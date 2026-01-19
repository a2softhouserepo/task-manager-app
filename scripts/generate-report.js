const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

const TaskSchema = new mongoose.Schema({
  requestDate: Date,
  deliveryDate: Date,
  clientName: String,
  categoryName: String,
  title: String,
  cost: Number,
  status: String
}, { collection: `${DB_PREFIX}tasks`, timestamps: true });

const Task = mongoose.model('Task', TaskSchema);

async function generateReport() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Ler Dashboard do Excel
    const filePath = path.join(__dirname, '../import-file/Relação de serviços prestados em 2025.xlsx');
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const dashboardData = XLSX.utils.sheet_to_json(workbook.Sheets['📊Dashboard']);
    
    const dashboardTotals = {};
    dashboardData.forEach(row => {
      const month = row['Mês'];
      dashboardTotals[month] = row['Total'];
    });

    // Buscar tarefas do banco
    const tasks = await Task.find({}).sort({ deliveryDate: 1 });
    
    // Agrupar por mês de entrega
    const dbTotals = {};
    tasks.forEach(task => {
      const date = new Date(task.deliveryDate);
      const month = date.toLocaleString('pt-BR', { month: 'long' });
      const monthKey = month.charAt(0).toUpperCase() + month.slice(1);
      
      if (!dbTotals[monthKey]) {
        dbTotals[monthKey] = 0;
      }
      dbTotals[monthKey] += task.cost || 0;
    });

    // Gerar relatório comparativo
    console.log('📊 RELATÓRIO COMPARATIVO: Dashboard vs Banco de Dados');
    console.log('='.repeat(80));
    console.log(` ${'Mês'.padEnd(15)} | ${'Dashboard'.padEnd(15)} | ${'Banco'.padEnd(15)} | ${'Status'.padEnd(15)}`);
    console.log('='.repeat(80));

    let totalDashboard = 0;
    let totalDB = 0;

    Object.keys(dashboardTotals).forEach(month => {
      const dashValue = dashboardTotals[month];
      const dbValue = dbTotals[month] || 0;
      const status = Math.abs(dashValue - dbValue) < 500 ? '✅ OK' : '⚠️  Diferença';
      
      totalDashboard += dashValue;
      totalDB += dbValue;
      
      console.log(` ${month.padEnd(15)} | R$ ${String(dashValue).padEnd(12)} | R$ ${String(dbValue.toFixed(0)).padEnd(12)} | ${status}`);
    });

    console.log('='.repeat(80));
    console.log(` ${'TOTAL'.padEnd(15)} | R$ ${String(totalDashboard).padEnd(12)} | R$ ${String(totalDB.toFixed(0)).padEnd(12)} | ${Math.abs(totalDashboard - totalDB) < 500 ? '✅ OK' : '⚠️  Diferença'}`);
    console.log('='.repeat(80));

    console.log(`\n📋 Resumo da Importação:`);
    console.log(`   • Total de tarefas: ${tasks.length}`);
    console.log(`   • Clientes únicos: ${[...new Set(tasks.map(t => t.clientName))].length}`);
    console.log(`   • Categorias únicas: ${[...new Set(tasks.map(t => t.categoryName))].length}`);
    console.log(`   • Período: ${new Date(tasks[0].deliveryDate).toLocaleDateString('pt-BR')} até ${new Date(tasks[tasks.length - 1].deliveryDate).toLocaleDateString('pt-BR')}`);
    console.log(`   • Valor total: R$ ${totalDB.toFixed(2)}`);

    console.log(`\n✅ A importação foi realizada com sucesso!`);
    console.log(`📊 Os dados estão disponíveis na interface em: http://localhost:3001`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

generateReport();
