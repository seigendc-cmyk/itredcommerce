-- Business Profile onboarding wizard — local SQLite side, companion to
-- supabase/migrations/20260902090000_business_profile.sql. Extends the
-- local `tenants` cache table (002_multi_tenant.sql) and `branches` rather
-- than a separate table, matching that migration's own stated goal of
-- keeping row shapes structurally identical to Supabase.

ALTER TABLE tenants ADD COLUMN registration_number TEXT;
ALTER TABLE tenants ADD COLUMN tin TEXT;
ALTER TABLE tenants ADD COLUMN vat_registered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN vat_number TEXT;
ALTER TABLE tenants ADD COLUMN business_type TEXT;
ALTER TABLE tenants ADD COLUMN registered_address TEXT;
ALTER TABLE tenants ADD COLUMN business_phone TEXT;
ALTER TABLE tenants ADD COLUMN business_email TEXT;
ALTER TABLE tenants ADD COLUMN whatsapp_business_number TEXT;
ALTER TABLE tenants ADD COLUMN website TEXT;
ALTER TABLE tenants ADD COLUMN logo_data_url TEXT;
ALTER TABLE tenants ADD COLUMN brand_color TEXT;
ALTER TABLE tenants ADD COLUMN multi_currency_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN fiscal_year_start_month INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tenants ADD COLUMN pairing_code TEXT;
ALTER TABLE tenants ADD COLUMN onboarding_completed_at TEXT;

ALTER TABLE branches ADD COLUMN latitude REAL;
ALTER TABLE branches ADD COLUMN longitude REAL;

ALTER TABLE staff ADD COLUMN contact_phone TEXT;
ALTER TABLE staff ADD COLUMN contact_email TEXT;
