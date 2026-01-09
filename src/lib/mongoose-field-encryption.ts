import { Schema } from 'mongoose';
import { encryptString, decryptString, isEncrypted, createBlindIndex } from './crypto';

interface FieldEncryptionOptions {
  fields: string[];
  blindIndexFields?: string[]; // Fields that need exact-match search via HMAC hash
}

/**
 * Mongoose plugin to automatically encrypt/decrypt specified string fields.
 * 
 * Features:
 * - Encrypts fields before saving (pre-save hook)
 * - Encrypts fields in updates (pre-update hooks)
 * - Decrypts fields after loading from DB (post-init, post-find hooks)
 * - Idempotent: won't double-encrypt already encrypted values
 * - Handles nested fields (e.g., 'address.street')
 * 
 * Usage:
 * ```typescript
 * schema.plugin(fieldEncryptionPlugin, { fields: ['description', 'notes'] });
 * ```
 * 
 * @param schema - Mongoose schema to add encryption to
 * @param options - Configuration object with fields array
 */
export function fieldEncryptionPlugin(schema: Schema, options: FieldEncryptionOptions) {
  if (!options || !Array.isArray(options.fields) || options.fields.length === 0) {
    throw new Error('fieldEncryptionPlugin requires options.fields array with at least one field');
  }

  const fields = options.fields;
  const blindIndexFields = options.blindIndexFields || [];

  /**
   * Checks if a value should be encrypted.
   * Returns true for non-empty strings that aren't already encrypted.
   */
  function shouldEncrypt(value: any): boolean {
    return typeof value === 'string' && value.length > 0 && !isEncrypted(value);
  }

  /**
   * Gets a value from document (handles both Mongoose docs and plain objects)
   */
  function getValue(doc: any, path: string): any {
    return doc.get ? doc.get(path) : doc[path];
  }

  /**
   * Sets a value on document (handles both Mongoose docs and plain objects)
   */
  function setValue(doc: any, path: string, value: any): void {
    if (doc.set) {
      doc.set(path, value);
    } else {
      doc[path] = value;
    }
  }

  // ==========================================
  // PRE-SAVE: Encrypt fields before saving and generate blind indexes
  // ==========================================
  schema.pre('save', function (next) {
    try {
      // 1. Generate blind indexes BEFORE encrypting (need plain text to hash)
      for (const path of blindIndexFields) {
        const value = getValue(this, path);
        if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
          const hash = createBlindIndex(value);
          setValue(this, `${path}Hash`, hash);
        }
      }

      // 2. Encrypt the fields
      for (const path of fields) {
        const value = getValue(this, path);
        if (shouldEncrypt(value)) {
          const encrypted = encryptString(value);
          setValue(this, path, encrypted);
        }
      }
      next();
    } catch (error) {
      next(error as any);
    }
  });

  // ==========================================
  // PRE-UPDATE: Encrypt fields in updates
  // ==========================================
  function encryptUpdateFields(this: any, next: any) {
    try {
      const update = this.getUpdate();
      if (!update) return next();

      /**
       * Process an object that might contain field updates
       * Handles $set, direct updates, and nested updates
       */
      function processUpdateObject(obj: any) {
        if (!obj || typeof obj !== 'object') return;

        // Handle $set operator
        if (obj.$set) {
          // Generate blind indexes first (before encryption)
          for (const path of blindIndexFields) {
            const value = obj.$set[path];
            if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
              obj.$set[`${path}Hash`] = createBlindIndex(value);
            }
          }

          // Then encrypt
          for (const path of fields) {
            const value = obj.$set[path];
            if (shouldEncrypt(value)) {
              obj.$set[path] = encryptString(value);
            }
          }
        }

        // Handle direct field updates at top level
        // Generate blind indexes first
        for (const path of blindIndexFields) {
          const value = obj[path];
          if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
            obj[`${path}Hash`] = createBlindIndex(value);
          }
        }

        // Then encrypt
        for (const path of fields) {
          const value = obj[path];
          if (shouldEncrypt(value)) {
            obj[path] = encryptString(value);
          }
        }
      }

      processUpdateObject(update);
      next();
    } catch (error) {
      next(error);
    }
  }

  schema.pre('findOneAndUpdate', encryptUpdateFields);
  schema.pre('updateOne', encryptUpdateFields);
  schema.pre('updateMany', encryptUpdateFields);

  // ==========================================
  // POST-INIT: Decrypt when loading from DB
  // ==========================================
  function decryptDocument(doc: any) {
    if (!doc) return;
    
    // Track if we've already tried to decrypt this document
    if (doc._decryptionAttempted) return;
    doc._decryptionAttempted = true;

    for (const path of fields) {
      const value = getValue(doc, path);
      if (typeof value === 'string' && isEncrypted(value)) {
        const decrypted = decryptString(value);
        // Only set if decryption returned different value
        if (decrypted !== value) {
          setValue(doc, path, decrypted);
        } else if (process.env.NODE_ENV === 'development') {
          // Value is still encrypted after decrypt attempt - data may be corrupted
          console.warn(`[CRYPTO] Field "${path}" remains encrypted (doc _id: ${doc._id})`);
        }
      }
    }
  }

  // Decrypt single document after init (when loading from DB)
  schema.post('init', function (doc: any) {
    decryptDocument(doc);
  });

  // Decrypt array of documents after find
  schema.post('find', function (docs: any[]) {
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        decryptDocument(doc);
      }
    }
  });

  // Decrypt single document after findOne
  schema.post('findOne', function (doc: any) {
    decryptDocument(doc);
  });

  // Decrypt document after findOneAndUpdate
  schema.post('findOneAndUpdate', function (doc: any) {
    decryptDocument(doc);
  });
}
