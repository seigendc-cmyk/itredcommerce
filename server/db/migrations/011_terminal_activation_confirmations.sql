-- Local outbound queue for DL-057's two-ledger reconciliation: one row per
-- local TerminalActivationToken activation event (a manually pasted token
-- accepted by POST /licensing/activate-terminal, or a newer token replacing
-- the local cache via server/sync/terminalActivationTokenPull.ts), pushed to
-- Supabase's terminal_activation_confirmations table by
-- server/sync/terminalActivationConfirmationDrainLoop.ts.
--
-- Deliberately NOT routed through applyWithOutbox/entityRules.ts — same
-- reasoning as fiscal_registration_cache's outbox (008_fiscalization.sql)
-- and delivery_orders (DL-015): this is a narrow, insert-only audit trail
-- with its own dedicated drain loop, not a general ledger/config row subject
-- to the general outbox's conflict-resolution rules.
CREATE TABLE IF NOT EXISTS terminal_activation_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  token_issued_at TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('manual_paste', 'sync_down')),
  confirmed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SYNCED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_terminal_activation_confirmations_status ON terminal_activation_confirmations(status);
