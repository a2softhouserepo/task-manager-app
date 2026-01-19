const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

async function clearImportedData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Limpar apenas as tarefas (manter usuários)
    const tasksCollection = mongoose.connection.db.collection(`${DB_PREFIX}tasks`);
    const clientsCollection = mongoose.connection.db.collection(`${DB_PREFIX}clients`);
    const categoriesCollection = mongoose.connection.db.collection(`${DB_PREFIX}categories`);

    const tasksResult = await tasksCollection.deleteMany({});
    console.log(`🗑️  Tarefas removidas: ${tasksResult.deletedCount}`);

    const clientsResult = await clientsCollection.deleteMany({});
    console.log(`🗑️  Clientes removidos: ${clientsResult.deletedCount}`);

    const categoriesResult = await categoriesCollection.deleteMany({});
    console.log(`🗑️  Categorias removidas: ${categoriesResult.deletedCount}`);

    console.log('\n✅ Banco limpo! Pronto para reimportação.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

clearImportedData();
