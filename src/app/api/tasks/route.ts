import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import { z } from 'zod';
import { logAudit, createAuditSnapshot } from '@/lib/audit';
import { sendTaskToAsana } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month'); // formato: YYYY-MM
    
    const query: any = {};

    if (clientId) {
      query.clientId = clientId;
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (status) {
      query.status = status;
    }

    // Filtro por período
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) {
        query.requestDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.requestDate.$lte = end;
      }
    }

    // Filtro por mês (substitui o período se fornecido)
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
      query.requestDate = { $gte: start, $lte: end };
    }

    // Se não há filtros de data, usar mês atual como padrão
    if (!startDate && !endDate && !month) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      query.requestDate = { $gte: start, $lte: end };
    }

    const tasks = await Task.find(query).sort({ requestDate: -1 });

    // Calcular totais
    const total = tasks.reduce((sum, task) => sum + task.cost, 0);

    return NextResponse.json({ tasks, total, count: tasks.length });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

const createTaskSchema = z.object({
  requestDate: z.string().or(z.date()).optional(),
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  description: z.string().min(1, 'Descrição é obrigatória').max(5000, 'Descrição muito longa'),
  deliveryDate: z.string().or(z.date()).optional(),
  cost: z.number().min(0, 'Custo não pode ser negativo'),
  observations: z.string().max(2000, 'Observações muito longas').optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  sendToAsana: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    
    const validationResult = createTaskSchema.safeParse(body);
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

    const { 
      requestDate, 
      clientId, 
      categoryId, 
      title, 
      description, 
      deliveryDate, 
      cost, 
      observations, 
      status,
      sendToAsana 
    } = validationResult.data;

    // Buscar cliente e categoria para denormalização
    const [client, category] = await Promise.all([
      Client.findById(clientId),
      Category.findById(categoryId),
    ]);

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 });
    }

    const task = await Task.create({
      requestDate: requestDate ? new Date(requestDate) : new Date(),
      clientId,
      clientName: client.name,
      categoryId,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      title,
      description,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      cost,
      observations: observations || undefined,
      status: status || 'pending',
      asanaEmailSent: false,
      userId: (session.user as any).id,
      createdBy: (session.user as any).id,
    });

    // Enviar para Asana se solicitado
    if (sendToAsana !== false) {
      const asanaResult = await sendTaskToAsana({
        title,
        description,
        clientName: client.name,
        category: category.name,
        dueDate: deliveryDate ? new Date(deliveryDate) : undefined,
        cost,
      });

      if (asanaResult.success) {
        task.asanaEmailSent = true;
      } else {
        task.asanaEmailError = asanaResult.error;
      }
      await task.save();
    }

    await logAudit({
      action: 'CREATE',
      resource: 'TASK',
      resourceId: task._id.toString(),
      details: createAuditSnapshot(task.toObject()),
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
