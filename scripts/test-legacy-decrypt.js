const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const ALGO = 'aes-256-gcm';
const LEGACY_IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey() {
  // Try legacy key first
  const legacyKey = process.env.ENCRYPTION_KEY;
  if (legacyKey) {
    return Buffer.from(legacyKey, 'hex');
  }
  // Fallback to new key
  const secret = process.env.ENCRYPT_KEY_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

// Test with real data from MongoDB
const testValue = 'f711f25b7c3b867ad1cd5565b4f696a5:891d9370ea6718219d16ee5ce0ce9247:1cc31ebb14ab01e04e728656383e8a1c';

console.log('Testing legacy format decryption...\n');
console.log('Encrypted value:', testValue);

try {
  const parts = testValue.split(':');
  console.log('Parts:', parts.length);
  
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts.slice(2).join(':'), 'hex');
  
  console.log('IV length:', iv.length, '(expected', LEGACY_IV_LENGTH, ')');
  console.log('TAG length:', tag.length, '(expected', TAG_LENGTH, ')');
  console.log('Ciphertext length:', ciphertext.length);
  
  const key = getKey();
  console.log('Key length:', key.length);
  console.log('Using ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'YES' : 'NO');
  
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  console.log('\n✓ Decrypted:', decrypted.toString('utf8'));
} catch (error) {
  console.error('\n✗ Error:', error.message);
}
