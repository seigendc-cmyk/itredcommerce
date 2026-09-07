-- Local SQLite mirror columns for Prompt 16 (DL-073/074/075). Matches the
-- three ALTERs in supabase/migrations/20260907090000_zimra_fiscal_device.sql
-- so that credit_notes/inventory_items/sales_transactions keep an identical
-- column set on both sides, the same convention every prior dual-schema
-- migration in this codebase already follows.
--
-- zimra_fiscal_device and zimra_fiscal_day are NOT mirrored here on
-- purpose: per DL-075 they are centralized, tenant-wide state owned
-- exclusively by the zimra-fiscal-service Edge Function — no local
-- terminal reads or writes them, so there is nothing for a local install
-- to cache (unlike fiscal_registration_cache, which exists because the
-- per-branch, per-terminal submission model actually needed a local read
-- path).
--
-- SQLite's ALTER TABLE cannot add a CHECK constraint to an existing table
-- (only Postgres's ALTER enforces inventory_items.hs_code's 4-or-8-digit
-- shape) — local rows are a cache of the authoritative Supabase row
-- anyway, so this is an acceptable asymmetry, not a silently-dropped
-- guarantee.
ALTER TABLE credit_notes ADD COLUMN zimra_receipt_id TEXT;
ALTER TABLE credit_notes ADD COLUMN zimra_device_id TEXT;
ALTER TABLE credit_notes ADD COLUMN zimra_receipt_global_no INTEGER;
ALTER TABLE credit_notes ADD COLUMN zimra_fiscal_day_no INTEGER;

ALTER TABLE inventory_items ADD COLUMN hs_code TEXT;

ALTER TABLE sales_transactions ADD COLUMN zimra_receipt_counter INTEGER;
ALTER TABLE sales_transactions ADD COLUMN zimra_receipt_global_no INTEGER;
ALTER TABLE sales_transactions ADD COLUMN zimra_fiscal_day_no INTEGER;
