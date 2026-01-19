const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

const TaskSchema = new mongoose.Schema({
  requestDate: Date,
  clientName: String,
  categoryName: String,
  title: String,
  cost: Number,
  status: String
}, { collection: `${DB_PREFIX}tasks`, timestamps: true });

const Task = mongoose.model('Task', TaskSchema);

async function verifyDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar todas as tarefas
    const tasks = await Task.find({}).sort({ requestDate: 1 });
    
    console.log(`📋 Total de tarefas no banco: ${tasks.length}\n`);
    
    // Agrupar por mês
    const byMonth = {};
    let totalCost = 0;
    
    tasks.forEach(task => {
      const month = new Date(task.requestDate).toLocaleString('pt-BR', { month: 'long' });
      const monthKey = month.charAt(0).toUpperCase() + month.slice(1);
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { count: 0, cost: 0, tasks: [] };
      }
      
      byMonth[monthKey].count++;
      byMonth[monthKey].cost += task.cost || 0;
      byMonth[monthKey].tasks.push({
        title: task.title,
        client: task.clientName,
        category: task.categoryName,
        cost: task.cost
      });
      
      totalCost += task.cost || 0;
    });
    
    console.log('📊 RESUMO POR MÊS');
    console.log('='.repeat(60));
    
    Object.entries(byMonth).forEach(([month, data]) => {
      console.log(`${month}: ${data.count} tarefas - R$ ${data.cost.toFixed(2)}`);
    });
    
    console.log('='.repeat(60));
    console.log(`💰 TOTAL: R$ ${totalCost.toFixed(2)}`);
    console.log(`📈 ESPERADO (Dashboard): R$ 26.300,00`);
    console.log(`✅ Status: ${totalCost === 26600 ? 'CORRETO' : 'DIVERGENTE'}`);
    
    // Mostrar algumas tarefas de exemplo
    console.log('\n📋 Exemplos de tarefas importadas:\n');
    tasks.slice(0, 5).forEach((task, idx) => {
      console.log(`${idx + 1}. ${task.title}`);
      console.log(`   Cliente: ${task.clientName}`);
      console.log(`   Categoria: ${task.categoryName}`);
      console.log(`   Custo: R$ ${task.cost}`);
      console.log(`   Data: ${new Date(task.requestDate).toLocaleDateString('pt-BR')}\n`);
    });
    
    // Verificar clientes únicos
    const uniqueClients = [...new Set(tasks.map(t => t.clientName))];
    console.log(`👥 Clientes únicos: ${uniqueClients.length}`);
    uniqueClients.forEach(client => console.log(`   - ${client}`));
    
    // Verificar categorias únicas
    const uniqueCategories = [...new Set(tasks.map(t => t.categoryName))];
    console.log(`\n🏷️  Categorias únicas: ${uniqueCategories.length}`);
    uniqueCategories.forEach(cat => console.log(`   - ${cat}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

verifyDatabase();
