import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { decideTerminalTokenSync, type RemoteTerminalTokenRow } from './terminalActivationTokenPull';

// decideTerminalTokenSync forwards an injectable public-key registry to
// verifyTerminalActivationToken (same seam that module exposes for its own
// tests) so a genuine REPLACE outcome can be exercised here against a
// locally generated keypair, without the real private key — which never
// leaves the Supabase Edge Function secret it's stored as.
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const TEST_KEY_ID = 'test-v1';
const TEST_PUBLIC_KEYS = {
  [TEST_KEY_ID]: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeRemoteRow(overrides: { tenant_id?: string; terminal_id?: string; issued_at?: string; keyId?: string } = {}): RemoteTerminalTokenRow {
  const payload = {
    tenantId: overrides.tenant_id ?? 'TEN-1',
    terminalId: overrides.terminal_id ?? 'TERM-1',
    planTier: 'PROFESSIONAL',
    issuedAt: overrides.issued_at ?? '2026-02-01T00:00:00.000Z',
    expiresAt: '2026-03-01T00:00:00.000Z',
    keyId: overrides.keyId ?? TEST_KEY_ID,
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
  const signature = cryptoSign('sha256', payloadBytes, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return {
    signature: `${b64url(payloadBytes)}.${b64url(signature)}`,
    tenant_id: payload.tenantId,
    terminal_id: payload.terminalId,
    issued_at: payload.issuedAt,
  };
}

const EXPECTED = { tenantId: 'TEN-1', terminalId: 'TERM-1' };
const NOW = new Date('2026-02-15T00:00:00.000Z'); // before the test tokens' expiresAt

test('sync-down: no remote token at all is a no-op', () => {
  const decision = decideTerminalTokenSync(null, null, EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'SKIP_NO_REMOTE_TOKEN');
});

test('sync-down: no locally cached token replaces with the valid remote one', () => {
  const remote = makeRemoteRow({ issued_at: '2026-02-01T00:00:00.000Z' });
  const decision = decideTerminalTokenSync(remote, null, EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'REPLACE');
});

test('sync-down: a genuinely newer, validly signed remote token replaces the stale cached one', () => {
  const remote = makeRemoteRow({ issued_at: '2026-02-10T00:00:00.000Z' });
  const decision = decideTerminalTokenSync(remote, '2026-01-01T00:00:00.000Z', EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'REPLACE');
});

test('sync-down: a remote token older than the cached one is skipped as stale, not replaced', () => {
  const remote = makeRemoteRow({ issued_at: '2026-01-01T00:00:00.000Z' });
  const decision = decideTerminalTokenSync(remote, '2026-02-01T00:00:00.000Z', EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'SKIP_STALE');
});

test('sync-down: a remote token with the same issued_at as the cached one is skipped as stale', () => {
  const remote = makeRemoteRow({ issued_at: '2026-02-01T00:00:00.000Z' });
  const decision = decideTerminalTokenSync(remote, '2026-02-01T00:00:00.000Z', EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'SKIP_STALE');
});

test('sync-down: a newer remote token that fails signature verification is never replaced', () => {
  const remote = makeRemoteRow({ issued_at: '2026-02-10T00:00:00.000Z', keyId: 'unregistered-key' });
  const decision = decideTerminalTokenSync(remote, '2026-01-01T00:00:00.000Z', EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'SKIP_INVALID');
  assert.equal(decision.reason, 'invalid-signature');
});

test('sync-down: a newer remote token issued to a different terminal is never replaced', () => {
  const remote = makeRemoteRow({ issued_at: '2026-02-10T00:00:00.000Z', terminal_id: 'TERM-OTHER' });
  const decision = decideTerminalTokenSync(remote, '2026-01-01T00:00:00.000Z', EXPECTED, NOW, TEST_PUBLIC_KEYS);
  assert.equal(decision.action, 'SKIP_INVALID');
  assert.equal(decision.reason, 'identity-mismatch');
});
