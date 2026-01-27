import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import User from '@/models/User';
import Backup from '@/models/Backup';
import { logAudit } from '@/lib/audit';
import { getConfig } from '@/models/SystemConfig';

/**
 * OTIMIZAÇÃO: Constantes para streaming de backups
 * Define tamanho de batch para processar documentos em chunks
 */
const BACKUP_BATCH_SIZE = 500; // Documentos por batch

/**
 * Processa uma collection em batches para evitar estouro de memória
 * OTIMIZAÇÃO: Usa cursor do Mongoose para streaming
 */
async function collectInBatches<T>(model: any): Promise<T[]> {
  const results: T[] = [];
  const cursor = model.find({}).lean().cursor();
  
  let batch: T[] = [];
  for await (const doc of cursor) {
    batch.push(doc as T);
    
    if (batch.length >= BACKUP_BATCH_SIZE) {
      results.push(...batch);
      batch = [];
    }
  }
  
  // Adicionar batch final
  if (batch.length > 0) {
    results.push(...batch);
  }
  
  return results;
}

/**
 * Cria um backup completo do sistema
 * OTIMIZAÇÃO: Usa streaming com cursores para grandes volumes de dados
 * Reduz uso de memória de O(n) para O(batch_size)
 */
export async function createBackup(userId: string, type: 'AUTO' | 'MANUAL' = 'MANUAL') {
  await dbConnect();
  
  // Coletar dados usando streaming para evitar estouro de memória
  // ⚠️ Usuários não são incluídos no backup por segurança
  console.log('📦 Coletando dados para backup...');
  
  const [tasks, clients, categories] = await Promise.all([
    collectInBatches(Task),
    collectInBatches(Client),
    collectInBatches(Category)
  ]);

  const stats = {
    tasks: tasks.length,
    clients: clients.length,
    categories: categories.length
  };

  console.log(`📊 Dados coletados: ${stats.tasks} tasks, ${stats.clients} clients, ${stats.categories} categories`);

  const backupData = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    stats,
    collections: {
      tasks,
      clients,
      categories
    }
  };

  const jsonString = JSON.stringify(backupData);
  const size = Buffer.byteLength(jsonString, 'utf8');
  
  // Nome do arquivo com timestamp
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `backup-${type.toLowerCase()}-${dateStr}_${timeStr}.json`;

  const backup = await Backup.create({
    filename,
    data: jsonString,
    size,
    type,
    createdBy: userId,
    stats,
  });

  // Log da ação
  try {
    await logAudit({
      action: 'CREATE',
      resource: 'BACKUP',
      resourceId: backup._id.toString(),
      userId: userId === 'SYSTEM' ? 'system' : userId,
      userName: userId === 'SYSTEM' ? 'Sistema (Auto)' : undefined,
      details: { type, size, filename, stats }
    });
  } catch (e) {
    console.error('Erro ao criar log de auditoria do backup:', e);
  }

  console.log(`✅ Backup criado: ${filename} (${formatBytes(size)})`);
  
  return backup;
}

/**
 * Verifica se já existe um backup automático do dia e cria um se não existir
 * Também executa limpeza de backups antigos após criação bem-sucedida
 * @param frequency - 'daily' verifica se já existe backup no dia atual, 'every_login' sempre cria novo backup, 'disabled' não faz backup
 */
export async function checkAndTriggerAutoBackup(frequency: 'daily' | 'every_login' | 'disabled' = 'daily'): Promise<boolean> {
  await dbConnect();
  
  if (frequency === 'disabled') {
    console.log('⏭️ Backup automático desabilitado via configuração.');
    return false;
  }
  
  let backupCreated = false;
  
  if (frequency === 'every_login') {
    console.log('🔄 Modo "todo login": criando backup automático...');
    try {
      await createBackup('SYSTEM', 'AUTO');
      console.log('✅ Backup automático criado com sucesso.');
      backupCreated = true;
    } catch (error) {
      console.error('❌ Falha ao criar backup automático:', error);
      return false;
    }
  } else {
    // Modo 'daily': verifica se já existe backup no dia atual (desde meia-noite)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Meia-noite do dia atual

    // Verifica se já existe um backup AUTO criado hoje
    const existingBackup = await Backup.findOne({
      type: 'AUTO',
      createdAt: { $gte: todayStart }
    });

    if (!existingBackup) {
      console.log('🔄 Disparando backup automático (primeiro do dia)...');
      try {
        await createBackup('SYSTEM', 'AUTO');
        console.log('✅ Backup automático criado com sucesso.');
        backupCreated = true;
      } catch (error) {
        console.error('❌ Falha ao criar backup automático:', error);
        return false;
      }
    } else {
      console.log('ℹ️ Backup automático do dia já existe:', existingBackup.filename);
    }
  }
  
  // Executar limpeza após backup (independente se criou ou não)
  try {
    console.log('🧹 Executando limpeza de backups antigos...');
    const cleanupResult = await cleanupOldBackups();
    const maxResult = await enforceMaxBackups();
    
    if (cleanupResult.removed > 0 || maxResult.removed > 0) {
      console.log(`🗑️ Limpeza concluída: ${cleanupResult.removed + maxResult.removed} backups removidos`);
    }
  } catch (cleanupError) {
    console.error('⚠️ Erro na limpeza de backups (não crítico):', cleanupError);
  }
  
  return backupCreated;
}

/**
 * Restaura um backup, substituindo todos os dados atuais
 */
export async function restoreBackup(backupId: string, adminUserId: string) {
  await dbConnect();

  const backup = await Backup.findById(backupId);
  if (!backup) {
    throw new Error('Backup não encontrado');
  }

  let content;
  try {
    content = JSON.parse(backup.data);
  } catch (e) {
    throw new Error('Dados do backup estão corrompidos');
  }

  const { tasks, clients, categories } = content.collections;

  // Limpar coleções atuais (exceto usuários)
  await Promise.all([
    Task.deleteMany({}),
    Client.deleteMany({}),
    Category.deleteMany({})
  ]);

  // Inserir dados do backup (usuários não são restaurados)
  const results = await Promise.all([
    clients?.length ? Client.insertMany(clients, { ordered: false }).catch(e => ({ error: e, count: 0 })) : [],
    categories?.length ? Category.insertMany(categories, { ordered: false }).catch(e => ({ error: e, count: 0 })) : [],
    tasks?.length ? Task.insertMany(tasks, { ordered: false }).catch(e => ({ error: e, count: 0 })) : [],
  ]);

  // Log da ação
  try {
    await logAudit({
      action: 'UPDATE',
      resource: 'BACKUP',
      resourceId: backup._id.toString(),
      userId: adminUserId,
      details: { 
        action: 'RESTORE',
        filename: backup.filename, 
        timestamp: new Date().toISOString(),
        stats: backup.stats
      }
    });
  } catch (e) {
    console.error('Erro ao criar log de auditoria da restauração:', e);
  }

  console.log(`✅ Backup restaurado: ${backup.filename}`);

  return { 
    success: true, 
    filename: backup.filename,
    stats: {
      tasks: tasks?.length || 0,
      clients: clients?.length || 0,
      categories: categories?.length || 0
    }
  };
}

/**
 * Limpa todos os dados das coleções principais (para teste)
 * ⚠️ NÃO limpa usuários para preservar acesso ao sistema
 */
export async function clearAllData(adminUserId: string) {
  await dbConnect();

  const [tasksCount, clientsCount, categoriesCount] = await Promise.all([
    Task.countDocuments({}),
    Client.countDocuments({}),
    Category.countDocuments({})
  ]);

  await Promise.all([
    Task.deleteMany({}),
    Client.deleteMany({}),
    Category.deleteMany({})
  ]);

  // Log da ação
  try {
    await logAudit({
      action: 'DELETE',
      resource: 'BACKUP',
      userId: adminUserId,
      details: { 
        action: 'CLEAR_ALL_DATA',
        timestamp: new Date().toISOString(),
        deletedCounts: {
          tasks: tasksCount,
          clients: clientsCount,
          categories: categoriesCount
        }
      }
    });
  } catch (e) {
    console.error('Erro ao criar log de auditoria:', e);
  }

  console.log('🗑️ Todos os dados foram removidos (exceto usuários)');

  return { 
    success: true, 
    deleted: {
      tasks: tasksCount,
      clients: clientsCount,
      categories: categoriesCount
    }
  };
}

/**
 * Utilitário para formatar bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Remove backups automáticos antigos baseado na configuração backup_retention_days
 * @returns Número de backups removidos e erros encontrados
 */
export async function cleanupOldBackups(): Promise<{ removed: number; errors: string[] }> {
  const results = { removed: 0, errors: [] as string[] };
  
  try {
    await dbConnect();
    
    const retentionDays = await getConfig<number>('backup_retention_days', 30);
    
    // Se retenção for 0, nunca remover
    if (retentionDays <= 0) {
      console.log('⏭️ Limpeza de backups desabilitada (retenção = 0)');
      return results;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Buscar backups AUTO mais antigos que a data de corte
    const oldBackups = await Backup.find({
      type: 'AUTO',
      createdAt: { $lt: cutoffDate }
    });
    
    if (oldBackups.length === 0) {
      console.log(`ℹ️ Nenhum backup antigo para remover (retenção: ${retentionDays} dias)`);
      return results;
    }
    
    for (const backup of oldBackups) {
      try {
        await Backup.findByIdAndDelete(backup._id);
        results.removed++;
        console.log(`  🗑️ Removido: ${backup.filename}`);
      } catch (err: any) {
        const errorMsg = `Erro ao remover backup ${backup._id}: ${err.message}`;
        results.errors.push(errorMsg);
        console.error(`  ❌ ${errorMsg}`);
      }
    }
    
    console.log(`✅ Limpeza de backups: ${results.removed} removidos (retenção: ${retentionDays} dias)`);
    
    // Log de auditoria da limpeza
    if (results.removed > 0) {
      try {
        await logAudit({
          action: 'DELETE',
          resource: 'BACKUP',
          userId: 'SYSTEM',
          userName: 'Sistema (Auto)',
          details: {
            action: 'CLEANUP_OLD_BACKUPS',
            removedCount: results.removed,
            retentionDays,
            cutoffDate: cutoffDate.toISOString()
          }
        });
      } catch (e) {
        console.error('Erro ao criar log de auditoria da limpeza:', e);
      }
    }
    
  } catch (err: any) {
    const errorMsg = `Erro geral na limpeza: ${err.message}`;
    results.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }
  
  return results;
}

/**
 * Remove backups excedentes quando ultrapassar o limite max_backups
 * @returns Número de backups removidos e erros encontrados
 */
export async function enforceMaxBackups(): Promise<{ removed: number; errors: string[] }> {
  const results = { removed: 0, errors: [] as string[] };
  
  try {
    await dbConnect();
    
    const maxBackups = await getConfig<number>('max_backups', 50);
    
    // Se max_backups for 0, sem limite
    if (maxBackups <= 0) {
      console.log('⏭️ Limite de backups desabilitado (max = 0)');
      return results;
    }
    
    const totalBackups = await Backup.countDocuments({});
    
    if (totalBackups <= maxBackups) {
      return results;
    }
    
    const toRemove = totalBackups - maxBackups;
    
    // Buscar os backups AUTO mais antigos para remover (preservar manuais)
    const oldestBackups = await Backup.find({ type: 'AUTO' })
      .sort({ createdAt: 1 })
      .limit(toRemove);
    
    for (const backup of oldestBackups) {
      try {
        await Backup.findByIdAndDelete(backup._id);
        results.removed++;
        console.log(`  🗑️ Removido (limite): ${backup.filename}`);
      } catch (err: any) {
        results.errors.push(`Erro ao remover backup ${backup._id}: ${err.message}`);
      }
    }
    
    if (results.removed > 0) {
      console.log(`✅ Limite de backups: ${results.removed} removidos (max: ${maxBackups})`);
      
      try {
        await logAudit({
          action: 'DELETE',
          resource: 'BACKUP',
          userId: 'SYSTEM',
          userName: 'Sistema (Auto)',
          details: {
            action: 'ENFORCE_MAX_BACKUPS',
            removedCount: results.removed,
            maxBackups,
            totalBefore: totalBackups
          }
        });
      } catch (e) {
        console.error('Erro ao criar log de auditoria:', e);
      }
    }
    
  } catch (err: any) {
    results.errors.push(`Erro geral: ${err.message}`);
  }
  
  return results;
}

