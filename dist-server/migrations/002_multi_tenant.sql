-- iTred Commerce — multi-tenant scoping for the local SQLite database.
-- Companion to the Supabase migrations under supabase/migrations/. See
-- ITRED_GOVERNANCE_AND_ARCHITECTURE.md, DL-001.
--
-- IMPORTANT ASYMMETRY vs. the Supabase schema: a single Tauri (or, today,
-- this Express/SQLite dev server) installation binds to exactly ONE
-- tenant, so every row in a given local database already belongs to the
-- same tenant by construction — there is no cross-tenant data to isolate
-- locally the way Supabase's RLS has to. tenant_id is added to every table
-- here mainly so (a) the future outbox/sync engine (Prompt 2) can stamp
-- every outgoing row with the tenant_id Supabase's RLS will check, and
-- (b) row shapes stay structurally identical between local SQLite and
-- Supabase, which simplifies the sync/conflict-resolution code. Because of
-- that, and because SQLite can't add a NOT NULL column without a constant
-- default on a non-empty table, tenant_id is added here as a nullable
-- column, not enforced NOT NULL the way it is in Postgres — the local
-- database's own single-tenancy is the real guarantee, not this column.
--
-- Scope note: this migration does NOT wire any application code to these
-- columns (no reads/writes changed) and does NOT build the LicensingView
-- activation UI — per this prompt's "schema and RLS only" scope, that's
-- business logic for a later prompt. It only prepares the schema and the
-- LicenceInfo type (see src/types/index.ts) so that work has somewhere to
-- land.

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------
-- TENANT (local cache of the Supabase tenants row this install belongs to)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  fiscalization_provider TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  timezone TEXT NOT NULL DEFAULT 'UTC'
);

-- --------------------------------------------------------
-- INSTALLATION IDENTITY (singleton — this device's fixed tenant/branch/
-- terminal binding, captured once at activation time and never changed
-- without a full re-activation). Extends the LicensingView/LicenceInfo
-- flow's persistence layer.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS installation_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id TEXT,
  tenant_id TEXT REFERENCES tenants(id),
  branch_id TEXT REFERENCES branches(id),
  terminal_id TEXT REFERENCES terminals(id),
  app_surface TEXT DEFAULT 'BRANCH_TERMINAL' CHECK (app_surface IN ('BRANCH_TERMINAL', 'HEAD_OFFICE')),
  activation_code TEXT,
  activated_at TEXT
);

-- --------------------------------------------------------
-- tenant_id ADDED TO EVERY EXISTING BUSINESS TABLE
-- (backups already has tenant_id from 001_init.sql — left untouched)
-- --------------------------------------------------------
ALTER TABLE staff ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE warehouses ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE branches ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE terminals ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE connected_shops ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE suppliers ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE customers ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE inventory_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE inventory_movements ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stock_adjustments ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stocktakes ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stocktake_sessions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stocktake_lines ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE reorder_recommendations ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE sales_transactions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE sale_line_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE sale_payments ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE held_sales ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE held_sale_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE held_receipts ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE held_receipt_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE layaway_orders ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE layaway_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE layaway_payments ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE credit_notes ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE credit_note_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE shifts ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE eod_reports ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE eod_reconciliation_entries ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE purchase_memos ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE purchase_memo_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE purchase_orders ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE purchase_order_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE goods_receipt_notes ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE goods_receipt_note_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stock_transfers ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE stock_transfer_items ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE debtor_transactions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE creditor_transactions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE cash_bank_accounts ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE cash_bank_transactions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE cash_movements ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE business_reserves ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE reserve_transfers ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE tax_config ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE tax_categories ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE tax_classifications ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE approval_requests ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE operational_exceptions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE activity_events ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE bi_alerts ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE generic_records ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_tenant ON activity_events(tenant_id);
