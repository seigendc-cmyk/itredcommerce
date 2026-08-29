-- iTred Commerce — multi-tenant foundation (Prompt 1)
-- Extensions, shared enums, and RLS helper functions used by every
-- migration that follows. See ITRED_GOVERNANCE_AND_ARCHITECTURE.md,
-- "MULTI-TENANT & DELIVERY SUBSYSTEM ADDENDUM" (DL-001, DL-005) for the
-- decisions this schema implements.
--
-- IDENTITY MODEL THIS RLS DESIGN ASSUMES (implemented fully in Prompt 5):
-- every authenticated Supabase session carries custom JWT claims —
-- `tenant_id`, `branch_id` (nullable), `staff_role` — populated by a
-- Supabase Auth "Custom Access Token" hook at login time. This migration
-- only defines the READ side (the helper functions below); Prompt 5 is
-- responsible for the auth hook that populates the claims. Until Prompt 5
-- lands, sessions with no claims are simply denied by every policy below
-- (the helper functions return NULL, and NULL never equals a tenant_id).

create extension if not exists pgcrypto;

-- --------------------------------------------------------
-- ROLE VOCABULARY (DL-005)
-- --------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_staff_role') then
    create type app_staff_role as enum (
      'till_operator',
      'head_office_staff',
      'executive',
      'rider',
      'platform_super_admin'
    );
  end if;
end $$;

-- --------------------------------------------------------
-- RLS HELPER FUNCTIONS
-- --------------------------------------------------------
create or replace function app_jwt_claims() returns jsonb
language sql stable
as $$
  select coalesce(auth.jwt(), '{}'::jsonb)
$$;

create or replace function app_current_tenant_id() returns text
language sql stable
as $$
  select nullif(app_jwt_claims() ->> 'tenant_id', '')
$$;

create or replace function app_current_branch_id() returns text
language sql stable
as $$
  select nullif(app_jwt_claims() ->> 'branch_id', '')
$$;

create or replace function app_current_role() returns text
language sql stable
as $$
  select nullif(app_jwt_claims() ->> 'staff_role', '')
$$;

create or replace function app_current_staff_id() returns text
language sql stable
as $$
  select nullif(app_jwt_claims() ->> 'staff_id', '')
$$;

-- TODO(platform-super-admin): scope is not yet defined (see governance doc
-- "Open items"). This always returns false, so no session can currently
-- bypass tenant isolation. Do not change this to a real check without a
-- dedicated addendum describing how platform-operator sessions are
-- authenticated and audited — a mistake here is a cross-tenant data leak.
create or replace function app_is_super_admin() returns boolean
language sql stable
as $$
  select false
$$;

-- Only till_operator sessions are restricted to a single branch's rows on
-- branch-scoped tables; head_office_staff/executive see the whole tenant.
-- rider is tenant-scoped, not branch-scoped, per the governance doc.
create or replace function app_is_branch_scoped_role() returns boolean
language sql stable
as $$
  select app_current_role() = 'till_operator'
$$;

-- Back-office-only tables (purchasing, financial, tax/fiscal config,
-- approvals) are not visible to till_operator or rider sessions at all.
create or replace function app_is_back_office_role() returns boolean
language sql stable
as $$
  select app_current_role() in ('head_office_staff', 'executive', 'platform_super_admin')
$$;

create or replace function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
