import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Client from '@/models/Client';
import Category from '@/models/Category';
import User from '@/models/User';
import Backup from '@/models/Backup';
import { logAudit } from '@/lib/audit';

/**
 * Cria um backup completo do sistema
 */
export async function createBackup(userId: string, type: 'AUTO' | 'MANUAL' = 'MANUAL') {
  await dbConnect();
  
  // Coletar todos os dados (lean() para objetos JS puros, mais rápido)
  // ⚠️ Usuários não são incluídos no backup por segurança
  const [tasks, clients, categories] = await Promise.all([
    Task.find({}).lean(),
    Client.find({}).lean(),
    Category.find({}).lean()
  ]);

  const stats = {
    tasks: tasks.length,
    clients: clients.length,
    categories: categories.length
  };

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
      resource: 'BACKUP' as any,
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
 */
export async function checkAndTriggerAutoBackup(): Promise<boolean> {
  await dbConnect();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Verifica se já existe um backup AUTO criado hoje
  const existingBackup = await Backup.findOne({
    type: 'AUTO',
    createdAt: { $gte: today }
  });

  if (!existingBackup) {
    console.log('🔄 Disparando backup automático diário...');
    try {
      await createBackup('SYSTEM', 'AUTO');
      console.log('✅ Backup automático diário criado com sucesso.');
      return true;
    } catch (error) {
      console.error('❌ Falha ao criar backup automático:', error);
      return false;
    }
  } else {
    console.log('ℹ️ Backup automático do dia já existe:', existingBackup.filename);
    return false;
  }
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
      resource: 'BACKUP' as any,
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
      resource: 'BACKUP' as any,
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
