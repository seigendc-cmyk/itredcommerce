// ZIMRA private-key encryption at rest (Prompt 16, DL-075). Deno/Web
// Crypto equivalent of server/lib/fiscalCrypto.ts's AES-256-GCM shape —
// NOT a shared import of that file, deliberately. That module runs in the
// Express process and is keyed by FISCAL_CREDENTIALS_KEY, a per-terminal
// secret that must stay off Supabase entirely; this module runs inside the
// zimra-fiscal-service Edge Function, the one place DL-075 designates as
// the ZIMRA device certificate/private key's sole holder, so it is keyed
// by a DIFFERENT secret — ZIMRA_CREDENTIALS_KEY, an Edge Function secret
// (Deno.env, never written to any database, never sent to a client). Using
// the same key for both would let every terminal decrypt the ZIMRA private
// key, which is exactly what DL-075 exists to prevent.
//
// See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's ZIMRA FISCALIZATION ADDENDUM.

const ALGORITHM = 'AES-GCM';
const TAG_LENGTH_BITS = 128;
const TAG_LENGTH_BYTES = TAG_LENGTH_BITS / 8;

export interface ZimraEncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(input: string): Uint8Array {
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function loadKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('ZIMRA_CREDENTIALS_KEY');
  if (!raw) {
    throw new Error('ZIMRA_CREDENTIALS_KEY is not configured on this Edge Function — cannot encrypt or decrypt the ZIMRA private key.');
  }
  const keyBytes = b64decode(raw);
  if (keyBytes.length !== 32) {
    throw new Error('ZIMRA_CREDENTIALS_KEY must decode (base64) to exactly 32 bytes.');
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

// Web Crypto's AES-GCM appends the auth tag to the ciphertext output
// (unlike Node's crypto, which exposes it via a separate getAuthTag()
// call) — split it off here so the stored shape matches fiscalCrypto.ts's
// three-column convention (ciphertext / iv / authTag) exactly, even though
// Web Crypto itself doesn't require the split.
export async function encryptZimraSecret(plaintext: string): Promise<ZimraEncryptedPayload> {
  const key = await loadKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH_BITS }, key, encoded)
  );
  const ciphertext = combined.slice(0, combined.length - TAG_LENGTH_BYTES);
  const authTag = combined.slice(combined.length - TAG_LENGTH_BYTES);
  return {
    ciphertext: b64encode(ciphertext),
    iv: b64encode(iv),
    authTag: b64encode(authTag),
  };
}

export async function decryptZimraSecret(payload: ZimraEncryptedPayload): Promise<string> {
  const key = await loadKey();
  const iv = b64decode(payload.iv);
  const ciphertext = b64decode(payload.ciphertext);
  const authTag = b64decode(payload.authTag);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH_BITS }, key, combined);
  return new TextDecoder().decode(decrypted);
}
