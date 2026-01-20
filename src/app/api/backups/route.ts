import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Backup from '@/models/Backup';
import { createBackup, clearAllData } from '@/lib/backup-service';

/**
 * GET /api/backups - Lista todos os backups (sem o campo data para não pesar)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode acessar backups.' }, { status: 403 });
    }

    await dbConnect();
    
    // Não retornamos o campo 'data' na listagem para não pesar a resposta
    const backups = await Backup.find({})
      .select('-data')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    return NextResponse.json({ error: 'Erro ao listar backups' }, { status: 500 });
  }
}

/**
 * POST /api/backups - Cria um novo backup manual
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode criar backups.' }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const backup = await createBackup(userId, 'MANUAL');

    // Remove o campo data pesado da resposta
    const { data, ...response } = backup.toObject();

    return NextResponse.json({ 
      success: true,
      backup: response,
      message: 'Backup criado com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    return NextResponse.json({ error: 'Erro ao criar backup' }, { status: 500 });
  }
}

/**
 * DELETE /api/backups - Limpa todos os dados das coleções (para teste)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode limpar dados.' }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const result = await clearAllData(userId);

    return NextResponse.json({ 
      success: true,
      ...result,
      message: 'Todos os dados foram removidos com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json({ error: 'Erro ao limpar dados' }, { status: 500 });
  }
}
