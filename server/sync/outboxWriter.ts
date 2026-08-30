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

export function applyWithOutbox<T>(params: ApplyWithOutboxParams<T>): T {
  const { db, tenantId, table, pkColumn, pk, operation, payload, originTerminalId, apply } = params;

  // Fail fast on an unregistered table rather than silently syncing
  // something with no defined conflict-resolution behavior.
  categoryForTable(table);

  return withTransaction(db, () => {
    if (operation === 'UPDATE') {
      const currentRow = db
        .prepare(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`)
        .get(pk) as Record<string, unknown> | undefined;
      if (violatesImmutabilityGuard(table, operation, currentRow)) {
        throw new ImmutabilityViolationError(table, pk);
      }
    }

    const result = apply();

    db.prepare(
      `INSERT INTO outbox (tenant_id, entity_table, entity_pk, operation, payload, origin_terminal_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenantId, table, pk, operation, JSON.stringify(payload), originTerminalId ?? null);

    return result;
  });
}
