-- Fiscal credit-note submission (follow-up to the sales-flow audit's
-- "no fiscalization credit-note handling exists on the returns path at
-- all" finding). A parallel table to fiscal_submissions, not a shared one
-- with a nullable/document_type column — fiscal_submissions.sale_id is
-- NOT NULL and FK'd to sales_transactions in Supabase; loosening that to
-- fit credit notes in would weaken an existing invariant for every sale
-- submission row to accommodate a different entity. Same shape,
-- deliberately duplicated rather than shared — the same "third instance of
-- an established pattern, not a fourth different one" discipline
-- DL-021/DL-026 already used, just applied to a sibling table instead of a
-- sibling column.
CREATE TABLE IF NOT EXISTS fiscal_credit_note_submissions (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  registration_id TEXT,
  credit_note_id TEXT NOT NULL,
  credit_note_number TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_fiscal_cn_submissions_status ON fiscal_credit_note_submissions(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_cn_submissions_credit_note ON fiscal_credit_note_submissions(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_cn_submissions_branch ON fiscal_credit_note_submissions(branch_id);
