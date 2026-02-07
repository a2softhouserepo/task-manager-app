#!/usr/bin/env node

/**
 * Script to clear all team members from the database
 * 
 * Usage: node scripts/clear-team-members.js
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

async function clearTeamMembers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    const count = await mongoose.connection.collection(`${DB_PREFIX}team-members`).countDocuments();
    console.log(`\n⚠️  Found ${count} team members to delete.`);
    
    rl.question('Are you sure you want to delete ALL team members? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const result = await mongoose.connection.collection(`${DB_PREFIX}team-members`).deleteMany({});
        console.log(`\n✅ Deleted ${result.deletedCount} team members.`);
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

clearTeamMembers();
