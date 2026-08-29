-- Generic JSON-record catalog for simpler reference/config domains (device
-- lists, payment method config, custom field definitions, etc.) — the
-- Postgres counterpart of the existing generic_records/crudFactory pattern.
-- Readable tenant-wide (till needs payment-method/device config to
-- operate), writable by back-office roles only.

create table if not exists generic_records (
  tenant_id text not null references tenants(id) on delete cascade,
  domain text not null,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, domain, id)
);
create index if not exists idx_generic_records_tenant_domain on generic_records(tenant_id, domain);

create trigger trg_generic_records_updated_at before update on generic_records
  for each row execute function set_updated_at();

alter table generic_records enable row level security;

create policy generic_records_select on generic_records for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy generic_records_write on generic_records for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy generic_records_update on generic_records for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
create policy generic_records_delete on generic_records for delete
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role());
