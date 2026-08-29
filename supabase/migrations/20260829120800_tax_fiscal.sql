-- Tax/fiscal configuration. Readable tenant-wide (receipts need to show
-- tax labels/rates at the till), writable by back-office roles only.
-- Fiscalization provider selection itself lives on tenants.fiscalization_provider
-- (DL-003) — this table is the tax display/config layer, ported unchanged
-- in shape from the existing FiscalConfig type.

create table if not exists tax_config (
  tenant_id text primary key references tenants(id) on delete cascade,
  tax_system_name text, tax_registration_number text, fiscal_device_serial_number text,
  tax_invoice_header_disclaimer text, tax_invoice_footer_disclaimer text,
  tax_inclusive_pricing boolean not null default false, currency_symbol text not null default '$'
);

alter table tax_config enable row level security;
create policy tax_config_select on tax_config for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy tax_config_write on tax_config for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy tax_config_update on tax_config for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists tax_categories (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  code text, name text, standard_rate numeric(8, 4) not null default 0, is_compound boolean not null default false,
  is_exempt boolean not null default false, is_zero_rated boolean not null default false,
  description text, active boolean not null default true, fiscal_code text,
  primary key (tenant_id, id)
);
create index if not exists idx_tax_categories_tenant on tax_categories(tenant_id);

alter table tax_categories enable row level security;
create policy tax_categories_select on tax_categories for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy tax_categories_write on tax_categories for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy tax_categories_update on tax_categories for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

create table if not exists tax_classifications (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  department_or_category text, tax_category_id text, tax_category_name text,
  tax_rate numeric(8, 4) not null default 0, item_count integer not null default 0
);
create index if not exists idx_tax_classifications_tenant on tax_classifications(tenant_id);

alter table tax_classifications enable row level security;
create policy tax_classifications_select on tax_classifications for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy tax_classifications_write on tax_classifications for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy tax_classifications_update on tax_classifications for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
