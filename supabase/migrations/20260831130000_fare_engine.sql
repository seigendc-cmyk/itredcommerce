-- Delivery fare calculation engine (Prompt 8). Mirrors
-- server/db/migrations/007_fare_engine.sql. Extends the DL-004 rate_config
-- ledger (supabase/migrations/20260830090000_rate_config.sql) with new
-- nullable/defaulted columns rather than a second versioning mechanism —
-- safe on an insert-only ledger since past rows are never rewritten.
alter table rate_config add column if not exists use_separate_intercity_rate boolean not null default false;
alter table rate_config add column if not exists per_km_rate_intercity numeric(12, 4);
alter table rate_config add column if not exists is_multi_currency boolean not null default false;
alter table rate_config add column if not exists settlement_currency text;
alter table rate_config add column if not exists exchange_rate_to_settlement numeric(18, 6);

-- delivery_orders.fare_amount already exists (Prompt 7, left null — this
-- migration is what starts populating it). These two columns record which
-- rate version produced it and in what currency, so a later rate change
-- can never retroactively alter an already-created dispatch's fare.
alter table delivery_orders add column if not exists fare_currency text;
alter table delivery_orders add column if not exists fare_rate_config_version integer;

do $$
begin
  alter table delivery_orders
    add constraint delivery_orders_fare_rate_config_version_fkey
    foreign key (tenant_id, fare_rate_config_version) references rate_config(tenant_id, version);
exception
  when duplicate_object then null;
end $$;
