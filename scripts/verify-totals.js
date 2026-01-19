const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../import-file/Relação de serviços prestados em 2025.xlsx');
const workbook = XLSX.readFile(filePath, { cellDates: true });

console.log('📊 Verificação Dashboard vs Dados Importados\n');
console.log('='.repeat(60));

// Ler Dashboard
const dashboardData = XLSX.utils.sheet_to_json(workbook.Sheets['📊Dashboard']);
let totalDashboard = 0;
dashboardData.forEach(row => {
  totalDashboard += row['Total'] || 0;
  console.log(`${row['Mês']}: R$ ${row['Total']}`);
});

console.log('='.repeat(60));
console.log(`💰 Total esperado (Dashboard): R$ ${totalDashboard.toFixed(2)}`);

// Calcular total real das abas
console.log('\n📋 Calculando total real das tarefas...\n');
let totalReal = 0;
let taskCount = 0;

workbook.SheetNames.forEach((sheetName) => {
  if (sheetName.toLowerCase().includes('dashboard')) return;
  
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  let monthTotal = 0;
  
  data.forEach(row => {
    const effort = row['Esforço Estimado'] || row['Esforço Estimado (h)'] || 0;
    monthTotal += effort * 100;
    taskCount++;
  });
  
  totalReal += monthTotal;
  console.log(`${sheetName}: R$ ${monthTotal.toFixed(2)} (${data.length} tarefas)`);
});

console.log('='.repeat(60));
console.log(`💰 Total real calculado: R$ ${totalReal.toFixed(2)}`);
console.log(`📋 Total de tarefas: ${taskCount}`);
console.log(`📊 Diferença: R$ ${Math.abs(totalReal - totalDashboard).toFixed(2)}`);
