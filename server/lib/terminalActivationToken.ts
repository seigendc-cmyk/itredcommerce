import { verify as cryptoVerify } from 'node:crypto';

// Offline verification for TerminalActivationTokens (DL-039 layer 3,
// DL-046). The public key is not secret — it is meaningless without the
// private key held only as a Supabase Edge Function secret
// (TERMINAL_TOKEN_SIGNING_PRIVATE_KEY, see
// scripts/generate-terminal-token-keypair.mjs and
// supabase/functions/console-issue-terminal-activation-token). Regenerate
// both together; this constant must always match whichever private key the
// issuance function is actually signing with.
export const TERMINAL_TOKEN_PUBLIC_KEY_SPKI_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnr4fWVmnrteothPBjOjnSavkJBurNvIit/9zLiG4Y8PRtzMGW/vfnIhFreXfrQteafG1Zxn/tIw1gvBOmZ1xcg==';

export interface TerminalActivationPayload {
  tenantId: string;
  terminalId: string;
  planTier: string;
  issuedAt: string;
  expiresAt: string;
}

export type VerifyTerminalActivationTokenResult =
  | { valid: true; payload: TerminalActivationPayload }
  | { valid: false; reason: string };

function base64urlToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

// The issuance Edge Function signs via the Web Crypto API (crypto.subtle),
// which emits ECDSA signatures in raw IEEE P1363 (r||s) form. Node's
// crypto.verify defaults to DER-encoded ECDSA signatures — dsaEncoding:
// 'ieee-p1363' is required here or every signature this codebase ever
// issues will fail to verify. See the addendum's DL-046 for why this
// cross-runtime detail matters.
function verifySignature(payloadBytes: Buffer, signatureBytes: Buffer): boolean {
  const publicKeyDer = Buffer.from(TERMINAL_TOKEN_PUBLIC_KEY_SPKI_B64, 'base64');
  return cryptoVerify(
    'sha256',
    payloadBytes,
    { key: publicKeyDer, format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' },
    signatureBytes
  );
}

// Verifies a pasted TerminalActivationToken string end to end: signature,
// well-formed payload, and that it's issued to *this* tenant/terminal —
// never trusts the payload's own claims without checking the signature
// first. Never makes a network call — this must produce a correct answer
// even if the terminal never reconnects again (DL-039/DL-040).
export function verifyTerminalActivationToken(
  tokenString: string,
  expected: { tenantId: string; terminalId: string }
): VerifyTerminalActivationTokenResult {
  const parts = tokenString.trim().split('.');
  if (parts.length !== 2) return { valid: false, reason: 'Malformed token' };

  const [payloadPart, signaturePart] = parts;
  let payloadBytes: Buffer;
  let signatureBytes: Buffer;
  try {
    payloadBytes = base64urlToBuffer(payloadPart);
    signatureBytes = base64urlToBuffer(signaturePart);
  } catch {
    return { valid: false, reason: 'Malformed token' };
  }

  let signatureOk: boolean;
  try {
    signatureOk = verifySignature(payloadBytes, signatureBytes);
  } catch {
    return { valid: false, reason: 'Malformed token' };
  }
  if (!signatureOk) return { valid: false, reason: 'Invalid signature' };

  let payload: TerminalActivationPayload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf-8'));
  } catch {
    return { valid: false, reason: 'Malformed token payload' };
  }
  if (!payload.tenantId || !payload.terminalId || !payload.planTier || !payload.issuedAt || !payload.expiresAt) {
    return { valid: false, reason: 'Malformed token payload' };
  }

  if (payload.tenantId !== expected.tenantId || payload.terminalId !== expected.terminalId) {
    return { valid: false, reason: 'Token was not issued to this tenant/terminal' };
  }

  return { valid: true, payload };
}

export type ModuleLockStatus = 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED';

export interface ModuleLockState {
  status: ModuleLockStatus;
  locked: boolean;
  graceDaysRemaining: number | null;
  expiresAt: string;
}

const GRACE_PERIOD_WORKING_DAYS = 5;

function isWorkingDay(date: Date, workingDays: Set<number>): boolean {
  return workingDays.has(date.getUTCDay());
}

function addWorkingDays(from: Date, workingDays: number, calendar: Set<number>): Date {
  const result = new Date(from);
  let remaining = workingDays;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isWorkingDay(result, calendar)) remaining -= 1;
  }
  return result;
}

// DL-040: 5 working-day grace period after a TerminalActivationToken
// expires, evaluated entirely from the token's own expiry field plus the
// local clock — no network call, correct even if this terminal never
// reconnects after expiry. Default calendar is Mon-Fri; a tenant-editable
// calendar is a follow-up, not built here (see the addendum).
export function evaluateModuleLock(
  payload: TerminalActivationPayload,
  now: Date = new Date(),
  workingDayCalendar: Set<number> = new Set([1, 2, 3, 4, 5])
): ModuleLockState {
  const expiresAt = new Date(payload.expiresAt);
  if (now < expiresAt) {
    return { status: 'ACTIVE', locked: false, graceDaysRemaining: null, expiresAt: payload.expiresAt };
  }

  const lockAt = addWorkingDays(expiresAt, GRACE_PERIOD_WORKING_DAYS, workingDayCalendar);
  if (now < lockAt) {
    let remaining = 0;
    const cursor = new Date(now);
    while (cursor < lockAt) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (isWorkingDay(cursor, workingDayCalendar)) remaining += 1;
    }
    return { status: 'GRACE_PERIOD', locked: false, graceDaysRemaining: remaining, expiresAt: payload.expiresAt };
  }

  return { status: 'LOCKED', locked: true, graceDaysRemaining: 0, expiresAt: payload.expiresAt };
}
