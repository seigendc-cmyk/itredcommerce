-- Pluggable fiscalization layer (Prompt 11). Confirmed architectural
-- decisions (see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Fiscalization
-- addendum for full reasoning — summarized here so this file is
-- self-explaining):
--
--   * Each tenant owns and manages its own fiscal-authority credentials —
--     no centralized platform-held credential store, no server-side proxy
--     submitting on a tenant's behalf. Credentials are stored below as
--     CIPHERTEXT ONLY; the AES-256-GCM key (FISCAL_CREDENTIALS_KEY) is an
--     environment variable local to each installed terminal's Express
--     process (server/lib/fiscalCrypto.ts), never sent to or held by
--     Supabase — so even full service-role DB access can never recover a
--     tenant's plaintext fiscal credentials. Distributing the same key to
--     every terminal under a shared registration is a manual, out-of-band
--     deployment step, not something this migration or any code here
--     automates.
--   * Fiscal device registration (fiscal-day state, invoice sequence) is
--     SHARED across every terminal at a BRANCH, not per-terminal — one row
--     per (tenant_id, branch_id), matching how a real fiscal device
--     identity (virtual or hardware) is registered once per location, not
--     once per till. This is a deliberate deviation from this codebase's
--     usual fully-independent-terminal pattern (DL-002/DL-009) — accepted
--     specifically for fiscal registration because ZIMRA's FDMS model
--     ties fiscal-day/invoice-sequence state to one registered identity.
--   * Sequence numbers are allocated ONLY at actual submission time
--     (claim_next_fiscal_sequence below), never at sale-completion time —
--     this is what lets multiple offline terminals at the same branch
--     complete sales independently with zero coordination: nothing about
--     a sale needs a fiscal sequence number until the moment it's actually
--     submitted, and claiming a sequence number requires being online
--     anyway (submission itself needs connectivity), so the atomic claim
--     never has to happen offline. Trade-off, stated plainly: sequence
--     numbers reflect SUBMISSION order across terminals, not strict
--     sale-completion chronological order — an inherent consequence of
--     sharing one registration across independent, sometimes-offline
--     terminals, not something this design can avoid while keeping sales
--     non-blocking.
--   * Real-time submission never blocks a sale: every sale completes
--     regardless of fiscal connectivity. fiscal_submissions is the
--     tenant-auditable log/outbox a sale's fiscal status is tracked
--     through, with its own tighter, uncapped-retry cadence separate from
--     the general outbox (DL-006/DL-007) — a fiscal submission is a
--     compliance obligation, not a UX nicety, so (unlike e.g. the WhatsApp
--     notification outbox) a transient failure is retried indefinitely,
--     not abandoned after a fixed attempt count. Only a definitive
--     rejection from the fiscal authority (a validation error, not a
--     network/5xx blip) is ever marked terminally FAILED.

create or replace function app_is_fiscal_admin_role() returns boolean
language sql stable
as $$
  select app_current_role() in ('head_office_staff', 'platform_super_admin')
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fiscal_registration_status') then
    create type fiscal_registration_status as enum ('NOT_CONFIGURED', 'TEST', 'ACTIVE', 'SUSPENDED');
  end if;
  if not exists (select 1 from pg_type where typname = 'fiscal_day_status') then
    create type fiscal_day_status as enum ('CLOSED', 'OPEN');
  end if;
  if not exists (select 1 from pg_type where typname = 'fiscal_submission_status') then
    create type fiscal_submission_status as enum ('PENDING', 'SUBMITTED', 'QUEUED_FOR_BATCH', 'FAILED');
  end if;
end $$;

-- --------------------------------------------------------
-- FISCAL_REGISTRATIONS — one row per (tenant, branch). Everything a
-- FiscalizationProvider needs to operate under, plus the fiscal-day/
-- invoice-sequence state ZIMRA's model requires. fiscal_day_status/number/
-- last_z_report_* are modeled now (the concept is real and ZIMRA-relevant)
-- but NOT yet operated on by any code in this prompt — see the governance
-- doc addendum for why day-open/close semantics are deferred rather than
-- guessed at.
-- --------------------------------------------------------
create table if not exists fiscal_registrations (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,

  country text not null,          -- ISO 3166-1 alpha-2
  provider_key text not null,     -- e.g. 'zimra_virtual'
  integration_path text not null, -- human label, e.g. 'Virtual Fiscalisation API (FDMS)'

  status fiscal_registration_status not null default 'NOT_CONFIGURED',

  fiscal_day_status fiscal_day_status not null default 'CLOSED',
  fiscal_day_number integer not null default 0,
  fiscal_day_opened_at timestamptz,
  last_z_report_number integer,
  last_z_report_at timestamptz,

  -- The ONE place an invoice sequence number is ever allocated (via
  -- claim_next_fiscal_sequence below) — never written to directly.
  invoice_sequence_counter bigint not null default 0,

  -- Ciphertext only — see header comment. NULL until the vendor first
  -- saves credentials in Settings.
  credentials_ciphertext text,
  credentials_iv text,
  credentials_auth_tag text,
  credentials_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, id),
  unique (tenant_id, branch_id)
);
create index if not exists idx_fiscal_registrations_tenant on fiscal_registrations(tenant_id);

create trigger trg_fiscal_registrations_updated_at before update on fiscal_registrations
  for each row execute function set_updated_at();

alter table fiscal_registrations enable row level security;

-- Read/write restricted to head-office/platform-admin only — till
-- operators and executives never see or touch fiscal credentials or
-- registration state (narrower than app_is_back_office_role(), which
-- includes executive — read-only BI access is not the same as being
-- trusted with fiscal secrets).
create policy fiscal_registrations_select on fiscal_registrations for select
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());
create policy fiscal_registrations_insert on fiscal_registrations for insert
  with check (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());
create policy fiscal_registrations_update on fiscal_registrations for update
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- FISCAL_SUBMISSIONS — the tenant-auditable log/outbox for every sale that
-- was (or should have been) submitted to a fiscal authority. This is what
-- backs the Settings page's "last successful submission, pending/failed
-- count, drill-down into failures" status display.
-- --------------------------------------------------------
create table if not exists fiscal_submissions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,
  registration_id text,

  sale_id text not null,
  sale_number text not null,

  submission_mode text not null default 'PER_TRANSACTION', -- 'PER_TRANSACTION' | 'BATCH_ADAPTER'
  status fiscal_submission_status not null default 'PENDING',

  invoice_sequence_number bigint,
  fiscal_reference_number text,
  qr_code_payload text,

  -- Unbounded retry for transient failures (see header comment) — this
  -- count is informational/audit, not a cutoff.
  attempt_count integer not null default 0,
  -- Set true only when a provider reports a definitive, non-retryable
  -- rejection (e.g. a validation error) — the drain loop stops retrying a
  -- submission once this is true, surfacing it for manual attention
  -- instead of hammering a fiscal authority with a request that can never
  -- succeed as-is.
  non_retryable boolean not null default false,
  error_message text,
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales_transactions(tenant_id, sale_id) on delete restrict
);
create index if not exists idx_fiscal_submissions_tenant on fiscal_submissions(tenant_id);
create index if not exists idx_fiscal_submissions_status on fiscal_submissions(tenant_id, status);
create index if not exists idx_fiscal_submissions_branch on fiscal_submissions(tenant_id, branch_id);

create trigger trg_fiscal_submissions_updated_at before update on fiscal_submissions
  for each row execute function set_updated_at();

alter table fiscal_submissions enable row level security;

create policy fiscal_submissions_select on fiscal_submissions for select
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());
-- No client insert/update policy: only the Express backend's service-role
-- client ever writes here (same shape as DL-015's delivery_orders direct
-- write) — a submission's status is never something a browser session
-- sets directly.

-- --------------------------------------------------------
-- claim_next_fiscal_sequence — the one place an invoice sequence number is
-- ever allocated, so two terminals at the same branch attempting to
-- submit concurrently can never receive the same number. See header
-- comment for why this only ever runs at submission time.
-- --------------------------------------------------------
create or replace function claim_next_fiscal_sequence(p_tenant_id text, p_branch_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  update fiscal_registrations
    set invoice_sequence_counter = invoice_sequence_counter + 1
    where tenant_id = p_tenant_id and branch_id = p_branch_id
    returning invoice_sequence_counter into v_next;

  if v_next is null then
    raise exception 'No fiscal registration found for tenant % branch %', p_tenant_id, p_branch_id;
  end if;

  return v_next;
end;
$$;

revoke all on function claim_next_fiscal_sequence(text, text) from public;
