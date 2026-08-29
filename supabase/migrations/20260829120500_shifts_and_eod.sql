-- Shifts and end-of-day reports. Branch-scoped (Tier A): till_operator
-- sessions see/act on only their own branch; back-office roles see the
-- whole tenant. The reconciliation_snapshot / tender_reconciliation /
-- cash_movements JSON blobs are ported as jsonb and must keep being
-- treated as immutable once a shift is closed, per
-- src/utils/shiftReconciliation.ts's existing design — RLS doesn't enforce
-- that immutability itself (a closed shift can still technically be
-- UPDATEd by a back-office role under this policy); that invariant is
-- application-layer, same as it is today.

create table if not exists shifts (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  shift_number text, terminal_id text, terminal_name text,
  branch_id text references branches(id) on delete set null, branch_name text,
  cashier_staff_id text, cashier_staff_name text,
  opened_date_time timestamptz, opening_date date,
  opening_float numeric(18, 4) not null default 0, opening_notes text,
  closed_date_time timestamptz, closing_float numeric(18, 4), status text not null default 'OPEN',
  expected_cash numeric(18, 4) not null default 0, counted_cash numeric(18, 4), cash_variance numeric(18, 4),
  cash_variance_tolerance numeric(18, 4), cash_up_mode text, close_policy text,
  total_sales_count integer not null default 0, gross_sales numeric(18, 4) not null default 0,
  total_cash_sales numeric(18, 4) not null default 0, total_mobile_money_sales numeric(18, 4) not null default 0,
  total_card_sales numeric(18, 4) not null default 0, total_credit_sales numeric(18, 4) not null default 0,
  total_refunds numeric(18, 4) not null default 0, total_payouts numeric(18, 4) not null default 0,
  total_held_sales numeric(18, 4) not null default 0, total_layaway_receipts numeric(18, 4) not null default 0,
  tender_reconciliation jsonb, cash_movements jsonb, reconciliation_snapshot jsonb,
  closure_reason_code text, cash_discrepancy_severity text, closing_notes text,
  approved_by_staff_name text, approved_date_time timestamptz,
  primary key (tenant_id, id)
);
create index if not exists idx_shifts_tenant_terminal on shifts(tenant_id, terminal_id);
create index if not exists idx_shifts_tenant_branch on shifts(tenant_id, branch_id);
create index if not exists idx_shifts_tenant_status on shifts(tenant_id, status);

alter table shifts enable row level security;

create policy shifts_select on shifts for select
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
    or app_is_super_admin()
  );
create policy shifts_insert on shifts for insert
  with check (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  );
create policy shifts_update on shifts for update
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  )
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists eod_reports (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  report_number text, date date,
  branch_id text references branches(id) on delete set null, branch_name text,
  terminal_id text, terminal_name text,
  generated_by_staff_id text, generated_by_staff_name text, status text not null default 'DRAFT',
  total_sales numeric(18, 4) not null default 0, total_cash_expected numeric(18, 4) not null default 0,
  total_cash_counted numeric(18, 4) not null default 0, total_variance numeric(18, 4) not null default 0,
  unresolved_held_sales_count integer not null default 0, unresolved_held_sales_value numeric(18, 4) not null default 0,
  unapproved_refunds_count integer not null default 0, unapproved_refunds_value numeric(18, 4) not null default 0,
  open_tills_count integer not null default 0, pending_stock_adjustments_count integer not null default 0,
  manager_approved_by text, manager_approval_date timestamptz, manager_notes text, created_date_time timestamptz,
  primary key (tenant_id, id)
);
create index if not exists idx_eod_reports_tenant_branch on eod_reports(tenant_id, branch_id);

alter table eod_reports enable row level security;

create policy eod_reports_select on eod_reports for select
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
    or app_is_super_admin()
  );
create policy eod_reports_insert on eod_reports for insert
  with check (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  );
create policy eod_reports_update on eod_reports for update
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  )
  with check (tenant_id = app_current_tenant_id());

create table if not exists eod_reconciliation_entries (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  eod_report_id text not null,
  category text, label text, expected_amount numeric(18, 4) not null default 0,
  counted_amount numeric(18, 4) not null default 0, variance numeric(18, 4) not null default 0, notes text,
  foreign key (tenant_id, eod_report_id) references eod_reports(tenant_id, id) on delete cascade
);
create index if not exists idx_eod_recon_entries_tenant on eod_reconciliation_entries(tenant_id, eod_report_id);

alter table eod_reconciliation_entries enable row level security;

create policy eod_recon_entries_select on eod_reconciliation_entries for select
  using (
    tenant_id = app_current_tenant_id()
    and (
      app_is_super_admin()
      or exists (
        select 1 from eod_reports er
        where er.tenant_id = eod_reconciliation_entries.tenant_id and er.id = eod_reconciliation_entries.eod_report_id
          and (not app_is_branch_scoped_role() or er.branch_id = app_current_branch_id())
      )
    )
  );
create policy eod_recon_entries_insert on eod_reconciliation_entries for insert
  with check (tenant_id = app_current_tenant_id());
