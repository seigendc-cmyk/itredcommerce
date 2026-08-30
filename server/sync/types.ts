// Shared types for the outbox sync engine (Prompt 2). Deliberately free of
// any Express/HTTP-framework dependency — only node:sqlite and plain TS —
// so this module can be lifted into whatever runtime hosts the Tauri
// terminal/head-office apps later without a rewrite.

export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type OutboxStatus = 'PENDING' | 'SYNCED' | 'CONFLICT_UNRESOLVED';

export interface OutboxRow {
  id: number;
  tenantId: string | null;
  entityTable: string;
  entityPk: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  originTerminalId: string | null;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  syncedAt: string | null;
}

/**
 * The four conflict-resolution categories from
 * ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-007. Every synced table must be
 * classified into exactly one.
 */
export type EntityCategory =
  | 'LEDGER'              // insert-once fact; conflict = idempotent no-op
  | 'CACHED_AGGREGATE'    // derived/cached field; conflict = last-write-wins
  | 'SINGLE_OWNER_WORKFLOW' // one-actor-at-a-time record; conflict = last-write-wins
  | 'CONFIG';             // centrally-edited master data; conflict = last-write-wins

/**
 * What a remote push attempt reports back. This is the seam a real
 * Supabase-backed implementation plugs into once Prompt 5's auth/JWT flow
 * exists — no @supabase/supabase-js dependency is added by this prompt,
 * since there is no live project/credentials to point it at yet.
 */
export type PushOutcome =
  | { kind: 'ACCEPTED' }
  | { kind: 'ALREADY_EXISTS' }
  | { kind: 'CONFLICT'; remoteRow: Record<string, unknown>; remoteUpdatedAt: string }
  | { kind: 'REJECTED'; reason: string }
  | { kind: 'NETWORK_ERROR'; error: unknown };

export interface PushOptions {
  /**
   * Set when the drain loop has already resolved a prior CONFLICT in the
   * local row's favor (DL-007's OVERRIDE_REMOTE outcome) and is retrying
   * with instructions to win regardless of the remote's current state.
   */
  forceOverwrite?: boolean;
}

export interface RemoteSyncClient {
  push(row: OutboxRow, options?: PushOptions): Promise<PushOutcome>;
}

export type ConnectivityState = 'ONLINE' | 'OFFLINE';
