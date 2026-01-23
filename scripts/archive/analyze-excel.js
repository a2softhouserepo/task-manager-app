const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../import-file/Relação de serviços prestados em 2025.xlsx');
const workbook = XLSX.readFile(filePath, { cellDates: true });

console.log('📊 Abas encontradas:', workbook.SheetNames);
console.log('\n');

workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== ABA: ${sheetName} ===`);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  if (data.length > 0) {
    console.log('Colunas:', Object.keys(data[0]));
    console.log('Total de linhas:', data.length);
    console.log('\nPrimeira linha de exemplo:');
    console.log(JSON.stringify(data[0], null, 2));
    
    if (sheetName.toLowerCase() === 'dashboard') {
      console.log('\n📈 Estatísticas do Dashboard:');
      data.forEach((row, idx) => {
        if (idx < 5) console.log(row);
      });
    }
  }
});
