-- DL-013 (Prompt 6, Executive PWA): pre-aggregated rollups for the
-- dashboard, refreshed on a schedule rather than aggregating raw
-- transaction rows on every page load — see the plan's performance note.
--
-- IMPORTANT: Postgres does not enforce Row-Level Security on materialized
-- views (RLS only applies to tables and regular views querying them). Every
-- matview below is therefore NOT granted to authenticated/anon directly —
-- only a thin wrapper view (v_*) that re-applies tenant_id = app_current_tenant_id()
-- explicitly is granted. This is the one correctness detail that matters
-- most in this file; every matview follows the same three-piece pattern:
--   1. matview (no RLS, no direct grant)
--   2. unique index (for REFRESH ... CONCURRENTLY)
--   3. wrapper view (re-applies tenant scoping, granted to authenticated)

create extension if not exists pg_cron;

-- --------------------------------------------------------
-- Refresh tracking — powers every page's "As of [time]" label.
-- --------------------------------------------------------
create table if not exists rollup_refresh_log (
  view_name text primary key,
  refreshed_at timestamptz not null default now()
);
alter table rollup_refresh_log enable row level security;
create policy rollup_refresh_log_select on rollup_refresh_log for select using (true);
-- No insert/update/delete policy for authenticated/anon — only the cron
-- jobs (running as the table owner / via SECURITY DEFINER refresh_all_
-- executive_rollups()) write to this table.

-- --------------------------------------------------------
-- mv_daily_sales_summary
-- --------------------------------------------------------
create materialized view if not exists mv_daily_sales_summary as
select
  tenant_id,
  branch_id,
  date_trunc('day', date_time::timestamptz)::date as sale_date,
  count(*) as transaction_count,
  sum(grand_total) as gross_revenue,
  sum(discount_total) as discounts,
  sum(tax_total) as tax,
  sum(grand_total - tax_total) as net_revenue,
  sum(coalesce(total_cost_basis, 0)) as cost_basis,
  case when sum(grand_total - tax_total) > 0
    then round((sum(grand_total - tax_total - coalesce(total_cost_basis, 0)) / sum(grand_total - tax_total) * 100)::numeric, 2)
    else 0 end as gross_margin_percent
from sales_transactions
where status = 'COMPLETED'
group by tenant_id, branch_id, date_trunc('day', date_time::timestamptz)::date;

create unique index if not exists idx_mv_daily_sales_summary
  on mv_daily_sales_summary (tenant_id, branch_id, sale_date);

create view v_daily_sales_summary as
select * from mv_daily_sales_summary where tenant_id = app_current_tenant_id();
grant select on v_daily_sales_summary to authenticated;

-- --------------------------------------------------------
-- mv_inventory_valuation
-- --------------------------------------------------------
create materialized view if not exists mv_inventory_valuation as
select
  tenant_id,
  sku,
  department,
  category,
  stock_on_hand,
  unit_cost,
  retail_price,
  (stock_on_hand * unit_cost) as valuation_at_cost,
  (stock_on_hand * retail_price) as valuation_at_retail
from inventory_items
where is_active = true;

create unique index if not exists idx_mv_inventory_valuation
  on mv_inventory_valuation (tenant_id, sku);

create view v_inventory_valuation as
select * from mv_inventory_valuation where tenant_id = app_current_tenant_id();
grant select on v_inventory_valuation to authenticated;

-- --------------------------------------------------------
-- mv_inventory_turnover — velocity + a simple fast/normal/slow/dead
-- classification (proposed thresholds, easy to retune once real sales
-- volume exists: >=1/day fast, >=0.2/day normal, >0/day slow, 0 dead).
-- --------------------------------------------------------
create materialized view if not exists mv_inventory_turnover as
with sold_30d as (
  select
    st.tenant_id as tenant_id,
    li.sku,
    sum(li.quantity) as units_sold_30d
  from sale_line_items li
  join sales_transactions st on st.sale_id = li.sale_id
  where st.status = 'COMPLETED'
    and st.date_time::timestamptz >= now() - interval '30 days'
  group by 1, 2
),
sold_90d as (
  select
    st.tenant_id as tenant_id,
    li.sku,
    sum(li.quantity) as units_sold_90d
  from sale_line_items li
  join sales_transactions st on st.sale_id = li.sale_id
  where st.status = 'COMPLETED'
    and st.date_time::timestamptz >= now() - interval '90 days'
  group by 1, 2
),
-- Ageing input: when this SKU last moved at all (sale, receipt, transfer,
-- adjustment) — distinct from velocity above. "Ageing" is about how long
-- stock has sat since it last moved, not how fast it's currently selling;
-- the inventory ageing page (top 20, filterable) is built on last_movement_
-- date/days_since_last_movement, not on movement_class.
last_movement as (
  select tenant_id, sku, max(timestamp::timestamptz) as last_movement_at
  from inventory_movements
  group by tenant_id, sku
)
select
  i.tenant_id,
  i.sku,
  i.name,
  i.stock_on_hand,
  coalesce(s30.units_sold_30d, 0) as units_sold_30d,
  coalesce(s90.units_sold_90d, 0) as units_sold_90d,
  round((coalesce(s30.units_sold_30d, 0) / 30.0)::numeric, 3) as avg_daily_velocity,
  case when coalesce(s30.units_sold_30d, 0) > 0
    then round((i.stock_on_hand / (coalesce(s30.units_sold_30d, 0) / 30.0))::numeric, 1)
    else null end as days_of_supply,
  case
    when coalesce(s30.units_sold_30d, 0) / 30.0 >= 1 then 'FAST'
    when coalesce(s30.units_sold_30d, 0) / 30.0 >= 0.2 then 'NORMAL'
    when coalesce(s30.units_sold_30d, 0) > 0 then 'SLOW'
    else 'DEAD'
  end as movement_class,
  lm.last_movement_at,
  case when lm.last_movement_at is not null
    then extract(day from now() - lm.last_movement_at)::integer
    else null end as days_since_last_movement
from inventory_items i
left join sold_30d s30 on s30.tenant_id = i.tenant_id and s30.sku = i.sku
left join sold_90d s90 on s90.tenant_id = i.tenant_id and s90.sku = i.sku
left join last_movement lm on lm.tenant_id = i.tenant_id and lm.sku = i.sku
where i.is_active = true;

create unique index if not exists idx_mv_inventory_turnover
  on mv_inventory_turnover (tenant_id, sku);

create view v_inventory_turnover as
select * from mv_inventory_turnover where tenant_id = app_current_tenant_id();
grant select on v_inventory_turnover to authenticated;

-- --------------------------------------------------------
-- mv_debtor_aging / mv_creditor_aging — reuses the exact bucket shape
-- DebtorAgingBucket/CreditorAgingBucket already define in
-- src/types/index.ts (0-30/31-60/61-90/90+), computed server-side.
-- --------------------------------------------------------
create materialized view if not exists mv_debtor_aging as
select
  tenant_id,
  customer_id,
  customer_name,
  sum(running_balance) filter (where due_date is null or due_date::date >= current_date - 30) as current_0_to_30,
  sum(running_balance) filter (where due_date::date < current_date - 30 and due_date::date >= current_date - 60) as days_31_to_60,
  sum(running_balance) filter (where due_date::date < current_date - 60 and due_date::date >= current_date - 90) as days_61_to_90,
  sum(running_balance) filter (where due_date::date < current_date - 90) as days_90_plus,
  sum(running_balance) as total_outstanding,
  sum(running_balance) filter (where status = 'OVERDUE') as overdue_amount
from debtor_transactions
group by tenant_id, customer_id, customer_name;

create unique index if not exists idx_mv_debtor_aging
  on mv_debtor_aging (tenant_id, customer_id);

create view v_debtor_aging as
select * from mv_debtor_aging where tenant_id = app_current_tenant_id();
grant select on v_debtor_aging to authenticated;

create materialized view if not exists mv_creditor_aging as
select
  tenant_id,
  supplier_code,
  supplier_name,
  sum(running_balance) filter (where due_date is null or due_date::date >= current_date - 30) as current_0_to_30,
  sum(running_balance) filter (where due_date::date < current_date - 30 and due_date::date >= current_date - 60) as days_31_to_60,
  sum(running_balance) filter (where due_date::date < current_date - 60 and due_date::date >= current_date - 90) as days_61_to_90,
  sum(running_balance) filter (where due_date::date < current_date - 90) as days_90_plus,
  sum(running_balance) as total_outstanding,
  sum(running_balance) filter (where status = 'OVERDUE') as overdue_amount
from creditor_transactions
group by tenant_id, supplier_code, supplier_name;

create unique index if not exists idx_mv_creditor_aging
  on mv_creditor_aging (tenant_id, supplier_code);

create view v_creditor_aging as
select * from mv_creditor_aging where tenant_id = app_current_tenant_id();
grant select on v_creditor_aging to authenticated;

-- --------------------------------------------------------
-- mv_expense_rollup — cash/bank outflows by day + movement type, the
-- closest existing "expense" signal absent a real GL posting engine
-- (see the Chart of Accounts migration for the gl_account_id linkage that
-- refines this further).
-- --------------------------------------------------------
create materialized view if not exists mv_expense_rollup as
select
  tenant_id,
  date_trunc('day', date_time::timestamptz)::date as expense_date,
  movement_type,
  sum(abs(amount)) as total_amount
from cash_bank_transactions
where movement_type in ('WITHDRAWAL', 'PAYOUT', 'CARD_SETTLEMENT')
group by tenant_id, date_trunc('day', date_time::timestamptz)::date, movement_type;

create unique index if not exists idx_mv_expense_rollup
  on mv_expense_rollup (tenant_id, expense_date, movement_type);

create view v_expense_rollup as
select * from mv_expense_rollup where tenant_id = app_current_tenant_id();
grant select on v_expense_rollup to authenticated;

-- --------------------------------------------------------
-- Refresh + schedule
-- --------------------------------------------------------
create or replace function refresh_all_executive_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently mv_daily_sales_summary;
  refresh materialized view concurrently mv_inventory_valuation;
  refresh materialized view concurrently mv_inventory_turnover;
  refresh materialized view concurrently mv_debtor_aging;
  refresh materialized view concurrently mv_creditor_aging;
  refresh materialized view concurrently mv_expense_rollup;

  insert into rollup_refresh_log (view_name, refreshed_at)
  values
    ('mv_daily_sales_summary', now()), ('mv_inventory_valuation', now()),
    ('mv_inventory_turnover', now()), ('mv_debtor_aging', now()),
    ('mv_creditor_aging', now()), ('mv_expense_rollup', now())
  on conflict (view_name) do update set refreshed_at = excluded.refreshed_at;
end;
$$;

revoke all on function refresh_all_executive_rollups() from public;

select cron.schedule('refresh-executive-rollups', '*/15 * * * *', $$select refresh_all_executive_rollups()$$);
