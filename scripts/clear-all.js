#!/usr/bin/env node

/**
 * Script to clear ALL data from the database
 * 
 * Usage: node scripts/clear-all.js
 * 
 * ⚠️ WARNING: This will delete EVERYTHING!
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX =  process.env.DB_PREFIX;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const collections = [
  'categories',
  'team-members',
  'clients',
  'tasks',
  'audit-logs',
];

async function clearAll() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    console.log('\n⚠️  This will delete ALL data from:');
    for (const col of collections) {
      const count = await mongoose.connection.collection(`${DB_PREFIX}${col}`).countDocuments().catch(() => 0);
      console.log(`  - ${DB_PREFIX}${col}: ${count} documents`);
    }
    
    rl.question('\nAre you sure you want to delete EVERYTHING? Type "DELETE ALL" to confirm: ', async (answer) => {
      if (answer === 'DELETE ALL') {
        console.log('\nDeleting...');
        
        for (const col of collections) {
          try {
            const result = await mongoose.connection.collection(`${DB_PREFIX}${col}`).deleteMany({});
            console.log(`  ✅ ${DB_PREFIX}${col}: deleted ${result.deletedCount} documents`);
          } catch (error) {
            console.log(`  ⚠️  ${DB_PREFIX}${col}: collection may not exist`);
          }
        }
        
        console.log('\n✅ All data cleared!');
      } else {
        console.log('\n❌ Operation cancelled.');
      }
      
      await mongoose.disconnect();
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
  }
}

clearAll();
