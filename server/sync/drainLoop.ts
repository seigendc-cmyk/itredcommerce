// The background drain process (DL-006): reads eligible outbox rows
// oldest-first, pushes them to Supabase via an injected RemoteSyncClient,
// and applies backoff/conflict-resolution outcomes. Kept separate from
// conflictResolution.ts (the decision logic) and backoff.ts (the delay
// math) so each is independently testable.

import type { DatabaseSync } from 'node:sqlite';
import type { OutboxRow, RemoteSyncClient } from './types';
import type { ConnectivityMonitor } from './connectivity';
import { computeBackoffDelayMs, DEFAULT_BACKOFF_OPTIONS, type BackoffOptions } from './backoff';
import { resolveConflict } from './conflictResolution';

export interface DrainOptions {
  batchSize: number;
  backoff: BackoffOptions;
  now: () => Date;
}

export const DEFAULT_DRAIN_OPTIONS: DrainOptions = {
  batchSize: 50,
  backoff: DEFAULT_BACKOFF_OPTIONS,
  now: () => new Date(),
};

export interface DrainSummary {
  attempted: number;
  synced: number;
  retryScheduled: number;
  rejected: number;
  skippedForOrdering: number;
}

interface OutboxDbRow {
  id: number;
  tenant_id: string | null;
  entity_table: string;
  entity_pk: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  origin_terminal_id: string | null;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
}

function toOutboxRow(dbRow: OutboxDbRow): OutboxRow {
  return {
    id: dbRow.id,
    tenantId: dbRow.tenant_id,
    entityTable: dbRow.entity_table,
    entityPk: dbRow.entity_pk,
    operation: dbRow.operation,
    payload: JSON.parse(dbRow.payload),
    originTerminalId: dbRow.origin_terminal_id,
    status: dbRow.status as OutboxRow['status'],
    attemptCount: dbRow.attempt_count,
    nextAttemptAt: dbRow.next_attempt_at,
    lastError: dbRow.last_error,
    createdAt: dbRow.created_at,
    syncedAt: dbRow.synced_at,
  };
}

/**
 * Processes up to `batchSize` eligible outbox rows once. Does not loop or
 * schedule itself — callers (startDrainLoop, or a test) decide cadence.
 * Rows are processed oldest-first; once a row for a given (table, pk) needs
 * a retry, later rows for that same entity in this batch are skipped
 * rather than applied out of order.
 */
export async function drainOnce(
  db: DatabaseSync,
  client: RemoteSyncClient,
  options: DrainOptions = DEFAULT_DRAIN_OPTIONS
): Promise<DrainSummary> {
  const nowIso = options.now().toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM outbox WHERE status = 'PENDING' AND next_attempt_at <= ? ORDER BY id ASC LIMIT ?`
    )
    .all(nowIso, options.batchSize) as unknown as OutboxDbRow[];

  const summary: DrainSummary = { attempted: 0, synced: 0, retryScheduled: 0, rejected: 0, skippedForOrdering: 0 };
  const blockedEntities = new Set<string>();

  for (const dbRow of rows) {
    const entityKey = `${dbRow.entity_table}:${dbRow.entity_pk}`;
    if (blockedEntities.has(entityKey)) {
      summary.skippedForOrdering += 1;
      continue;
    }

    const row = toOutboxRow(dbRow);
    summary.attempted += 1;

    let outcome;
    try {
      outcome = await client.push(row);
    } catch (error) {
      outcome = { kind: 'NETWORK_ERROR' as const, error };
    }

    if (outcome.kind === 'ACCEPTED' || outcome.kind === 'ALREADY_EXISTS') {
      markSynced(db, row.id, options.now());
      summary.synced += 1;
      continue;
    }

    if (outcome.kind === 'CONFLICT') {
      const resolution = resolveConflict(row, outcome);
      if (resolution.action === 'DISCARD_LOCAL') {
        markSynced(db, row.id, options.now(), `resolved: ${resolution.reason}`);
        summary.synced += 1;
        continue;
      }
      // OVERRIDE_REMOTE: retry soon, forcing an overwrite next attempt.
      // A short fixed delay is enough here (not full backoff) — we
      // already know we should win, this isn't a failure being retried.
      scheduleRetry(db, row.id, dbRow.attempt_count, options.now(), 250, resolution.reason);
      blockedEntities.add(entityKey);
      summary.retryScheduled += 1;
      continue;
    }

    if (outcome.kind === 'REJECTED') {
      markRejected(db, row.id, outcome.reason);
      blockedEntities.add(entityKey);
      summary.rejected += 1;
      continue;
    }

    // NETWORK_ERROR: back off and retry.
    const nextAttempt = dbRow.attempt_count + 1;
    const delayMs = computeBackoffDelayMs(nextAttempt, options.backoff);
    scheduleRetry(db, row.id, dbRow.attempt_count, options.now(), delayMs, describeNetworkError(outcome.error));
    blockedEntities.add(entityKey);
    summary.retryScheduled += 1;
  }

  return summary;
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function markSynced(db: DatabaseSync, id: number, now: Date, note?: string) {
  db.prepare(`UPDATE outbox SET status = 'SYNCED', synced_at = ?, last_error = ? WHERE id = ?`).run(
    now.toISOString(),
    note ?? null,
    id
  );
}

function markRejected(db: DatabaseSync, id: number, reason: string) {
  db.prepare(`UPDATE outbox SET status = 'CONFLICT_UNRESOLVED', last_error = ? WHERE id = ?`).run(reason, id);
}

function scheduleRetry(db: DatabaseSync, id: number, previousAttemptCount: number, now: Date, delayMs: number, error: string) {
  const nextAttemptAt = new Date(now.getTime() + delayMs).toISOString();
  db.prepare(`UPDATE outbox SET attempt_count = ?, next_attempt_at = ?, last_error = ? WHERE id = ?`).run(
    previousAttemptCount + 1,
    nextAttemptAt,
    error,
    id
  );
}

/**
 * Wires drainOnce to the connectivity signal (DL-008): drains repeatedly
 * while online (to clear a backlog quickly after reconnecting) and on
 * every ONLINE transition, plus a periodic nudge so rows whose backoff
 * timer elapses while already online still get retried. Returns a stop
 * function.
 */
export function startDrainLoop(
  db: DatabaseSync,
  client: RemoteSyncClient,
  connectivity: ConnectivityMonitor,
  options: DrainOptions = DEFAULT_DRAIN_OPTIONS,
  nudgeIntervalMs = 30_000
): () => void {
  let stopped = false;

  const drainUntilIdle = async () => {
    if (connectivity.getState() !== 'ONLINE') return;
    let summary = await drainOnce(db, client, options);
    while (!stopped && connectivity.getState() === 'ONLINE' && summary.synced + summary.retryScheduled + summary.rejected > 0 && summary.attempted >= options.batchSize) {
      summary = await drainOnce(db, client, options);
    }
  };

  const unsubscribe = connectivity.subscribe((state) => {
    if (state === 'ONLINE') void drainUntilIdle();
  });
  const interval = setInterval(() => void drainUntilIdle(), nudgeIntervalMs);

  return () => {
    stopped = true;
    unsubscribe();
    clearInterval(interval);
  };
}
