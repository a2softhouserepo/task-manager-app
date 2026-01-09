const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

function getKey() {
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) {
    throw new Error('ENCRYPT_KEY_SECRET not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function decryptString(enc) {
  if (!enc || typeof enc !== 'string') return enc;
  if (!enc.startsWith(PREFIX)) return enc;

  try {
    const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
    const iv = payload.slice(0, IV_LENGTH);
    const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
    
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[DECRYPT ERROR]', error.message);
    return enc;
  }
}

// Connect to MongoDB
const mongoose = require('mongoose');

console.log('ENCRYPT_KEY_SECRET:', process.env.ENCRYPT_KEY_SECRET ? 'SET ✓' : 'NOT SET ✗');
console.log('Connecting to MongoDB...\n');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-manager')
  .then(async () => {
    console.log('Connected to MongoDB ✓\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('tasks-clients');
    
    const clients = await collection.find().limit(3).toArray();
    
    console.log(`Found ${clients.length} clients\n`);
    
    for (const client of clients) {
      console.log('='.repeat(60));
      console.log('ID:', client._id);
      console.log('Name (raw):', client.name?.substring(0, 50) + '...');
      console.log('Is encrypted?', isEncrypted(client.name || ''));
      
      if (client.name && isEncrypted(client.name)) {
        const decrypted = decryptString(client.name);
        console.log('Decrypted:', decrypted);
      } else {
        console.log('NOT ENCRYPTED - showing as is:', client.name);
      }
      console.log();
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
