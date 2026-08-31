import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Fiscal credential encryption (Prompt 11). AES-256-GCM, key held ONLY in
// this process's own environment (FISCAL_CREDENTIALS_KEY) — never sent to
// Supabase, never logged. See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
// Fiscalization addendum for why this is the credential-storage design:
// Supabase and local SQLite only ever hold the ciphertext this module
// produces, so neither the platform operator's own Supabase access nor a
// stolen SQLite file can recover a tenant's plaintext fiscal credentials
// without also having this same env var — which is distributed to every
// terminal under a shared branch registration out-of-band (a manual
// deployment step, not something this code automates).
//
// A terminal with no FISCAL_CREDENTIALS_KEY set simply cannot encrypt or
// decrypt fiscal credentials; callers fail loudly rather than silently
// falling back to plaintext storage.

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

function loadKey(): Buffer {
  const raw = process.env.FISCAL_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error('FISCAL_CREDENTIALS_KEY is not set — fiscal credentials cannot be encrypted or decrypted on this install.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('FISCAL_CREDENTIALS_KEY must decode (base64) to exactly 32 bytes.');
  }
  return key;
}

export function isFiscalCryptoConfigured(): boolean {
  return Boolean(process.env.FISCAL_CREDENTIALS_KEY);
}

export function encryptFiscalCredentials(plaintext: Record<string, string>): EncryptedPayload {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(plaintext);
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptFiscalCredentials(payload: EncryptedPayload): Record<string, string> {
  const key = loadKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// Use anywhere a credentials object might otherwise end up in a log line
// or error message — never JSON.stringify a raw credentials object
// directly.
export function redactCredentialsForLogging(credentials: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const key of Object.keys(credentials)) {
    redacted[key] = '***REDACTED***';
  }
  return redacted;
}
