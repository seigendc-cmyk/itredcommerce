-- ZIMRA device registration, config sync, and data model (Prompt 16,
-- DL-073/074/075). See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's ZIMRA
-- FISCALIZATION ADDENDUM for the confirmed decisions this migration
-- encodes:
--
--   * One ZIMRA virtual fiscal device per TENANT (DL-073), not per branch
--     (a deliberate departure from fiscal_registrations' per-branch shape,
--     which remains as-is for the generic pluggable-provider interface —
--     this table is ZIMRA-specific, sitting alongside it, not replacing
--     it).
--   * USD-only for now (DL-074) — no currency column here because there is
--     nothing to select; this table has no opinion on currency at all.
--   * Submission itself (openDay/closeDay/submitReceipt) is centralized in
--     the zimra-fiscal-service Edge Function (DL-075) — this migration
--     only lays the schema and the device-registration/config-sync
--     surface; nothing here calls those three operations.
--
-- The device certificate and private key are the only ZIMRA secret this
-- schema ever stores. The certificate is a public X.509 document (stored
-- in the clear); the private key is AES-256-GCM ciphertext ONLY, encrypted
-- and decrypted exclusively inside the zimra-fiscal-service Edge Function
-- (supabase/functions/_shared/zimraCrypto.ts) using ZIMRA_CREDENTIALS_KEY,
-- an Edge Function secret that never reaches this database and is
-- deliberately a DIFFERENT secret from FISCAL_CREDENTIALS_KEY (that one is
-- a per-terminal Express-process env var for the generic
-- FiscalizationProvider interface's credentials; this one is held only by
-- the centralized Edge Function, matching DL-075's "sole holder" decision
-- — the two must never be the same value or terminals would be able to
-- decrypt the ZIMRA private key, which DL-075 exists specifically to
-- prevent).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'zimra_device_status') then
    create type zimra_device_status as enum (
      'NOT_REGISTERED',      -- no CSR generated yet
      'CSR_GENERATED',       -- keypair + CSR exist locally, registerDevice not yet called (or failed)
      'REGISTERED',          -- ZIMRA issued a certificate; config not yet synced
      'CONFIG_SYNCED',       -- getConfig has been called at least once since registration
      'CERTIFICATE_RENEWAL_DUE', -- certificateValidTill is inside the renewal lead-time window
      'SUSPENDED'            -- manually suspended; not used by this prompt's code, reserved for a future Settings action
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'zimra_fiscal_day_status') then
    -- Names mirror the FDMS spec's own status values exactly (not
    -- reformatted to this codebase's usual SCREAMING_SNAKE convention) so a
    -- value read out of this column can be compared/logged against the
    -- spec without translation.
    create type zimra_fiscal_day_status as enum (
      'FiscalDayClosed', 'FiscalDayOpened', 'FiscalDayCloseInitiated', 'FiscalDayCloseFailed'
    );
  end if;
end $$;

-- --------------------------------------------------------
-- ZIMRA_FISCAL_DEVICE — one row per tenant (DL-073). Everything the
-- centralized Edge Function needs to have registered a device, synced its
-- config, and know when the certificate needs renewing. No branch_id: a
-- tenant-wide device has no per-branch dimension.
-- --------------------------------------------------------
create table if not exists zimra_fiscal_device (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,

  status zimra_device_status not null default 'NOT_REGISTERED',

  -- Tenant-provided at registration time (from ZIMRA's own portal — see
  -- the governance doc addendum; this codebase never automates obtaining
  -- these). activationKey itself is deliberately NOT stored — it's a
  -- ZIMRA-issued one-time registration secret, consumed by registerDevice
  -- and never needed again, the same "don't persist what you don't need
  -- to" discipline fiscalCrypto.ts's credential handling already follows.
  device_id text,
  serial_no text,

  -- CSR and certificate are both public documents — stored in the clear on
  -- purpose, unlike the private key below.
  csr_pem text,
  certificate_pem text,
  certificate_valid_till timestamptz,

  -- AES-256-GCM ciphertext only. See header comment.
  private_key_ciphertext text,
  private_key_iv text,
  private_key_auth_tag text,

  -- getConfig() response, persisted verbatim (Prompt 16 item 3). Mapping
  -- applicable_taxes entries to this codebase's own inventory_items.tax_rate
  -- values is explicitly deferred to the submitReceipt follow-up prompt —
  -- see the governance doc addendum's open items.
  device_operating_mode text,
  tax_payer_name text,
  tax_payer_tin text,
  vat_number text,
  tax_payer_day_max_hrs numeric,
  taxpayer_day_end_notification_hrs numeric,
  applicable_taxes jsonb not null default '[]'::jsonb,
  qr_url text,
  config_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, id),
  unique (tenant_id)
);
create index if not exists idx_zimra_fiscal_device_tenant on zimra_fiscal_device(tenant_id);

create trigger trg_zimra_fiscal_device_updated_at before update on zimra_fiscal_device
  for each row execute function set_updated_at();

alter table zimra_fiscal_device enable row level security;

-- Same narrow fiscal-admin gating as fiscal_registrations — till operators
-- and executives never see device/certificate state. No insert/update
-- policy for any client role: only the zimra-fiscal-service Edge Function
-- (service-role, bypasses RLS) ever writes this table, the same shape
-- fiscal_submissions already established for a row no browser session sets
-- directly.
create policy zimra_fiscal_device_select on zimra_fiscal_device for select
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());

-- --------------------------------------------------------
-- ZIMRA_FISCAL_DAY — fiscal day lifecycle state. Modeled now, per Prompt
-- 16 item 4; NOT operated on by any code in this prompt (openDay/closeDay
-- are explicitly out of scope — see header comment and the governance doc
-- addendum's open items on operational ownership).
-- --------------------------------------------------------
create table if not exists zimra_fiscal_day (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,

  fiscal_day_no integer not null,
  status zimra_fiscal_day_status not null default 'FiscalDayClosed',
  opened_at timestamptz,
  closed_at timestamptz,
  reconciliation_mode text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, id),
  unique (tenant_id, fiscal_day_no)
);
create index if not exists idx_zimra_fiscal_day_tenant on zimra_fiscal_day(tenant_id);

create trigger trg_zimra_fiscal_day_updated_at before update on zimra_fiscal_day
  for each row execute function set_updated_at();

alter table zimra_fiscal_day enable row level security;

create policy zimra_fiscal_day_select on zimra_fiscal_day for select
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());

-- --------------------------------------------------------
-- credit_notes: CreditDebitNote linkage back to the original receipt.
-- zimra_receipt_id is the preferred reference once FDMS confirms the
-- original sale's receipt; the three-column fallback exists because the
-- spec allows referencing an original receipt by
-- (deviceID, receiptGlobalNo, fiscalDayNo) when a direct receiptID isn't
-- available. All nullable — populated only once the original sale has
-- actually been submitted and confirmed, which this prompt does not build.
-- --------------------------------------------------------
alter table credit_notes add column if not exists zimra_receipt_id text;
alter table credit_notes add column if not exists zimra_device_id text;
alter table credit_notes add column if not exists zimra_receipt_global_no bigint;
alter table credit_notes add column if not exists zimra_fiscal_day_no integer;

-- --------------------------------------------------------
-- inventory_items: HS code, mandatory per receipt line for VAT payers
-- (spec rule RCPT048 — 4 or 8 digits). Nullable: this prompt does not
-- build a data-entry/bulk-import path (flagged as an open item in the
-- governance doc addendum), so existing catalogs are left unpopulated
-- until that follow-up exists. The check constraint still enforces the
-- 4-or-8-digit shape for whatever value IS entered, rather than accepting
-- anything.
-- --------------------------------------------------------
alter table inventory_items add column if not exists hs_code text;
alter table inventory_items add constraint inventory_items_hs_code_format
  check (hs_code is null or hs_code ~ '^[0-9]{4}$' or hs_code ~ '^[0-9]{8}$');

-- --------------------------------------------------------
-- sales_transactions: fiscal sequence numbers, assigned ONLY by the
-- centralized service at actual submission time (mirrors
-- claim_next_fiscal_sequence's existing "never at sale-completion time"
-- discipline for the generic fiscal_registrations path) — null on every
-- row until a later prompt wires submitReceipt.
-- --------------------------------------------------------
alter table sales_transactions add column if not exists zimra_receipt_counter bigint;
alter table sales_transactions add column if not exists zimra_receipt_global_no bigint;
alter table sales_transactions add column if not exists zimra_fiscal_day_no integer;

-- --------------------------------------------------------
-- Certificate-renewal sweep scheduling. Mirrors
-- trigger_whatsapp_notification_drain()'s exact shape (DL-021) — reusing
-- the existing platform_settings table rather than a new one-off table,
-- the same "third instance of the same pattern, not a fourth different
-- one" discipline that migration's own header comment established. Seeded
-- null on purpose: populating the real URL/secret is a deployment step
-- this migration cannot perform, same class of gap as
-- whatsapp_edge_function_url/whatsapp_drain_secret.
-- --------------------------------------------------------
insert into platform_settings (key, value) values
  ('zimra_edge_function_url', null),
  ('zimra_service_secret', null)
on conflict (key) do nothing;

create or replace function trigger_zimra_certificate_renewal_check() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from platform_settings where key = 'zimra_edge_function_url';
  select value into v_secret from platform_settings where key = 'zimra_service_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-zimra-service-secret', v_secret),
    body := jsonb_build_object('action', 'renewCertificateSweep')
  );
end;
$$;

revoke all on function trigger_zimra_certificate_renewal_check() from public;

-- Daily, not per-minute like the WhatsApp drain — certificate renewal has a
-- ~1-month lead time (spec's own recommendation), so a tight cadence buys
-- nothing here and only adds noise.
select cron.schedule('zimra-certificate-renewal-check', '0 3 * * *', $$select trigger_zimra_certificate_renewal_check()$$);
