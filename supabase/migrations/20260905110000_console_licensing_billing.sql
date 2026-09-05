-- Platform console, licensing, and billing schema (Prompt 13). Schema + RLS
-- only, per this prompt's explicit scope — no issuance/signature logic, no
-- billing calculation, no console-operator auth mechanism. See
-- ITRED_GOVERNANCE_AND_ARCHITECTURE.md's "CONSOLE, LICENSING & BILLING
-- SUBSYSTEM ADDENDUM" (DL-038 through DL-044) for the decisions this
-- migration implements. Per DL-039's naming resolution, the per-terminal
-- signed token is TerminalActivationToken / terminal_activation_tokens
-- throughout — "activation code" is not used anywhere below.
--
-- ACCESS MODEL FOR THE SIX TABLES BELOW: RLS is enabled on all of them, and
-- none of them grant any policy to `anon` or `authenticated` — meaning only
-- a service-role client (which bypasses RLS entirely; no policy needed for
-- it) can read or write these tables at all. This is a deliberate,
-- necessary consequence of an existing guard already in this schema:
-- extensions_and_rls_helpers.sql's app_is_super_admin() is hardcoded to
-- always return false, with an explicit comment that it must not become a
-- real check "without a dedicated addendum describing how platform-operator
-- sessions are authenticated and audited — a mistake here is a cross-tenant
-- data leak." No such addendum exists yet, so there is currently no JWT
-- claim this migration could safely key a "platform admin" RLS policy off
-- of. Real console-operator access will go through a service-role-holding
-- Edge Function (the same shape whatsapp-notify/executive-signin already
-- use) once issuance logic is scoped (Prompt 14+) — not decided or built
-- here. The two narrow tenant-facing VIEWs below are the only read path
-- into any of this data from an ordinary authenticated tenant session.

-- --------------------------------------------------------
-- LICENSE_KEYS — tenant-wide, long-lived (DL-039 layer 2).
-- --------------------------------------------------------
create table if not exists license_keys (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  email text not null,
  plan_tier text not null,
  -- Free text, not a hard enum: exact lifecycle vocabulary (suspended,
  -- cancelled, etc.) is issuance-logic scope (Prompt 14+), not decided here.
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_license_keys_tenant on license_keys(tenant_id);

create trigger trg_license_keys_updated_at before update on license_keys
  for each row execute function set_updated_at();

alter table license_keys enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment. Only a service-role client can touch this table
-- directly; v_tenant_license_status below is the narrow tenant read path.

-- --------------------------------------------------------
-- TERMINAL_ACTIVATION_TOKENS — per-terminal, short-lived, signed
-- (DL-039 layer 3). `signature` is the actual cryptographic credential —
-- never exposed through any view, including the tenant-facing one below,
-- since a terminal at the same tenant reading another terminal's valid
-- signature would let it impersonate that terminal.
-- --------------------------------------------------------
create table if not exists terminal_activation_tokens (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  terminal_id text not null references terminals(id) on delete cascade,
  plan_tier text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  signature text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  -- No console-operator identity table exists yet (out of this prompt's
  -- scope — see header comment) — free-form reference until Prompt 14+
  -- defines one and this can become a real foreign key.
  issued_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_terminal_activation_tokens_tenant on terminal_activation_tokens(tenant_id);
create index if not exists idx_terminal_activation_tokens_terminal on terminal_activation_tokens(terminal_id);
create index if not exists idx_terminal_activation_tokens_status on terminal_activation_tokens(tenant_id, status);

create trigger trg_terminal_activation_tokens_updated_at before update on terminal_activation_tokens
  for each row execute function set_updated_at();

alter table terminal_activation_tokens enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment. v_tenant_terminal_activation_tokens below is the
-- narrow tenant read path (expiry/status only, never the signature).

-- --------------------------------------------------------
-- ACTIVATION_REQUESTS — one row per WhatsApp "Request
-- TerminalActivationToken" action (DL-041). A distinct concept from the
-- token itself: this is the request for one, not a credential.
-- --------------------------------------------------------
create table if not exists activation_requests (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  terminal_id text references terminals(id) on delete set null,
  requested_at timestamptz not null default now(),
  channel text not null default 'whatsapp',
  -- Free text, not a hard enum: exact fulfillment-status vocabulary is not
  -- decided here — Prompt 14+ scope, once the console's fulfillment UI is
  -- actually built.
  fulfillment_status text not null default 'pending',
  -- No console-operator identity table exists yet — see
  -- terminal_activation_tokens.issued_by's comment above; same caveat.
  fulfilled_by text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_activation_requests_tenant on activation_requests(tenant_id);
create index if not exists idx_activation_requests_status on activation_requests(tenant_id, fulfillment_status);

create trigger trg_activation_requests_updated_at before update on activation_requests
  for each row execute function set_updated_at();

alter table activation_requests enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment. No tenant-facing view is defined for this table in
-- this prompt (none was asked for) — a tenant currently has no Supabase-side
-- read path to its own activation_requests rows at all.

-- --------------------------------------------------------
-- PLAN_COMPONENTS — the platform-wide billable-item catalog (DL-043). Not
-- tenant-scoped: this is the price list, not a tenant's own data.
-- --------------------------------------------------------
create table if not exists plan_components (
  id text primary key,
  component_type text not null check (component_type in ('base', 'branch', 'terminal', 'feature')),
  -- Only meaningful when component_type = 'feature' (e.g. 'bi_brain',
  -- 'delivery', 'poolwise', 'cashplan') — intentionally not constrained to a
  -- fixed set of keys, since DL-043 itself expects more feature add-ons
  -- later and a hardcoded CHECK would need editing for each one.
  feature_key text,
  unit_price numeric(18, 4) not null,
  currency text not null,
  -- ⚠ Deliberately unconstrained free text, per DL-043's own open decision:
  -- whether a feature add-on bills tenant-wide flat or per-branch/
  -- per-terminal is NOT decided. This column must stay flexible enough to
  -- express either shape once that decision is made — do not add a CHECK
  -- constraint or otherwise assume one interpretation.
  billing_unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plan_components_type on plan_components(component_type);

create trigger trg_plan_components_updated_at before update on plan_components
  for each row execute function set_updated_at();

alter table plan_components enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment. This is a platform-operated price list; no tenant
-- read path is defined for it in this prompt.

-- --------------------------------------------------------
-- TENANT_SUBSCRIPTIONS — which plan_components (and what quantities) are
-- active for a given tenant (DL-043).
-- --------------------------------------------------------
create table if not exists tenant_subscriptions (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  plan_component_id text not null references plan_components(id) on delete restrict,
  quantity integer not null default 1,
  active_since timestamptz not null default now(),
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tenant_subscriptions_tenant on tenant_subscriptions(tenant_id);
create index if not exists idx_tenant_subscriptions_component on tenant_subscriptions(plan_component_id);

create trigger trg_tenant_subscriptions_updated_at before update on tenant_subscriptions
  for each row execute function set_updated_at();

alter table tenant_subscriptions enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment.
--
-- TODO(console-billing-views): no tenant-facing view exists yet for
-- tenant_subscriptions — the tenant SysAdmin Billing page (DL-043) will need
-- one once that page is actually scoped/built. Not built in this prompt,
-- which is schema + RLS only.

-- --------------------------------------------------------
-- BILLING_INVOICES — one row per tenant per billing period (DL-043).
-- `line_items` is a JSONB array rather than a normalized child table for
-- now (this prompt's schema list named one table, not two) — whether that
-- needs to become a normalized table later (for reporting/query needs) is
-- an implementation detail Prompt 14+ can revisit, not decided here.
-- --------------------------------------------------------
create table if not exists billing_invoices (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  -- Exact format (e.g. 'YYYY-MM' vs. a date range) is not pinned down here.
  billing_period text not null,
  -- Each element expected to reference a plan_components.id, but this is
  -- not enforced at the database level (JSONB, not a child table) — see
  -- header comment above.
  line_items jsonb not null default '[]'::jsonb,
  total numeric(18, 4) not null default 0,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_billing_invoices_tenant on billing_invoices(tenant_id);
create index if not exists idx_billing_invoices_status on billing_invoices(tenant_id, status);

create trigger trg_billing_invoices_updated_at before update on billing_invoices
  for each row execute function set_updated_at();

alter table billing_invoices enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see this
-- file's header comment.
--
-- TODO(console-billing-views): no tenant-facing view exists yet for
-- billing_invoices either — same note as tenant_subscriptions above. The
-- tenant SysAdmin Billing page (DL-043) needs one once it's actually
-- scoped/built.

-- --------------------------------------------------------
-- TENANT-FACING VIEWS — the only read path into any of the above from an
-- ordinary authenticated tenant session (never raw table access, per this
-- prompt's explicit instruction). Views are not themselves subject to their
-- underlying tables' RLS policies when queried by a role that doesn't
-- otherwise have one (same non-enforcement this schema already documents
-- and relies on for the Executive Rollups mv_*/v_* split — see DL-013) —
-- each view's own WHERE clause is therefore the entire security boundary
-- here, not a convenience filter on top of an already-enforced one.
-- --------------------------------------------------------

-- "My current plan status" — plan tier + status only. Deliberately excludes
-- `email` (PII, not needed for this display).
create or replace view v_tenant_license_status as
select tenant_id, plan_tier, status, created_at
from license_keys
where tenant_id = app_current_tenant_id() and app_current_role() in ('head_office_staff', 'platform_super_admin');

grant select on v_tenant_license_status to authenticated;

-- "My terminal's token expiry" — expiry/status only. Deliberately excludes
-- `signature` (the credential itself — see terminal_activation_tokens'
-- table comment) and `issued_by` (internal console-operator reference).
create or replace view v_tenant_terminal_activation_tokens as
select tenant_id, terminal_id, plan_tier, issued_at, expires_at, status
from terminal_activation_tokens
where tenant_id = app_current_tenant_id() and app_current_role() in ('head_office_staff', 'platform_super_admin');

grant select on v_tenant_terminal_activation_tokens to authenticated;
