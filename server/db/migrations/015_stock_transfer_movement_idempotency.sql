-- Prompt 18 / DL-078: stock_transfers gains per-action idempotency keys
-- (one column per action rather than a shared column, since a single
-- transfer legitimately goes through four separate action calls —
-- approve/dispatch/receive/reject — each needing its own independent
-- dedup key; a shared column could only ever remember the most recent
-- action's key) plus the dispatch-stock-warning fields DL-078's "don't
-- hard-cap, flag instead" decision requires.
--
-- Status default is intentionally NOT changed here to 'Requested' (unlike
-- the Supabase migration, which can ALTER COLUMN SET DEFAULT cheaply):
-- SQLite has no ALTER COLUMN, only ADD/DROP/RENAME COLUMN, so fixing this
-- would require a full table rebuild (rename, recreate, copy, drop) for a
-- default value that is already dead code today — server/routes/
-- stockTransfers.ts's create route always supplies an explicit status
-- (`transfer.status ?? 'Requested'`), so the column-level default is never
-- actually read by anything. Not worth the risk of a table rebuild to fix
-- a value nothing consults. See the governance doc note on this prompt.
ALTER TABLE stock_transfers ADD COLUMN approve_idempotency_key TEXT;
ALTER TABLE stock_transfers ADD COLUMN dispatch_idempotency_key TEXT;
ALTER TABLE stock_transfers ADD COLUMN receive_idempotency_key TEXT;
ALTER TABLE stock_transfers ADD COLUMN reject_idempotency_key TEXT;
ALTER TABLE stock_transfers ADD COLUMN has_dispatch_stock_warning INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_approve_idem ON stock_transfers(approve_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_dispatch_idem ON stock_transfers(dispatch_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_receive_idem ON stock_transfers(receive_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_reject_idem ON stock_transfers(reject_idempotency_key);

ALTER TABLE stock_transfer_items ADD COLUMN stock_on_hand_at_dispatch REAL;
ALTER TABLE stock_transfer_items ADD COLUMN dispatch_shortfall_qty REAL;
