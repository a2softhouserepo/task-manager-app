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
    console.log(`[TEST] Encrypting with key hash: ${crypto.createHash('sha256').update(key).digest('hex').substring(0, 8)}`);
    
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
  if (enc.startsWith(PREFIX)) {
    try {
      const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
      
      const iv = payload.slice(0, IV_LENGTH);
      const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
      
      const key = getKey();
      console.log(`[TEST] Decrypting with key hash: ${crypto.createHash('sha256').update(key).digest('hex').substring(0, 8)}`);
      
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[TEST] Decryption failed:', error);
      return enc;
    }
  }
  return enc;
}

// Test
const original = 'test@example.com';
console.log('Original:', original);
const encrypted = encryptString(original);
console.log('Encrypted:', encrypted);
const decrypted = decryptString(encrypted);
console.log('Decrypted:', decrypted);

if (original === decrypted) {
  console.log('SUCCESS: Decryption matches original');
} else {
  console.error('FAILURE: Decryption does not match');
}
