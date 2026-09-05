import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { verifyTerminalActivationToken, type TerminalActivationPayload } from './terminalActivationToken';

// Ephemeral test-only keypair — verifyTerminalActivationToken's optional
// 5th parameter (an injectable public-key registry) exists specifically so
// tests can do this without the real private key, which never leaves the
// Supabase Edge Function secret it's stored as (DL-046/DL-048).
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const TEST_KEY_ID = 'test-v1';
const TEST_PUBLIC_KEYS = {
  [TEST_KEY_ID]: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(payload: TerminalActivationPayload): string {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
  const signature = cryptoSign('sha256', payloadBytes, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${b64url(payloadBytes)}.${b64url(signature)}`;
}

const EXPECTED = { tenantId: 'TEN-1', terminalId: 'TERM-1' };

function basePayload(overrides: Partial<TerminalActivationPayload> = {}): TerminalActivationPayload {
  return {
    tenantId: EXPECTED.tenantId,
    terminalId: EXPECTED.terminalId,
    planTier: 'PROFESSIONAL',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-02-01T00:00:00.000Z',
    keyId: TEST_KEY_ID,
    ...overrides,
  };
}

test('a validly signed, unexpired token verifies as valid', () => {
  const token = signToken(basePayload());
  const now = new Date('2026-01-15T00:00:00.000Z'); // before expiresAt
  const result = verifyTerminalActivationToken(token, EXPECTED, now, undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'valid');
  assert.equal(result.payload?.tenantId, EXPECTED.tenantId);
});

test('signature tampering: a mutated payload fails verification', () => {
  const token = signToken(basePayload());
  const [payloadPart, signaturePart] = token.split('.');
  const payloadBytes = Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const mutated = JSON.parse(payloadBytes.toString('utf-8'));
  mutated.planTier = 'ENTERPRISE'; // attacker tries to upgrade their own plan tier
  const mutatedPayloadPart = b64url(Buffer.from(JSON.stringify(mutated), 'utf-8'));
  const tamperedToken = `${mutatedPayloadPart}.${signaturePart}`;

  const result = verifyTerminalActivationToken(tamperedToken, EXPECTED, new Date('2026-01-15T00:00:00.000Z'), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'invalid-signature');
  assert.equal(result.payload, null);
});

test('signature tampering: a mutated signature fails verification', () => {
  const token = signToken(basePayload());
  const [payloadPart, signaturePart] = token.split('.');
  const sigBytes = Buffer.from(signaturePart.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  sigBytes[0] ^= 0xff; // flip a bit
  const tamperedToken = `${payloadPart}.${b64url(sigBytes)}`;

  const result = verifyTerminalActivationToken(tamperedToken, EXPECTED, new Date('2026-01-15T00:00:00.000Z'), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'invalid-signature');
});

test('a token signed with an unregistered keyId fails verification', () => {
  const token = signToken(basePayload({ keyId: 'unknown-key' }));
  const result = verifyTerminalActivationToken(token, EXPECTED, new Date('2026-01-15T00:00:00.000Z'), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'invalid-signature');
});

test('identity mismatch: a token issued to a different terminalId is rejected', () => {
  const token = signToken(basePayload({ terminalId: 'TERM-OTHER' }));
  const result = verifyTerminalActivationToken(token, EXPECTED, new Date('2026-01-15T00:00:00.000Z'), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'identity-mismatch');
  // Identity is checked on an already-signature-verified payload, so it's
  // safe (and useful for logging) to hand it back even on a mismatch.
  assert.equal(result.payload?.terminalId, 'TERM-OTHER');
});

test('identity mismatch: a token issued to a different tenantId is rejected', () => {
  const token = signToken(basePayload({ tenantId: 'TEN-OTHER' }));
  const result = verifyTerminalActivationToken(token, EXPECTED, new Date('2026-01-15T00:00:00.000Z'), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'identity-mismatch');
});

// DL-040's 5-working-day grace period, evaluated against a fixed Mon-Fri
// calendar. expiresAt below is a Friday (2026-01-02); the 5 working days
// after it are Mon 01-05, Tue 01-06, Wed 01-07, Thu 01-08, Fri 01-09 — so
// the lock boundary (lockAt) is Fri 2026-01-09T00:00:00Z.
const FRIDAY_EXPIRY = '2026-01-02T00:00:00.000Z';

test('grace period boundary: just before the lock boundary is expired-in-grace', () => {
  const token = signToken(basePayload({ expiresAt: FRIDAY_EXPIRY }));
  const justInside = new Date('2026-01-08T23:59:59.999Z'); // one ms before the boundary
  const result = verifyTerminalActivationToken(token, EXPECTED, justInside, undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'expired-in-grace');
  assert.equal(result.graceDaysRemaining, 1); // Friday 01-09 itself still remains
});

test('grace period boundary: exactly at the lock boundary is expired-locked', () => {
  const token = signToken(basePayload({ expiresAt: FRIDAY_EXPIRY }));
  const atBoundary = new Date('2026-01-09T00:00:00.000Z');
  const result = verifyTerminalActivationToken(token, EXPECTED, atBoundary, undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'expired-locked');
  assert.equal(result.graceDaysRemaining, null);
});

test('grace period boundary: well past the lock boundary stays expired-locked', () => {
  const token = signToken(basePayload({ expiresAt: FRIDAY_EXPIRY }));
  const wellAfter = new Date('2026-02-01T00:00:00.000Z');
  const result = verifyTerminalActivationToken(token, EXPECTED, wellAfter, undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'expired-locked');
});

test('a token exactly at its expiresAt instant is already treated as expired, not valid', () => {
  const token = signToken(basePayload({ expiresAt: FRIDAY_EXPIRY }));
  const result = verifyTerminalActivationToken(token, EXPECTED, new Date(FRIDAY_EXPIRY), undefined, TEST_PUBLIC_KEYS);
  assert.notEqual(result.status, 'valid');
});

test('weekends are not counted as working days in the grace period', () => {
  // expiresAt Friday 2026-01-02T00:00:00Z: the FIRST working day after it
  // is Monday 01-05, not Saturday 01-03 — so one calendar day after expiry
  // (still the weekend) must still show 5 full working days remaining.
  const token = signToken(basePayload({ expiresAt: FRIDAY_EXPIRY }));
  const saturday = new Date('2026-01-03T00:00:00.000Z');
  const result = verifyTerminalActivationToken(token, EXPECTED, saturday, undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'expired-in-grace');
  assert.equal(result.graceDaysRemaining, 5);
});

test('a malformed token (wrong number of parts) is invalid-signature', () => {
  const result = verifyTerminalActivationToken('not-a-real-token', EXPECTED, new Date(), undefined, TEST_PUBLIC_KEYS);
  assert.equal(result.status, 'invalid-signature');
});
