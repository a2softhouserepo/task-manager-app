import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended for GCM (new format)
const LEGACY_IV_LENGTH = 16; // Legacy format used 16 bytes
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:'; // Version prefix for future key rotation

/**
 * Derives a 32-byte encryption key from ENCRYPT_KEY_SECRET environment variable.
 * Uses SHA-256 to ensure consistent key length.
 */
function getKey(): Buffer {
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) {
    throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  }
  // Derive 32-byte key deterministically from secret
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns encrypted string with prefix 'enc:v1:' for version control.
 * Idempotent: if already encrypted, returns as-is.
 * 
 * @param plain - Plain text string to encrypt
 * @returns Encrypted string with format: enc:v1:base64(iv + tag + ciphertext)
 */
export function encryptString(plain: string): string {
  // Handle null, undefined, empty strings
  if (plain == null || plain === '') return plain;
  if (typeof plain !== 'string') return plain;
  
  // Already encrypted? Return as-is (idempotent)
  if (plain.startsWith(PREFIX)) return plain;

  try {
    const key = getKey();
    // Debug key hash
    if (process.env.NODE_ENV === 'development') {
      const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
      console.log(`[CRYPTO] Encrypting with key hash: ${keyHash}`);
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plain, 'utf8')),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine: IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext
    const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    
    return `${PREFIX}${payload}`;
  } catch (error) {
    console.error('[CRYPTO] Encryption failed:', error);
    throw error;
  }
}

/**
 * Decrypts a string encrypted with encryptString().
 * Supports both new format (enc:v1:base64) and legacy format (hex:hex:hex).
 * 
 * @param enc - Encrypted string
 * @returns Decrypted plain text string
 */
export function decryptString(enc: string): string {
  // Handle null, undefined, non-strings
  if (!enc || typeof enc !== 'string') return enc;
  
  // New format: enc:v1:base64(iv + tag + ciphertext)
  if (enc.startsWith(PREFIX)) {
    try {
      const payload = Buffer.from(enc.slice(PREFIX.length), 'base64');
      
      // Extract components
      const iv = payload.slice(0, IV_LENGTH);
      const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
      
      const key = getKey();
      // Debug key hash
      if (process.env.NODE_ENV === 'development') {
        const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
        console.log(`[CRYPTO] Decrypting (new format) with key hash: ${keyHash}, payload length: ${payload.length}, iv: ${iv.length}, tag: ${tag.length}, cipher: ${ciphertext.length}`);
      }
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      // Decryption failed - data may be corrupted or encrypted with different key
      if (process.env.NODE_ENV === 'development') {
        console.error(`[CRYPTO] Failed to decrypt new format data:`, error instanceof Error ? error.message : error);
        console.error(`[CRYPTO] Encrypted value preview: ${enc.substring(0, 50)}...`);
      }
      // Return original encrypted value - it will be flagged as encrypted by isEncrypted()
      return enc;
    }
  }
  
  // Legacy format: iv:tag:ciphertext (all in hex, separated by colons)
  // Legacy used 16-byte IV and ENCRYPTION_KEY instead of ENCRYPT_KEY_SECRET
  if (enc.includes(':') && enc.split(':').length >= 3) {
    const parts = enc.split(':');
    if (parts.length < 3) return enc;
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts.slice(2).join(':'), 'hex');
    
    // Legacy format validation: IV should be 16 bytes (not 12)
    if (iv.length !== LEGACY_IV_LENGTH || tag.length !== TAG_LENGTH) {
      return enc; // Not legacy encrypted format
    }
    
    // Try with ENCRYPT_KEY_SECRET first, then fall back to ENCRYPTION_KEY
    let key = getKey();
    const legacyKey = process.env.ENCRYPTION_KEY;
    
    // Try current key first
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (firstError) {
      // If failed and we have a legacy key, try that
      if (legacyKey) {
        key = Buffer.from(legacyKey, 'hex');
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
        
        return decrypted.toString('utf8');
      }
      throw firstError;
    }
  }
  
  // Not encrypted in any recognized format
  return enc;
}

/**
 * Checks if a string is encrypted (has the enc:v1: prefix or legacy format).
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // New format
  if (value.startsWith(PREFIX)) return true;
  
  // Legacy format: hex:hex:hex with at least 3 parts
  if (value.includes(':')) {
    const parts = value.split(':');
    if (parts.length >= 3) {
      // Check if first two parts look like hex (IV and TAG)
      const firstPart = parts[0];
      const secondPart = parts[1];
      
      // Legacy IV should be 32 hex chars (16 bytes), TAG should be 32 hex chars (16 bytes)
      if (firstPart.length === 32 && secondPart.length === 32) {
        return /^[0-9a-f]+$/i.test(firstPart) && /^[0-9a-f]+$/i.test(secondPart);
      }
    }
  }
  
  return false;
}

/**
 * Creates an HMAC hash of a value for indexing/searching encrypted fields.
 * Useful when you need exact-match searches on encrypted data.
 * 
 * @param value - Plain text value to hash
 * @returns HMAC-SHA256 hash in hex format
 */
export function createSearchableHash(value: string): string {
  if (!value || typeof value !== 'string') return '';
  
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) {
    throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  }
  
  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex');
}

/**
 * Creates a deterministic blind index (HMAC) for exact-match searching on encrypted fields.
 * Normalizes input (trim + lowercase) for consistent search behavior.
 * 
 * @param value - Plain text value to hash
 * @returns HMAC-SHA256 hash in hex format
 */
export function createBlindIndex(value: string): string {
  if (!value || typeof value !== 'string') return '';
  
  const secret = process.env.ENCRYPT_KEY_SECRET;
  if (!secret) {
    throw new Error('ENCRYPT_KEY_SECRET environment variable is not set');
  }
  
  // Normalize: trim and lowercase for consistent searching
  const normalized = value.trim().toLowerCase();
  
  return crypto
    .createHmac('sha256', secret)
    .update(normalized)
    .digest('hex');
}
