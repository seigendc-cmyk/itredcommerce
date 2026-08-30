-- DL-013 (Prompt 6): Chart of Accounts, scoped honestly. No general ledger
-- / double-entry posting engine exists anywhere in this schema — this is
-- the account *registry* plus a linkage from real cash/bank accounts to
-- one GL account each, giving the Executive PWA a real drill-down (click a
-- GL account -> see its linked bank/cash accounts and their transactions).
-- It is NOT a per-sale/per-expense-line posting ledger. See the
-- P&L/Balance Sheet notes in ITRED_GOVERNANCE_AND_ARCHITECTURE.md's DL-013
-- addendum for how those two statements are approximated from this plus
-- the rollups in 20260831090000_executive_rollups.sql, not derived from
-- real postings.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gl_account_type') then
    create type gl_account_type as enum ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
  end if;
end $$;

create table if not exists chart_of_accounts (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type gl_account_type not null,
  parent_account_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, account_code),
  foreign key (tenant_id, parent_account_id) references chart_of_accounts (tenant_id, id) on delete set null
);
create index if not exists idx_chart_of_accounts_tenant on chart_of_accounts(tenant_id);

alter table chart_of_accounts enable row level security;
create policy chart_of_accounts_select on chart_of_accounts for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy chart_of_accounts_write on chart_of_accounts for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy chart_of_accounts_update on chart_of_accounts for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- Links each real bank/cash/till account to one GL account. Nullable —
-- existing cash_bank_accounts rows aren't retroactively assigned one by
-- this migration (there's no reliable automatic mapping); back-office
-- staff assign it per account going forward via the head-office app.
alter table cash_bank_accounts add column if not exists gl_account_id text;
alter table cash_bank_accounts
  add constraint cash_bank_accounts_gl_account_fk
  foreign key (tenant_id, gl_account_id) references chart_of_accounts (tenant_id, id) on delete set null;

create trigger trg_chart_of_accounts_updated_at
  before update on chart_of_accounts
  for each row execute function set_updated_at();
