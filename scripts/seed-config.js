#!/usr/bin/env node

/**
 * Script to seed the database with default system configurations
 * 
 * Usage: node scripts/seed-config.js
 * 
 * Creates default configurations for:
 * - Backup settings (frequency, retention, max backups)
 * - Security settings (audit log retention)
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = process.env.DB_PREFIX || 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

// Schema definition (same as src/models/SystemConfig.ts)
const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json'],
      default: 'string',
    },
    category: {
      type: String,
      enum: ['backup', 'email', 'security', 'general', 'asana'],
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: String,
    options: [String],
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: `${DB_PREFIX}system-config`,
  }
);

const SystemConfig = mongoose.model(`${DB_PREFIX}system-config`, SystemConfigSchema);

// Default configurations
const defaultConfigs = [
  // Backup Settings
  {
    key: 'backup_frequency',
    value: 'daily',
    type: 'string',
    category: 'backup',
    label: 'Frequência de Backup Automático',
    description: 'Define quando o backup automático será criado no login do rootAdmin',
    options: ['daily', 'every_login', 'disabled'],
    updatedBy: 'SYSTEM',
  },
  {
    key: 'backup_retention_days',
    value: 30,
    type: 'number',
    category: 'backup',
    label: 'Dias de Retenção de Backups',
    description: 'Backups automáticos mais antigos serão excluídos automaticamente (0 = nunca excluir)',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'max_backups',
    value: 50,
    type: 'number',
    category: 'backup',
    label: 'Máximo de Backups Armazenados',
    description: 'Limite de backups mantidos no sistema (0 = sem limite)',
    updatedBy: 'SYSTEM',
  },
  
  // Security Settings
  {
    key: 'max_login_attempts',
    value: 5,
    type: 'number',
    category: 'security',
    label: 'Máximo de Tentativas de Login',
    description: 'Número máximo de tentativas de login antes de bloquear por 15 minutos',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'audit_log_retention_days',
    value: 90,
    type: 'number',
    category: 'security',
    label: 'Dias de Retenção de Logs de Auditoria',
    description: 'Logs mais antigos serão arquivados automaticamente (0 = nunca arquivar)',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'session_timeout_hours',
    value: 24,
    type: 'number',
    category: 'security',
    label: 'Timeout de Sessão (horas)',
    description: 'Tempo máximo de duração da sessão do usuário antes de expirar',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'maintenance_mode',
    value: false,
    type: 'boolean',
    category: 'security',
    label: 'Modo Manutenção',
    description: 'Quando ativo, apenas rootAdmin pode acessar o sistema',
    updatedBy: 'SYSTEM',
  },
  
  // Asana Settings
  {
    key: 'asana_allowed_file_types',
    value: ['.zip'],
    type: 'json',
    category: 'asana',
    label: 'Tipos de Arquivo Permitidos',
    description: 'Extensões de arquivo permitidas para upload no Asana (ex: .zip, .pdf, .png)',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'asana_max_file_size_mb',
    value: 10,
    type: 'number',
    category: 'asana',
    label: 'Tamanho Máximo de Arquivo (MB)',
    description: 'Tamanho máximo permitido por arquivo para upload no Asana',
    updatedBy: 'SYSTEM',
  },
  {
    key: 'asana_max_files_per_task',
    value: 5,
    type: 'number',
    category: 'asana',
    label: 'Máximo de Arquivos por Tarefa',
    description: 'Quantidade máxima de arquivos que podem ser anexados a uma tarefa',
    updatedBy: 'SYSTEM',
  },
  
  // General Settings
  {
    key: 'app_name',
    value: 'Task Manager',
    type: 'string',
    category: 'general',
    label: 'Nome da Aplicação',
    description: 'Nome exibido no cabeçalho e título da página',
    updatedBy: 'SYSTEM',
  },
];

async function seedConfigs() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    console.log('\n📝 Criando configurações padrão...\n');

    for (const config of defaultConfigs) {
      try {
        // Usar upsert para não sobrescrever valores existentes
        const existing = await SystemConfig.findOne({ key: config.key });
        
        if (existing) {
          console.log(`  ⏭️  ${config.key}: já existe (valor: ${JSON.stringify(existing.value)})`);
        } else {
          await SystemConfig.create(config);
          console.log(`  ✅ ${config.key}: criado (valor: ${JSON.stringify(config.value)})`);
        }
      } catch (err) {
        if (err.code === 11000) {
          console.log(`  ⏭️  ${config.key}: já existe`);
        } else {
          console.error(`  ❌ ${config.key}: erro -`, err.message);
        }
      }
    }

    console.log('\n✅ Seed de configurações concluído!');
    console.log('\n📊 Resumo das configurações:');
    
    const allConfigs = await SystemConfig.find({}).sort({ category: 1, key: 1 });
    
    let currentCategory = '';
    for (const config of allConfigs) {
      if (config.category !== currentCategory) {
        currentCategory = config.category;
        console.log(`\n  [${currentCategory.toUpperCase()}]`);
      }
      console.log(`    ${config.label}: ${JSON.stringify(config.value)}`);
    }

  } catch (error) {
    console.error('❌ Erro no seed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
    process.exit(0);
  }
}

seedConfigs();
