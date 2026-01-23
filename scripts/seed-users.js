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
const DB_PREFIX = process.env.DB_PREFIX;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}




// Funções de criptografia e plugin (copiadas do src/lib)
const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';
function getKey() {
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  return crypto.createHash('sha256').update(secret).digest();
}
function encryptString(plain) {
  if (plain == null || plain === '') return plain;
  if (typeof plain !== 'string') return plain;
  if (plain.startsWith(PREFIX)) return plain;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plain, 'utf8')),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${PREFIX}${payload}`;
}
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith(PREFIX)) return true;
  if (value.includes(':')) {
    const parts = value.split(':');
    if (parts.length >= 3) {
      const firstPart = parts[0];
      const secondPart = parts[1];
      if (firstPart.length === 32 && secondPart.length === 32) {
        return /^[0-9a-f]+$/i.test(firstPart) && /^[0-9a-f]+$/i.test(secondPart);
      }
    }
  }
  return false;
}
function createBlindIndex(value) {
  if (!value || typeof value !== 'string') return '';
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}
function fieldEncryptionPlugin(schema, options) {
  const fields = options.fields;
  const blindIndexFields = options.blindIndexFields || [];
  function shouldEncrypt(value) {
    return typeof value === 'string' && value.length > 0 && !isEncrypted(value);
  }
  function getValue(doc, path) {
    return doc.get ? doc.get(path) : doc[path];
  }
  function setValue(doc, path, value) {
    if (doc.set) doc.set(path, value); else doc[path] = value;
  }
  schema.pre('save', function (next) {
    try {
      for (const path of blindIndexFields) {
        const value = getValue(this, path);
        if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
          const hash = createBlindIndex(value);
          setValue(this, `${path}Hash`, hash);
        }
      }
      for (const path of fields) {
        const value = getValue(this, path);
        if (shouldEncrypt(value)) {
          const encrypted = encryptString(value);
          setValue(this, path, encrypted);
        }
      }
      next();
    } catch (error) { next(error); }
  });
}

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  emailHash: { type: String, index: true },
  role: { type: String, enum: ['rootAdmin', 'admin', 'user'], default: 'user' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true, collection: `${DB_PREFIX}users` });

// Pre-save hook to hash password with bcrypt
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    // Hash password with cost of 10
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.plugin(fieldEncryptionPlugin, {
  fields: ['email'],
  blindIndexFields: ['email'],
});
const User = mongoose.models[`${DB_PREFIX}users`] || mongoose.model(`${DB_PREFIX}users`, userSchema);


const isProd = process.argv.includes('--prod');

async function getRootUserInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
  }

  console.log('Modo produção: criar usuário administrador total');
  const username = await ask('Username do administrador: ');
  const password = await ask('Password do administrador: ');
  const name = await ask('Nome completo: ');
  const email = await ask('Email: ');
  rl.close();

  return [{
    username,
    password,
    name,
    email,
    role: 'rootAdmin',
    active: true,
  }];
}

const usersDefault = [
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

    let users;
    if (isProd) {
      users = await getRootUserInteractive();
    } else {
      users = usersDefault;
    }

    console.log('\nSeeding users...');


    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });

      if (existingUser) {
        console.log(`  ⚠️  User "${userData.username}" already exists, skipping...`);
        continue;
      }

      // O modelo já faz hash da senha no pre-save (se quiser garantir, pode-se adicionar hook aqui também)
      const user = new User({
        ...userData,
      });

      await user.save();
      console.log(`  ✅ Created user: ${userData.username} (${userData.role})`);
    }

    console.log('\n✅ Users seeded successfully!');
    if (!isProd) {
      console.log('\nCredentials:');
      console.log('  root / root123 (Root Admin)');
      console.log('  admin / admin123 (Admin)');
      console.log('  user / user123 (User)');
    }

  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedUsers();
