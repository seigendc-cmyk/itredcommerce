-- Console-operator identity and the real app_is_super_admin() check
-- (Prompt 13's follow-up). See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
-- "CONSOLE-OPERATOR AUTH, TOKEN ISSUANCE & BILLING CALCULATION ADDENDUM"
-- (DL-045) for the decisions this migration implements.

-- --------------------------------------------------------
-- CONSOLE_OPERATORS — the platform's own operator roster. Same access
-- model as the six Prompt-13 console tables: RLS enabled, zero grants to
-- anon/authenticated. Provisioned out-of-band (service-role only) — no
-- self-serve signup path exists or should exist here.
-- --------------------------------------------------------
create table if not exists console_operators (
  id text primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_console_operators_updated_at before update on console_operators
  for each row execute function set_updated_at();

alter table console_operators enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — only a
-- service-role client can touch this table directly.

-- --------------------------------------------------------
-- access_token_hook() — extend the existing staff lookup (Prompt 5,
-- DL-011/DL-013) with a second branch for console operators. Same function
-- name/signature as the version already registered as a Supabase Auth Hook
-- in the dashboard, so no re-registration is needed — only the body changes.
-- --------------------------------------------------------
create or replace function access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_staff staff%rowtype;
  v_operator console_operators%rowtype;
  v_claims jsonb;
  v_user_id uuid;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims := event -> 'claims';

  select * into v_staff from staff where auth_user_id = v_user_id and is_active = true;

  if found then
    v_claims := v_claims
      || jsonb_build_object('tenant_id', v_staff.tenant_id)
      || jsonb_build_object('branch_id', v_staff.home_branch_id)
      || jsonb_build_object('staff_role', v_staff.access_role)
      || jsonb_build_object('staff_id', v_staff.id);
  else
    select * into v_operator from console_operators where auth_user_id = v_user_id and is_active = true;

    if found then
      v_claims := v_claims
        || jsonb_build_object('platform_role', 'platform_operator')
        || jsonb_build_object('console_operator_id', v_operator.id);
    end if;
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function access_token_hook(jsonb) to supabase_auth_admin;

-- --------------------------------------------------------
-- app_is_super_admin() — was hardcoded false since Prompt 1, pending
-- exactly this addendum. Now a real check against the platform_role claim
-- access_token_hook() injects above. This function is already wired as an
-- `or app_is_super_admin()` cross-tenant bypass clause into essentially
-- every RLS policy in this schema — making it real is the entire
-- mechanism, not one piece of it.
-- --------------------------------------------------------
create or replace function app_is_super_admin() returns boolean
language sql stable
as $$
  select coalesce(app_jwt_claims() ->> 'platform_role', '') = 'platform_operator'
$$;

-- Thin self-check the console app calls right after sign-in to decide
-- "show the dashboard" vs. "sign out, not authorized". security invoker
-- (not definer) — it only ever echoes the caller's own claim back to them,
-- so there is nothing to leak.
create or replace function is_console_operator() returns boolean
language sql stable security invoker
as $$
  select app_is_super_admin()
$$;

grant execute on function is_console_operator() to authenticated;

-- --------------------------------------------------------
-- Console-operator read access to the six Prompt-13 tables. Column-scoped
-- grant on terminal_activation_tokens excludes `signature` — the actual
-- cryptographic credential — same exclusion technique already used for
-- staff.pin_hash.
-- --------------------------------------------------------
grant select on license_keys to authenticated;
create policy license_keys_console_read on license_keys
  for select using (app_is_super_admin());

grant select (id, tenant_id, terminal_id, plan_tier, issued_at, expires_at, status, issued_by, created_at, updated_at)
  on terminal_activation_tokens to authenticated;
create policy terminal_activation_tokens_console_read on terminal_activation_tokens
  for select using (app_is_super_admin());

grant select on activation_requests to authenticated;
create policy activation_requests_console_read on activation_requests
  for select using (app_is_super_admin());

grant select on plan_components to authenticated;
create policy plan_components_console_read on plan_components
  for select using (app_is_super_admin());

grant select on tenant_subscriptions to authenticated;
create policy tenant_subscriptions_console_read on tenant_subscriptions
  for select using (app_is_super_admin());

grant select on billing_invoices to authenticated;
create policy billing_invoices_console_read on billing_invoices
  for select using (app_is_super_admin());

-- --------------------------------------------------------
-- Console-operator write access. Only plan_components/tenant_subscriptions
-- (plain config, no signing key or trusted-attribution concern) get full
-- CRUD directly. billing_invoices gets a column-scoped update limited to
-- status/paid_at/payment_reference — total/line_items have no update path
-- outside a service-role client, keeping a generated invoice's computed
-- fields effectively immutable. license_keys, terminal_activation_tokens,
-- and activation_requests get NO write grants here at all: issuing a token
-- needs the signing key, and both issuance and request-resolution need
-- fulfilled_by/issued_by attribution the server verifies rather than the
-- client asserts — both go through a service-role Edge Function instead
-- (console-issue-terminal-activation-token, console-resolve-activation-request,
-- console-generate-billing-invoice).
-- --------------------------------------------------------
grant insert, update, delete on plan_components to authenticated;
create policy plan_components_console_insert on plan_components
  for insert with check (app_is_super_admin());
create policy plan_components_console_update on plan_components
  for update using (app_is_super_admin()) with check (app_is_super_admin());
create policy plan_components_console_delete on plan_components
  for delete using (app_is_super_admin());

grant insert, update, delete on tenant_subscriptions to authenticated;
create policy tenant_subscriptions_console_insert on tenant_subscriptions
  for insert with check (app_is_super_admin());
create policy tenant_subscriptions_console_update on tenant_subscriptions
  for update using (app_is_super_admin()) with check (app_is_super_admin());
create policy tenant_subscriptions_console_delete on tenant_subscriptions
  for delete using (app_is_super_admin());

grant update (status, paid_at, payment_reference) on billing_invoices to authenticated;
create policy billing_invoices_console_mark_paid on billing_invoices
  for update using (app_is_super_admin()) with check (app_is_super_admin());
