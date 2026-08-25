import crypto from 'crypto';

// ─── Credential Encryption Helper (AES-256-GCM) ─────────────
// Production-grade authenticated encryption using Node's built-in
// crypto module. Provides confidentiality + integrity via GCM mode.
//
// For multi-instance production deployments, replace the static key
// derivation with a KMS-backed key (AWS KMS, GCP KMS, HashiCorp Vault).
// The encrypt/decrypt interface stays the same.

// Refuse to start in production without a real encryption key. The previous
// fallback chain (GATEWAY_ENCRYPTION_KEY -> NEXTAUTH_SECRET -> public constant)
// meant any deployment missing the env var would silently encrypt all gateway
// secrets with a publicly-known key — full secret disclosure on DB read.
const RAW_APP_SECRET =
  process.env.GATEWAY_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!RAW_APP_SECRET || RAW_APP_SECRET.length < 32)) {
  throw new Error(
    '[crypto] FATAL: GATEWAY_ENCRYPTION_KEY (or NEXTAUTH_SECRET fallback) must be set to a strong (>= 32 char) value in production.'
  );
}
const APP_SECRET =
  RAW_APP_SECRET || 'thubpay-dev-only-encryption-key-not-for-prod';

// Derive a 32-byte (256-bit) AES key from the app secret using PBKDF2
// with a fixed salt. This ensures a consistent key across server
// restarts (critical for decrypting stored secrets).
const SALT = 'thubpay-gateway-encryption-salt-v1';
const ENCRYPTION_KEY = crypto.pbkdf2Sync(APP_SECRET, SALT, 100000, 32, 'sha512');

// Legacy XOR decryptor — used ONLY to migrate old secrets to AES-256-GCM.
// XOR has NO integrity check, so any DB-level compromise could craft a
// ciphertext that decrypts to a malicious plaintext. We log every use so
// admins can see when legacy values are still being read (and migrate them).
function legacyXorDecrypt(stored: string): string | null {
  try {
    const [salt, hex] = stored.split(':');
    if (!salt || !hex) return null;
    const key = `${salt}:${APP_SECRET}`;
    let out = '';
    for (let i = 0; i < hex.length; i += 2) {
      // Use Math.floor for integer division (the previous float-modulo
      // happened to work but was fragile and surprising).
      const c = parseInt(hex.slice(i, i + 2), 16) ^ key.charCodeAt(Math.floor(i / 2) % key.length);
      out += String.fromCharCode(c);
    }
    if (IS_PROD) {
      console.warn('[crypto] legacy XOR secret decrypted — run migrate-encryption to upgrade to AES-256-GCM.');
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext secret using AES-256-GCM.
 *
 * Output format: `v2:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * The `v2:` prefix distinguishes AES-256-GCM encrypted secrets from
 * legacy XOR-encrypted secrets (which have no prefix).
 *
 * @param plaintext - The secret to encrypt (e.g. Stripe secret key)
 * @returns Encrypted string, or empty string if input is empty
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(12); // 96-bit IV (standard for GCM)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `v2:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a secret. Supports both:
 *  - AES-256-GCM (v2: prefix) — current standard
 *  - Legacy XOR (no prefix) — auto-migrated on read
 *
 * @param stored - The encrypted string from the database
 * @returns Decrypted plaintext, or null if decryption fails
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;

  // AES-256-GCM encrypted (current)
  if (stored.startsWith('v2:')) {
    try {
      const parts = stored.split(':');
      // v2:<iv>:<authTag>:<ciphertext>
      if (parts.length !== 4) return null;

      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];

      const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Auth tag mismatch or corrupt data — decryption failed
      return null;
    }
  }

  // Legacy XOR-encrypted (backward compatibility)
  return legacyXorDecrypt(stored);
}

/**
 * Check if a stored secret uses the legacy XOR encryption (pre-v2).
 * Used by migration scripts to identify secrets that need re-encryption.
 */
export function isLegacyEncryption(stored: string | null | undefined): boolean {
  if (!stored) return false;
  return !stored.startsWith('v2:');
}

/**
 * Re-encrypt a legacy XOR-encrypted secret to AES-256-GCM.
 * Returns the new encrypted string, or the original if already v2.
 */
export function migrateToAES(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('v2:')) return stored; // Already AES-256-GCM

  const plaintext = legacyXorDecrypt(stored);
  if (plaintext === null) return null;

  return encryptSecret(plaintext);
}

// ─── API Key Generation ───────────────────────────────────────

/**
 * Generate a cryptographically secure API key.
 * Uses crypto.randomBytes for unpredictable randomness (not Math.random).
 */
export function generateApiKey(prefix: 'live' | 'test' = 'live'): {
  fullKey: string;
  keyHash: string;
  keyMasked: string;
} {
  // Use crypto.randomBytes for cryptographically secure randomness
  const randBytes = crypto.randomBytes(16);
  const rand = randBytes.toString('hex');

  const fullKey = `tpk_${prefix}_${rand}`;
  // SHA-256 hash for storage (one-way, not reversible)
  const keyHash = crypto.createHash('sha256').update(fullKey + APP_SECRET).digest('hex');
  const keyMasked = `tpk_${prefix}_${rand.slice(0, 4)}...${rand.slice(-4)}`;
  return { fullKey, keyHash, keyMasked };
}

/**
 * Verify an API key against its stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyApiKey(
  fullKey: string,
  storedHash: string
): boolean {
  const computedHash = crypto
    .createHash('sha256')
    .update(fullKey + APP_SECRET)
    .digest('hex');

  // Timing-safe comparison
  if (computedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/**
 * Create a cryptographically signed HMAC token for an invoice.
 * Used for secure guest checkout URLs without exposing sequential or guessable parameters.
 */
export function signInvoiceToken(invoiceId: string, totalCents: number, workspaceId: string): string {
  const payload = `${invoiceId}:${totalCents}:${workspaceId}`;
  const signature = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify a signed invoice checkout token.
 */
export function verifyInvoiceToken(token: string): { ok: true; invoiceId: string; totalCents: number; workspaceId: string } | { ok: false; error: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return { ok: false, error: 'Invalid token format' };

    const [invoiceId, totalCentsStr, workspaceId, signature] = parts;
    const payload = `${invoiceId}:${totalCentsStr}:${workspaceId}`;
    const expectedSignature = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');

    if (signature.length !== expectedSignature.length) return { ok: false, error: 'Invalid signature length' };
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) return { ok: false, error: 'Signature mismatch' };

    return {
      ok: true,
      invoiceId,
      totalCents: parseInt(totalCentsStr, 10),
      workspaceId,
    };
  } catch {
    return { ok: false, error: 'Malformed token' };
  }
}
