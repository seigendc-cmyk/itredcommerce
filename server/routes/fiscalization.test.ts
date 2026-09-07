import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSubmissionsSummary } from './fiscalization';

// Locks in that removing the dead `r.status === 'FAILED'` clause changed
// nothing observable: non_retryable was always the only thing that ever
// actually got set, so failedCount must be identical to what the old
// (status === 'FAILED' || non_retryable) expression would have produced
// for every real row shape this codebase ever writes.

test('a non_retryable row counts as failed regardless of its status literal', () => {
  const rows = [{ status: 'PENDING', non_retryable: 1, created_at: new Date().toISOString() }];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.pendingCount, 0);
});

test('a status of literal "FAILED" with non_retryable false is NOT counted — this codebase never actually writes that status value, and the dead clause is gone', () => {
  const rows = [{ status: 'FAILED', non_retryable: 0, created_at: new Date().toISOString() }];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.failedCount, 0);
});

test('a PENDING, non-non_retryable row counts as pending, not failed', () => {
  const rows = [{ status: 'PENDING', non_retryable: 0, created_at: new Date().toISOString() }];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.failedCount, 0);
});

test('a PENDING row that is also non_retryable counts as failed only, not pending', () => {
  const rows = [{ status: 'PENDING', non_retryable: 1, created_at: new Date().toISOString() }];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.failedCount, 1);
});

test('SUBMITTED rows are neither pending nor failed', () => {
  const rows = [{ status: 'SUBMITTED', non_retryable: 0, created_at: new Date().toISOString() }];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.failedCount, 0);
});

test('empty rows produce a zeroed, non-alerting summary', () => {
  const summary = computeSubmissionsSummary([]);
  assert.deepEqual(summary, { pendingCount: 0, failedCount: 0, oldestPendingAgeMinutes: 0, alert: false });
});

test('alert fires when pending count reaches the threshold (5)', () => {
  const now = new Date().toISOString();
  const rows = Array.from({ length: 5 }, () => ({ status: 'PENDING', non_retryable: 0, created_at: now }));
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.pendingCount, 5);
  assert.equal(summary.alert, true);
});

test('alert fires when the oldest pending row exceeds 60 minutes, even with a single pending row', () => {
  const nowMs = Date.now();
  const old = new Date(nowMs - 61 * 60 * 1000).toISOString();
  const rows = [{ status: 'PENDING', non_retryable: 0, created_at: old }];
  const summary = computeSubmissionsSummary(rows, nowMs);
  assert.equal(summary.oldestPendingAgeMinutes, 61);
  assert.equal(summary.alert, true);
});

test('no alert when pending count and age are both under threshold', () => {
  const nowMs = Date.now();
  const recent = new Date(nowMs - 5 * 60 * 1000).toISOString();
  const rows = [{ status: 'PENDING', non_retryable: 0, created_at: recent }];
  const summary = computeSubmissionsSummary(rows, nowMs);
  assert.equal(summary.alert, false);
});

test('mixed batch: pendingCount and failedCount are computed independently and rows.length can exceed their sum', () => {
  const now = new Date().toISOString();
  const rows = [
    { status: 'PENDING', non_retryable: 0, created_at: now },
    { status: 'PENDING', non_retryable: 1, created_at: now }, // failed, not pending
    { status: 'SUBMITTED', non_retryable: 0, created_at: now }, // neither
  ];
  const summary = computeSubmissionsSummary(rows);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.failedCount, 1);
});
