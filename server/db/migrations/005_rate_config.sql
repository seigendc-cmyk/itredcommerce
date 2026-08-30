-- DL-004 versioned fare/rate configuration (Prompt 4). Modeled as a pure
-- insert-only ledger, not a mutable settings row like tax_config: publishing
-- a new version never updates or deletes an existing row, so past rate
-- versions are structurally immune to being retroactively altered — the
-- "current" rate is always whichever row has the highest `version`. This is
-- DL-007 category 1 (LEDGER / insert-once), registered in
-- server/sync/entityRules.ts.
--
-- load_size_surcharge_tiers: JSON array of {label, maxWeightKg, surcharge},
-- ascending by weight (last tier's maxWeightKg may be null = no upper bound).
-- ride_type_multipliers: JSON object of {rideTypeCode: multiplier} — the
-- ride-type vocabulary itself is an explicit open item pending sign-off per
-- the governance doc, so this table doesn't validate against a fixed enum.
CREATE TABLE IF NOT EXISTS rate_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  version INTEGER NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD',
  base_fee REAL NOT NULL DEFAULT 0,
  per_km_rate REAL NOT NULL DEFAULT 0,
  load_size_surcharge_tiers TEXT NOT NULL DEFAULT '[]',
  ride_type_multipliers TEXT NOT NULL DEFAULT '{}',
  effective_date TEXT NOT NULL,
  created_by_staff_id TEXT,
  created_by_staff_name TEXT,
  created_at TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_rate_config_version ON rate_config(version);
