-- Business Profile onboarding wizard. See
-- ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business Profile Onboarding
-- addendum. Extends `tenants` (legal/registration/fiscal/branding/financial
-- fields) rather than a separate onboarding-only table, per this prompt's
-- own instruction that the wizard and the permanent Business Profile page
-- read/write the same underlying records. Also closes the branch-geocoding
-- persistence gap DL-016 flagged and left open (branches.latitude/longitude
-- existed only as an in-memory client field until now).

alter table tenants
  add column if not exists registration_number text,
  add column if not exists tin text,
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text,
  add column if not exists business_type text
    check (business_type is null or business_type in (
      'GENERAL_RETAIL', 'WHOLESALE_DISTRIBUTION', 'HOSPITALITY', 'PHARMACY',
      'HARDWARE_BUILDING', 'FASHION_APPAREL', 'ELECTRONICS_APPLIANCES',
      'LIQUOR_BOTTLE_STORE', 'BUTCHERY_FRESH_PRODUCE', 'AUTOMOTIVE_PARTS_SERVICES',
      'SALON_PERSONAL_CARE', 'OTHER'
    )),
  add column if not exists registered_address text,
  add column if not exists business_phone text,
  add column if not exists business_email text,
  add column if not exists whatsapp_business_number text,
  add column if not exists website text,
  -- No object-storage bucket exists in this codebase yet (see DL-018's own
  -- "no live external dependency" precedent for FX) — a logo is small
  -- enough that a base64 data: URL column is a reasonable simplification.
  -- Revisit if logo sizes or a second consumer ever make that untenable.
  add column if not exists logo_data_url text,
  add column if not exists brand_color text,
  add column if not exists multi_currency_enabled boolean not null default false,
  add column if not exists fiscal_year_start_month integer not null default 1
    check (fiscal_year_start_month between 1 and 12),
  -- Tenant Pairing Code: generated once when the founding install's wizard
  -- completes. A DIFFERENT concept from LicenceInfo's software
  -- activationCode (a product/plan license key) — this one identifies the
  -- tenant itself, so a second terminal/desk install can join the same
  -- tenant instead of provisioning a new one. Shown on the permanent
  -- Business Profile page for the admin to hand to whoever sets up the
  -- next branch till.
  add column if not exists pairing_code text unique,
  add column if not exists onboarding_completed_at timestamptz;

alter table branches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table staff
  add column if not exists contact_phone text,
  add column if not exists contact_email text;
