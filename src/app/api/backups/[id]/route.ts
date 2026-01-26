import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Backup from '@/models/Backup';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/backups/[id] - Retorna detalhes de um backup específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    
    const backup = await Backup.findById(id).select('-data').lean();
    if (!backup) {
      return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ backup });
  } catch (error) {
    console.error('Erro ao buscar backup:', error);
    return NextResponse.json({ error: 'Erro ao buscar backup' }, { status: 500 });
  }
}

/**
 * DELETE /api/backups/[id] - Exclui um backup específico
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    
    const backup = await Backup.findById(id);
    if (!backup) {
      return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
    }

    await Backup.findByIdAndDelete(id);

    // Log da exclusão
    try {
      await logAudit({
        action: 'DELETE',
        resource: 'BACKUP',
        resourceId: id,
        userId: (session.user as any).id,
        details: { filename: backup.filename }
      });
    } catch (e) {
      console.error('Erro ao criar log de auditoria:', e);
    }

    return NextResponse.json({ success: true, message: 'Backup excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir backup:', error);
    return NextResponse.json({ error: 'Erro ao excluir backup' }, { status: 500 });
  }
}
