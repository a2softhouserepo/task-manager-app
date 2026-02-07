#!/usr/bin/env node

/**
 * Script to seed the database with team members
 * 
 * Usage: node scripts/seed-team-members.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX =  process.env.DB_PREFIX;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

// TeamMember Schema
const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String },
  icon: { type: String, default: '👤' },
  color: { type: String, default: '#3B82F6' },
  active: { type: Boolean, default: true },
  createdBy: { type: String },
}, { timestamps: true });

const TeamMember = mongoose.model('TeamMember', teamMemberSchema, `${DB_PREFIX}team-members`);

const teamMembers = [
  { name: 'Ana Silva', role: 'Desenvolvedora Frontend', icon: '👩‍💻', color: '#3B82F6' },
  { name: 'Bruno Santos', role: 'Desenvolvedor Backend', icon: '👨‍💻', color: '#10B981' },
  { name: 'Carla Oliveira', role: 'Designer', icon: '👩‍🎨', color: '#EC4899' },
  { name: 'Diego Lima', role: 'DevOps', icon: '🧑‍💼', color: '#F59E0B' },
  { name: 'Elena Costa', role: 'Gerente de Projetos', icon: '👩‍💼', color: '#8B5CF6' },
];

async function seedTeamMembers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    console.log('\nSeeding team members...');
    
    for (const memberData of teamMembers) {
      const existingMember = await TeamMember.findOne({ name: memberData.name });
      
      if (existingMember) {
        console.log(`  ⚠️  Team member "${memberData.name}" already exists, skipping...`);
        continue;
      }
      
      const member = new TeamMember(memberData);
      await member.save();
      console.log(`  ✅ Created team member: ${memberData.icon} ${memberData.name} (${memberData.role})`);
    }
    
    console.log('\n✅ Team members seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding team members:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedTeamMembers();
