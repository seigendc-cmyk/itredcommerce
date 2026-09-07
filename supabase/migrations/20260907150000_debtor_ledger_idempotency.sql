-- DL-069/070/084 (Prompt 15): mirrors
-- server/db/migrations/020_debtor_ledger_idempotency.sql — idempotency for
-- the new POST /customers/:id/payments endpoint.
alter table debtor_transactions add column if not exists idempotency_key text;
create unique index if not exists idx_debtor_tx_idempotency_key on debtor_transactions(tenant_id, idempotency_key);
