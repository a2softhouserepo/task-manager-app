import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';

/**
 * GET /api/team-members/stats - Estatísticas de distribuição de custo por membro da equipe
 * 
 * Retorna totais por membro para o mês atual e geral (all-time)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const [aggregatedStats] = await Task.aggregate([
      {
        // Filtrar apenas tarefas que possuem costDistribution
        $match: {
          'costDistribution.0': { $exists: true }
        }
      },
      {
        $facet: {
          // Totais por membro no mês atual
          currentMonth: [
            {
              $match: {
                requestDate: { $gte: startOfMonth, $lte: endOfMonth }
              }
            },
            { $unwind: '$costDistribution' },
            {
              $group: {
                _id: '$costDistribution.teamMemberId',
                teamMemberName: { $first: '$costDistribution.teamMemberName' },
                total: { $sum: '$costDistribution.value' },
                count: { $sum: 1 },
              }
            },
            { $sort: { total: -1 } }
          ],
          // Totais por membro geral (all-time)
          allTime: [
            { $unwind: '$costDistribution' },
            {
              $group: {
                _id: '$costDistribution.teamMemberId',
                teamMemberName: { $first: '$costDistribution.teamMemberName' },
                total: { $sum: '$costDistribution.value' },
                count: { $sum: 1 },
              }
            },
            { $sort: { total: -1 } }
          ],
        }
      }
    ]);

    return NextResponse.json({
      currentMonth: aggregatedStats?.currentMonth || [],
      allTime: aggregatedStats?.allTime || [],
    });
  } catch (error: any) {
    console.error('Error fetching team member stats:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
