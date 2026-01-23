import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import { z } from 'zod';
import { logAudit, createAuditSnapshot, logAuthFailure } from '@/lib/audit';

const updateTaskSchema = z.object({
  requestDate: z.string().or(z.date()).optional(),
  clientId: z.string().min(1, 'Cliente não pode estar vazio').optional(),
  categoryId: z.string().min(1, 'Categoria não pode estar vazia').optional(),
  title: z.string().min(1, 'Título não pode estar vazio').max(200, 'Título muito longo').optional(),
  description: z.string().min(1, 'Descrição não pode estar vazia').max(5000, 'Descrição muito longa').optional(),
  deliveryDate: z.string().or(z.date()).nullable().optional(),
  cost: z.number().min(0, 'Custo não pode ser negativo').optional(),
  observations: z.string().max(2000, 'Observações muito longas').optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
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

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Error fetching task:', error);
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
    
    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && task.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TASK',
        resourceId: id,
        reason: 'Tentativa de editar tarefa de outro usuário',
        attemptedAction: 'UPDATE',
      });
      return NextResponse.json(
        { error: 'Você só pode editar tarefas que você cadastrou' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const validationResult = updateTaskSchema.safeParse(body);
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

    const updates: any = { ...validationResult.data };
    const originalTask = createAuditSnapshot(task.toObject());

    // Se clientId foi alterado, atualizar clientName
    if (updates.clientId && updates.clientId !== task.clientId) {
      const client = await Client.findById(updates.clientId);
      if (!client) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });
      }
      updates.clientName = client.name;
    }

    // Se categoryId foi alterado, atualizar categoryName
    if (updates.categoryId && updates.categoryId !== task.categoryId) {
      const category = await Category.findById(updates.categoryId);
      if (!category) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 });
      }
      updates.categoryName = category.name;
      updates.categoryIcon = category.icon;
      updates.categoryColor = category.color;
    }

    // Converter datas
    if (updates.requestDate) {
      updates.requestDate = new Date(updates.requestDate);
    }
    if (updates.deliveryDate) {
      updates.deliveryDate = new Date(updates.deliveryDate);
    } else if (updates.deliveryDate === null) {
      updates.deliveryDate = undefined;
    }

    Object.assign(task, updates);
    task.updatedAt = new Date();
    await task.save();

    await logAudit({
      action: 'UPDATE',
      resource: 'TASK',
      resourceId: id,
      details: {
        before: originalTask,
        after: createAuditSnapshot(task.toObject()),
        changes: Object.keys(updates),
      },
    });

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Error updating task:', error);
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
        resource: 'TASK',
        resourceId: 'unknown',
        reason: 'Usuário comum tentou deletar tarefa',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Usuários não podem deletar registros' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Admin só pode deletar seus próprios registros
    if (userRole === 'admin' && task.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TASK',
        resourceId: id,
        reason: 'Admin tentou deletar tarefa de outro usuário',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Você só pode deletar tarefas que você cadastrou' },
        { status: 403 }
      );
    }

    await logAudit({
      action: 'DELETE',
      resource: 'TASK',
      resourceId: id,
      details: { deleted: createAuditSnapshot(task.toObject()) },
    });

    await Task.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Tarefa deletada com sucesso' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
