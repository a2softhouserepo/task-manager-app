import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import User from '@/models/User';
import Backup from '@/models/Backup';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/backups/upload - Faz upload de um arquivo de backup JSON
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Não autorizado. Apenas rootAdmin pode fazer upload de backups.' }, { status: 403 });
    }

    const body = await request.json();
    const { data, filename } = body;

    if (!data) {
      return NextResponse.json({ error: 'Dados do backup são obrigatórios' }, { status: 400 });
    }

    let backupContent;
    try {
      backupContent = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return NextResponse.json({ error: 'Formato de backup inválido. O arquivo deve ser um JSON válido.' }, { status: 400 });
    }

    // Validar estrutura do backup
    if (!backupContent.collections) {
      return NextResponse.json({ error: 'Estrutura de backup inválida. Campo "collections" não encontrado.' }, { status: 400 });
    }

    const { tasks, clients, categories, users } = backupContent.collections;

    await dbConnect();

    const stats = {
      tasks: tasks?.length || 0,
      clients: clients?.length || 0,
      categories: categories?.length || 0,
      users: users?.length || 0,
    };

    const jsonString = JSON.stringify(backupContent);
    const size = Buffer.byteLength(jsonString, 'utf8');
    
    // Nome do arquivo
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const finalFilename = filename || `backup-upload-${dateStr}_${timeStr}.json`;

    // Salvar o backup na coleção
    const backup = await Backup.create({
      filename: finalFilename,
      data: jsonString,
      size,
      type: 'MANUAL',
      createdBy: (session.user as any).id,
      stats,
    });

    // Log da ação
    try {
      await logAudit({
        action: 'CREATE',
        resource: 'BACKUP' as any,
        resourceId: backup._id.toString(),
        userId: (session.user as any).id,
        details: { 
          action: 'UPLOAD',
          filename: finalFilename, 
          size, 
          stats,
          originalTimestamp: backupContent.timestamp
        }
      });
    } catch (e) {
      console.error('Erro ao criar log de auditoria:', e);
    }

    // Remove o campo data pesado da resposta
    const { data: _, ...response } = backup.toObject();

    return NextResponse.json({ 
      success: true,
      backup: response,
      message: 'Backup enviado e salvo com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao fazer upload do backup:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload do backup' }, { status: 500 });
  }
}
