-- Prompt 18 / DL-078: stock movement, idempotency, and reject-state-guard
-- fixes for stock_transfers. Mirrors
-- server/db/migrations/015_stock_transfer_movement_idempotency.sql.
--
-- Idempotency: one column per action (approve/dispatch/receive/reject),
-- not a single shared column — a transfer legitimately goes through all
-- four action calls over its lifetime, each independently retryable, and
-- a single column could only ever remember the most recent action's key.
-- Not a separate per-action table either: the action set is small and
-- fixed (exactly four, unlikely to grow), so a table would add a join for
-- no real benefit over four scoped columns on the one row every action
-- already loads by id.
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approve_idempotency_key text;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatch_idempotency_key text;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS receive_idempotency_key text;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS reject_idempotency_key text;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS has_dispatch_stock_warning boolean NOT NULL DEFAULT false;

-- Tenant-scoped uniqueness (NULLs never conflict, same as every other
-- idempotency-key index in this schema) — a key is only unique within one
-- tenant's own transfers, not globally.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_approve_idem ON stock_transfers(tenant_id, approve_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_dispatch_idem ON stock_transfers(tenant_id, dispatch_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_receive_idem ON stock_transfers(tenant_id, receive_idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_reject_idem ON stock_transfers(tenant_id, reject_idempotency_key);

ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS stock_on_hand_at_dispatch numeric(18, 4);
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS dispatch_shortfall_qty numeric(18, 4);

-- Prompt 18 item 4: the route's create default has always actually been
-- 'Requested' (server/routes/stockTransfers.ts, `status: transfer.status
-- ?? 'Requested'`) — 'Draft' was the schema's stated default but no code
-- path anywhere ever creates or transitions a 'Draft' row, so it was dead.
-- Normalizing the schema default to match the real behavior; this cannot
-- change any existing row (ALTER COLUMN SET DEFAULT only affects future
-- inserts with no explicit value, and the route always supplies one).
ALTER TABLE stock_transfers ALTER COLUMN status SET DEFAULT 'Requested';
