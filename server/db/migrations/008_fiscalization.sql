-- Fiscalization pluggable layer, local mirror (Prompt 11). No tenant_id
-- column, matching every other local table (DL-001: one install binds to
-- exactly one tenant). Registration is branch-scoped and SHARED across
-- every terminal at that branch (not per-terminal, a deliberate deviation
-- from DL-002/DL-009's usual independent-terminal pattern — see the
-- Supabase migration's header comment and the governance doc addendum) —
-- this local table is a pull-only cache of the authoritative Supabase
-- row(s) for this install's tenant, refreshed by
-- server/sync/fiscalRegistrationPull.ts, the same pull-cache shape DL-012
-- already established for `staff`. Credentials are cached here as
-- CIPHERTEXT ONLY (see the Supabase migration's header comment) —
-- decrypted in memory only, immediately before building a provider
-- request, never written back to disk in plaintext.
CREATE TABLE IF NOT EXISTS fiscal_registration_cache (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  country TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  integration_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  fiscal_day_status TEXT NOT NULL DEFAULT 'CLOSED',
  fiscal_day_number INTEGER NOT NULL DEFAULT 0,
  fiscal_day_opened_at TEXT,
  last_z_report_number INTEGER,
  last_z_report_at TEXT,
  invoice_sequence_counter INTEGER NOT NULL DEFAULT 0,
  credentials_ciphertext TEXT,
  credentials_iv TEXT,
  credentials_auth_tag TEXT,
  credentials_updated_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_registration_cache_branch ON fiscal_registration_cache(branch_id);

-- Every terminal's own local outbox for sales it personally completed —
-- deliberately NOT routed through applyWithOutbox/entityRules.ts, same
-- reasoning as delivery_orders (DL-015): a fiscal submission's retry
-- cadence and correctness rules (invoice sequencing via Supabase's
-- claim_next_fiscal_sequence) are specific to this feature, not the
-- general ledger/config sync categories.
CREATE TABLE IF NOT EXISTS fiscal_submissions (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  registration_id TEXT,
  sale_id TEXT NOT NULL,
  sale_number TEXT NOT NULL,
  submission_mode TEXT NOT NULL DEFAULT 'PER_TRANSACTION',
  status TEXT NOT NULL DEFAULT 'PENDING',
  invoice_sequence_number INTEGER,
  fiscal_reference_number TEXT,
  qr_code_payload TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  non_retryable INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_fiscal_submissions_status ON fiscal_submissions(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_submissions_sale ON fiscal_submissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_submissions_branch ON fiscal_submissions(branch_id);
