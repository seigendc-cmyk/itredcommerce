-- Mirrors server/db/migrations/016_stock_transfer_cancel.sql.
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS cancel_idempotency_key text;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS cancellation_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_cancel_idem ON stock_transfers(tenant_id, cancel_idempotency_key);
