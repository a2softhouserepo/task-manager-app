import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    // Estatísticas gerais
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Total do mês atual
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    
    const currentMonthTasks = await Task.find({
      requestDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const currentMonthTotal = currentMonthTasks.reduce((sum, t) => sum + t.cost, 0);
    const currentMonthCount = currentMonthTasks.length;

    // Dados mensais dos últimos 12 meses
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const tasks = await Task.find({
        requestDate: { $gte: start, $lte: end }
      });
      
      const total = tasks.reduce((sum, t) => sum + t.cost, 0);
      
      monthlyData.push({
        month: start.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        total,
        count: tasks.length,
      });
    }

    // Top 5 clientes por valor
    const clientStats = await Task.aggregate([
      {
        $group: {
          _id: '$clientId',
          clientName: { $first: '$clientName' },
          total: { $sum: '$cost' },
          count: { $sum: 1 },
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    // Top 5 categorias por valor
    const categoryStats = await Task.aggregate([
      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$categoryName' },
          total: { $sum: '$cost' },
          count: { $sum: 1 },
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    // Status das tarefas do mês atual
    const statusStats = await Task.aggregate([
      {
        $match: {
          requestDate: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$cost' },
        }
      }
    ]);

    // Total geral (todas as tarefas)
    const allTimeTasks = await Task.find({});
    const allTimeTotal = allTimeTasks.reduce((sum, t) => sum + t.cost, 0);

    return NextResponse.json({
      currentMonth: {
        total: currentMonthTotal,
        count: currentMonthCount,
      },
      allTime: {
        total: allTimeTotal,
        count: allTimeTasks.length,
      },
      monthlyData,
      clientStats,
      categoryStats,
      statusStats,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
