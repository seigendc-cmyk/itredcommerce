// Conflict resolution (DL-007). Deliberately its own module, independent
// of the drain loop, so the four-category decision logic can be tested in
// isolation from network/retry concerns.

import type { OutboxRow, PushOutcome } from './types';
import { categoryForTable } from './entityRules';

export type ConflictResolution =
  // Remote value is kept; this local push is dropped (marked synced,
  // never retried) because it lost the comparison — or, for ledger
  // entities, because a fact should never be overwritten regardless of
  // timestamps.
  | { action: 'DISCARD_LOCAL'; reason: string }
  // Local value should overwrite the remote one; the caller should retry
  // the push (typically as a forced-overwrite request).
  | { action: 'OVERRIDE_REMOTE'; reason: string };

/**
 * Resolves a single CONFLICT outcome for one outbox row. Pure — no I/O —
 * the caller (the drain loop) is responsible for acting on the decision
 * (retrying the push, or marking the row synced/discarded).
 */
export function resolveConflict(
  row: OutboxRow,
  outcome: Extract<PushOutcome, { kind: 'CONFLICT' }>
): ConflictResolution {
  const category = categoryForTable(row.entityTable);

  if (category === 'LEDGER') {
    // A genuine conflict should never happen for an insert-once fact — the
    // server is expected to report ALREADY_EXISTS for a duplicate, not
    // CONFLICT. If it does happen anyway (e.g. a bug upstream), the safe
    // default is to never let a "conflict" overwrite a fact.
    return { action: 'DISCARD_LOCAL', reason: 'ledger entities are never overwritten by conflict resolution' };
  }

  // CACHED_AGGREGATE, SINGLE_OWNER_WORKFLOW, and CONFIG all resolve the
  // same way: last-write-wins, comparing when this local write happened
  // (the outbox row's created_at) against when the remote row was last
  // updated.
  const localWriteTime = Date.parse(row.createdAt);
  const remoteUpdateTime = Date.parse(outcome.remoteUpdatedAt);

  if (Number.isNaN(localWriteTime) || Number.isNaN(remoteUpdateTime)) {
    // Can't compare — don't guess. Keep the remote value, since silently
    // overwriting with an unverifiable timestamp is the riskier failure
    // mode for shared/aggregate data.
    return { action: 'DISCARD_LOCAL', reason: 'unparseable timestamp; defaulting to remote value' };
  }

  if (localWriteTime > remoteUpdateTime) {
    return { action: 'OVERRIDE_REMOTE', reason: `local write (${row.createdAt}) is newer than remote (${outcome.remoteUpdatedAt})` };
  }
  return { action: 'DISCARD_LOCAL', reason: `remote write (${outcome.remoteUpdatedAt}) is newer than or equal to local (${row.createdAt})` };
}
