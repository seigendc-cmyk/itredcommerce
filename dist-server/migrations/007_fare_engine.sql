-- Delivery fare calculation engine (Prompt 8). Extends the DL-004
-- versioned rate_config ledger from Prompt 4 rather than introducing a
-- second versioning mechanism — new nullable/defaulted columns are safe to
-- ALTER onto an insert-only ledger since past rows simply get the default
-- and are never rewritten.
--
-- use_separate_intercity_rate / per_km_rate_intercity: vendor-toggleable
-- (confirmed decision) — when off, per_km_rate applies to every route
-- regardless of local/intercity classification.
--
-- is_multi_currency / settlement_currency / exchange_rate_to_settlement:
-- fare is always calculated in `currency` first; when multi-currency is
-- enabled, that amount is converted to settlement_currency using this
-- rate, and BOTH the fare formula and the exchange rate are locked in by
-- the same rate_config version at once (see server/lib/fareEngine.ts).
ALTER TABLE rate_config ADD COLUMN use_separate_intercity_rate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rate_config ADD COLUMN per_km_rate_intercity REAL;
ALTER TABLE rate_config ADD COLUMN is_multi_currency INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rate_config ADD COLUMN settlement_currency TEXT;
ALTER TABLE rate_config ADD COLUMN exchange_rate_to_settlement REAL;

-- delivery_orders.fare_amount already exists (Prompt 7, left NULL — this
-- prompt is what populates it). These two columns record which rate
-- version produced it and in what currency, so a later rate change can
-- never retroactively alter an already-created dispatch's fare.
ALTER TABLE delivery_orders ADD COLUMN fare_currency TEXT;
ALTER TABLE delivery_orders ADD COLUMN fare_rate_config_version INTEGER REFERENCES rate_config(version);
