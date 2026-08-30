-- Dev-only seed data for the Supabase project (Prompt 5 migration of the
-- existing mock staff into the new tenant-aware model). Not applied by
-- `supabase db push` — only by `supabase db reset` / an explicit
-- `psql -f supabase/seed.sql` run, matching the Supabase CLI's own
-- convention that seed.sql is separate from migrations/.
--
-- country/base_currency below are PLACEHOLDER values (US/USD, matching the
-- rest of this repo's mock data) — country selects the FiscalizationProvider
-- per DL-003, so update it to the tenant's real country before that matters.
insert into tenants (id, legal_name, display_name, country, base_currency, status, timezone)
values ('TENANT-NYAMUTSAMBA', 'L Nyamutsamba', 'L Nyamutsamba', 'US', 'USD', 'ACTIVE', 'UTC')
on conflict (id) do nothing;

-- Migrated from src/data/mockData.ts's INITIAL_STAFF_MEMBERS. PINs are
-- re-hashed at bcrypt cost 12 (up from the local dev seed's cost 10) since
-- this is the one time we still hold the plaintext — see the governance
-- doc's DL-011 security notes on why this option disappears for any real
-- staff PIN migrated later. home_branch_id is left null for all four: no
-- source data exists to map terminal_access (terminal ids) to a branch.
insert into staff (id, tenant_id, code, name, role, role_title, department, access_role, pin_hash, avatar_initials, permissions, terminal_access, is_active)
values
  ('STF-001', 'TENANT-NYAMUTSAMBA', '1001', 'Jonathan Reynolds', 'STORE_MANAGER', 'Store Manager', 'Store Operations', 'head_office_staff',
   crypt('1234', gen_salt('bf', 12)), 'JR',
   '["all_sales", "all_purchasing", "reports_full", "settings_general", "inventory_full", "staff_view"]'::jsonb,
   '["TERM-01", "TERM-02", "TERM-03"]'::jsonb, true),
  ('STF-002', 'TENANT-NYAMUTSAMBA', '1002', 'Elena Vance', 'SENIOR_CASHIER', 'Senior Cashier', 'Sales & Front Office', 'till_operator',
   crypt('2244', gen_salt('bf', 12)), 'EV',
   '["all_sales", "reports_shift", "inventory_view", "customer_manage"]'::jsonb,
   '["TERM-01", "TERM-02"]'::jsonb, true),
  ('STF-003', 'TENANT-NYAMUTSAMBA', '1003', 'Marcus Chen', 'INVENTORY_OFFICER', 'Inventory Officer', 'Warehouse & Receiving', 'head_office_staff',
   crypt('3355', gen_salt('bf', 12)), 'MC',
   '["all_purchasing", "inventory_full", "stocktake", "reports_inventory"]'::jsonb,
   '["TERM-02", "TERM-03"]'::jsonb, true),
  ('STF-004', 'TENANT-NYAMUTSAMBA', '1000', 'System Administrator', 'SYS_ADMIN', 'System Administrator', 'Administration', 'head_office_staff',
   crypt('9999', gen_salt('bf', 12)), 'SA',
   '["*"]'::jsonb,
   '["TERM-01", "TERM-02", "TERM-03", "BACKOFFICE-01"]'::jsonb, true)
on conflict (tenant_id, id) do nothing;
