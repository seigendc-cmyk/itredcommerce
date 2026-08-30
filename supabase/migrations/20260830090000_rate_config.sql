-- DL-004 versioned fare/rate configuration (Prompt 4). Mirrors
-- server/db/migrations/005_rate_config.sql — an insert-only ledger, never
-- updated: publishing a new rate version is always an INSERT with
-- version = MAX(version)+1, so past versions can never be retroactively
-- altered. This is why there is deliberately no `update` RLS policy below —
-- the absence enforces insert-only at the RLS layer too, not just app
-- convention.

create table if not exists rate_config (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  version integer not null,
  currency text not null default 'USD',
  base_fee numeric(12, 4) not null default 0,
  per_km_rate numeric(12, 4) not null default 0,
  load_size_surcharge_tiers jsonb not null default '[]'::jsonb,
  ride_type_multipliers jsonb not null default '{}'::jsonb,
  effective_date date not null,
  created_by_staff_id text,
  created_by_staff_name text,
  created_at timestamptz not null default now(),
  notes text,
  primary key (tenant_id, id),
  unique (tenant_id, version)
);
create index if not exists idx_rate_config_tenant on rate_config(tenant_id);

alter table rate_config enable row level security;
create policy rate_config_select on rate_config for select
  using (tenant_id = app_current_tenant_id() or app_is_super_admin());
create policy rate_config_write on rate_config for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
