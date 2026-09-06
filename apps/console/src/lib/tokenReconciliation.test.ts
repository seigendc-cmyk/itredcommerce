import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTerminalActivationTokens } from './tokenReconciliation';
import type { TerminalActivationTokenRow, TerminalActivationConfirmationRow } from './consoleApi';

function makeToken(overrides: Partial<TerminalActivationTokenRow> = {}): TerminalActivationTokenRow {
  return {
    id: 'TOK-1',
    tenant_id: 'TEN-1',
    terminal_id: 'TERM-1',
    plan_tier: 'PROFESSIONAL',
    issued_at: '2026-02-01T00:00:00.000Z',
    expires_at: '2026-03-01T00:00:00.000Z',
    status: 'active',
    issued_by: 'operator-1',
    ...overrides,
  };
}

function makeConfirmation(overrides: Partial<TerminalActivationConfirmationRow> = {}): TerminalActivationConfirmationRow {
  return {
    id: 'CONF-1',
    tenant_id: 'TEN-1',
    terminal_id: 'TERM-1',
    token_issued_at: '2026-02-01T00:00:00.000Z',
    event_type: 'manual_paste',
    confirmed_at: '2026-02-01T00:05:00.000Z',
    ...overrides,
  };
}

test('a token with a matching confirmation is reported confirmed', () => {
  const [result] = reconcileTerminalActivationTokens([makeToken()], [makeConfirmation()]);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.confirmation?.id, 'CONF-1');
});

test('a token with no matching confirmation is reported awaiting-confirmation', () => {
  const [result] = reconcileTerminalActivationTokens([makeToken()], []);
  assert.equal(result.status, 'awaiting-confirmation');
  assert.equal(result.confirmation, null);
});

test('a confirmation for a different terminal_id never matches', () => {
  const [result] = reconcileTerminalActivationTokens(
    [makeToken()],
    [makeConfirmation({ terminal_id: 'TERM-OTHER' })]
  );
  assert.equal(result.status, 'awaiting-confirmation');
});

test('a confirmation for a different tenant_id never matches', () => {
  const [result] = reconcileTerminalActivationTokens(
    [makeToken()],
    [makeConfirmation({ tenant_id: 'TEN-OTHER' })]
  );
  assert.equal(result.status, 'awaiting-confirmation');
});

test('a confirmation with a different token_issued_at never matches (e.g. an older, superseded token)', () => {
  const [result] = reconcileTerminalActivationTokens(
    [makeToken()],
    [makeConfirmation({ token_issued_at: '2026-01-01T00:00:00.000Z' })]
  );
  assert.equal(result.status, 'awaiting-confirmation');
});

test('each token is matched independently against the full confirmation set', () => {
  const tokens = [
    makeToken({ id: 'TOK-1', terminal_id: 'TERM-1', issued_at: '2026-02-01T00:00:00.000Z' }),
    makeToken({ id: 'TOK-2', terminal_id: 'TERM-2', issued_at: '2026-02-05T00:00:00.000Z' }),
  ];
  const confirmations = [makeConfirmation({ terminal_id: 'TERM-1', token_issued_at: '2026-02-01T00:00:00.000Z' })];

  const results = reconcileTerminalActivationTokens(tokens, confirmations);
  assert.equal(results.find((r) => r.token.id === 'TOK-1')?.status, 'confirmed');
  assert.equal(results.find((r) => r.token.id === 'TOK-2')?.status, 'awaiting-confirmation');
});
