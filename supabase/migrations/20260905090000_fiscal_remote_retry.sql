-- Closes DL-023's "Known gap" / the Tauri Packaging Addendum's re-flagged
-- note: a manual fiscal-submission retry issued from one terminal (e.g.
-- Head Office) could only ever see and flip a row in ITS OWN local SQLite
-- queue, never a submission created by a different till at the same
-- branch — a real, previously-unsolved problem now that per-install
-- separation (DL-033) is genuinely in place. See
-- ITRED_GOVERNANCE_AND_ARCHITECTURE.md's new DL-037 for the mailbox design
-- this column supports: whichever terminal actually owns a submission
-- locally consumes this flag (and clears it) on its own next fiscal drain
-- tick, at most ~30s later while online. Nothing writes this column except
-- the Express backend's service-role client (same as every other write to
-- this table) — no new RLS policy is needed since service-role bypasses
-- RLS entirely, and there is still no client insert/update policy on this
-- table (a submission's state is never something a browser session sets
-- directly).
alter table fiscal_submissions add column if not exists retry_requested_at timestamptz;

-- Partial index — this column is null for the overwhelming majority of
-- rows at any given time (a request is cleared within one drain cycle of
-- being consumed), so a full-column index would be wasted space.
create index if not exists idx_fiscal_submissions_retry_requested
  on fiscal_submissions(tenant_id)
  where retry_requested_at is not null;
