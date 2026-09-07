-- DL-069/070/084 (Prompt 15): idempotency for the new POST
-- /customers/:id/payments endpoint. debtor_transactions is a general ledger
-- table used for OPENING_BALANCE/INVOICE/PAYMENT rows alike, so one nullable
-- column shared across all of them (set only by the payment-recording path)
-- mirrors credit_notes.idempotency_key's precedent rather than adding a
-- payment-specific table.
ALTER TABLE debtor_transactions ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtor_tx_idempotency_key ON debtor_transactions(idempotency_key);
