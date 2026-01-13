import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';

const updateUserSchema = z.object({
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').max(50, 'Username muito longo').optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100, 'Senha muito longa').optional(),
  name: z.string().min(1, 'Nome não pode estar vazio').max(100, 'Nome muito longo').optional(),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['user', 'admin', 'rootAdmin']).optional(),
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

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error fetching user:', error);
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

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && currentUserId !== id) {
      return NextResponse.json(
        { error: 'Você só pode editar seu próprio perfil' },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await request.json();
    
    const validationResult = updateUserSchema.safeParse(body);
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

    // Não permite alterar role se não for rootAdmin
    if (updates.role && userRole !== 'rootAdmin') {
      delete updates.role;
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const originalUser = createAuditSnapshot(user.toObject());

    Object.assign(user, updates);
    await user.save();

    const userResponse = user.toObject();
    delete (userResponse as any).password;

    await logAudit({
      action: 'UPDATE',
      resource: 'USER',
      resourceId: id,
      details: {
        before: originalUser,
        after: createAuditSnapshot(userResponse),
        changes: Object.keys(updates),
      },
    });

    return NextResponse.json({ user: userResponse });
  } catch (error: any) {
    console.error('Error updating user:', error);
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

    if (userRole !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Apenas Root Admin pode deletar usuários' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    if (id === currentUserId) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 400 }
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    await logAudit({
      action: 'DELETE',
      resource: 'USER',
      resourceId: id,
      details: { deleted: createAuditSnapshot(user.toObject()) },
    });

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Usuário deletado com sucesso' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
