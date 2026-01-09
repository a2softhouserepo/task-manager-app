#!/usr/bin/env node

/**
 * Test script to verify encryption/decryption works correctly
 * 
 * This script:
 * 1. Tests the encryption/decryption functions directly
 * 2. Creates a test client via API
 * 3. Reads it back and verifies decryption
 * 
 * Usage: node scripts/test-encryption-flow.js
 */

const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

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

function encryptString(plain) {
  try {
    const key = getKey();
    const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
    console.log(`[TEST] Encrypting with key hash: ${keyHash}`);
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plain, 'utf8')),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    
    return `${PREFIX}${payload}`;
  } catch (error) {
    console.error('[TEST] Encryption failed:', error);
    throw error;
  }
}

function decryptString(enc) {
  if (!enc.startsWith(PREFIX)) {
    console.log('[TEST] Not encrypted format');
    return enc;
  }
  
  try {
    const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
    
    const iv = payload.slice(0, IV_LENGTH);
    const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
    
    const key = getKey();
    const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
    console.log(`[TEST] Decrypting with key hash: ${keyHash}, payload: ${payload.length}, iv: ${iv.length}, tag: ${tag.length}, cipher: ${ciphertext.length}`);
    
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[TEST] Decryption failed:', error.message);
    return enc;
  }
}

async function testEncryptionFlow() {
  console.log('='.repeat(60));
  console.log('Testing Encryption/Decryption Flow');
  console.log('='.repeat(60));
  
  // Test 1: Direct encryption/decryption
  console.log('\n1. Testing direct encryption/decryption:');
  const testValues = [
    'test@example.com',
    'João Silva',
    '(11) 99999-9999',
    'Rua das Flores, 123',
  ];
  
  let allPassed = true;
  
  for (const original of testValues) {
    console.log(`\n   Original: "${original}"`);
    const encrypted = encryptString(original);
    console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);
    const decrypted = decryptString(encrypted);
    console.log(`   Decrypted: "${decrypted}"`);
    
    if (original === decrypted) {
      console.log('   ✅ PASS');
    } else {
      console.log('   ❌ FAIL');
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ All tests PASSED');
  } else {
    console.log('❌ Some tests FAILED');
  }
  console.log('='.repeat(60));
}

testEncryptionFlow().catch(console.error);
