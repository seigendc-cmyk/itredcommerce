import { verify as cryptoVerify } from 'node:crypto';

// Offline verification for TerminalActivationTokens (DL-039 layer 3,
// DL-046, DL-048). Keyed by `keyId` so a future key rotation can add a new
// entry here without invalidating tokens already signed under an older key
// (they stay verifiable until they expire + grace period lapses) — see
// DL-048's key rotation decision. Values are not secret; each is
// meaningless without its corresponding private key, held only as a
// Supabase Edge Function secret (see scripts/generate-terminal-token-
// keypair.mjs and supabase/functions/console-issue-terminal-activation-
// token). Regenerate a key with that script; add its printed keyId/public
// key pair here rather than replacing an existing entry.
export const TERMINAL_TOKEN_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  v1: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnr4fWVmnrteothPBjOjnSavkJBurNvIit/9zLiG4Y8PRtzMGW/vfnIhFreXfrQteafG1Zxn/tIw1gvBOmZ1xcg==',
};

export interface TerminalActivationPayload {
  tenantId: string;
  terminalId: string;
  planTier: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
}

export type TerminalTokenStatus =
  | 'valid'
  | 'expired-in-grace'
  | 'expired-locked'
  | 'invalid-signature'
  | 'identity-mismatch';

export interface TerminalTokenVerification {
  status: TerminalTokenStatus;
  // null only for invalid-signature — an unverified payload is never
  // trustworthy enough to hand back to a caller, even for display.
  payload: TerminalActivationPayload | null;
  // Set only for expired-in-grace; null in every other status (including
  // expired-locked, where the window has already closed).
  graceDaysRemaining: number | null;
}

function base64urlToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

// The issuance Edge Function signs via the Web Crypto API (crypto.subtle),
// which emits ECDSA signatures in raw IEEE P1363 (r||s) form. Node's
// crypto.verify defaults to DER-encoded ECDSA signatures — dsaEncoding:
// 'ieee-p1363' is required here or every signature this codebase ever
// issues will fail to verify. See DL-046 for why this cross-runtime detail
// matters.
function verifySignature(publicKeySpkiB64: string, payloadBytes: Buffer, signatureBytes: Buffer): boolean {
  const publicKeyDer = Buffer.from(publicKeySpkiB64, 'base64');
  return cryptoVerify(
    'sha256',
    payloadBytes,
    { key: publicKeyDer, format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' },
    signatureBytes
  );
}

const GRACE_PERIOD_WORKING_DAYS = 5;
const DEFAULT_WORKING_DAY_CALENDAR: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);

function isWorkingDay(date: Date, workingDays: ReadonlySet<number>): boolean {
  return workingDays.has(date.getUTCDay());
}

function addWorkingDays(from: Date, workingDays: number, calendar: ReadonlySet<number>): Date {
  const result = new Date(from);
  let remaining = workingDays;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isWorkingDay(result, calendar)) remaining -= 1;
  }
  return result;
}

function countWorkingDaysUntil(from: Date, until: Date, calendar: ReadonlySet<number>): number {
  let remaining = 0;
  const cursor = new Date(from);
  while (cursor < until) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, calendar)) remaining += 1;
  }
  return remaining;
}

/**
 * Verifies a pasted TerminalActivationToken string end to end — signature,
 * well-formed payload, that it's issued to *this* tenant/terminal, and
 * (DL-040) the 5-working-day grace period math — and reports a single
 * status a caller can act on directly. Never trusts the payload's own
 * claims without checking the signature first, and never makes a network
 * call: this must produce a correct answer even if the terminal never
 * reconnects again (DL-039/DL-040).
 */
export function verifyTerminalActivationToken(
  tokenString: string,
  expected: { tenantId: string; terminalId: string },
  now: Date = new Date(),
  workingDayCalendar: ReadonlySet<number> = DEFAULT_WORKING_DAY_CALENDAR,
  // Injectable so tests can verify against a locally generated keypair
  // without the real private key, which (by design) never leaves the
  // Supabase Edge Function secret it's stored as. Production callers never
  // pass this — it defaults to the real registry.
  publicKeys: Readonly<Record<string, string>> = TERMINAL_TOKEN_PUBLIC_KEYS
): TerminalTokenVerification {
  const invalidSignature: TerminalTokenVerification = { status: 'invalid-signature', payload: null, graceDaysRemaining: null };

  const parts = tokenString.trim().split('.');
  if (parts.length !== 2) return invalidSignature;

  const [payloadPart, signaturePart] = parts;
  let payloadBytes: Buffer;
  let signatureBytes: Buffer;
  try {
    payloadBytes = base64urlToBuffer(payloadPart);
    signatureBytes = base64urlToBuffer(signaturePart);
  } catch {
    return invalidSignature;
  }

  let payload: TerminalActivationPayload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf-8'));
  } catch {
    return invalidSignature;
  }
  if (!payload.tenantId || !payload.terminalId || !payload.planTier || !payload.issuedAt || !payload.expiresAt || !payload.keyId) {
    return invalidSignature;
  }

  const publicKey = publicKeys[payload.keyId];
  if (!publicKey) return invalidSignature;

  let signatureOk: boolean;
  try {
    signatureOk = verifySignature(publicKey, payloadBytes, signatureBytes);
  } catch {
    return invalidSignature;
  }
  if (!signatureOk) return invalidSignature;

  if (payload.tenantId !== expected.tenantId || payload.terminalId !== expected.terminalId) {
    return { status: 'identity-mismatch', payload, graceDaysRemaining: null };
  }

  const expiresAt = new Date(payload.expiresAt);
  if (now < expiresAt) {
    return { status: 'valid', payload, graceDaysRemaining: null };
  }

  const lockAt = addWorkingDays(expiresAt, GRACE_PERIOD_WORKING_DAYS, workingDayCalendar);
  if (now < lockAt) {
    return { status: 'expired-in-grace', payload, graceDaysRemaining: countWorkingDaysUntil(now, lockAt, workingDayCalendar) };
  }

  return { status: 'expired-locked', payload, graceDaysRemaining: null };
}
