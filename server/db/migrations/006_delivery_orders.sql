-- Delivery subsystem, dispatch-side data model (Prompt 7). Local mirror of
-- supabase/migrations/20260831120000_delivery_orders.sql's delivery_orders
-- table. No tenant_id column here, matching every other local table's
-- convention (a single Tauri/terminal install binds to exactly one tenant —
-- DL-001 — so local SQLite doesn't need to carry it).
--
-- IMPORTANT: this table is deliberately absent from
-- server/sync/entityRules.ts's CATEGORY_BY_TABLE map. Delivery orders must
-- never be queued in the outbox for later creation (DL-008) — the creation
-- route writes directly to Supabase first, synchronously, and only mirrors
-- the row here afterwards on success, without an outbox entry. If a future
-- change tries to route a delivery_orders write through
-- applyWithOutbox/applyBatchWithOutbox, categoryForTable() will throw —
-- that's an intentional guard, not an oversight.
CREATE TABLE IF NOT EXISTS delivery_orders (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales_transactions(sale_id) ON DELETE RESTRICT,
  sale_number TEXT NOT NULL,

  pickup_branch_id TEXT,
  pickup_branch_name TEXT,
  pickup_latitude REAL NOT NULL,
  pickup_longitude REAL NOT NULL,

  delivery_address_line TEXT NOT NULL,
  delivery_city TEXT,
  delivery_landmark TEXT,
  delivery_latitude REAL NOT NULL,
  delivery_longitude REAL NOT NULL,
  delivery_contact_name TEXT,
  delivery_contact_phone TEXT,

  load_size_tier TEXT NOT NULL,
  ride_type_requirement TEXT NOT NULL,

  distance_km REAL NOT NULL,
  route_class TEXT NOT NULL,

  fare_amount REAL,

  status TEXT NOT NULL DEFAULT 'posted',

  confirmation_code TEXT NOT NULL,
  confirmation_code_expires_at TEXT NOT NULL,
  confirmation_code_attempt_count INTEGER NOT NULL DEFAULT 0,

  rider_id TEXT,

  created_by_staff_id TEXT,
  created_by_staff_name TEXT,
  origin_terminal_id TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_sale ON delivery_orders(sale_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
