import { db } from '../db/connection';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env } from '../env';

// Pull-only counterpart to the outbox drain loop, same shape as
// staffPull.ts — Supabase is the source of truth for the tenant's Business
// Profile; local SQLite's `tenants` row is a read-through cache used for
// offline display (e.g. printing the legal name/TIN/address on a receipt
// with no connectivity). Never written locally-first: profile edits go
// through server/routes/businessProfile.ts's PUT, which requires a live
// Supabase connection, for the same reason staff administration does
// (DL-012) — this is a connected back-office operation, not something that
// should be trusted from a stale local edit.
export async function pullTenantFromSupabase(): Promise<{ pulled: boolean } | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from('tenants')
    .select('*')
    .eq('id', env.tenantId)
    .maybeSingle();

  if (error || !data) {
    console.error('[tenantPull] failed to pull tenant from Supabase:', error);
    return null;
  }

  db.prepare(`
    INSERT INTO tenants (id, legal_name, display_name, country, base_currency, fiscalization_provider, status, timezone,
      registration_number, tin, vat_registered, vat_number, business_type, registered_address,
      business_phone, business_email, whatsapp_business_number, website, logo_data_url, brand_color,
      multi_currency_enabled, fiscal_year_start_month, pairing_code, onboarding_completed_at)
    VALUES (@id, @legal_name, @display_name, @country, @base_currency, @fiscalization_provider, @status, @timezone,
      @registration_number, @tin, @vat_registered, @vat_number, @business_type, @registered_address,
      @business_phone, @business_email, @whatsapp_business_number, @website, @logo_data_url, @brand_color,
      @multi_currency_enabled, @fiscal_year_start_month, @pairing_code, @onboarding_completed_at)
    ON CONFLICT(id) DO UPDATE SET
      legal_name = excluded.legal_name, display_name = excluded.display_name, country = excluded.country,
      base_currency = excluded.base_currency, fiscalization_provider = excluded.fiscalization_provider,
      status = excluded.status, timezone = excluded.timezone,
      registration_number = excluded.registration_number, tin = excluded.tin,
      vat_registered = excluded.vat_registered, vat_number = excluded.vat_number,
      business_type = excluded.business_type, registered_address = excluded.registered_address,
      business_phone = excluded.business_phone, business_email = excluded.business_email,
      whatsapp_business_number = excluded.whatsapp_business_number, website = excluded.website,
      logo_data_url = excluded.logo_data_url, brand_color = excluded.brand_color,
      multi_currency_enabled = excluded.multi_currency_enabled, fiscal_year_start_month = excluded.fiscal_year_start_month,
      pairing_code = excluded.pairing_code, onboarding_completed_at = excluded.onboarding_completed_at
  `).run({
    id: data.id,
    legal_name: data.legal_name,
    display_name: data.display_name,
    country: data.country,
    base_currency: data.base_currency,
    fiscalization_provider: data.fiscalization_provider ?? null,
    status: data.status,
    timezone: data.timezone,
    registration_number: data.registration_number ?? null,
    tin: data.tin ?? null,
    vat_registered: data.vat_registered ? 1 : 0,
    vat_number: data.vat_number ?? null,
    business_type: data.business_type ?? null,
    registered_address: data.registered_address ?? null,
    business_phone: data.business_phone ?? null,
    business_email: data.business_email ?? null,
    whatsapp_business_number: data.whatsapp_business_number ?? null,
    website: data.website ?? null,
    logo_data_url: data.logo_data_url ?? null,
    brand_color: data.brand_color ?? null,
    multi_currency_enabled: data.multi_currency_enabled ? 1 : 0,
    fiscal_year_start_month: data.fiscal_year_start_month ?? 1,
    pairing_code: data.pairing_code ?? null,
    onboarding_completed_at: data.onboarding_completed_at ?? null,
  });

  return { pulled: true };
}
