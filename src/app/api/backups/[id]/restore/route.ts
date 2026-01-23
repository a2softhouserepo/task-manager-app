import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreBackup } from '@/lib/backup-service';
import { logAudit, logAuthFailure } from '@/lib/audit';

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
      // Log unauthorized restore attempt (critical security event)
      void logAuthFailure({
        resource: 'BACKUP',
        resourceId: 'unknown',
        reason: 'Tentativa de restaurar backup sem permissão de rootAdmin',
        attemptedAction: 'BACKUP_RESTORE',
      });
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode restaurar backups.' }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    
    // Log restore attempt BEFORE execution (in case it fails)
    void logAudit({
      action: 'BACKUP_RESTORE',
      resource: 'BACKUP',
      resourceId: id,
      details: {
        initiatedBy: session.user?.email,
        warning: 'Esta ação substituiu todos os dados do sistema',
      },
      severity: 'CRITICAL',
    });

    const result = await restoreBackup(id, userId);

    return NextResponse.json({ 
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
