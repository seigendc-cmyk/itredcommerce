-- Sales transactions and their line items/payments, plus held sales,
-- held receipts, layaway, and credit notes.
--
-- Branch scoping note: sales_transactions carries branch_id in the source
-- schema, so till_operator sessions are restricted to their own branch's
-- sales there (and, via an EXISTS check against the parent, on its line
-- items and payments too). held_sales, held_receipts, layaway_orders, and
-- credit_notes do NOT carry a branch_id in the source schema or the
-- TypeScript types — they're ported as tenant-wide operational tables
-- rather than having a branch_id invented for them here. If branch-level
-- isolation is wanted for these later, that's a schema change with its
-- own migration, not something to retrofit silently in this prompt.

create table if not exists sales_transactions (
  sale_id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  sale_number text not null, date_time timestamptz not null,
  customer_id text, customer_name text,
  cashier_id text, cashier_name text,
  subtotal numeric(18, 4) not null default 0, tax_total numeric(18, 4) not null default 0,
  discount_total numeric(18, 4) not null default 0, grand_total numeric(18, 4) not null default 0,
  change_given numeric(18, 4) not null default 0, transaction_type text not null,
  status text not null default 'COMPLETED', terminal_id text, shift_id text,
  branch_id text references branches(id) on delete set null, branch_name text,
  idempotency_key text, total_cost_basis numeric(18, 4), gross_margin numeric(18, 4), notes text,
  primary key (tenant_id, sale_id),
  unique (tenant_id, idempotency_key)
);
create index if not exists idx_sales_tenant_datetime on sales_transactions(tenant_id, date_time);
create index if not exists idx_sales_tenant_branch on sales_transactions(tenant_id, branch_id);
create index if not exists idx_sales_tenant_shift on sales_transactions(tenant_id, shift_id);
create index if not exists idx_sales_tenant_customer on sales_transactions(tenant_id, customer_id);

alter table sales_transactions enable row level security;

create policy sales_transactions_select on sales_transactions for select
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
    or app_is_super_admin()
  );
create policy sales_transactions_insert on sales_transactions for insert
  with check (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  );
-- Deliberately no UPDATE/DELETE policy: a completed sale is an immutable
-- financial record once written. Corrections happen via credit notes, not
-- by editing the original row. Back-office correction tooling that truly
-- needs to patch a row (rare) should go through service_role, not RLS.

create table if not exists sale_line_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  sale_id text not null,
  sku text, item_name text, part_number text, oem_number text,
  quantity numeric(18, 4) not null, unit_price numeric(18, 4) not null default 0,
  discount_percent numeric(8, 4) not null default 0, discount_amount numeric(18, 4) not null default 0,
  tax_rate numeric(8, 4) not null default 0, tax_amount numeric(18, 4) not null default 0,
  unit_cost_basis numeric(18, 4) not null default 0, cost_total numeric(18, 4) not null default 0,
  net_subtotal numeric(18, 4) not null default 0, line_total numeric(18, 4) not null default 0,
  foreign key (tenant_id, sale_id) references sales_transactions(tenant_id, sale_id) on delete cascade
);
create index if not exists idx_sale_lines_tenant_sale on sale_line_items(tenant_id, sale_id);
create index if not exists idx_sale_lines_tenant_sku on sale_line_items(tenant_id, sku);

alter table sale_line_items enable row level security;

create policy sale_line_items_select on sale_line_items for select
  using (
    tenant_id = app_current_tenant_id()
    and (
      app_is_super_admin()
      or exists (
        select 1 from sales_transactions st
        where st.tenant_id = sale_line_items.tenant_id and st.sale_id = sale_line_items.sale_id
          and (not app_is_branch_scoped_role() or st.branch_id = app_current_branch_id())
      )
    )
  );
create policy sale_line_items_insert on sale_line_items for insert
  with check (tenant_id = app_current_tenant_id());

create table if not exists sale_payments (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  sale_id text not null,
  method text not null, amount numeric(18, 4) not null, reference text,
  foreign key (tenant_id, sale_id) references sales_transactions(tenant_id, sale_id) on delete cascade
);
create index if not exists idx_sale_payments_tenant_sale on sale_payments(tenant_id, sale_id);

alter table sale_payments enable row level security;

create policy sale_payments_select on sale_payments for select
  using (
    tenant_id = app_current_tenant_id()
    and (
      app_is_super_admin()
      or exists (
        select 1 from sales_transactions st
        where st.tenant_id = sale_payments.tenant_id and st.sale_id = sale_payments.sale_id
          and (not app_is_branch_scoped_role() or st.branch_id = app_current_branch_id())
      )
    )
  );
create policy sale_payments_insert on sale_payments for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists held_sales (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  sale_number text, customer_id text, customer_name text, cashier_id text, cashier_name text,
  subtotal numeric(18, 4) not null default 0, grand_total numeric(18, 4) not null default 0,
  date_time timestamptz,
  expected_settlement_time timestamptz, status text not null default 'OUTSTANDING', notes text,
  settled_date_time timestamptz, converted_by_staff text,
  primary key (tenant_id, id)
);
create index if not exists idx_held_sales_tenant on held_sales(tenant_id);

alter table held_sales enable row level security;
create policy held_sales_select on held_sales for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy held_sales_write on held_sales for insert
  with check (tenant_id = app_current_tenant_id());
create policy held_sales_update on held_sales for update
  using (tenant_id = app_current_tenant_id())
  with check (tenant_id = app_current_tenant_id());

create table if not exists held_sale_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  held_sale_id text not null,
  sku text, item_name text, quantity numeric(18, 4) not null, unit_price numeric(18, 4) not null default 0,
  discount_percent numeric(8, 4) not null default 0, tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  foreign key (tenant_id, held_sale_id) references held_sales(tenant_id, id) on delete cascade
);
create index if not exists idx_held_sale_items_tenant on held_sale_items(tenant_id, held_sale_id);

alter table held_sale_items enable row level security;
create policy held_sale_items_select on held_sale_items for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy held_sale_items_write on held_sale_items for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists held_receipts (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  cashier_id text, cashier_name text, customer_id text, customer_name text,
  parked_at timestamptz, note text, total_amount numeric(18, 4) not null default 0,
  primary key (tenant_id, id)
);
create index if not exists idx_held_receipts_tenant on held_receipts(tenant_id);

alter table held_receipts enable row level security;
create policy held_receipts_select on held_receipts for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy held_receipts_write on held_receipts for insert
  with check (tenant_id = app_current_tenant_id());
create policy held_receipts_delete on held_receipts for delete
  using (tenant_id = app_current_tenant_id());

create table if not exists held_receipt_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  held_receipt_id text not null,
  sku text, item_name text, quantity numeric(18, 4) not null, unit_price numeric(18, 4) not null default 0,
  discount_percent numeric(8, 4) not null default 0, tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  foreign key (tenant_id, held_receipt_id) references held_receipts(tenant_id, id) on delete cascade
);
create index if not exists idx_held_receipt_items_tenant on held_receipt_items(tenant_id, held_receipt_id);

alter table held_receipt_items enable row level security;
create policy held_receipt_items_select on held_receipt_items for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy held_receipt_items_write on held_receipt_items for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists layaway_orders (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  customer_id text, customer_name text, cashier_id text, cashier_name text,
  total_amount numeric(18, 4) not null default 0, amount_paid numeric(18, 4) not null default 0,
  balance_remaining numeric(18, 4) not null default 0, next_expected_payment_date date,
  deposit_percent numeric(8, 4) not null default 0, created_date date, expiry_date date,
  status text not null default 'ACTIVE', converted_sale_number text,
  primary key (tenant_id, id)
);
create index if not exists idx_layaway_orders_tenant on layaway_orders(tenant_id);

alter table layaway_orders enable row level security;
create policy layaway_orders_select on layaway_orders for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy layaway_orders_write on layaway_orders for insert
  with check (tenant_id = app_current_tenant_id());
create policy layaway_orders_update on layaway_orders for update
  using (tenant_id = app_current_tenant_id())
  with check (tenant_id = app_current_tenant_id());

create table if not exists layaway_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  layaway_id text not null,
  sku text, item_name text, quantity numeric(18, 4) not null, unit_price numeric(18, 4) not null default 0,
  discount_percent numeric(8, 4) not null default 0, tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  foreign key (tenant_id, layaway_id) references layaway_orders(tenant_id, id) on delete cascade
);
create index if not exists idx_layaway_items_tenant on layaway_items(tenant_id, layaway_id);

alter table layaway_items enable row level security;
create policy layaway_items_select on layaway_items for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy layaway_items_write on layaway_items for insert
  with check (tenant_id = app_current_tenant_id());

create table if not exists layaway_payments (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  layaway_id text not null,
  date timestamptz, amount numeric(18, 4) not null, method text, cashier_name text, receipt_no text,
  foreign key (tenant_id, layaway_id) references layaway_orders(tenant_id, id) on delete cascade
);
create index if not exists idx_layaway_payments_tenant on layaway_payments(tenant_id, layaway_id);

alter table layaway_payments enable row level security;
create policy layaway_payments_select on layaway_payments for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy layaway_payments_write on layaway_payments for insert
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists credit_notes (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  original_sale_number text, customer_id text, customer_name text,
  cashier_id text, cashier_name text, date_time timestamptz,
  total_refund_amount numeric(18, 4) not null default 0, refund_method text,
  reason_category text, status text not null default 'ISSUED',
  primary key (tenant_id, id)
);
create index if not exists idx_credit_notes_tenant on credit_notes(tenant_id);

alter table credit_notes enable row level security;
create policy credit_notes_select on credit_notes for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy credit_notes_write on credit_notes for insert
  with check (tenant_id = app_current_tenant_id());
create policy credit_notes_update on credit_notes for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists credit_note_items (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  credit_note_id text not null,
  sku text, item_name text, return_qty numeric(18, 4) not null default 0, unit_price numeric(18, 4) not null default 0,
  reason text, restock boolean not null default true,
  foreign key (tenant_id, credit_note_id) references credit_notes(tenant_id, id) on delete cascade
);
create index if not exists idx_credit_note_items_tenant on credit_note_items(tenant_id, credit_note_id);

alter table credit_note_items enable row level security;
create policy credit_note_items_select on credit_note_items for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy credit_note_items_write on credit_note_items for insert
  with check (tenant_id = app_current_tenant_id());
