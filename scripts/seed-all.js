#!/usr/bin/env node

/**
 * Script to seed all data at once
 * 
 * Usage: node scripts/seed-all.js
 * 
 * This script runs:
 * 1. seed-users.js
 * 2. seed-categories.js
 * 3. seed-clients.js
 * 4. seed-tasks.js
 */

const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'seed-users.js',
  'seed-categories.js',
  'seed-clients.js',
  'seed-tasks.js',
];

async function seedAll() {
  console.log('🚀 Starting full database seed...\n');
  console.log('═'.repeat(50));
  
  for (const script of scripts) {
    console.log(`\n📦 Running ${script}...\n`);
    console.log('─'.repeat(50));
    
    try {
      execSync(`node ${path.join(__dirname, script)}`, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });
    } catch (error) {
      console.error(`\n❌ Error running ${script}`);
      // Continue with other scripts
    }
    
    console.log('─'.repeat(50));
  }
  
  console.log('\n═'.repeat(50));
  console.log('\n✅ Database seeding complete!');
  console.log('\nYou can now start the app with: npm run dev');
  console.log('\nLogin credentials:');
  console.log('  root / root123 (Root Admin - full access)');
  console.log('  admin / admin123 (Admin - manage own records)');
  console.log('  user / user123 (User - view and create only)');
}

seedAll();
