#!/usr/bin/env node

/**
 * Script to seed the database with categories
 * 
 * Usage: node scripts/seed-categories.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

// Category Schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: '📋' },
  color: { type: String, default: '#3B82F6' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema, `${DB_PREFIX}categories`);

const categories = [
  { name: 'Desenvolvimento Web', description: 'Sites, sistemas e aplicações web', icon: '💻', color: '#3B82F6' },
  { name: 'Design Gráfico', description: 'Logos, artes e materiais visuais', icon: '🎨', color: '#EC4899' },
  { name: 'Marketing Digital', description: 'Redes sociais, ads e campanhas', icon: '📊', color: '#10B981' },
  { name: 'Consultoria', description: 'Consultoria técnica e de negócios', icon: '💡', color: '#F59E0B' },
  { name: 'Suporte Técnico', description: 'Manutenção e suporte de sistemas', icon: '🔧', color: '#6366F1' },
  { name: 'Redação', description: 'Textos, artigos e conteúdo', icon: '📝', color: '#8B5CF6' },
  { name: 'SEO', description: 'Otimização para buscadores', icon: '🚀', color: '#06B6D4' },
  { name: 'E-commerce', description: 'Lojas virtuais e marketplaces', icon: '🛒', color: '#84CC16' },
  { name: 'App Mobile', description: 'Aplicativos iOS e Android', icon: '📱', color: '#F97316' },
  { name: 'Infraestrutura', description: 'Servidores, cloud e DevOps', icon: '⚡', color: '#EF4444' },
];

async function seedCategories() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    console.log('\nSeeding categories...');
    
    for (const catData of categories) {
      const existingCat = await Category.findOne({ name: catData.name });
      
      if (existingCat) {
        console.log(`  ⚠️  Category "${catData.name}" already exists, skipping...`);
        continue;
      }
      
      const category = new Category(catData);
      await category.save();
      console.log(`  ✅ Created category: ${catData.icon} ${catData.name}`);
    }
    
    console.log('\n✅ Categories seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedCategories();
