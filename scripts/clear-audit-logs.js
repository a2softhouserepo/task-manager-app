#!/usr/bin/env node

/**
 * Script to clear all audit logs from the database
 * 
 * Usage: node scripts/clear-audit-logs.js
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

async function clearAuditLogs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    const count = await mongoose.connection.collection(`${DB_PREFIX}audit-logs`).countDocuments();
    console.log(`\n⚠️  Found ${count} audit logs to delete.`);
    
    rl.question('Are you sure you want to delete ALL audit logs? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const result = await mongoose.connection.collection(`${DB_PREFIX}audit-logs`).deleteMany({});
        console.log(`\n✅ Deleted ${result.deletedCount} audit logs.`);
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

clearAuditLogs();
