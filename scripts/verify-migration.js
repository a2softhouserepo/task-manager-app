require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

const TaskSchema = new mongoose.Schema({
  title: String,
  cost: Number
}, { collection: `${DB_PREFIX}tasks` });

const Task = mongoose.model('Task', TaskSchema);

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    const tasks = await Task.find({ cost: { $exists: true } }).limit(10);
    console.log('📊 Amostra de tarefas após migração:\n');
    
    tasks.forEach(t => {
      console.log(`   ${t.title?.substring(0, 40).padEnd(40)} | Custo: ${t.cost}`);
    });

    const stats = await Task.aggregate([
      {
        $group: {
          _id: null,
          min: { $min: '$cost' },
          max: { $max: '$cost' },
          avg: { $avg: '$cost' },
          total: { $sum: '$cost' }
        }
      }
    ]);

    console.log('\n📈 Estatísticas:');
    console.log(`   Mínimo: ${stats[0].min}`);
    console.log(`   Máximo: ${stats[0].max}`);
    console.log(`   Média: ${stats[0].avg.toFixed(2)}`);
    console.log(`   Total: ${stats[0].total.toFixed(2)}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verify();
