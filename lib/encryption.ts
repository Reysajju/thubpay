/**
 * ThubPay — Encryption Middleware
 * Thin wrapper around Supabase pgcrypto / Vault functions.
 * encryptField / decryptField are called only in server-side API routes —
 * NEVER in client components.
 * Per instructions.docx §3.2
 *
 * Production setup:
 *  1. Enable pgsodium extension in Supabase
 *  2. Store master key in Supabase Vault (backed by AWS KMS)
 *  3. Create encrypt_field() / decrypt_field() Postgres functions
 *  4. Call them via supabase.rpc() here
 *
 * The function signatures below are the stable API your application code
 * should use — the internals can be swapped from JS crypto → pgcrypto
 * without changing callers.
 */

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export type EncryptedValue = string; // base64-encoded ciphertext

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  // If the key is hex-encoded (64 chars = 32 bytes)
  if (key.length === 64) return Buffer.from(key, 'hex');
  // Otherwise derive a 32-byte key from whatever was provided
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * In production with Supabase Vault configured, delegates to pgcrypto.
 * Otherwise uses the ENCRYPTION_KEY env var for strong local encryption.
 */
export async function encryptField(
  plaintext: string
): Promise<EncryptedValue> {
  if (!plaintext) return '';

  // Production path: delegate to pgcrypto Postgres function if available
  if (process.env.USE_PG_ENCRYPTION === 'true') {
    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc('encrypt_field', {
      plaintext
    });
    if (error) throw new Error(`Encryption failed: ${error.message}`);
    return data as EncryptedValue;
  }

  // Strong AES-256-GCM encryption using ENCRYPTION_KEY
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a ciphertext string back to plaintext.
 * Must only be called server-side in API routes.
 */
export async function decryptField(ciphertext: EncryptedValue): Promise<string> {
  if (!ciphertext) return '';

  // AES-256-GCM path: reverse the strong encryption
  if (ciphertext.startsWith('enc:')) {
    const parts = ciphertext.slice(4).split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  // Legacy dev path: reverse the base64 encoding
  if (ciphertext.startsWith('dev:')) {
    const encoded = ciphertext.slice(4);
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  // pgcrypto path: delegate to Postgres function
  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc('decrypt_field', {
    ciphertext
  });
  if (error) throw new Error(`Decryption failed: ${error.message}`);
  return data as string;
}

/**
 * Encrypt a record's PII fields.
 * Convenience wrapper — pass field names to encrypt.
 */
export async function encryptRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...record };
  await Promise.all(
    fields.map(async (field) => {
      const value = result[field];
      if (typeof value === 'string') {
        (result[field] as unknown) = await encryptField(value);
      }
    })
  );
  return result;
}

/**
 * Decrypt a record's PII fields.
 * Convenience wrapper — pass field names to decrypt.
 */
export async function decryptRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...record };
  await Promise.all(
    fields.map(async (field) => {
      const value = result[field];
      if (typeof value === 'string') {
        (result[field] as unknown) = await decryptField(value);
      }
    })
  );
  return result;
}
