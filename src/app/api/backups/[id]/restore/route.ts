import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreBackup } from '@/lib/backup-service';

/**
 * POST /api/backups/[id]/restore - Restaura um backup específico
 * ATENÇÃO: Esta ação substitui TODOS os dados atuais pelos dados do backup!
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode restaurar backups.' }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    
    const result = await restoreBackup(id, userId);

    return NextResponse.json({ 
      success: true,
      ...result,
      message: 'Backup restaurado com sucesso!' 
    });
  } catch (error: any) {
    console.error('Erro ao restaurar backup:', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao restaurar backup' 
    }, { status: 500 });
  }
}
