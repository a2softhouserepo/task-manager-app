#!/usr/bin/env node

/**
 * Script to seed the database with 2 years of tasks
 * Creates 3-5 tasks per week
 * 
 * Usage: node scripts/seed-tasks.js
 * 
 * Prerequisites:
 * - Run seed-users.js first
 * - Run seed-categories.js first
 * - Run seed-clients.js first
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPT_KEY_SECRET = process.env.ENCRYPT_KEY_SECRET;
const DB_PREFIX = 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

if (!ENCRYPT_KEY_SECRET) {
  console.error('ENCRYPT_KEY_SECRET not found in .env.local');
  process.exit(1);
}

// Decryption plugin (simplified version for reading)
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

function getKey() {
  return crypto.createHash('sha256').update(ENCRYPT_KEY_SECRET).digest();
}

function decrypt(enc) {
  if (!enc || typeof enc !== 'string') return enc;
  
  if (enc.startsWith(PREFIX)) {
    try {
      const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
      const iv = payload.slice(0, IV_LENGTH);
      const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
      
      const key = getKey();
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return enc;
    }
  }
  
  return enc;
}

// Mongoose plugin to auto-decrypt on read
function fieldDecryptionPlugin(schema, options) {
  const fields = options.fields || [];
  
  schema.post('init', function() {
    fields.forEach(field => {
      if (this[field]) {
        this[field] = decrypt(this[field]);
      }
    });
  });
}

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  name: String,
  role: String,
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  name: String,
  icon: String,
  color: String,
}, { timestamps: true });

const clientSchema = new mongoose.Schema({
  name: String,
  email: String,
  active: Boolean,
}, { timestamps: true });

// Apply decryption plugin to Client
clientSchema.plugin(fieldDecryptionPlugin, {
  fields: ['name', 'email']
});

const taskSchema = new mongoose.Schema({
  requestDate: { type: Date, required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientName: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  categoryName: { type: String, required: true },
  categoryIcon: { type: String },
  categoryColor: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  deliveryDate: { type: Date },
  cost: { type: Number, required: true, default: 0 },
  observations: { type: String },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  asanaEmailSent: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema, `${DB_PREFIX}users`);
const Category = mongoose.model('Category', categorySchema, `${DB_PREFIX}categories`);
const Client = mongoose.model('Client', clientSchema, `${DB_PREFIX}clients`);
const Task = mongoose.model('Task', taskSchema, `${DB_PREFIX}tasks`);

// Task titles by category type
const taskTemplates = {
  'Desenvolvimento Web': [
    { title: 'Criar landing page', desc: 'Desenvolvimento de landing page responsiva com formulário de contato' },
    { title: 'Correção de bugs no sistema', desc: 'Identificar e corrigir bugs reportados no sistema web' },
    { title: 'Implementar nova funcionalidade', desc: 'Desenvolver e integrar nova funcionalidade ao sistema existente' },
    { title: 'Otimização de performance', desc: 'Análise e otimização de performance do site' },
    { title: 'Atualização de plugins', desc: 'Atualizar plugins e dependências do sistema' },
  ],
  'Design Gráfico': [
    { title: 'Criação de logo', desc: 'Desenvolver identidade visual e logo para a marca' },
    { title: 'Banner para redes sociais', desc: 'Criar artes para campanhas em redes sociais' },
    { title: 'Material impresso', desc: 'Design de cartão de visita e material promocional' },
    { title: 'Apresentação corporativa', desc: 'Criação de template para apresentações' },
    { title: 'Redesign de interface', desc: 'Atualização visual da interface do sistema' },
  ],
  'Marketing Digital': [
    { title: 'Gestão de redes sociais', desc: 'Criação de conteúdo e gerenciamento mensal das redes sociais' },
    { title: 'Campanha Google Ads', desc: 'Configuração e otimização de campanhas no Google Ads' },
    { title: 'E-mail marketing', desc: 'Criação e disparo de campanha de e-mail marketing' },
    { title: 'Análise de métricas', desc: 'Relatório completo de performance das ações de marketing' },
    { title: 'Estratégia de conteúdo', desc: 'Planejamento de conteúdo para o próximo trimestre' },
  ],
  'Consultoria': [
    { title: 'Análise de processos', desc: 'Mapeamento e análise dos processos internos' },
    { title: 'Plano de transformação digital', desc: 'Elaboração de roadmap para transformação digital' },
    { title: 'Assessment tecnológico', desc: 'Avaliação da infraestrutura e sistemas atuais' },
    { title: 'Workshop de capacitação', desc: 'Treinamento presencial para equipe' },
    { title: 'Documento de requisitos', desc: 'Levantamento e documentação de requisitos' },
  ],
  'Suporte Técnico': [
    { title: 'Suporte mensal', desc: 'Atendimento de chamados e suporte ao usuário' },
    { title: 'Backup e manutenção', desc: 'Execução de rotinas de backup e manutenção preventiva' },
    { title: 'Configuração de servidor', desc: 'Setup e configuração de ambiente de servidor' },
    { title: 'Migração de dados', desc: 'Migração de dados entre sistemas' },
    { title: 'Troubleshooting', desc: 'Investigação e resolução de problemas técnicos' },
  ],
  'SEO': [
    { title: 'Auditoria SEO', desc: 'Análise completa de SEO do site' },
    { title: 'Otimização on-page', desc: 'Implementação de melhorias de SEO on-page' },
    { title: 'Link building', desc: 'Estratégia e execução de link building' },
    { title: 'Pesquisa de palavras-chave', desc: 'Estudo e definição de palavras-chave estratégicas' },
    { title: 'Relatório de posicionamento', desc: 'Análise de rankings e posicionamento nos buscadores' },
  ],
};

// Random helpers
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCost() {
  // Costs between 100 and 5000, in increments of 50
  return Math.round(randomInt(100, 5000) / 50) * 50;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function seedTasks() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    // Get existing data
    const users = await User.find({ role: { $in: ['rootAdmin', 'admin'] } });
    const categories = await Category.find({ active: true });
    const clients = await Client.find({ active: true });
    
    if (users.length === 0) {
      console.error('❌ No users found. Run seed-users.js first.');
      process.exit(1);
    }
    
    if (categories.length === 0) {
      console.error('❌ No categories found. Run seed-categories.js first.');
      process.exit(1);
    }
    
    if (clients.length === 0) {
      console.error('❌ No clients found. Run seed-clients.js first.');
      process.exit(1);
    }
    
    console.log(`\nFound ${users.length} users, ${categories.length} categories, ${clients.length} clients`);
    
    // Check if tasks already exist
    const existingTasks = await Task.countDocuments();
    if (existingTasks > 0) {
      console.log(`\n⚠️  ${existingTasks} tasks already exist. Skipping seed.`);
      console.log('Run clear-tasks.js first if you want to reseed.');
      process.exit(0);
    }
    
    console.log('\nGenerating 2 years of tasks...');
    
    const tasks = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    
    let currentDate = new Date(startDate);
    let totalTasks = 0;
    
    while (currentDate <= endDate) {
      // Get start of week (Monday)
      const dayOfWeek = currentDate.getDay();
      const monday = new Date(currentDate);
      monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      
      // Generate 3-5 tasks per week
      const tasksThisWeek = randomInt(3, 5);
      
      for (let i = 0; i < tasksThisWeek; i++) {
        const client = randomElement(clients);
        const category = randomElement(categories);
        const user = randomElement(users);
        
        // Get template for this category
        const categoryTemplates = taskTemplates[category.name] || [
          { title: 'Serviço', desc: 'Prestação de serviço' },
        ];
        const template = randomElement(categoryTemplates);
        
        // Random day within the week
        const requestDate = addDays(monday, randomInt(0, 4));
        
        // Delivery date: 3-30 days after request
        const deliveryDate = addDays(requestDate, randomInt(3, 30));
        
        // Status based on delivery date
        let status = 'pending';
        const now = new Date();
        if (deliveryDate < now) {
          status = Math.random() > 0.1 ? 'completed' : 'cancelled';
        } else if (requestDate < now) {
          status = Math.random() > 0.5 ? 'in_progress' : 'pending';
        }
        
        // Client name is already decrypted by Mongoose plugin
        tasks.push({
          requestDate,
          clientId: client._id,
          clientName: client.name,
          categoryId: category._id,
          categoryName: category.name,
          categoryIcon: category.icon,
          categoryColor: category.color,
          title: template.title,
          description: template.desc,
          deliveryDate,
          cost: randomCost(),
          observations: Math.random() > 0.7 ? 'Urgente' : '',
          status,
          asanaEmailSent: status === 'completed' && Math.random() > 0.5,
          createdBy: user._id,
          updatedBy: user._id,
          createdAt: requestDate,
          updatedAt: status === 'completed' ? deliveryDate : requestDate,
        });
        
        totalTasks++;
      }
      
      // Move to next week
      currentDate = addDays(monday, 7);
    }
    
    console.log(`\nInserting ${tasks.length} tasks...`);
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      await Task.insertMany(batch);
      process.stdout.write(`  Inserted ${Math.min(i + batchSize, tasks.length)}/${tasks.length}\r`);
    }
    
    console.log(`\n\n✅ ${tasks.length} tasks seeded successfully!`);
    
    // Summary
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$cost' },
        },
      },
    ]);
    
    console.log('\nSummary:');
    for (const stat of stats) {
      console.log(`  ${stat._id}: ${stat.count} tasks, R$ ${stat.total.toLocaleString('pt-BR')}`);
    }
    
  } catch (error) {
    console.error('Error seeding tasks:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedTasks();
