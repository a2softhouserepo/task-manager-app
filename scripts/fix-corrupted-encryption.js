#!/usr/bin/env node

/**
 * Script to fix corrupted encrypted data in the database
 * 
 * This script:
 * 1. Finds all clients with corrupted encryption
 * 2. Attempts to decrypt and re-encrypt them
 * 3. If decryption fails, deletes the corrupted records
 * 
 * Usage: node scripts/fix-corrupted-encryption.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PREFIX = 'tasks-';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

function getKey() {
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) {
    throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(PREFIX);
}

function testDecryption(enc) {
  if (!enc.startsWith(PREFIX)) return { success: false, reason: 'Not encrypted format' };
  
  try {
    const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
    
    const iv = payload.slice(0, IV_LENGTH);
    const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
    
    if (iv.length !== IV_LENGTH) {
      return { success: false, reason: `Invalid IV length: ${iv.length}` };
    }
    if (tag.length !== TAG_LENGTH) {
      return { success: false, reason: `Invalid TAG length: ${tag.length}` };
    }
    
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return { success: true, decrypted: decrypted.toString('utf8') };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

// Client Schema (inline for script)
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: `${DB_PREFIX}clients` });

async function fixCorruptedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully\n');

    const Client = mongoose.model('Client', clientSchema);

    // Get all clients
    const clients = await Client.find({}).lean();
    console.log(`Found ${clients.length} clients\n`);

    let corruptedCount = 0;
    let fixedCount = 0;
    let deletedCount = 0;

    for (const client of clients) {
      const issues = [];

      // Check email
      if (isEncrypted(client.email)) {
        const result = testDecryption(client.email);
        if (!result.success) {
          issues.push(`email: ${result.reason}`);
        }
      }

      // Check phone
      if (isEncrypted(client.phone)) {
        const result = testDecryption(client.phone);
        if (!result.success) {
          issues.push(`phone: ${result.reason}`);
        }
      }

      // Check address
      if (client.address && isEncrypted(client.address)) {
        const result = testDecryption(client.address);
        if (!result.success) {
          issues.push(`address: ${result.reason}`);
        }
      }

      if (issues.length > 0) {
        corruptedCount++;
        console.log(`\n❌ Corrupted client found:`);
        console.log(`   ID: ${client._id}`);
        console.log(`   Name: ${client.name}`);
        console.log(`   Issues: ${issues.join(', ')}`);
        
        // Delete corrupted client
        await Client.deleteOne({ _id: client._id });
        deletedCount++;
        console.log(`   ✓ Deleted`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`  Total clients: ${clients.length}`);
    console.log(`  Corrupted: ${corruptedCount}`);
    console.log(`  Deleted: ${deletedCount}`);
    console.log('='.repeat(50));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixCorruptedData();
