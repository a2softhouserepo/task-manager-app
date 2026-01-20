require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

// Schema simples para a migração
const taskSchema = new mongoose.Schema({
  title: String,
  cost: Number
}, { collection: `${DB_PREFIX}tasks`, strict: false });

const Task = mongoose.model('Task', taskSchema);

async function migrate() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado com sucesso.\n');

    // Buscar todas as tasks com custo
    const tasks = await Task.find({ cost: { $exists: true, $ne: null } });
    console.log(`📊 Encontradas ${tasks.length} tarefas com custo definido.\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    console.log('🔄 Iniciando migração dos valores...\n');

    for (const task of tasks) {
      const oldCost = task.cost;
      
      // Converter valores financeiros em unitários
      // 100 -> 1, 150 -> 1.5, 400 -> 4
      const newCost = oldCost / 100;
      
      // Atualizar o documento
      await Task.updateOne(
        { _id: task._id },
        { $set: { cost: newCost } }
      );

      updatedCount++;
      
      // Mostrar exemplos das primeiras 10 conversões
      if (updatedCount <= 10) {
        console.log(`   ${task.title?.substring(0, 40).padEnd(40)} | ${String(oldCost).padStart(6)} → ${String(newCost).padStart(6)}`);
      }
    }

    if (updatedCount > 10) {
      console.log(`   ... e mais ${updatedCount - 10} tarefas\n`);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log(`📊 Total de tarefas atualizadas: ${updatedCount}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
