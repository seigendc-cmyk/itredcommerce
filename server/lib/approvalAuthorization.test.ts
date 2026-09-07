import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeApprovalDecision } from './approvalAuthorization';

test('a STORE_MANAGER deciding someone else\'s request is allowed', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'STORE_MANAGER' }, 'STF-2');
  assert.deepEqual(result, { allowed: true });
});

test('a SYS_ADMIN deciding someone else\'s request is allowed', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'SYS_ADMIN' }, 'STF-2');
  assert.deepEqual(result, { allowed: true });
});

test('a CASHIER is rejected regardless of who requested it', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'CASHIER' }, 'STF-2');
  assert.deepEqual(result, { allowed: false, reason: 'NOT_MANAGER' });
});

test('a manager deciding their own request is rejected as self-approval', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'STORE_MANAGER' }, 'STF-1');
  assert.deepEqual(result, { allowed: false, reason: 'SELF_APPROVAL' });
});

test('role check takes priority over self-approval when both would fail', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'CASHIER' }, 'STF-1');
  assert.deepEqual(result, { allowed: false, reason: 'NOT_MANAGER' });
});

test('a request with no recorded requester (null) is not treated as self-approval', () => {
  const result = authorizeApprovalDecision({ id: 'STF-1', role: 'STORE_MANAGER' }, null);
  assert.deepEqual(result, { allowed: true });
});
