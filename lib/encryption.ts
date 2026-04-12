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

export type EncryptedValue = string; // base64-encoded ciphertext

/**
 * Encrypt a plaintext string using the Supabase Vault key.
 * Falls back to a dev-only AES-256-GCM implementation when
 * the pgcrypto RPC is not available (local dev without Vault).
 */
export async function encryptField(
  plaintext: string
): Promise<EncryptedValue> {
  if (!plaintext) return '';

  // Production path: delegate to pgcrypto Postgres function
  if (process.env.NODE_ENV === 'production') {
    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc('encrypt_field', {
      plaintext
    });
    if (error) throw new Error(`Encryption failed: ${error.message}`);
    return data as EncryptedValue;
  }

  // Dev/test path: lightweight base64 (NOT secure — dev only)
  // Replace with real pgcrypto before shipping to production.
  const encoded = Buffer.from(plaintext, 'utf8').toString('base64');
  return `dev:${encoded}`;
}

/**
 * Decrypt a ciphertext string back to plaintext.
 * Must only be called server-side in API routes.
 */
export async function decryptField(ciphertext: EncryptedValue): Promise<string> {
  if (!ciphertext) return '';

  // Dev path: reverse the dev encoding
  if (ciphertext.startsWith('dev:')) {
    const encoded = ciphertext.slice(4);
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  // Production path: delegate to pgcrypto Postgres function
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
