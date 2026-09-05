// Shared TerminalActivationToken signing/persistence logic (DL-046/048/054),
// used by both console-issue-terminal-activation-token (manual/WhatsApp-
// triggered issuance) and console-confirm-invoice-payment (payment-triggered
// renewal, DL-054). Shared between these two Edge Functions specifically
// because BOTH already run in the same Deno Edge Function runtime — unlike
// apps/console's zero-shared-runtime rule (DL-038), which exists because a
// Vite-bundled browser app and a Deno function have no build pipeline in
// common, there is no such boundary between two Edge Functions in this same
// supabase/functions tree, so duplicating the ECDSA signing dance a third
// time here would be pure duplication with no isolation benefit.
import { createClient } from 'npm:@supabase/supabase-js@2';

type SupabaseAdminClient = ReturnType<typeof createClient>;

// DL-048: the key currently signing new tokens. See
// server/lib/terminalActivationToken.ts's TERMINAL_TOKEN_PUBLIC_KEYS
// registry and scripts/generate-terminal-token-keypair.mjs for the
// rotation procedure this constant is part of.
export const CURRENT_KEY_ID = 'v1';

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PREFIX-<epoch-ms>-<random> — same shape as server/lib/ids.ts's
// generateId(), but a random suffix rather than an in-process counter,
// since a stateless Edge Function invocation has no counter to keep and a
// counter wouldn't be collision-safe across concurrent invocations anyway.
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function importSigningKey(): Promise<CryptoKey> {
  const signingSecretName = `TERMINAL_TOKEN_SIGNING_PRIVATE_KEY_${CURRENT_KEY_ID.toUpperCase()}`;
  const privateKeyPem = Deno.env.get(signingSecretName);
  if (!privateKeyPem) {
    throw new Error(`${signingSecretName} is not configured`);
  }
  const pemBody = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const pkcs8Der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', pkcs8Der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export interface IssuedTerminalToken {
  id: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

// Caller computes issuedAt/expiresAt explicitly rather than this function
// reading "now" or a validity-days count implicitly — mirrors
// calculateInvoiceLineItems' "caller passes the exact already-selected
// values" discipline (DL-047). This is what lets a renewal (DL-054) set
// expiresAt to an invoice's own period_end exactly, while manual console
// issuance (DL-046/048) computes it from an operator-supplied or default
// validityDays — both go through this identical signing/persist path.
export async function signAndPersistTerminalActivationToken(
  admin: SupabaseAdminClient,
  signingKey: CryptoKey,
  params: { tenantId: string; terminalId: string; planTier: string; issuedAt: string; expiresAt: string; issuedBy: string }
): Promise<IssuedTerminalToken> {
  const payload = {
    tenantId: params.tenantId,
    terminalId: params.terminalId,
    planTier: params.planTier,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    keyId: CURRENT_KEY_ID,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, payloadBytes);
  const token = `${b64url(payloadBytes.buffer)}.${b64url(signature)}`;

  const id = generateId('TAT');
  const { error } = await admin.from('terminal_activation_tokens').insert({
    id,
    tenant_id: params.tenantId,
    terminal_id: params.terminalId,
    plan_tier: params.planTier,
    issued_at: params.issuedAt,
    expires_at: params.expiresAt,
    signature: token,
    status: 'active',
    issued_by: params.issuedBy,
  });
  if (error) throw error;

  return { id, token, issuedAt: params.issuedAt, expiresAt: params.expiresAt };
}
