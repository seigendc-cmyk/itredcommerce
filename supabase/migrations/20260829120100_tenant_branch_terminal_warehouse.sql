-- Tenant → Branch → Terminal hierarchy, plus warehouses and the legacy
-- connected_shops concept. DL-001 / DL-002.

-- --------------------------------------------------------
-- TENANTS
-- --------------------------------------------------------
create table if not exists tenants (
  id text primary key,
  legal_name text not null,
  display_name text not null,
  country text not null,               -- ISO 3166-1 alpha-2; selects the FiscalizationProvider (DL-003)
  base_currency text not null,         -- ISO 4217
  fiscalization_provider text,         -- e.g. 'KRA_ETIMS'; null until assigned (Prompt 11)
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tenants_updated_at before update on tenants
  for each row execute function set_updated_at();

alter table tenants enable row level security;

-- A session may only ever see its own tenant row. There is deliberately no
-- INSERT/UPDATE/DELETE policy for the authenticated role: tenant
-- provisioning is an administrative action performed with the Supabase
-- service_role key (which bypasses RLS), not something any client app can
-- do to itself.
create policy tenants_select_own on tenants for select
  using (id = app_current_tenant_id() or app_is_super_admin());

-- --------------------------------------------------------
-- BRANCHES
-- --------------------------------------------------------
create table if not exists branches (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  code text, name text not null, address text, city text, manager_name text,
  contact_phone text, email text, operating_hours text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'TEMPORARILY_CLOSED', 'INACTIVE')),
  is_default boolean not null default false,
  default_warehouse_id text, default_warehouse_name text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_branches_tenant on branches(tenant_id);

create trigger trg_branches_updated_at before update on branches
  for each row execute function set_updated_at();

alter table branches enable row level security;

create policy branches_select on branches for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());

create policy branches_write on branches for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy branches_update on branches for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- TERMINALS
-- --------------------------------------------------------
create table if not exists terminals (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  branch_id text references branches(id) on delete set null,
  branch_name text,
  code text, name text not null,
  workstation_type text not null default 'COUNTER_POS'
    check (workstation_type in ('COUNTER_POS', 'EXPRESS_CHECKOUT', 'BACKOFFICE_REGISTER')),
  -- Which of the two Tauri deployables this install runs (DL-002): a
  -- Branch Terminal App or a Head Office App desk. Both are "a terminal
  -- with a different feature set unlocked" per the governance doc, so they
  -- share this one table rather than two separate ones.
  app_surface text not null default 'BRANCH_TERMINAL'
    check (app_surface in ('BRANCH_TERMINAL', 'HEAD_OFFICE')),
  current_cashier_staff_id text, current_cashier_staff_name text,
  cash_drawer_port text, receipt_printer text,
  status text not null default 'OFFLINE' check (status in ('ONLINE', 'OFFLINE', 'LOCKED', 'IN_USE', 'ACTIVE')),
  is_default boolean not null default false,
  last_active timestamptz, ip_address text,
  -- Provisioning/activation identity captured once at setup time, extending
  -- the existing LicensingView/LicenceInfo flow (client-side LicenceInfo
  -- gains matching tenantId/branchId/terminalId fields — see
  -- src/types/index.ts changes in this same prompt).
  activation_code text,
  activated_at timestamptz,
  daily_sales_total numeric(18, 4) not null default 0,
  daily_transactions_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_terminals_tenant on terminals(tenant_id);
create index if not exists idx_terminals_branch on terminals(branch_id);

create trigger trg_terminals_updated_at before update on terminals
  for each row execute function set_updated_at();

alter table terminals enable row level security;

create policy terminals_select on terminals for select
  using (
    tenant_id = app_current_tenant_id()
    and (
      not app_is_branch_scoped_role()
      or branch_id = app_current_branch_id()
    )
    or app_is_super_admin()
  );

create policy terminals_write on terminals for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy terminals_update on terminals for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- WAREHOUSES
-- --------------------------------------------------------
create table if not exists warehouses (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  -- Nullable: a warehouse may be a tenant-wide central DC, or attached to
  -- one branch. Not every tenant/deployment uses branch-attached warehouses.
  branch_id text references branches(id) on delete set null,
  code text, name text not null, address text, manager_name text,
  contact_phone text, email text, total_capacity_sq_m numeric(18, 4),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_warehouses_tenant on warehouses(tenant_id);

create trigger trg_warehouses_updated_at before update on warehouses
  for each row execute function set_updated_at();

alter table warehouses enable row level security;

create policy warehouses_select on warehouses for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy warehouses_write on warehouses for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy warehouses_update on warehouses for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- CONNECTED SHOPS (legacy peer-stock-visibility concept)
-- --------------------------------------------------------
-- NOTE: this predates the tenant/branch model and may now be largely
-- redundant with simply viewing peer branches within the same tenant.
-- Ported as-is (tenant-scoped) rather than removed, since deciding to drop
-- it is outside this prompt's scope — flagged here for a later cleanup
-- pass once the branch-to-branch stock-transfer flows (Prompt 4) are live.
create table if not exists connected_shops (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  location_id text, location_type text, name text not null, city text,
  is_connected_online boolean not null default false,
  sync_status text not null default 'OFFLINE',
  last_ping timestamptz, allow_peer_stock_viewing boolean not null default false,
  ip_or_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_connected_shops_tenant on connected_shops(tenant_id);

create trigger trg_connected_shops_updated_at before update on connected_shops
  for each row execute function set_updated_at();

alter table connected_shops enable row level security;

create policy connected_shops_select on connected_shops for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy connected_shops_write on connected_shops for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy connected_shops_update on connected_shops for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
