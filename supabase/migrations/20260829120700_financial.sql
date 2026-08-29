-- Debtors, creditors, cash/bank accounts, cash manager movements, reserves.
-- Tier B: back-office only.

create table if not exists debtor_transactions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  customer_id text, customer_name text, account_number text, date_time timestamptz,
  transaction_type text, reference_number text, description text,
  debit numeric(18, 4) not null default 0, credit numeric(18, 4) not null default 0,
  running_balance numeric(18, 4) not null default 0,
  due_date date, status text not null default 'UNPAID', allocated_amount numeric(18, 4), payment_method text,
  notes text, cashier_or_staff_name text,
  primary key (tenant_id, id)
);
create index if not exists idx_debtor_tx_tenant_customer on debtor_transactions(tenant_id, customer_id);

alter table debtor_transactions enable row level security;
create policy debtor_tx_select on debtor_transactions for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy debtor_tx_write on debtor_transactions for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

create table if not exists creditor_transactions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  supplier_code text, supplier_name text, date_time timestamptz, transaction_type text,
  reference_number text, description text, invoice_amount numeric(18, 4) not null default 0,
  payment_amount numeric(18, 4) not null default 0, running_balance numeric(18, 4) not null default 0,
  due_date date, status text not null default 'PENDING', payment_method text,
  authorized_by_staff_name text, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_creditor_tx_tenant_supplier on creditor_transactions(tenant_id, supplier_code);

alter table creditor_transactions enable row level security;
create policy creditor_tx_select on creditor_transactions for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy creditor_tx_write on creditor_transactions for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists cash_bank_accounts (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  code text, name text, account_type text, account_number text, institution_or_provider text,
  branch_id text references branches(id) on delete set null, branch_name text,
  currency text not null default 'USD',
  current_balance numeric(18, 4) not null default 0, opening_balance numeric(18, 4) not null default 0,
  status text not null default 'ACTIVE', is_default boolean not null default false,
  requires_dual_approval_for_transfer boolean not null default false, max_daily_outflow_limit numeric(18, 4),
  last_reconciled_date date, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_cash_bank_accounts_tenant on cash_bank_accounts(tenant_id);

alter table cash_bank_accounts enable row level security;
create policy cash_bank_accounts_select on cash_bank_accounts for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy cash_bank_accounts_write on cash_bank_accounts for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy cash_bank_accounts_update on cash_bank_accounts for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists cash_bank_transactions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  account_id text, account_name text, date_time timestamptz, movement_type text,
  amount numeric(18, 4) not null default 0, fee_amount numeric(18, 4), balance_after numeric(18, 4) not null default 0,
  reference_number text, counter_account_id text, counter_account_name text, description text,
  performed_by_staff_id text, performed_by_staff_name text, approved_by_staff_name text,
  status text not null default 'POSTED', receipt_or_slip_number text, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_cash_bank_tx_tenant_account on cash_bank_transactions(tenant_id, account_id);

alter table cash_bank_transactions enable row level security;
create policy cash_bank_tx_select on cash_bank_transactions for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy cash_bank_tx_write on cash_bank_transactions for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists cash_movements (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  movement_number text, category text, source_account_id text, source_account_name text,
  destination_account_id text, destination_account_name text, amount numeric(18, 4) not null default 0,
  reason_category text, description text, receipt_slip_number text, bag_seal_number text,
  denomination_breakdown jsonb, requested_by_staff_id text, requested_by_staff_name text,
  is_sensitive boolean not null default false, requires_approval boolean not null default false,
  approval_status text not null default 'NOT_REQUIRED', approved_by_staff_name text,
  approved_date_time timestamptz, date_time timestamptz,
  primary key (tenant_id, id)
);
create index if not exists idx_cash_movements_tenant on cash_movements(tenant_id);

alter table cash_movements enable row level security;
create policy cash_movements_select on cash_movements for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy cash_movements_write on cash_movements for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy cash_movements_update on cash_movements for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists business_reserves (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  code text, name text, category text, target_amount numeric(18, 4) not null default 0,
  current_funded_balance numeric(18, 4) not null default 0, allocation_rule_percent numeric(8, 4) not null default 0,
  linked_bank_account_id text, linked_bank_account_name text, description text,
  priority text not null default 'MEDIUM', status text not null default 'ACTIVE',
  last_contribution_date date, last_drawdown_date date,
  primary key (tenant_id, id)
);
create index if not exists idx_business_reserves_tenant on business_reserves(tenant_id);

alter table business_reserves enable row level security;
create policy business_reserves_select on business_reserves for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy business_reserves_write on business_reserves for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy business_reserves_update on business_reserves for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists reserve_transfers (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  reserve_id text, reserve_name text, date_time timestamptz, type text, amount numeric(18, 4) not null default 0,
  from_account_name text, to_account_name text, reference_number text,
  authorized_by_staff_name text, notes text,
  primary key (tenant_id, id)
);
create index if not exists idx_reserve_transfers_tenant on reserve_transfers(tenant_id);

alter table reserve_transfers enable row level security;
create policy reserve_transfers_select on reserve_transfers for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy reserve_transfers_write on reserve_transfers for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
