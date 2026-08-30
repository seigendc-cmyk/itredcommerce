// Transactional outbox write path (DL-006). `applyWithOutbox` is the one
// function every local mutation that needs to reach Supabase should go
// through: it performs the live-table write and the outbox insert in a
// single SQLite transaction, so a crash between the two is impossible —
// either both happened or neither did.
//
// Deliberately takes a `db: DatabaseSync` parameter rather than importing
// server/db/connection's singleton, so tests can point it at a throwaway
// database instead of the real one.

import type { DatabaseSync } from 'node:sqlite';
import type { OutboxOperation } from './types';
import { categoryForTable, violatesImmutabilityGuard } from './entityRules';

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure — original error is what matters
    }
    throw err;
  }
}

export interface ApplyWithOutboxParams<T> {
  db: DatabaseSync;
  tenantId: string | null;
  table: string;
  pkColumn: string;
  pk: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  originTerminalId?: string | null;
  /** Performs the actual live-table write (an INSERT/UPDATE/DELETE statement execution). */
  apply: () => T;
}

export class ImmutabilityViolationError extends Error {
  constructor(table: string, pk: string) {
    super(`Refusing to update ${table} row ${pk}: it has already reached a locked terminal status.`);
    this.name = 'ImmutabilityViolationError';
  }
}

/**
 * Throws ImmutabilityViolationError if this UPDATE would touch a row that's
 * already reached a locked terminal status (DL-006). Exported so multi-row
 * write paths (applyBatchWithOutbox callers) can run the same check per row
 * without going through the single-entity applyWithOutbox wrapper.
 */
export function assertUpdateAllowed(db: DatabaseSync, table: string, pkColumn: string, pk: string): void {
  const currentRow = db
    .prepare(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`)
    .get(pk) as Record<string, unknown> | undefined;
  if (violatesImmutabilityGuard(table, 'UPDATE', currentRow)) {
    throw new ImmutabilityViolationError(table, pk);
  }
}

export function applyWithOutbox<T>(params: ApplyWithOutboxParams<T>): T {
  const { db, tenantId, table, pkColumn, pk, operation, payload, originTerminalId, apply } = params;

  // Fail fast on an unregistered table rather than silently syncing
  // something with no defined conflict-resolution behavior.
  categoryForTable(table);

  return withTransaction(db, () => {
    if (operation === 'UPDATE') {
      assertUpdateAllowed(db, table, pkColumn, pk);
    }

    const result = apply();

    db.prepare(
      `INSERT INTO outbox (tenant_id, entity_table, entity_pk, operation, payload, origin_terminal_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenantId, table, pk, operation, JSON.stringify(payload), originTerminalId ?? null);

    return result;
  });
}

export interface BatchEntry {
  table: string;
  pkColumn: string;
  pk: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
}

export interface ApplyBatchWithOutboxParams<T> {
  db: DatabaseSync;
  tenantId: string | null;
  originTerminalId?: string | null;
  /**
   * Performs every live-table write for this atomic unit (e.g. a checkout's
   * sale + line items + payments + inventory/customer updates) and returns
   * both the caller's result and the list of outbox entries to record for
   * it. Entries are built here rather than passed in up front because
   * autoincrement PKs (e.g. sale_line_items.id) aren't known until their
   * INSERT runs. Any UPDATE must call assertUpdateAllowed itself before
   * issuing the UPDATE statement.
   */
  apply: () => { result: T; entries: BatchEntry[] };
}

/**
 * Multi-row variant of applyWithOutbox (DL-006) for one atomic unit of work
 * that spans several tables/rows — a single checkout, for instance, which
 * needs its own outbox row per sale_line_items/sale_payments/etc. entry
 * rather than one row summarizing the whole sale. withTransaction isn't
 * reentrant, so this — not N calls to applyWithOutbox — is how a multi-table
 * write must be composed.
 */
export function applyBatchWithOutbox<T>(params: ApplyBatchWithOutboxParams<T>): T {
  const { db, tenantId, originTerminalId, apply } = params;

  return withTransaction(db, () => {
    const { result, entries } = apply();

    for (const entry of entries) {
      // Fail fast on an unregistered table rather than silently syncing
      // something with no defined conflict-resolution behavior.
      categoryForTable(entry.table);
      db.prepare(
        `INSERT INTO outbox (tenant_id, entity_table, entity_pk, operation, payload, origin_terminal_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(tenantId, entry.table, entry.pk, entry.operation, JSON.stringify(entry.payload), originTerminalId ?? null);
    }

    return result;
  });
}
