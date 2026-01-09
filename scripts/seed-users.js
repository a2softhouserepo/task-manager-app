#!/usr/bin/env node

/**
 * Script to seed the database with test users
 * 
 * Usage: node scripts/seed-users.js
 * 
 * Creates:
 * - root / root123 (rootAdmin)
 * - admin / admin123 (admin)
 * - user / user123 (user)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

// User Schema (inline for script)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  role: { type: String, enum: ['rootAdmin', 'admin', 'user'], default: 'user' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

const User = mongoose.model('User', userSchema, `${DB_PREFIX}users`);

const users = [
  {
    username: 'root',
    password: 'root123',
    name: 'Root Administrator',
    email: 'root@taskmanager.local',
    role: 'rootAdmin',
    active: true,
  },
  {
    username: 'admin',
    password: 'admin123',
    name: 'Administrador',
    email: 'admin@taskmanager.local',
    role: 'admin',
    active: true,
  },
  {
    username: 'user',
    password: 'user123',
    name: 'Usuário Padrão',
    email: 'user@taskmanager.local',
    role: 'user',
    active: true,
  },
];

async function seedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    console.log('\nSeeding users...');
    
    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });
      
      if (existingUser) {
        console.log(`  ⚠️  User "${userData.username}" already exists, skipping...`);
        continue;
      }
      
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = new User({
        ...userData,
        password: hashedPassword,
      });
      
      await user.save();
      console.log(`  ✅ Created user: ${userData.username} (${userData.role})`);
    }
    
    console.log('\n✅ Users seeded successfully!');
    console.log('\nCredentials:');
    console.log('  root / root123 (Root Admin)');
    console.log('  admin / admin123 (Admin)');
    console.log('  user / user123 (User)');
    
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedUsers();
