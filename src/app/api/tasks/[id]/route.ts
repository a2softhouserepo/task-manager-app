import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import { z } from 'zod';
import { logAudit, createAuditSnapshot, logAuthFailure } from '@/lib/audit';
import { syncTaskToAsana, isAsanaConfigured, deleteAsanaTask, uploadAsanaAttachments, AsanaAttachmentData } from '@/lib/asana';
import { getConfig } from '@/models/SystemConfig';

const updateTaskSchema = z.object({
  requestDate: z.string().or(z.date()).optional(),
  clientId: z.string().min(1, 'Cliente não pode estar vazio').optional(),
  categoryId: z.string().min(1, 'Categoria não pode estar vazia').optional(),
  title: z.string().min(1, 'Título não pode estar vazio').max(200, 'Título muito longo').optional(),
  description: z.string().min(1, 'Descrição não pode estar vazia').max(5000, 'Descrição muito longa').optional(),
  deliveryDate: z.string().or(z.date()).nullable().optional(),
  cost: z.number().min(0, 'Custo não pode ser negativo').optional(),
  observations: z.string().max(2000, 'Observações muito longas').nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'qa', 'completed', 'cancelled']).optional(),
  sendToAsana: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;
    const { id } = await params;

    await dbConnect();
    
    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // RootAdmin pode editar todos, outros só podem editar seus próprios registros
    if (userRole !== 'rootAdmin' && task.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TASK',
        resourceId: id,
        reason: 'Tentativa de editar tarefa de outro usuário',
        attemptedAction: 'UPDATE',
      });
      return NextResponse.json(
        { error: 'Você só pode editar tarefas que você cadastrou' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    // Verifica se é multipart/form-data (com arquivos)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      
      // Extrai os campos do formulário
      body = {
        requestDate: formData.get('requestDate') || undefined,
        clientId: formData.get('clientId') || undefined,
        categoryId: formData.get('categoryId') || undefined,
        title: formData.get('title') || undefined,
        description: formData.get('description') || undefined,
        deliveryDate: formData.get('deliveryDate') || undefined,
        cost: formData.has('cost') ? parseFloat(formData.get('cost') as string) : undefined,
        observations: formData.get('observations') || undefined,
        status: formData.get('status') || undefined,
        sendToAsana: formData.get('sendToAsana') === 'true',
      };
      
      // Remove campos undefined
      Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);

      // Buscar configurações de limite de arquivos
      const allowedTypes = await getConfig<string[]>('asana_allowed_file_types', ['.zip']);
      const maxSizeMB = await getConfig<number>('asana_max_file_size_mb', 10);
      const maxFiles = await getConfig<number>('asana_max_files_per_task', 5);
      const maxSize = maxSizeMB * 1024 * 1024;
      
      // Extrai e valida os arquivos
      const files = formData.getAll('attachments');
      
      if (files.length > maxFiles) {
        return NextResponse.json(
          { error: `Máximo de ${maxFiles} arquivos permitidos` },
          { status: 400 }
        );
      }
      
      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          // Validar tamanho
          if (file.size > maxSize) {
            return NextResponse.json(
              { error: `Arquivo ${file.name} excede o limite de ${maxSizeMB}MB` },
              { status: 400 }
            );
          }
          
          // Validar tipo de arquivo (extensão)
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
          if (allowedTypes.length > 0 && !allowedTypes.includes(fileExtension)) {
            return NextResponse.json(
              { error: `Tipo de arquivo não permitido: ${file.name}. Permitidos: ${allowedTypes.join(', ')}` },
              { status: 400 }
            );
          }
          
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          attachments.push({
            filename: file.name,
            content: buffer,
            contentType: file.type || 'application/octet-stream',
          });
        }
      }
    } else {
      // JSON normal
      body = await request.json();
    }
    
    const validationResult = updateTaskSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues || [];
      const errorMessages = errors.length > 0
        ? errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')
        : 'Dados inválidos';
      return NextResponse.json(
        { error: `Erro de validação: ${errorMessages}`, details: errors },
        { status: 400 }
      );
    }

    const updates: any = { ...validationResult.data };
    const originalTask = createAuditSnapshot(task.toObject());

    // Se clientId foi alterado, atualizar clientName
    if (updates.clientId && updates.clientId !== task.clientId) {
      const client = await Client.findById(updates.clientId);
      if (!client) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });
      }
      updates.clientName = client.name;
    }

    // Se categoryId foi alterado, atualizar categoryName
    if (updates.categoryId && updates.categoryId !== task.categoryId) {
      const category = await Category.findById(updates.categoryId);
      if (!category) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 });
      }
      updates.categoryName = category.name;
      updates.categoryIcon = category.icon;
      updates.categoryColor = category.color;
    }

    // Converter datas
    if (updates.requestDate) {
      updates.requestDate = new Date(updates.requestDate);
    }
    if (updates.deliveryDate) {
      updates.deliveryDate = new Date(updates.deliveryDate);
    } else if (updates.deliveryDate === null) {
      updates.deliveryDate = undefined;
    }

    Object.assign(task, updates);
    task.updatedAt = new Date();
    
    // Check if this update came from a webhook (to prevent sync loops)
    const fromWebhook = (task as any)._fromWebhook === true;
    if (fromWebhook) {
      delete (task as any)._fromWebhook;
    }
    
    // Capture plain text values BEFORE saving (save will encrypt them)
    const plainTitle = task.title;
    const plainDescription = task.description;
    const plainRequestDate = task.requestDate;
    
    // Campos sincronizáveis com Asana: title, description, deliveryDate, status, requestDate
    // Verifica se algum campo sincronizável foi alterado
    const ASANA_SYNCABLE_FIELDS = ['title', 'description', 'deliveryDate', 'status', 'requestDate'];
    const changedFields = Object.keys(updates);
    const hasAsanaSyncableChanges = changedFields.some(field => ASANA_SYNCABLE_FIELDS.includes(field));
    
    await task.save();

    // Sync to Asana if requested and configured (skip if update came from webhook)
    // OTIMIZAÇÃO: Só sincroniza se houver mudanças em campos sincronizáveis
    // Also sync if task is already synced (has asanaTaskGid), regardless of sendToAsana flag
    let attachmentErrors: string[] = [];
    const shouldSync = (validationResult.data.sendToAsana || !!task.asanaTaskGid) && isAsanaConfigured() && !fromWebhook;
    
    if (shouldSync) {
      // Verifica se há mudanças em campos que sincronizam com Asana
      if (!hasAsanaSyncableChanges && attachments.length === 0) {
        console.log('[ASANA] Skipping sync - no syncable fields changed (cost, clientId, categoryId, observations only)');
      } else {
        // Get current client and category names
        const currentClient = await Client.findById(task.clientId);
        const currentCategory = await Category.findById(task.categoryId);
        
        const clientName = currentClient?.name || task.clientName || 'Cliente não especificado';
        const categoryName = currentCategory?.name || task.categoryName || 'Categoria não especificada';
        
        // Use existing Asana task GID if available (update), otherwise create new
        // Use plain text values captured before save (not encrypted ones)
        const asanaResult = await syncTaskToAsana({
          title: plainTitle,
          description: plainDescription,
          clientName,
          category: categoryName,
          dueDate: task.deliveryDate ? new Date(task.deliveryDate) : undefined,
          startDate: plainRequestDate ? new Date(plainRequestDate) : undefined,
          cost: task.cost,
          status: task.status,
        }, task.asanaTaskGid);

      if (asanaResult.success) {
        task.asanaSynced = true;
        task.asanaTaskGid = asanaResult.taskGid;
        task.asanaSyncError = undefined;
        
        // Upload attachments if we have a task GID and attachments
        if (asanaResult.taskGid && attachments.length > 0) {
          console.log(`[ASANA] Uploading ${attachments.length} attachment(s) to task ${asanaResult.taskGid}...`);
          
          const uploadResults = await uploadAsanaAttachments(
            asanaResult.taskGid,
            attachments as AsanaAttachmentData[]
          );
          
          if (uploadResults.hasErrors) {
            attachmentErrors = uploadResults.failed.map(
              (f) => `${f.filename}: ${f.error}`
            );
            console.warn('[ASANA] Some attachments failed to upload:', attachmentErrors);
          }
          
          if (uploadResults.successful.length > 0) {
            console.log(`[ASANA] Successfully uploaded ${uploadResults.successful.length} attachment(s)`);
          }
        }
        } else {
          task.asanaSyncError = asanaResult.error;
        }
        await task.save();
      }
    }

    await logAudit({
      action: 'UPDATE',
      resource: 'TASK',
      resourceId: id,
      details: {
        before: originalTask,
        after: createAuditSnapshot(task.toObject()),
        changes: Object.keys(updates),
      },
    });

    // Retornar resposta com informações de erros de anexos se houver
    const response: any = { task };
    
    if (attachmentErrors.length > 0) {
      response.attachmentErrors = attachmentErrors;
      response.warning = `Tarefa atualizada, mas ${attachmentErrors.length} anexo(s) falharam ao enviar para o Asana`;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const currentUserId = (session.user as any).id;

    // User não pode deletar
    if (userRole === 'user') {
      void logAuthFailure({
        resource: 'TASK',
        resourceId: 'unknown',
        reason: 'Usuário comum tentou deletar tarefa',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Usuários não podem deletar registros' },
        { status: 403 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Admin só pode deletar seus próprios registros
    if (userRole === 'admin' && task.createdBy !== currentUserId) {
      void logAuthFailure({
        resource: 'TASK',
        resourceId: id,
        reason: 'Admin tentou deletar tarefa de outro usuário',
        attemptedAction: 'DELETE',
      });
      return NextResponse.json(
        { error: 'Você só pode deletar tarefas que você cadastrou' },
        { status: 403 }
      );
    }

    await logAudit({
      action: 'DELETE',
      resource: 'TASK',
      resourceId: id,
      details: { deleted: createAuditSnapshot(task.toObject()) },
    });

    // Mark as completed in Asana if synced
    if (task.asanaTaskGid && isAsanaConfigured()) {
      await deleteAsanaTask(task.asanaTaskGid);
    }

    await Task.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Tarefa deletada com sucesso' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
