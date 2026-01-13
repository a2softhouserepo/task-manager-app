import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Client from '@/models/Client';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    
    const query: any = {};
    if (active !== null) {
      query.active = active === 'true';
    }

    const clients = await Client.find(query).sort({ name: 1 });

    // Convert Mongoose documents to plain objects (already decrypted by plugin)
    const clientsPlain = clients.map(client => {
      const obj = client.toObject();
      
      // Debug: Check if still encrypted
      if (process.env.NODE_ENV === 'development') {
        const fieldsToCheck = ['name', 'phone', 'email', 'address', 'notes'];
        for (const field of fieldsToCheck) {
          if ((obj as any)[field] && isEncrypted((obj as any)[field] as string)) {
            console.warn(`[API] Field "${field}" is still encrypted for client ${obj._id}`);
          }
        }
      }
      
      // Plugin already handled decryption, just convert to plain object
      return {
        _id: obj._id.toString(),
        name: obj.name,
        phone: obj.phone,
        email: obj.email,
        address: obj.address,
        notes: obj.notes,
        active: obj.active,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
      };
    });

    return NextResponse.json({ clients: clientsPlain });
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

const createClientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  phone: z.string().max(20, 'Telefone muito longo').optional(),
  address: z.string().max(500, 'Endereço muito longo').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Observações muito longas').optional(),
  active: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    
    const validationResult = createClientSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues || [];
      const errorMessages = errors.length > 0
        ? errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join('; ')
        : 'Dados inválidos';
      return NextResponse.json(
        { error: `Erro de validação: ${errorMessages}`, details: errors },
        { status: 400 }
      );
    }

    const { name, phone, address, email, notes, active } = validationResult.data;

    // Trim all string fields before saving
    const trimmedData = {
      name: name.trim(),
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      email: email?.trim() || undefined,
      notes: notes?.trim() || undefined,
      active,
      createdBy: (session.user as any).id,
    };

    const client = await Client.create(trimmedData);

    await logAudit({
      action: 'CREATE',
      resource: 'CLIENT',
      resourceId: client._id.toString(),
      details: createAuditSnapshot(client.toObject()),
    });

    // Re-fetch to trigger post-init hooks for decryption
    const createdClient = await Client.findById(client._id);
    
    if (!createdClient) {
      return NextResponse.json({ error: 'Cliente criado mas não encontrado' }, { status: 500 });
    }

    // Convert to plain object (already decrypted by plugin)
    const clientObj = createdClient.toObject();
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

    return NextResponse.json({ client: clientPlain }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
