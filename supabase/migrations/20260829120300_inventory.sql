-- Inventory catalog, movements, adjustments, stocktakes, reorder
-- recommendations. Catalog and movement history are treated as tenant-wide
-- (not branch-partitioned) here, matching how the existing SQLite schema
-- already models them (a single stock_on_hand figure per SKU, no
-- per-location split) — this migration doesn't change that shape, only
-- adds tenant scoping on top of it.

create table if not exists inventory_items (
  sku text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  barcode text, name text, description text, department text, category text,
  unit_of_measure text, stock_on_hand numeric(18, 4) not null default 0,
  reorder_level numeric(18, 4) not null default 0,
  unit_cost numeric(18, 4) not null default 0, retail_price numeric(18, 4) not null default 0,
  preferred_supplier text, is_active boolean not null default true,
  image_url text, tax_rate numeric(8, 4) not null default 0, status text not null default 'In Stock',
  location text, part_number text, oem_number text,
  custom_fields jsonb not null default '{}'::jsonb, last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, sku)
);
create index if not exists idx_inventory_tenant on inventory_items(tenant_id);
create index if not exists idx_inventory_tenant_status on inventory_items(tenant_id, status);
create index if not exists idx_inventory_tenant_barcode on inventory_items(tenant_id, barcode);

create trigger trg_inventory_items_updated_at before update on inventory_items
  for each row execute function set_updated_at();

alter table inventory_items enable row level security;

create policy inventory_items_select on inventory_items for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy inventory_items_write on inventory_items for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy inventory_items_update on inventory_items for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists inventory_movements (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  "timestamp" timestamptz not null, movement_type text not null, sku text not null, item_name text,
  quantity numeric(18, 4) not null, unit_cost numeric(18, 4) not null default 0,
  total_value numeric(18, 4) not null default 0,
  source_location_id text, source_location_name text,
  destination_location_id text, destination_location_name text,
  reference_document text, staff_id text, staff_name text,
  shift_id text, terminal_id text, reason_code text, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_movements_tenant_sku on inventory_movements(tenant_id, sku);
create index if not exists idx_movements_tenant_ts on inventory_movements(tenant_id, "timestamp");

alter table inventory_movements enable row level security;

-- Not branch-filtered: movements don't carry a branch_id column in the
-- source schema (only terminal_id, which would need a join to resolve to
-- a branch). Every tenant role can read/write movement history tenant-wide;
-- branch-level UI filtering (if wanted) happens client-side against
-- terminal_id. Revisit if a later prompt needs true branch-level isolation
-- here.
create policy inventory_movements_select on inventory_movements for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy inventory_movements_insert on inventory_movements for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists stock_adjustments (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  adjustment_number text, location_id text, location_type text, location_name text,
  sku text, item_name text, adjustment_type text, quantity_delta numeric(18, 4) not null default 0,
  unit_cost numeric(18, 4) not null default 0, total_delta_value numeric(18, 4) not null default 0,
  staff_name text, date date, reason text,
  primary key (tenant_id, id)
);
create index if not exists idx_stock_adjustments_tenant on stock_adjustments(tenant_id);

alter table stock_adjustments enable row level security;

create policy stock_adjustments_select on stock_adjustments for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy stock_adjustments_insert on stock_adjustments for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists stocktakes (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  batch_no text, location_id text, location_type text, location_name text, date date,
  auditor_staff_name text, status text not null default 'DRAFT', items_count integer not null default 0,
  counted_qty numeric(18, 4) not null default 0, book_qty numeric(18, 4) not null default 0,
  variance_units numeric(18, 4) not null default 0, valuation_delta numeric(18, 4) not null default 0,
  notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_stocktakes_tenant on stocktakes(tenant_id);

alter table stocktakes enable row level security;

create policy stocktakes_select on stocktakes for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy stocktakes_write on stocktakes for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy stocktakes_update on stocktakes for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists stocktake_sessions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  session_number text, title text, location_id text, location_type text, location_name text,
  department_filter text, is_blind_count boolean not null default false, status text not null default 'DRAFT',
  created_by_staff_id text, created_by_staff_name text,
  created_date_time timestamptz, completed_date_time timestamptz,
  total_expected_units numeric(18, 4) not null default 0, total_counted_units numeric(18, 4) not null default 0,
  total_variance_units numeric(18, 4) not null default 0, total_variance_valuation numeric(18, 4) not null default 0,
  approval_required boolean not null default false, approved_by_staff_name text, approved_date_time timestamptz,
  approval_notes text, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_stocktake_sessions_tenant on stocktake_sessions(tenant_id);

alter table stocktake_sessions enable row level security;

create policy stocktake_sessions_select on stocktake_sessions for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy stocktake_sessions_write on stocktake_sessions for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy stocktake_sessions_update on stocktake_sessions for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists stocktake_lines (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  session_id text not null,
  sku text not null, barcode text, name text, category text, bin_location text,
  unit_cost numeric(18, 4) not null default 0, retail_price numeric(18, 4) not null default 0,
  book_qty numeric(18, 4) not null default 0, counted_qty numeric(18, 4), variance_qty numeric(18, 4) not null default 0,
  variance_valuation numeric(18, 4) not null default 0, reason_code text, notes text,
  last_counted_timestamp timestamptz, counted_by_staff_name text, exception_id text,
  foreign key (tenant_id, session_id) references stocktake_sessions(tenant_id, id) on delete cascade
);
create index if not exists idx_stocktake_lines_tenant_session on stocktake_lines(tenant_id, session_id);

alter table stocktake_lines enable row level security;

create policy stocktake_lines_select on stocktake_lines for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy stocktake_lines_write on stocktake_lines for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy stocktake_lines_update on stocktake_lines for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- Rule-versioned, per deterministicRulesEngine.ts convention (Section 1.5
-- of the governance doc): rule_version is preserved unchanged from the
-- existing schema and must keep being stamped at generation time.
create table if not exists reorder_recommendations (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  sku text not null, item_name text, department text, location_id text, location_name text,
  stock_on_hand numeric(18, 4) not null default 0, available_stock numeric(18, 4) not null default 0,
  reorder_level numeric(18, 4) not null default 0, target_stock numeric(18, 4) not null default 0,
  average_daily_sales numeric(18, 4) not null default 0, supplier_lead_time_days integer,
  suggested_reorder_qty numeric(18, 4) not null default 0,
  preferred_supplier_code text, preferred_supplier_name text,
  last_cost numeric(18, 4) not null default 0, estimated_cost_total numeric(18, 4) not null default 0, reason text,
  status text not null default 'NEW', rule_version integer not null default 1, created_at timestamptz,
  reviewed_by_staff_name text, reviewed_at timestamptz, decision_notes text,
  converted_document_type text, converted_document_number text,
  primary key (tenant_id, id)
);
create index if not exists idx_reorder_recs_tenant on reorder_recommendations(tenant_id);

alter table reorder_recommendations enable row level security;

create policy reorder_recs_select on reorder_recommendations for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy reorder_recs_write on reorder_recommendations for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy reorder_recs_update on reorder_recommendations for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
