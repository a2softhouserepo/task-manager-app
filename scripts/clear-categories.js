#!/usr/bin/env node

/**
 * Script to clear all categories from the database
 * 
 * Usage: node scripts/clear-categories.js
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

async function clearCategories() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    const count = await mongoose.connection.collection(`${DB_PREFIX}categories`).countDocuments();
    console.log(`\n⚠️  Found ${count} categories to delete.`);
    
    rl.question('Are you sure you want to delete ALL categories? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const result = await mongoose.connection.collection(`${DB_PREFIX}categories`).deleteMany({});
        console.log(`\n✅ Deleted ${result.deletedCount} categories.`);
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

clearCategories();
