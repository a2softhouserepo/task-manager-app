import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';
import { createBlindIndex } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'admin' && userRole !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem gerenciar usuários' },
        { status: 403 }
      );
    }

    await dbConnect();

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

const createUserSchema = z.object({
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').max(50, 'Username muito longo'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100, 'Senha muito longa'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['user', 'admin', 'rootAdmin']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'rootAdmin') {
      return NextResponse.json(
        { error: 'Apenas Root Admin pode criar usuários' },
        { status: 403 }
      );
    }

    await dbConnect();

    const body = await request.json();
    
    const validationResult = createUserSchema.safeParse(body);
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

    const { username, password, name, email, role } = validationResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username já existe' },
        { status: 400 }
      );
    }

    // Check if email already exists
    if (email) {
      const emailHash = createBlindIndex(email);
      const existingEmail = await User.findOne({ emailHash });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email já existe' },
          { status: 400 }
        );
      }
    }

    const user = await User.create({
      username,
      password,
      name,
      email: email || undefined,
      role: role || 'user',
    });

    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    await logAudit({
      action: 'CREATE',
      resource: 'USER',
      resourceId: user._id.toString(),
      details: createAuditSnapshot(userResponse),
    });

    return NextResponse.json({ user: userResponse }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
