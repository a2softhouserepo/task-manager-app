/**
 * Script de Migração: Hierarquia de Clientes
 * 
 * Este script adiciona os campos de hierarquia aos clientes existentes.
 * Todos os clientes existentes são tratados como clientes raiz (depth: 0).
 * 
 * Uso: node scripts/migrate-client-hierarchy.js
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

async function migrate() {
  console.log('🚀 Iniciando migração de hierarquia de clientes...\n');
  
  try {
    // Conectar ao MongoDB
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI não configurada no .env.local');
    }
    
    await mongoose.connect(uri);
    console.log('✅ Conectado ao MongoDB\n');
    
    const db = mongoose.connection.db;
    const clientsCollection = db.collection(`${DB_PREFIX}clients`);
    
    // Contar clientes sem campos de hierarquia
    const clientsWithoutHierarchy = await clientsCollection.countDocuments({
      $or: [
        { path: { $exists: false } },
        { depth: { $exists: false } }
      ]
    });
    
    console.log(`📊 Clientes sem campos de hierarquia: ${clientsWithoutHierarchy}`);
    
    if (clientsWithoutHierarchy === 0) {
      console.log('\n✅ Todos os clientes já possuem campos de hierarquia. Nada a fazer.');
      return;
    }
    
    // Atualizar clientes existentes com valores padrão
    console.log('\n📝 Atualizando clientes existentes...\n');
    
    const result = await clientsCollection.updateMany(
      {
        $or: [
          { path: { $exists: false } },
          { depth: { $exists: false } }
        ]
      },
      {
        $set: {
          parentId: null,
          path: [],
          depth: 0,
          rootClientId: null,
          childrenCount: 0
        }
      }
    );
    
    console.log(`✅ ${result.modifiedCount} clientes atualizados com campos de hierarquia`);
    
    // Criar índices
    console.log('\n📑 Criando índices...');
    
    await clientsCollection.createIndex({ parentId: 1 });
    await clientsCollection.createIndex({ path: 1 });
    await clientsCollection.createIndex({ rootClientId: 1 });
    await clientsCollection.createIndex({ depth: 1 });
    await clientsCollection.createIndex({ parentId: 1, active: 1 });
    await clientsCollection.createIndex({ rootClientId: 1, active: 1 });
    await clientsCollection.createIndex({ depth: 1, active: 1 });
    
    console.log('✅ Índices criados');
    
    // Resumo final
    const totalClients = await clientsCollection.countDocuments();
    const rootClients = await clientsCollection.countDocuments({ depth: 0 });
    
    console.log('\n========================================');
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('========================================');
    console.log(`Total de clientes: ${totalClients}`);
    console.log(`Clientes raiz (diretos): ${rootClients}`);
    console.log(`Clientes migrados: ${result.modifiedCount}`);
    console.log('========================================\n');
    
    console.log('✅ Migração concluída com sucesso!\n');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

migrate();
