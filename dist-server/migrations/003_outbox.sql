-- iTred Commerce — event-sourced outbox (Prompt 2). See
-- ITRED_GOVERNANCE_AND_ARCHITECTURE.md "OUTBOX SYNC & CONFLICT RESOLUTION
-- ADDENDUM" (DL-006/DL-007) for the design this table implements.
--
-- Every local mutation that needs to reach Supabase is written here in the
-- SAME transaction as the mutation itself (see server/sync/outboxWriter.ts),
-- so `id`'s insertion order is a durable, replayable log of what happened
-- and in what order, independent of whether/when it actually reaches
-- Supabase.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  entity_table TEXT NOT NULL,
  entity_pk TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,                          -- JSON snapshot of the row at write time
  origin_terminal_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SYNCED', 'CONFLICT_UNRESOLVED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Set when a resolved conflict decided the local write should win
  -- (DL-007's OVERRIDE_REMOTE outcome); tells the next push attempt for
  -- this row to force an overwrite instead of risking the same conflict again.
  force_overwrite INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt ON outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(entity_table, entity_pk);
