-- Staff, suppliers, customers. DL-005 groundwork: this migration only adds
-- tenant scoping and the access_role vocabulary to the staff table; the
-- actual Supabase-Auth-backed PIN verification flow, JWT claim population,
-- and PIN-hash security review are Prompt 5's job, not this one.
--
-- CONVENTION USED THROUGHOUT THIS AND ALL FOLLOWING MIGRATIONS: any table
-- whose primary key was a single app-generated business key (e.g. a SKU, a
-- PO number, a sale id) gets a COMPOSITE primary key (tenant_id, <key>),
-- and any child table referencing it does so via a composite foreign key.
-- This means tenant isolation is enforced by the storage layer itself, not
-- only by RLS — a defense-in-depth measure, not just belt-and-suspenders
-- for its own sake, given RLS policy bugs are exactly the kind of mistake
-- multi-tenant systems can't afford. Tables with a surrogate autoincrement
-- PK (line items) keep that surrogate as PK and add a plain tenant_id
-- column instead, since a globally-unique identity column doesn't need
-- compositing to stay tenant-safe on its own — it just needs the column
-- present for RLS to filter on without a join.

-- --------------------------------------------------------
-- STAFF
-- --------------------------------------------------------
create table if not exists staff (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  code text not null,
  name text not null,
  role text not null,                 -- free-text job role (e.g. 'Cashier', 'Branch Manager')
  role_title text not null,
  department text,
  access_role app_staff_role not null default 'till_operator',  -- DL-005 auth-scope role, distinct from `role` above
  home_branch_id text references branches(id) on delete set null,
  pin_hash text not null,
  avatar_initials text,
  last_login timestamptz,
  permissions jsonb not null default '[]'::jsonb,
  terminal_access jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, code)
);
create index if not exists idx_staff_tenant on staff(tenant_id);

create trigger trg_staff_updated_at before update on staff
  for each row execute function set_updated_at();

alter table staff enable row level security;

-- pin_hash is never selectable by any client session, back-office included
-- — RLS only controls ROW visibility, not columns, and a view doesn't
-- fix that cleanly either (Supabase migrations run as a role with
-- BYPASSRLS, so a view's row-security would run as the view owner rather
-- than the querying session unless carefully pinned with
-- security_invoker, and even then every role would still need its own
-- separate row-visibility rule). A column-level GRANT is the actual
-- boundary here: revoke the broad default privileges Supabase grants new
-- tables, then grant back only the columns/operations each Postgres role
-- actually needs. All app roles share the single Postgres `authenticated`
-- role, so this is the only way to keep pin_hash write-only across the
-- board — reading it back (for PIN verification) is Prompt 5's job via a
-- SECURITY DEFINER function or edge function, never a plain SELECT.
revoke all on staff from authenticated;
grant select (
  id, tenant_id, code, name, role, role_title, department, access_role,
  home_branch_id, avatar_initials, last_login, permissions, terminal_access,
  is_active, created_at, updated_at
) on staff to authenticated;
grant insert, update on staff to authenticated;

-- Now that pin_hash is unselectable regardless of role, SELECT can be
-- tenant-wide (a till_operator needs the roster to know who's on shift);
-- INSERT/UPDATE (which do touch pin_hash) stay back-office-only.
create policy staff_select on staff for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy staff_write on staff for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy staff_update on staff for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- SUPPLIERS
-- --------------------------------------------------------
create table if not exists suppliers (
  code text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null, contact_person text, email text, phone text, address text,
  payment_terms text, tax_number text, current_balance numeric(18, 4) not null default 0,
  due_amount numeric(18, 4) not null default 0, overdue_amount numeric(18, 4) not null default 0,
  last_purchase_date date, last_purchase_amount numeric(18, 4), last_purchase_ref text,
  last_payment_date date, last_payment_amount numeric(18, 4), last_payment_ref text,
  bank_account_details text, status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, code)
);
create index if not exists idx_suppliers_tenant on suppliers(tenant_id);

create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();

alter table suppliers enable row level security;

create policy suppliers_select on suppliers for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy suppliers_write on suppliers for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy suppliers_update on suppliers for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
create policy suppliers_delete on suppliers for delete
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
-- CUSTOMERS
-- --------------------------------------------------------
create table if not exists customers (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  account_number text, name text not null, company_name text, phone text,
  email text, address text, tax_number text, tax_exempt boolean not null default false,
  tax_exemption_cert_number text, status text not null default 'APPROVED',
  credit_status text, debtor_status text, is_credit_approved boolean not null default false,
  credit_limit numeric(18, 4) not null default 0, current_balance numeric(18, 4) not null default 0,
  available_credit numeric(18, 4) not null default 0, payment_terms text, payment_terms_days integer,
  last_purchase_date date, last_purchase_amount numeric(18, 4), last_purchase_ref text,
  last_payment_date date, last_payment_amount numeric(18, 4), last_payment_ref text,
  overdue_amount numeric(18, 4) not null default 0, created_date date, created_by_staff_id text,
  approved_by_manager_id text, credit_approved_date date,
  exceptional_credit_override_notes text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, account_number)
);
create index if not exists idx_customers_tenant on customers(tenant_id);

create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;

create policy customers_select on customers for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy customers_write on customers for insert
  with check (tenant_id = app_current_tenant_id());
create policy customers_update on customers for update
  using (tenant_id = app_current_tenant_id())
  with check (tenant_id = app_current_tenant_id());
create policy customers_delete on customers for delete
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role());
