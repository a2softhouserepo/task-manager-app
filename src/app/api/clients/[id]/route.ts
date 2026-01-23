import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Client from '@/models/Client';
import { z } from 'zod';
import { logAudit, createAuditSnapshot, logAuthFailure, logSensitiveRead } from '@/lib/audit';
import { decryptString, isEncrypted } from '@/lib/crypto';

// Helper function to decrypt client fields if needed
function decryptClientFields(clientObj: any) {
  const fields = ['name', 'phone', 'email', 'address', 'notes'];
  for (const field of fields) {
    if (clientObj[field] && isEncrypted(clientObj[field] as string)) {
      try {
        clientObj[field] = decryptString(clientObj[field]);
      } catch (error) {
        console.error(`[API] Failed to decrypt field ${field}:`, error);
        // Keep original value if decryption fails
      }
    }
  }
  return clientObj;
}

const updateClientSchema = z.object({
  name: z.string().min(1, 'Nome não pode estar vazio').max(200, 'Nome muito longo').optional(),
  phone: z.string().max(20, 'Telefone muito longo').optional(),
  address: z.string().max(500, 'Endereço muito longo').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Observações muito longas').optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Convert to plain object (already decrypted by plugin)
    const clientObj = client.toObject();
    const clientPlain = {
      _id: clientObj._id.toString(),
      name: clientObj.name,
      phone: clientObj.phone,
      email: clientObj.email,
      address: clientObj.address,
      notes: clientObj.notes,
      active: clientObj.active,
      createdAt: clientObj.createdAt,
      updatedAt: clientObj.updatedAt,
    };

    // Log sensitive data access (GDPR compliance)
    void logSensitiveRead({
      resource: 'CLIENT',
      resourceId: id,
      details: {
        clientName: clientPlain.name,
        accessedFields: ['name', 'phone', 'email', 'address', 'notes'],
      },
    });

    return NextResponse.json({ client: clientPlain });
  } catch (error: any) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;
    const { id } = await params;

    await dbConnect();
    
    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && client.createdBy !== currentUserId) {
      // Log authorization failure for security monitoring
      void logAuthFailure({
        resource: 'CLIENT',
        resourceId: id,
        reason: 'Tentativa de editar cliente de outro usuário',
        attemptedAction: 'UPDATE',
      });
      return NextResponse.json(
        { error: 'Você só pode editar clientes que você cadastrou' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const validationResult = updateClientSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues || [];
      const errorMessages = errors.length > 0
        ? errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')
        : 'Dados inválidos';
      return NextResponse.json(
        { error: `Erro de validação: ${errorMessages}`, details: errors },
        { status: 400 }
      );
    }

    const updates = validationResult.data;
    const originalClient = createAuditSnapshot(client.toObject());

    // Trim string fields before updating
    const trimmedUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string') {
        trimmedUpdates[key] = value.trim();
      } else {
        trimmedUpdates[key] = value;
      }
    }

    Object.assign(client, trimmedUpdates);
    client.updatedAt = new Date();
    await client.save();

    await logAudit({
      action: 'UPDATE',
      resource: 'CLIENT',
      resourceId: id,
      details: {
        before: originalClient,
        after: createAuditSnapshot(client.toObject()),
        changes: Object.keys(updates),
      },
    });

    // Re-fetch to trigger post-init hooks for decryption
    const updatedClient = await Client.findById(id);
    
    if (!updatedClient) {
      return NextResponse.json({ error: 'Cliente atualizado mas não encontrado' }, { status: 500 });
    }

    // Convert to plain object (already decrypted by plugin)
    const clientObj = updatedClient.toObject();
    const clientPlain = {
      _id: clientObj._id.toString(),
      name: clientObj.name,
      phone: clientObj.phone,
      email: clientObj.email,
      address: clientObj.address,
      notes: clientObj.notes,
      active: clientObj.active,
      createdAt: clientObj.createdAt,
      updatedAt: clientObj.updatedAt,
    };

    return NextResponse.json({ client: clientPlain });
  } catch (error: any) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;

    // User não pode deletar
    if (userRole === 'user') {
      void logAuthFailure({
        resource: 'CLIENT',
        resourceId: 'unknown',
        reason: 'Usuário comum tentou deletar cliente',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Usuários não podem deletar registros' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Admin só pode deletar seus próprios registros
    if (userRole === 'admin' && client.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'CLIENT',
        resourceId: id,
        reason: 'Admin tentou deletar cliente de outro usuário',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Você só pode deletar clientes que você cadastrou' },
        { status: 403 }
      );
    }

    await logAudit({
      action: 'DELETE',
      resource: 'CLIENT',
      resourceId: id,
      details: { deleted: createAuditSnapshot(client.toObject()) },
    });

    await Client.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Cliente deletado com sucesso' });
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
