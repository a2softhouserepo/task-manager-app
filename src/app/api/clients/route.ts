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
    const parentId = searchParams.get('parentId');
    const rootClientId = searchParams.get('rootClientId');
    const includeDescendants = searchParams.get('includeDescendants') === 'true';
    const tree = searchParams.get('tree') === 'true';
    
    const query: any = {};
    if (active !== null) {
      query.active = active === 'true';
    }
    
    // Filtro por cliente pai
    if (parentId !== null) {
      if (parentId === 'null' || parentId === '') {
        query.parentId = null; // Apenas clientes raiz
      } else {
        if (includeDescendants) {
          // Cliente + todos os descendentes
          query.$or = [
            { _id: parentId },
            { path: parentId }
          ];
        } else {
          query.parentId = parentId; // Apenas filhos diretos
        }
      }
    }
    
    // Filtro por cliente raiz (toda a árvore)
    if (rootClientId) {
      query.$or = [
        { _id: rootClientId },
        { rootClientId: rootClientId }
      ];
    }

    const clients = await Client.find(query).sort({ depth: 1, name: 1 });

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
        // Campos de hierarquia
        parentId: obj.parentId || null,
        path: obj.path || [],
        depth: obj.depth || 0,
        rootClientId: obj.rootClientId || null,
        childrenCount: obj.childrenCount || 0,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
      };
    });

    // Se solicitou estrutura em árvore
    if (tree) {
      const clientTree = buildClientTree(clientsPlain);
      return NextResponse.json({ clients: clientTree });
    }

    return NextResponse.json({ clients: clientsPlain });
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função auxiliar para construir árvore de clientes
function buildClientTree(clients: any[]): any[] {
  const clientMap = new Map<string, any>();
  const roots: any[] = [];

  // Primeiro, mapear todos os clientes
  clients.forEach(client => {
    clientMap.set(client._id, { ...client, children: [] });
  });

  // Depois, construir a árvore
  clients.forEach(client => {
    const node = clientMap.get(client._id);
    if (client.parentId && clientMap.has(client.parentId)) {
      const parent = clientMap.get(client.parentId);
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

const createClientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  parentId: z.string().nullable().optional(), // ID do cliente pai
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

    const { name, parentId, phone, address, email, notes, active } = validationResult.data;

    // Calcular campos de hierarquia
    let path: string[] = [];
    let depth = 0;
    let rootClientId: string | null = null;

    if (parentId) {
      const parentClient = await Client.findById(parentId);
      if (!parentClient) {
        return NextResponse.json({ error: 'Cliente pai não encontrado' }, { status: 400 });
      }
      
      // Construir path: path do pai + id do pai
      path = [...(parentClient.path || []), parentId];
      depth = (parentClient.depth || 0) + 1;
      // rootClientId é o primeiro da árvore (ou o pai se pai é raiz)
      rootClientId = parentClient.rootClientId || parentId;
    }

    // Trim all string fields before saving
    const trimmedData = {
      name: name.trim(),
      parentId: parentId || null,
      path,
      depth,
      rootClientId,
      childrenCount: 0,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      email: email?.trim() || undefined,
      notes: notes?.trim() || undefined,
      active,
      createdBy: (session.user as any).id,
    };

    const client = await Client.create(trimmedData);

    // Incrementar childrenCount do pai
    if (parentId) {
      await Client.findByIdAndUpdate(parentId, { $inc: { childrenCount: 1 } });
    }

    await logAudit({
      action: 'CREATE',
      resource: 'CLIENT',
      resourceId: client._id.toString(),
      details: createAuditSnapshot({ ...client.toObject(), parentId }),
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
      parentId: clientObj.parentId || null,
      path: clientObj.path || [],
      depth: clientObj.depth || 0,
      rootClientId: clientObj.rootClientId || null,
      childrenCount: clientObj.childrenCount || 0,
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
