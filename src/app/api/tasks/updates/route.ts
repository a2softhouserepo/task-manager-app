/**
 * Task Updates Polling Endpoint
 * 
 * Endpoint leve para verificar se houve atualizações nas tasks.
 * Retorna apenas o timestamp da última atualização para minimizar transferência de dados.
 * 
 * O frontend faz polling neste endpoint e, se houver mudanças, recarrega os dados completos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';

// Cache do último timestamp conhecido (por simplicidade, em memória)
// Em produção com múltiplas instâncias, usar Redis
let lastKnownUpdate: Date | null = null;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();

    // Buscar a task mais recentemente atualizada
    const latestTask = await Task.findOne()
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();

    const latestUpdate = latestTask?.updatedAt || null;
    
    // Verificar se o cliente enviou o timestamp que conhece
    const clientTimestamp = request.nextUrl.searchParams.get('since');
    
    let hasUpdates = false;
    if (clientTimestamp && latestUpdate) {
      const clientDate = new Date(clientTimestamp);
      hasUpdates = latestUpdate > clientDate;
    }

    return NextResponse.json({
      lastUpdate: latestUpdate?.toISOString() || null,
      hasUpdates,
    });
  } catch (error: any) {
    console.error('[TASKS/UPDATES] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
