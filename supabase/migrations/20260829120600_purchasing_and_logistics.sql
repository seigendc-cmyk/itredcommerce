-- Purchasing (memos, POs, GRNs) and stock transfers. Tier B: back-office
-- only — purchasing/inventory management is explicitly outside the Branch
-- Terminal App's restricted feature set per the governance doc, so
-- till_operator and rider sessions have no access to this whole group.

create table if not exists purchase_memos (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  memo_number text, supplier_name text, supplier_code text, request_date date, required_date date,
  requested_by_staff_id text, requested_by_staff_name text, department text,
  destination_warehouse_id text, destination_warehouse_name text, priority text not null default 'MEDIUM',
  status text not null default 'Draft', notes text, converted_po_number text,
  approved_by_staff_name text, approval_date date,
  primary key (tenant_id, id)
);
create index if not exists idx_purchase_memos_tenant on purchase_memos(tenant_id);

alter table purchase_memos enable row level security;
create policy purchase_memos_select on purchase_memos for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy purchase_memos_write on purchase_memos for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy purchase_memos_update on purchase_memos for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists purchase_memo_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  memo_id text not null,
  sku text, description text, requested_qty numeric(18, 4) not null default 0,
  estimated_unit_cost numeric(18, 4), notes text,
  foreign key (tenant_id, memo_id) references purchase_memos(tenant_id, id) on delete cascade
);
create index if not exists idx_purchase_memo_items_tenant on purchase_memo_items(tenant_id, memo_id);

alter table purchase_memo_items enable row level security;
create policy purchase_memo_items_select on purchase_memo_items for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy purchase_memo_items_write on purchase_memo_items for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists purchase_orders (
  po_number text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  supplier_name text, supplier_code text, date_created date, delivery_due_date date,
  destination_warehouse_id text, destination_warehouse_name text, total_items integer not null default 0,
  subtotal numeric(18, 4), tax_rate numeric(8, 4), tax_amount numeric(18, 4), total_amount numeric(18, 4) not null default 0,
  currency text not null default 'USD', status text not null default 'Open',
  payment_terms text, authorized_by text, notes text, origin_memo_number text,
  primary key (tenant_id, po_number)
);
create index if not exists idx_purchase_orders_tenant on purchase_orders(tenant_id);

alter table purchase_orders enable row level security;
create policy purchase_orders_select on purchase_orders for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy purchase_orders_write on purchase_orders for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy purchase_orders_update on purchase_orders for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists purchase_order_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  po_number text not null,
  sku text, description text, ordered_qty numeric(18, 4) not null default 0, received_qty numeric(18, 4) not null default 0,
  unit_cost numeric(18, 4) not null default 0, total_cost numeric(18, 4) not null default 0,
  foreign key (tenant_id, po_number) references purchase_orders(tenant_id, po_number) on delete cascade
);
create index if not exists idx_purchase_order_items_tenant on purchase_order_items(tenant_id, po_number);

alter table purchase_order_items enable row level security;
create policy purchase_order_items_select on purchase_order_items for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy purchase_order_items_write on purchase_order_items for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists goods_receipt_notes (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  grn_number text, po_number text, supplier_code text, supplier_name text,
  destination_warehouse_id text, destination_warehouse_name text, received_date date,
  received_by_staff_name text, delivery_note_number text,
  total_units_received numeric(18, 4) not null default 0, total_valuation numeric(18, 4) not null default 0,
  status text not null default 'ACCEPTED', notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_grn_tenant on goods_receipt_notes(tenant_id);

alter table goods_receipt_notes enable row level security;
create policy grn_select on goods_receipt_notes for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy grn_write on goods_receipt_notes for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy grn_update on goods_receipt_notes for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists goods_receipt_note_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  grn_id text not null,
  sku text, description text, ordered_qty numeric(18, 4) not null default 0, received_qty numeric(18, 4) not null default 0,
  unit_cost numeric(18, 4) not null default 0, total_cost numeric(18, 4) not null default 0,
  batch_number text, expiry_date date, condition text not null default 'GOOD',
  foreign key (tenant_id, grn_id) references goods_receipt_notes(tenant_id, id) on delete cascade
);
create index if not exists idx_grn_items_tenant on goods_receipt_note_items(tenant_id, grn_id);

alter table goods_receipt_note_items enable row level security;
create policy grn_items_select on goods_receipt_note_items for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy grn_items_write on goods_receipt_note_items for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists stock_transfers (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  transfer_number text, flow_type text,
  origin_location_id text, origin_location_type text, origin_location_name text,
  destination_location_id text, destination_location_type text, destination_location_name text,
  request_date date, status text not null default 'Draft', requested_by_staff_name text,
  approved_by_staff_name text, approved_date date, dispatched_by_staff_name text, dispatched_date date,
  carrier_or_vehicle text, dispatch_notes text, received_by_staff_name text, received_date date,
  receiving_notes text, rejection_reason text, notes text,
  has_discrepancy boolean not null default false, discrepancy_reason text, discrepancy_notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_stock_transfers_tenant on stock_transfers(tenant_id);

alter table stock_transfers enable row level security;
create policy stock_transfers_select on stock_transfers for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy stock_transfers_write on stock_transfers for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy stock_transfers_update on stock_transfers for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists stock_transfer_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  transfer_id text not null,
  sku text, description text, requested_qty numeric(18, 4) not null default 0, dispatched_qty numeric(18, 4) not null default 0,
  received_qty numeric(18, 4) not null default 0, variance_qty numeric(18, 4), discrepancy_reason text,
  discrepancy_notes text, unit_cost numeric(18, 4) not null default 0,
  foreign key (tenant_id, transfer_id) references stock_transfers(tenant_id, id) on delete cascade
);
create index if not exists idx_stock_transfer_items_tenant on stock_transfer_items(tenant_id, transfer_id);

alter table stock_transfer_items enable row level security;
create policy stock_transfer_items_select on stock_transfer_items for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy stock_transfer_items_write on stock_transfer_items for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
