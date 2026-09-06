-- BI Brain: data-driven rules engine substrate (DL-058-063). Schema only —
-- see server/lib/biRuleEngine.ts for the evaluator this data drives.

-- --------------------------------------------------------
-- BI_RULES — platform-owned, versioned. A new version is a new row (never
-- an UPDATE to an existing one), the same insert-only immutability
-- discipline already established for rate_config
-- (20260830090000_rate_config.sql) — a rule's past behavior stays
-- permanently reconstructable regardless of later versions. Not
-- tenant-scoped: rule definitions are global platform policy, not
-- per-tenant data.
-- --------------------------------------------------------
create table if not exists bi_rules (
  rule_id text not null,
  version integer not null,
  category text not null check (
    category in ('CAPITAL_VELOCITY', 'BUDGET_VARIANCE_ADVISOR', 'FORENSIC_THEFT_GUARD', 'DEAD_STOCK_SEASONAL_DISPOSAL')
  ),
  description text not null,
  conditions jsonb not null,
  event jsonb not null,
  parameters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (rule_id, version)
);
create index if not exists idx_bi_rules_rule_id on bi_rules(rule_id, version desc);

alter table bi_rules enable row level security;

-- Rule definitions carry no secrets and every tenant install needs to read
-- the full catalog to evaluate/configure rules locally — no tenant_id
-- column exists to scope by, so this is a flat "any authenticated session"
-- read, not a tenant-filtered one. No insert/update/delete policy at all:
-- only the service-role key (bypassing RLS) can author a new rule version,
-- per DL-059 — tenants can never write rule logic.
grant select on bi_rules to authenticated;
create policy bi_rules_select on bi_rules for select using (true);

-- --------------------------------------------------------
-- TENANT_BI_RULE_SETTINGS — tenant-owned, mutable (unlike bi_rules, this is
-- the tenant's *current* configuration, not a versioned ledger — updated in
-- place as parameters change). rule_version records which bi_rules version
-- these parameter_values were last reconciled against (see the
-- reconciliation logic in server/sync/biRulesPull.ts); orphaned_parameters
-- holds any parameter name a newer rule version dropped, kept rather than
-- deleted and surfaced in the BI Config page until acknowledged.
-- --------------------------------------------------------
create table if not exists tenant_bi_rule_settings (
  tenant_id text not null references tenants(id) on delete cascade,
  rule_id text not null,
  rule_version integer not null,
  enabled boolean not null default true,
  parameter_values jsonb not null default '{}'::jsonb,
  orphaned_parameters jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rule_id)
);

create trigger trg_tenant_bi_rule_settings_updated_at before update on tenant_bi_rule_settings
  for each row execute function set_updated_at();

alter table tenant_bi_rule_settings enable row level security;

-- Ordinary tenant-scoped read/write, back-office-gated — this table IS
-- tenant-owned data (DL-063), unlike bi_rules above. Mirrors
-- rate_config/tax_config's tenant-back-office-write convention, not
-- bi_rules' service-role-only one.
create policy tenant_bi_rule_settings_select on tenant_bi_rule_settings for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy tenant_bi_rule_settings_insert on tenant_bi_rule_settings for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy tenant_bi_rule_settings_update on tenant_bi_rule_settings for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- Approval tickets: DL-063 extends the existing approval_requests table
-- (20260829120900_governance.sql) rather than introducing a new one — it
-- already has exactly the extension points needed (a free-text `type`
-- column, `reference_id`/`reference_type`, and a `meta` jsonb blob) and no
-- existing call site to conflict with. A BI Brain ticket is inserted with
-- type = 'BI_RULE_REDIRECT', reference_id/reference_type pointing at the
-- gated entity (e.g. an inventory sku), and meta containing
-- {ruleId, ruleVersion, parameterValuesSnapshot} — no schema change to that
-- table is needed.

-- --------------------------------------------------------
-- ONE example rule, shipped end-to-end per the implementation prompt: the
-- dead-stock restock-redirect. Redirects a purchase-memo/order request to
-- manager approval when sales for the item since its last restock request
-- are at or below a tenant-tunable threshold (default 0 — "no sales at
-- all since we last asked for more of this").
-- --------------------------------------------------------
insert into bi_rules (rule_id, version, category, description, conditions, event, parameters)
values (
  'BI-DEADSTOCK-RESTOCK-001',
  1,
  'DEAD_STOCK_SEASONAL_DISPOSAL',
  'Redirect a restock request to manager approval when sales of the item since its last restock request are at or below the configured threshold.',
  '{"all": [{"fact": "salesSinceLastRequest", "operator": "lessThanOrEqual", "value": {"param": "sales_threshold"}}]}'::jsonb,
  '{"type": "REDIRECT_TO_APPROVAL"}'::jsonb,
  '[{"name": "sales_threshold", "type": "number", "default": 0, "min": 0, "max": 1000}]'::jsonb
)
on conflict (rule_id, version) do nothing;
