-- DL-011 (Prompt 5): the staff/PIN verification primitive promised by
-- 20260829120200_identity_and_parties.sql's own header comment ("reading
-- pin_hash back is Prompt 5's job via a SECURITY DEFINER function or edge
-- function, never a plain SELECT") and by 20260829120000's file header
-- ("Prompt 5 is responsible for the auth hook that populates the claims").
--
-- Two trusted callers share verify_staff_pin(): the Express backend behind
-- the Tauri branch-terminal/head-office apps (holds the service-role key
-- server-side, keeps issuing its own existing cookie session — no Supabase
-- JWT needed for that path) and, later, a Supabase Edge Function backing
-- the Executive/Rider PWA sign-in flow. Only the RPC + the access-token
-- hook that a *future* PWA-facing sign-in will lean on are built here —
-- the PWA sign-in flow itself (linking a staff row to a real auth.users
-- identity, choosing how that identity gets created) is explicitly
-- deferred to whichever prompt actually builds the Executive/Rider PWA,
-- per ITRED_GOVERNANCE_AND_ARCHITECTURE.md's "don't build ahead of the
-- prompt that needs it" pattern (see the DL-011 addendum for the full
-- rationale). auth_user_id is added now (nullable) purely so that future
-- linkage has a column to land in without another migration.

alter table staff add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table staff add column if not exists failed_attempts integer not null default 0;
alter table staff add column if not exists locked_until timestamptz;

-- Centralizing lockout here (rather than in each caller's own process
-- memory, which is what the pre-Prompt-5 Express implementation did) is
-- what makes it actually work once a tenant has multiple desks/terminals
-- all able to attempt PIN verification against the same staff row — see
-- the governance doc's DL-011 security notes.
create index if not exists idx_staff_auth_user on staff(auth_user_id) where auth_user_id is not null;

-- Returns one row with status IN ('OK','INVALID','LOCKED_OUT') — the staff
-- fields are populated only when status = 'OK', never pin_hash under any
-- status. SECURITY DEFINER + a narrow EXECUTE grant (service_role only,
-- below) is what lets this function read pin_hash despite it being
-- column-grant-revoked from authenticated/anon in
-- 20260829120200_identity_and_parties.sql — pin_hash itself never leaves
-- this function; the comparison happens inside Postgres via pgcrypto's
-- crypt(), bcrypt-compatible with the bcryptjs-produced hashes already
-- stored (same $2a$/$2b$ format).
--
-- Deliberately does NOT use `raise exception` to signal INVALID/LOCKED_OUT
-- (an earlier version of this function did, and it was a real bug caught
-- during manual testing): raising an exception rolls back everything the
-- function itself has written in the same call, including the
-- failed_attempts/locked_until UPDATE a failed attempt is supposed to
-- persist — so the lockout counter silently never advanced. Returning a
-- status column instead means every write this function makes actually
-- commits, regardless of the outcome it reports.
--
-- Takes the staff id (not code) — matches what the existing client already
-- sends today (StaffAccessScreen.tsx posts {staffId, pin} to /auth/login),
-- so no client-facing contract change is needed to add the Supabase path.
create or replace function verify_staff_pin(p_tenant_id text, p_staff_id text, p_pin text)
returns table (
  status text,
  id text,
  tenant_id text,
  code text,
  name text,
  role text,
  role_title text,
  department text,
  access_role app_staff_role,
  home_branch_id text,
  avatar_initials text,
  permissions jsonb,
  terminal_access jsonb,
  is_active boolean,
  last_login timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row staff%rowtype;
  v_max_attempts constant integer := 5;
  v_lockout interval := interval '60 seconds';
begin
  -- Qualified with the staff. prefix deliberately — bare tenant_id/id here
  -- would be ambiguous with this function's own OUT parameters of the same
  -- name (RETURNS TABLE(..., tenant_id text, id text, ...) puts those in
  -- scope as PL/pgSQL variables for the whole function body).
  select * into v_row from staff
    where staff.tenant_id = p_tenant_id and staff.id = p_staff_id and staff.is_active = true
    for update;

  if not found then
    status := 'INVALID';
    return next;
    return;
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    status := 'LOCKED_OUT';
    return next;
    return;
  end if;

  if v_row.pin_hash = crypt(p_pin, v_row.pin_hash) then
    update staff set failed_attempts = 0, locked_until = null, last_login = now()
      where staff.tenant_id = p_tenant_id and staff.id = v_row.id;

    select s.id, s.tenant_id, s.code, s.name, s.role, s.role_title, s.department,
           s.access_role, s.home_branch_id, s.avatar_initials, s.permissions,
           s.terminal_access, s.is_active, s.last_login
      into id, tenant_id, code, name, role, role_title, department, access_role,
           home_branch_id, avatar_initials, permissions, terminal_access, is_active, last_login
      from staff s where s.tenant_id = p_tenant_id and s.id = v_row.id;
    status := 'OK';
    return next;
  else
    update staff set
        failed_attempts = v_row.failed_attempts + 1,
        locked_until = case when v_row.failed_attempts + 1 >= v_max_attempts then now() + v_lockout else v_row.locked_until end
      where staff.tenant_id = p_tenant_id and staff.id = v_row.id;

    status := 'INVALID';
    return next;
  end if;
end;
$$;

revoke all on function verify_staff_pin(text, text, text) from public;
grant execute on function verify_staff_pin(text, text, text) to service_role;

-- Custom Access Token Hook (Supabase Auth feature — registered separately
-- in the project dashboard under Authentication > Hooks, not something a
-- SQL migration can wire up on its own). Ready for whichever future prompt
-- builds a PWA that needs a real Supabase Auth session: once a staff row
-- has auth_user_id populated and this hook is registered, any JWT issued
-- for that auth.users identity gets tenant_id/branch_id/staff_role/staff_id
-- claims injected, which is what every RLS helper in
-- 20260829120000_extensions_and_rls_helpers.sql already expects to read.
-- Until a PWA exists and populates auth_user_id, this function has no
-- effect on anything — it is not registered as a hook by this migration.
create or replace function access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_staff staff%rowtype;
  v_claims jsonb;
begin
  select * into v_staff from staff where auth_user_id = (event ->> 'user_id')::uuid and is_active = true;

  v_claims := event -> 'claims';
  if found then
    v_claims := v_claims
      || jsonb_build_object('tenant_id', v_staff.tenant_id)
      || jsonb_build_object('branch_id', v_staff.home_branch_id)
      || jsonb_build_object('staff_role', v_staff.access_role)
      || jsonb_build_object('staff_id', v_staff.id);
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function access_token_hook(jsonb) to supabase_auth_admin;
