-- Prompt 14 / DL-068: credit_notes gets the columns needed to attribute a
-- refund to the terminal/shift/branch that actually issued it —
-- shiftReconciliation.ts previously had no real, server-persisted entity to
-- read at all for returns (see the governance doc's SALES FLOW AUDIT &
-- REMEDIATION ADDENDUM). idempotency_key closes the separate gap that
-- POST /credit-notes had no dedup guard at all.
ALTER TABLE credit_notes ADD COLUMN terminal_id TEXT;
ALTER TABLE credit_notes ADD COLUMN branch_id TEXT;
ALTER TABLE credit_notes ADD COLUMN shift_id TEXT;
ALTER TABLE credit_notes ADD COLUMN idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_notes_shift ON credit_notes(shift_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_sale ON credit_notes(original_sale_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_idempotency_key ON credit_notes(idempotency_key);
