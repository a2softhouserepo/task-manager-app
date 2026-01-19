const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';
const HOURLY_RATE = 100; // 1h = 100 valores monetários

// Definição de Schemas Simplificados para o Script
const ClientSchema = new mongoose.Schema({ 
  name: String,
  email: String,
  phone: String
}, { collection: `${DB_PREFIX}clients`, timestamps: true });

const CategorySchema = new mongoose.Schema({ 
  name: String, 
  icon: { type: String, default: 'AiOutlineFolder' },
  color: { type: String, default: '#3b82f6' }
}, { collection: `${DB_PREFIX}categories`, timestamps: true });

const UserSchema = new mongoose.Schema({ 
  username: String 
}, { collection: `${DB_PREFIX}users` });

const TaskSchema = new mongoose.Schema({
  requestDate: Date,
  clientId: String,
  clientName: String,
  categoryId: String,
  categoryName: String,
  categoryIcon: String,
  categoryColor: String,
  title: String,
  description: String,
  deliveryDate: Date,
  cost: Number,
  status: String,
  userId: String,
  createdBy: String
}, { collection: `${DB_PREFIX}tasks`, timestamps: true });

// Modelos
const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// Cores para as categorias
const categoryColors = {
  'E-mail MKT': '#f59e0b',
  'E-mail': '#3b82f6',
  'E-mkt': '#f59e0b',
  'Sustentação': '#10b981',
  'Landing Page': '#8b5cf6',
  'Site': '#ec4899',
  'Banner': '#ef4444',
  'default': '#64748b'
};

const categoryIcons = {
  'E-mail MKT': 'AiOutlineMail',
  'E-mail': 'AiOutlineMail',
  'E-mkt': 'AiOutlineMail',
  'Sustentação': 'AiOutlineTool',
  'Landing Page': 'AiOutlineFileText',
  'Site': 'AiOutlineGlobal',
  'Banner': 'AiOutlinePicture',
  'default': 'AiOutlineFolder'
};

// Função para tratar datas do Excel
function parseExcelDate(excelDate) {
  if (!excelDate) return new Date();
  if (excelDate instanceof Date) {
    // Excel já converteu para Date, mas pode ter timezone issues
    return excelDate;
  }
  if (typeof excelDate === 'number') {
    // Número serial do Excel (dias desde 1900-01-01)
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
  }
  return new Date(excelDate);
}

// Função para tratar o Esforço
function parseEffort(effortRaw) {
  if (!effortRaw) return 0;
  let value = effortRaw;
  if (typeof effortRaw === 'string') {
    value = parseFloat(effortRaw.replace('h', '').replace(',', '.').trim());
  }
  if (isNaN(value)) return 0;
  return value * HOURLY_RATE;
}

// Função para normalizar nome das colunas (variações entre os meses)
function normalizeRow(row, sheetName) {
  return {
    requestDate: row['Data'] || row['Data da Solicitação'],
    category: row['Categoria'],
    client: row['Cliente'] || 'A2 Horizons', // Default para Fevereiro que não tem cliente
    title: row['Item'],
    effort: row['Esforço Estimado'] || row['Esforço Estimado (h)'],
    deliveryDate: row['Entregue em:'] || row['Data da Entrega'] || row['Data'] || row['Data da Solicitação'],
    observations: row['Observações'] || row['Item'] // Usa o título se não tiver observações
  };
}

async function importFullExcel() {
  let stats = {
    clientsCreated: 0,
    categoriesCreated: 0,
    tasksCreated: 0,
    errors: []
  };

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    const filePath = path.join(__dirname, '../import-file/Relação de serviços prestados em 2025.xlsx');
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    
    // Busca usuário root para atribuir a autoria
    const rootUser = await User.findOne({ username: 'root' });
    if (!rootUser) throw new Error('❌ Usuário root não encontrado. Execute: node scripts/seed-users.js');

    console.log('\n🚀 Iniciando importação...\n');

    for (const sheetName of workbook.SheetNames) {
      // Pula a aba Dashboard
      if (sheetName.toLowerCase().includes('dashboard')) {
        console.log(`⏭️  Pulando aba: ${sheetName}`);
        continue;
      }

      console.log(`📦 Processando: ${sheetName}`);
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      for (const row of data) {
        try {
          const normalized = normalizeRow(row, sheetName);

          // Validação mínima
          if (!normalized.title) {
            console.log(`   ⚠️  Linha sem título, pulando...`);
            continue;
          }

          // 1. Busca ou Cria Cliente
          let client = await Client.findOne({ name: new RegExp(`^${normalized.client.trim()}$`, 'i') });
          if (!client) {
            client = await Client.create({ 
              name: normalized.client.trim(),
              email: `${normalized.client.toLowerCase().replace(/\s+/g, '')}@cliente.com`,
              phone: '(00) 00000-0000'
            });
            stats.clientsCreated++;
            console.log(`   👤 Cliente criado: ${client.name}`);
          }

          // 2. Busca ou Cria Categoria
          const categoryName = normalized.category || 'Geral';
          let category = await Category.findOne({ name: new RegExp(`^${categoryName.trim()}$`, 'i') });
          if (!category) {
            category = await Category.create({ 
              name: categoryName.trim(),
              icon: categoryIcons[categoryName] || categoryIcons['default'],
              color: categoryColors[categoryName] || categoryColors['default']
            });
            stats.categoriesCreated++;
            console.log(`   🏷️  Categoria criada: ${category.name}`);
          }

          // 3. Prepara Dados da Tarefa
          const requestDate = parseExcelDate(normalized.requestDate);
          const deliveryDate = parseExcelDate(normalized.deliveryDate);
          const cost = parseEffort(normalized.effort);

          // 4. Cria Tarefa
          await Task.create({
            requestDate: requestDate,
            clientId: client._id.toString(),
            clientName: client.name,
            categoryId: category._id.toString(),
            categoryName: category.name,
            categoryIcon: category.icon,
            categoryColor: category.color,
            title: normalized.title,
            description: normalized.observations,
            deliveryDate: deliveryDate,
            cost: cost,
            status: 'completed',
            userId: rootUser._id.toString(),
            createdBy: rootUser._id.toString()
          });
          stats.tasksCreated++;

        } catch (error) {
          stats.errors.push({ sheet: sheetName, row: row, error: error.message });
          console.error(`   ❌ Erro na linha:`, error.message);
        }
      }
      console.log(`   ✓ ${sheetName} concluído\n`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ IMPORTAÇÃO CONCLUÍDA!');
    console.log('='.repeat(50));
    console.log(`👤 Clientes criados: ${stats.clientsCreated}`);
    console.log(`🏷️  Categorias criadas: ${stats.categoriesCreated}`);
    console.log(`📋 Tarefas criadas: ${stats.tasksCreated}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Erros encontrados: ${stats.errors.length}`);
      stats.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.sheet}: ${err.error}`);
      });
    }

    // Validação final comparando com Dashboard
    console.log('\n📊 Validando com Dashboard...');
    const allTasks = await Task.find({});
    const totalCost = allTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
    console.log(`💰 Valor total importado: R$ ${totalCost.toFixed(2)}`);
    console.log(`📈 Valor esperado (Dashboard): R$ 24.700,00`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

importFullExcel();
