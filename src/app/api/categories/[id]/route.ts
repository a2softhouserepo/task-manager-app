import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import Task from '@/models/Task';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Nome não pode estar vazio').max(100, 'Nome muito longo').optional(),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  icon: z.string().max(10, 'Ícone inválido').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hex válido').optional(),
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

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Error fetching category:', error);
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
    
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && category.createdBy !== currentUserId) {
      return NextResponse.json(
        { error: 'Você só pode editar categorias que você cadastrou' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const validationResult = updateCategorySchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors || [];
      const errorMessages = errors.length > 0
        ? errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')
        : 'Dados inválidos';
      return NextResponse.json(
        { error: `Erro de validação: ${errorMessages}`, details: errors },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Verifica se novo nome já existe
    if (updates.name && updates.name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return NextResponse.json(
          { error: 'Já existe uma categoria com este nome' },
          { status: 400 }
        );
      }
    }

    const originalCategory = createAuditSnapshot(category.toObject());

    Object.assign(category, updates);
    category.updatedAt = new Date();
    await category.save();

    await logAudit({
      action: 'UPDATE',
      resource: 'CATEGORY',
      resourceId: id,
      details: {
        before: originalCategory,
        after: createAuditSnapshot(category.toObject()),
        changes: Object.keys(updates),
      },
    });

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Error updating category:', error);
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
      return NextResponse.json(
        { error: 'Usuários não podem deletar registros' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    // Admin só pode deletar seus próprios registros
    if (userRole === 'admin' && category.createdBy !== currentUserId) {
      return NextResponse.json(
        { error: 'Você só pode deletar categorias que você cadastrou' },
        { status: 403 }
      );
    }

    // Verifica se existem tarefas usando esta categoria
    const tasksUsingCategory = await Task.countDocuments({ categoryId: id });
    if (tasksUsingCategory > 0) {
      return NextResponse.json(
        { error: `Não é possível deletar. Existem ${tasksUsingCategory} tarefa(s) usando esta categoria.` },
        { status: 400 }
      );
    }

    await logAudit({
      action: 'DELETE',
      resource: 'CATEGORY',
      resourceId: id,
      details: { deleted: createAuditSnapshot(category.toObject()) },
    });

    await Category.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Categoria deletada com sucesso' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
