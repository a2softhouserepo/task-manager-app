import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Backup from '@/models/Backup';

/**
 * GET /api/backups/[id]/download - Faz download dos dados do backup como JSON
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
    
    const backup = await Backup.findById(id).lean();
    if (!backup) {
      return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
    }

    // Retorna o JSON do backup para download
    return new NextResponse(backup.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao baixar backup:', error);
    return NextResponse.json({ error: 'Erro ao baixar backup' }, { status: 500 });
  }
}
