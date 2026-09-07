-- Stock transfer cancellation (follow-up to DL-079's "open item carried
-- forward": a Dispatched transfer had no corrective path). Cancel is a
-- distinct action from reject — reject is the approver declining a
-- request; cancel is withdrawing/recalling one, valid from Requested,
-- Approved, or Dispatched (not Received — once goods have landed and
-- potentially been mixed into destination stock, unwinding needs a
-- different, not-yet-built correction workflow, not a cancel).
ALTER TABLE stock_transfers ADD COLUMN cancel_idempotency_key TEXT;
ALTER TABLE stock_transfers ADD COLUMN cancellation_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfers_cancel_idem ON stock_transfers(cancel_idempotency_key);
