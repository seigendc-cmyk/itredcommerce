import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { generateId } from '../lib/ids';
import { applyWithOutbox } from '../sync/outboxWriter';
import { pullTenantFromSupabase } from '../sync/tenantPull';
import { env } from '../env';

// Permanent Business Profile page (System menu) — same tenant/branch
// records the onboarding wizard creates, per this prompt's own "not two
// separate systems" instruction. Mirrors staff.ts's shape closely: whole
// router head-office-only, live Supabase read with a local-cache fallback
// for GET, service-role write with no offline fallback for PUT (DL-012's
// reasoning applies equally here — business-profile edits are a connected
// back-office operation).
const router = Router();
router.use(requireAuth);
router.use(requireAccessRole(...BACK_OFFICE_WRITE_ROLES));

function requireSupabase() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new ApiError(503, 'Business Profile editing requires a live connection to Supabase', 'SUPABASE_UNAVAILABLE');
  }
  return client;
}

function localTenantRowToProfile(row: any, branchRow: any) {
  return {
    tenantId: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    registrationNumber: row.registration_number,
    tin: row.tin,
    vatRegistered: !!row.vat_registered,
    vatNumber: row.vat_number,
    country: row.country,
    businessType: row.business_type,
    registeredAddress: row.registered_address,
    businessPhone: row.business_phone,
    businessEmail: row.business_email,
    whatsappBusinessNumber: row.whatsapp_business_number,
    website: row.website,
    logoDataUrl: row.logo_data_url,
    brandColor: row.brand_color,
    baseCurrency: row.base_currency,
    multiCurrencyEnabled: !!row.multi_currency_enabled,
    fiscalYearStartMonth: row.fiscal_year_start_month,
    pairingCode: row.pairing_code,
    onboardingCompletedAt: row.onboarding_completed_at,
    primaryBranch: branchRow
      ? { id: branchRow.id, name: branchRow.name, address: branchRow.address, latitude: branchRow.latitude, longitude: branchRow.longitude }
      : null,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const client = getSupabaseAdmin();
    if (client) {
      const [{ data: tenant, error: tenantError }, { data: branch }] = await Promise.all([
        client.from('tenants').select('*').eq('id', env.tenantId).maybeSingle(),
        client.from('branches').select('id, name, address, latitude, longitude').eq('tenant_id', env.tenantId).eq('is_default', true).maybeSingle(),
      ]);
      if (!tenantError && tenant) {
        res.json(
          localTenantRowToProfile(
            {
              id: tenant.id, legal_name: tenant.legal_name, display_name: tenant.display_name,
              registration_number: tenant.registration_number, tin: tenant.tin, vat_registered: tenant.vat_registered,
              vat_number: tenant.vat_number, country: tenant.country, business_type: tenant.business_type,
              registered_address: tenant.registered_address, business_phone: tenant.business_phone,
              business_email: tenant.business_email, whatsapp_business_number: tenant.whatsapp_business_number,
              website: tenant.website, logo_data_url: tenant.logo_data_url, brand_color: tenant.brand_color,
              base_currency: tenant.base_currency, multi_currency_enabled: tenant.multi_currency_enabled,
              fiscal_year_start_month: tenant.fiscal_year_start_month, pairing_code: tenant.pairing_code,
              onboarding_completed_at: tenant.onboarding_completed_at,
            },
            branch
          )
        );
        return;
      }
      console.error('[businessProfile] GET / Supabase query failed, falling back to local cache (read-only):', tenantError);
    }
    const tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(env.tenantId) as any;
    if (!tenantRow) throw new ApiError(404, 'Business profile not found');
    const branchRow = db.prepare('SELECT id, name, address, latitude, longitude FROM branches WHERE tenant_id = ? AND is_default = 1').get(env.tenantId) as any;
    res.json(localTenantRowToProfile(tenantRow, branchRow));
  })
);

interface UpdateBody {
  displayName?: string;
  registrationNumber?: string;
  tin?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  country?: string;
  businessType?: string;
  registeredAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  whatsappBusinessNumber?: string;
  website?: string;
  logoDataUrl?: string;
  brandColor?: string;
  baseCurrency?: string;
  multiCurrencyEnabled?: boolean;
  fiscalYearStartMonth?: number;
  primaryBranch?: { name?: string; address?: string; latitude?: number; longitude?: number };
}

// These five are what the permanent page requires retype-to-confirm for
// client-side (see the shared confirm-to-change modal); this server route
// is the one place that actually writes them, so it's also where the audit
// trail lives — every other field updates silently.
const SENSITIVE_FIELDS: Array<[keyof UpdateBody, string]> = [
  ['tin', 'tin'],
  ['vatNumber', 'vat_number'],
  ['registrationNumber', 'registration_number'],
  ['country', 'country'],
  ['baseCurrency', 'base_currency'],
];

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const client = requireSupabase();
    const body = req.body as UpdateBody;

    const { data: current, error: currentError } = await client.from('tenants').select('*').eq('id', env.tenantId).maybeSingle();
    if (currentError || !current) throw new ApiError(404, 'Business profile not found');

    const patch: Record<string, unknown> = {};
    if (body.displayName !== undefined) patch.display_name = body.displayName.trim();
    if (body.registrationNumber !== undefined) patch.registration_number = body.registrationNumber?.trim() || null;
    if (body.tin !== undefined) patch.tin = body.tin?.trim() || null;
    if (body.vatRegistered !== undefined) patch.vat_registered = body.vatRegistered;
    if (body.vatNumber !== undefined) patch.vat_number = body.vatNumber?.trim() || null;
    if (body.country !== undefined) patch.country = body.country.trim().toUpperCase();
    if (body.businessType !== undefined) patch.business_type = body.businessType;
    if (body.registeredAddress !== undefined) patch.registered_address = body.registeredAddress?.trim() || null;
    if (body.businessPhone !== undefined) patch.business_phone = body.businessPhone?.trim() || null;
    if (body.businessEmail !== undefined) patch.business_email = body.businessEmail?.trim() || null;
    if (body.whatsappBusinessNumber !== undefined) patch.whatsapp_business_number = body.whatsappBusinessNumber?.trim() || null;
    if (body.website !== undefined) patch.website = body.website?.trim() || null;
    if (body.logoDataUrl !== undefined) patch.logo_data_url = body.logoDataUrl || null;
    if (body.brandColor !== undefined) patch.brand_color = body.brandColor || null;
    if (body.baseCurrency !== undefined) patch.base_currency = body.baseCurrency.trim().toUpperCase();
    if (body.multiCurrencyEnabled !== undefined) patch.multi_currency_enabled = body.multiCurrencyEnabled;
    if (body.fiscalYearStartMonth !== undefined) {
      if (body.fiscalYearStartMonth < 1 || body.fiscalYearStartMonth > 12) throw new ApiError(400, 'fiscalYearStartMonth must be 1-12');
      patch.fiscal_year_start_month = body.fiscalYearStartMonth;
    }

    const changedSensitiveFields = SENSITIVE_FIELDS.filter(([, column]) => column in patch && patch[column] !== current[column]);

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await client.from('tenants').update(patch).eq('id', env.tenantId);
      if (updateError) throw new ApiError(502, 'Failed to update business profile in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    if (body.primaryBranch) {
      const branchPatch: Record<string, unknown> = {};
      if (body.primaryBranch.name !== undefined) branchPatch.name = body.primaryBranch.name.trim();
      if (body.primaryBranch.address !== undefined) branchPatch.address = body.primaryBranch.address?.trim() || null;
      if (body.primaryBranch.latitude !== undefined) branchPatch.latitude = body.primaryBranch.latitude;
      if (body.primaryBranch.longitude !== undefined) branchPatch.longitude = body.primaryBranch.longitude;
      if (Object.keys(branchPatch).length > 0) {
        const { error: branchError } = await client.from('branches').update(branchPatch).eq('tenant_id', env.tenantId).eq('is_default', true);
        if (branchError) throw new ApiError(502, 'Failed to update primary branch in Supabase', 'SUPABASE_WRITE_FAILED');
        // No branchPull job exists yet (branches.ts's GET only ever read
        // local — see its own header comment) — mirror directly here so
        // this doesn't silently go stale until one is built.
        const localBranchPatch: Record<string, unknown> = {};
        if (branchPatch.name !== undefined) localBranchPatch.name = branchPatch.name;
        if (branchPatch.address !== undefined) localBranchPatch.address = branchPatch.address;
        if (branchPatch.latitude !== undefined) localBranchPatch.latitude = branchPatch.latitude;
        if (branchPatch.longitude !== undefined) localBranchPatch.longitude = branchPatch.longitude;
        const setClause = Object.keys(localBranchPatch).map((k) => `${k} = @${k}`).join(', ');
        db.prepare(`UPDATE branches SET ${setClause} WHERE tenant_id = @tenantId AND is_default = 1`).run({
          ...localBranchPatch,
          tenantId: env.tenantId,
        });
      }
    }

    if (changedSensitiveFields.length > 0 && req.currentStaff) {
      const evtId = generateId('EVT');
      const description = `Business Profile sensitive field(s) changed: ${changedSensitiveFields.map(([, c]) => c).join(', ')} by ${req.currentStaff.name}.`;
      applyWithOutbox({
        db,
        tenantId: env.tenantId,
        table: 'activity_events',
        pkColumn: 'id',
        pk: evtId,
        operation: 'INSERT',
        payload: { id: evtId },
        apply: () =>
          db
            .prepare(
              `INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, metadata)
               VALUES (@id, 'BUSINESS_PROFILE_SENSITIVE_FIELD_CHANGED', @timestamp, @description, @staffId, @staffName, @metadata)`
            )
            .run({
              id: evtId,
              timestamp: new Date().toISOString(),
              description,
              staffId: req.currentStaff!.id,
              staffName: req.currentStaff!.name,
              metadata: JSON.stringify(
                Object.fromEntries(changedSensitiveFields.map(([, column]) => [column, { from: current[column], to: patch[column] }]))
              ),
            }),
      });
    }

    await pullTenantFromSupabase();
    const tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(env.tenantId) as any;
    const branchRow = db.prepare('SELECT id, name, address, latitude, longitude FROM branches WHERE tenant_id = ? AND is_default = 1').get(env.tenantId) as any;
    res.json(localTenantRowToProfile(tenantRow, branchRow));
  })
);

export default router;
