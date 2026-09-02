import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, withTransaction } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { generateId } from '../lib/ids';
import { assertStrongPin } from '../lib/pinPolicy';
import { generatePairingCode } from '../lib/pairingCode';
import { getSupabaseAdminUnscoped } from '../lib/supabaseAdmin';
import { persistInstallationConfig } from '../lib/installationConfig';
import { env } from '../env';
import { pullStaffFromSupabase } from '../sync/staffPull';
import { pullTenantFromSupabase } from '../sync/tenantPull';

// Business Profile onboarding wizard's backend. Unauthenticated by design —
// see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business Profile Onboarding
// addendum: there is no staff record, and therefore no session, until the
// wizard's Step 5 creates the tenant's first (owner/admin) one. The one
// thing standing in for auth here is env.tenantId itself: every route below
// refuses to run a second time once this install is already bound to a
// tenant, which is the whole reason onboarding could ever run unauthenticated
// in the first place.
const router = Router();

function requireNotYetProvisioned() {
  if (env.tenantId) {
    throw new ApiError(409, 'This installation is already bound to a tenant', 'ALREADY_PROVISIONED');
  }
}

function requireSupabase() {
  const client = getSupabaseAdminUnscoped();
  if (!client) {
    throw new ApiError(503, 'Onboarding requires a configured connection to Supabase (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)', 'SUPABASE_UNAVAILABLE');
  }
  return client;
}

const BUSINESS_TYPES = new Set([
  'GENERAL_RETAIL', 'WHOLESALE_DISTRIBUTION', 'HOSPITALITY', 'PHARMACY',
  'HARDWARE_BUILDING', 'FASHION_APPAREL', 'ELECTRONICS_APPLIANCES',
  'LIQUOR_BOTTLE_STORE', 'BUTCHERY_FRESH_PRODUCE', 'AUTOMOTIVE_PARTS_SERVICES',
  'SALON_PERSONAL_CARE', 'OTHER',
]);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ needsOnboarding: !env.tenantId });
  })
);

interface ResolvePairingCodeBody {
  pairingCode: string;
}

router.post(
  '/resolve-pairing-code',
  asyncHandler(async (req, res) => {
    requireNotYetProvisioned();
    const { pairingCode } = req.body as ResolvePairingCodeBody;
    if (!pairingCode?.trim()) throw new ApiError(400, 'pairingCode is required');

    const client = requireSupabase();
    const { data: tenant, error } = await client
      .from('tenants')
      .select('id, legal_name, display_name, country, base_currency, business_type, logo_data_url, brand_color')
      .eq('pairing_code', pairingCode.trim().toUpperCase())
      .maybeSingle();

    if (error) throw new ApiError(502, 'Failed to look up pairing code', 'SUPABASE_READ_FAILED');
    if (!tenant) throw new ApiError(404, 'No business found for that pairing code', 'PAIRING_CODE_NOT_FOUND');

    const { data: branches } = await client
      .from('branches')
      .select('id, name, city, status')
      .eq('tenant_id', tenant.id)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true });

    res.json({
      tenant: {
        id: tenant.id,
        legalName: tenant.legal_name,
        displayName: tenant.display_name,
        country: tenant.country,
        baseCurrency: tenant.base_currency,
        businessType: tenant.business_type,
        logoDataUrl: tenant.logo_data_url,
        brandColor: tenant.brand_color,
      },
      branches: (branches ?? []).map((b: any) => ({ id: b.id, name: b.name, city: b.city })),
    });
  })
);

function shortCode(name: string): string {
  const slug = (name || 'BR').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'BR';
  return `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

interface CompleteBody {
  legalName: string;
  displayName?: string;
  registrationNumber?: string;
  tin?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  country: string;
  businessType?: string;
  registeredAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  whatsappBusinessNumber?: string;
  website?: string;
  logoDataUrl?: string;
  brandColor?: string;
  baseCurrency: string;
  multiCurrencyEnabled?: boolean;
  fiscalYearStartMonth?: number;
  branch: { name: string; address?: string; latitude: number; longitude: number };
  admin: { name: string; pin: string; contactPhone?: string; contactEmail?: string };
  activationCode?: string;
}

const MAX_LOGO_DATA_URL_LENGTH = 400_000; // ~300KB decoded, base64 overhead included

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    requireNotYetProvisioned();
    const body = req.body as CompleteBody;

    if (!body?.legalName?.trim()) throw new ApiError(400, 'legalName is required');
    if (!body.country?.trim()) throw new ApiError(400, 'country is required');
    if (!body.baseCurrency?.trim()) throw new ApiError(400, 'baseCurrency is required');
    if (body.businessType && !BUSINESS_TYPES.has(body.businessType)) throw new ApiError(400, 'Invalid businessType');
    if (body.vatRegistered && !body.vatNumber?.trim()) throw new ApiError(400, 'vatNumber is required when vatRegistered is true');
    if (!body.branch?.name?.trim()) throw new ApiError(400, 'branch.name is required');
    if (typeof body.branch?.latitude !== 'number' || typeof body.branch?.longitude !== 'number') {
      throw new ApiError(400, 'branch.latitude and branch.longitude are required');
    }
    if (!body.admin?.name?.trim()) throw new ApiError(400, 'admin.name is required');
    if (!body.admin?.pin) throw new ApiError(400, 'admin.pin is required');
    assertStrongPin(body.admin.pin);
    if (body.logoDataUrl && body.logoDataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
      throw new ApiError(400, 'Logo image is too large — please use a smaller file', 'LOGO_TOO_LARGE');
    }
    const fiscalYearStartMonth = body.fiscalYearStartMonth ?? 1;
    if (fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) throw new ApiError(400, 'fiscalYearStartMonth must be 1-12');

    const client = requireSupabase();

    const tenantId = generateId('TEN');
    const pairingCode = generatePairingCode();
    const nowIso = new Date().toISOString();
    const displayName = body.displayName?.trim() || body.legalName.trim();

    const { error: tenantError } = await client.from('tenants').insert({
      id: tenantId,
      legal_name: body.legalName.trim(),
      display_name: displayName,
      country: body.country.trim().toUpperCase(),
      base_currency: body.baseCurrency.trim().toUpperCase(),
      status: 'ACTIVE',
      registration_number: body.registrationNumber?.trim() || null,
      tin: body.tin?.trim() || null,
      vat_registered: !!body.vatRegistered,
      vat_number: body.vatRegistered ? body.vatNumber?.trim() : null,
      business_type: body.businessType ?? null,
      registered_address: body.registeredAddress?.trim() || null,
      business_phone: body.businessPhone?.trim() || null,
      business_email: body.businessEmail?.trim() || null,
      whatsapp_business_number: body.whatsappBusinessNumber?.trim() || null,
      website: body.website?.trim() || null,
      logo_data_url: body.logoDataUrl || null,
      brand_color: body.brandColor || null,
      multi_currency_enabled: !!body.multiCurrencyEnabled,
      fiscal_year_start_month: fiscalYearStartMonth,
      pairing_code: pairingCode,
      onboarding_completed_at: nowIso,
    });
    if (tenantError) throw new ApiError(502, 'Failed to create tenant in Supabase', 'SUPABASE_WRITE_FAILED');

    const branchId = generateId('BR');
    const branchCode = shortCode(body.branch.name);
    const { error: branchError } = await client.from('branches').insert({
      id: branchId,
      tenant_id: tenantId,
      code: branchCode,
      name: body.branch.name.trim(),
      address: body.branch.address?.trim() || null,
      contact_phone: body.businessPhone?.trim() || null,
      email: body.businessEmail?.trim() || null,
      status: 'ACTIVE',
      is_default: true,
      latitude: body.branch.latitude,
      longitude: body.branch.longitude,
    });
    if (branchError) {
      await client.from('tenants').delete().eq('id', tenantId);
      throw new ApiError(502, 'Failed to create branch in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    const staffId = generateId('STF');
    const staffCode = `ADMIN-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const pinHash = bcrypt.hashSync(body.admin.pin, 12);
    const avatarInitials = body.admin.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    const { data: staffRow, error: staffError } = await client
      .from('staff')
      .insert({
        id: staffId,
        tenant_id: tenantId,
        code: staffCode,
        name: body.admin.name.trim(),
        role: 'SYS_ADMIN',
        role_title: 'Owner / Administrator',
        access_role: 'head_office_staff',
        pin_hash: pinHash,
        avatar_initials: avatarInitials,
        permissions: ['*'],
        terminal_access: [],
        is_active: true,
        contact_phone: body.admin.contactPhone?.trim() || null,
        contact_email: body.admin.contactEmail?.trim() || null,
      })
      .select('id')
      .single();
    if (staffError || !staffRow) {
      await client.from('branches').delete().eq('id', branchId);
      await client.from('tenants').delete().eq('id', tenantId);
      throw new ApiError(502, 'Failed to create admin staff account in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    const terminalId = generateId('TRM');
    const terminalCode = shortCode(`${body.branch.name}-HQ`);
    const installationId = randomUUID();
    const { error: terminalError } = await client.from('terminals').insert({
      id: terminalId,
      tenant_id: tenantId,
      branch_id: branchId,
      branch_name: body.branch.name.trim(),
      code: terminalCode,
      name: 'Head Office Desk 1',
      workstation_type: 'BACKOFFICE_REGISTER',
      app_surface: 'HEAD_OFFICE',
      status: 'ACTIVE',
      is_default: true,
      activation_code: body.activationCode ?? null,
      activated_at: nowIso,
    });
    if (terminalError) {
      await client.from('staff').delete().eq('id', staffId);
      await client.from('branches').delete().eq('id', branchId);
      await client.from('tenants').delete().eq('id', tenantId);
      throw new ApiError(502, 'Failed to create terminal in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    // Mirror into local SQLite immediately (write-through) rather than
    // waiting for the first pull-cache cycle — this device needs its own
    // tenant/branch/terminal/staff rows usable the instant onboarding
    // finishes, not up to 5 minutes later.
    withTransaction(() => {
      db.prepare(`
        INSERT INTO tenants (id, legal_name, display_name, country, base_currency, status,
          registration_number, tin, vat_registered, vat_number, business_type, registered_address,
          business_phone, business_email, whatsapp_business_number, website, logo_data_url, brand_color,
          multi_currency_enabled, fiscal_year_start_month, pairing_code, onboarding_completed_at)
        VALUES (@id, @legal_name, @display_name, @country, @base_currency, @status,
          @registration_number, @tin, @vat_registered, @vat_number, @business_type, @registered_address,
          @business_phone, @business_email, @whatsapp_business_number, @website, @logo_data_url, @brand_color,
          @multi_currency_enabled, @fiscal_year_start_month, @pairing_code, @onboarding_completed_at)
      `).run({
        id: tenantId,
        legal_name: body.legalName.trim(),
        display_name: displayName,
        country: body.country.trim().toUpperCase(),
        base_currency: body.baseCurrency.trim().toUpperCase(),
        status: 'ACTIVE',
        registration_number: body.registrationNumber?.trim() || null,
        tin: body.tin?.trim() || null,
        vat_registered: body.vatRegistered ? 1 : 0,
        vat_number: body.vatRegistered ? (body.vatNumber?.trim() ?? null) : null,
        business_type: body.businessType ?? null,
        registered_address: body.registeredAddress?.trim() || null,
        business_phone: body.businessPhone?.trim() || null,
        business_email: body.businessEmail?.trim() || null,
        whatsapp_business_number: body.whatsappBusinessNumber?.trim() || null,
        website: body.website?.trim() || null,
        logo_data_url: body.logoDataUrl || null,
        brand_color: body.brandColor || null,
        multi_currency_enabled: body.multiCurrencyEnabled ? 1 : 0,
        fiscal_year_start_month: fiscalYearStartMonth,
        pairing_code: pairingCode,
        onboarding_completed_at: nowIso,
      });

      db.prepare(`
        INSERT INTO branches (id, tenant_id, code, name, address, contact_phone, email, status, is_default, latitude, longitude)
        VALUES (@id, @tenant_id, @code, @name, @address, @contact_phone, @email, @status, @is_default, @latitude, @longitude)
      `).run({
        id: branchId,
        tenant_id: tenantId,
        code: branchCode,
        name: body.branch.name.trim(),
        address: body.branch.address?.trim() || null,
        contact_phone: body.businessPhone?.trim() || null,
        email: body.businessEmail?.trim() || null,
        status: 'ACTIVE',
        is_default: 1,
        latitude: body.branch.latitude,
        longitude: body.branch.longitude,
      });

      db.prepare(`
        INSERT INTO staff (id, tenant_id, code, name, role, role_title, access_role, pin_hash,
          avatar_initials, permissions, terminal_access, is_active, contact_phone, contact_email)
        VALUES (@id, @tenant_id, @code, @name, @role, @role_title, @access_role, @pin_hash,
          @avatar_initials, @permissions, @terminal_access, @is_active, @contact_phone, @contact_email)
      `).run({
        id: staffId,
        tenant_id: tenantId,
        code: staffCode,
        name: body.admin.name.trim(),
        role: 'SYS_ADMIN',
        role_title: 'Owner / Administrator',
        access_role: 'HEAD_OFFICE_STAFF',
        pin_hash: pinHash,
        avatar_initials: avatarInitials,
        permissions: JSON.stringify(['*']),
        terminal_access: JSON.stringify([]),
        is_active: 1,
        contact_phone: body.admin.contactPhone?.trim() || null,
        contact_email: body.admin.contactEmail?.trim() || null,
      });

      db.prepare(`
        INSERT INTO terminals (id, tenant_id, code, name, branch_id, branch_name, workstation_type, status, is_default)
        VALUES (@id, @tenant_id, @code, @name, @branch_id, @branch_name, @workstation_type, @status, @is_default)
      `).run({
        id: terminalId,
        tenant_id: tenantId,
        code: terminalCode,
        name: 'Head Office Desk 1',
        branch_id: branchId,
        branch_name: body.branch.name.trim(),
        workstation_type: 'BACKOFFICE_REGISTER',
        status: 'ACTIVE',
        is_default: 1,
      });
    });

    persistInstallationConfig({
      installationId,
      tenantId,
      branchId,
      terminalId,
      appSurface: 'HEAD_OFFICE',
      activationCode: body.activationCode ?? null,
    });

    // Import lazily to avoid a require-cycle with index.ts at module load.
    const { startBackgroundSync } = await import('../index');
    startBackgroundSync();

    res.status(201).json({
      tenant: { id: tenantId, legalName: body.legalName.trim(), displayName, country: body.country.trim().toUpperCase(), baseCurrency: body.baseCurrency.trim().toUpperCase(), pairingCode },
      branch: { id: branchId, name: body.branch.name.trim(), latitude: body.branch.latitude, longitude: body.branch.longitude },
      terminal: { id: terminalId, name: 'Head Office Desk 1', appSurface: 'HEAD_OFFICE' },
      staff: { id: staffId, name: body.admin.name.trim() },
      installationId,
    });
  })
);

interface JoinTenantBody {
  pairingCode: string;
  branch: { existingBranchId: string } | { new: { name: string; address?: string; latitude: number; longitude: number } };
  terminalName: string;
  appSurface: 'BRANCH_TERMINAL' | 'HEAD_OFFICE';
  activationCode?: string;
}

router.post(
  '/join-tenant',
  asyncHandler(async (req, res) => {
    requireNotYetProvisioned();
    const body = req.body as JoinTenantBody;
    if (!body?.pairingCode?.trim()) throw new ApiError(400, 'pairingCode is required');
    if (!body.terminalName?.trim()) throw new ApiError(400, 'terminalName is required');
    if (body.appSurface !== 'BRANCH_TERMINAL' && body.appSurface !== 'HEAD_OFFICE') {
      throw new ApiError(400, 'appSurface must be BRANCH_TERMINAL or HEAD_OFFICE');
    }

    const client = requireSupabase();
    const { data: tenant, error: tenantLookupError } = await client
      .from('tenants')
      .select('id')
      .eq('pairing_code', body.pairingCode.trim().toUpperCase())
      .maybeSingle();
    if (tenantLookupError) throw new ApiError(502, 'Failed to look up pairing code', 'SUPABASE_READ_FAILED');
    if (!tenant) throw new ApiError(404, 'No business found for that pairing code', 'PAIRING_CODE_NOT_FOUND');
    const tenantId = tenant.id as string;

    let branchId: string;
    let branchName: string;
    if ('existingBranchId' in body.branch) {
      const { data: branch, error } = await client
        .from('branches')
        .select('id, name')
        .eq('id', body.branch.existingBranchId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error || !branch) throw new ApiError(404, 'Branch not found for this business', 'BRANCH_NOT_FOUND');
      branchId = branch.id;
      branchName = branch.name;
    } else {
      const newBranch = body.branch.new;
      if (!newBranch?.name?.trim()) throw new ApiError(400, 'branch.new.name is required');
      if (typeof newBranch.latitude !== 'number' || typeof newBranch.longitude !== 'number') {
        throw new ApiError(400, 'branch.new.latitude and branch.new.longitude are required');
      }
      branchId = generateId('BR');
      branchName = newBranch.name.trim();
      const { error } = await client.from('branches').insert({
        id: branchId,
        tenant_id: tenantId,
        code: shortCode(newBranch.name),
        name: branchName,
        address: newBranch.address?.trim() || null,
        status: 'ACTIVE',
        is_default: false,
        latitude: newBranch.latitude,
        longitude: newBranch.longitude,
      });
      if (error) throw new ApiError(502, 'Failed to create branch in Supabase', 'SUPABASE_WRITE_FAILED');
      db.prepare(`
        INSERT INTO branches (id, tenant_id, code, name, address, status, is_default, latitude, longitude)
        VALUES (@id, @tenant_id, @code, @name, @address, @status, @is_default, @latitude, @longitude)
      `).run({
        id: branchId, tenant_id: tenantId, code: shortCode(newBranch.name), name: branchName,
        address: newBranch.address?.trim() || null, status: 'ACTIVE', is_default: 0,
        latitude: newBranch.latitude, longitude: newBranch.longitude,
      });
    }

    const terminalId = generateId('TRM');
    const terminalCode = shortCode(body.terminalName);
    const installationId = randomUUID();
    const nowIso = new Date().toISOString();
    const { error: terminalError } = await client.from('terminals').insert({
      id: terminalId,
      tenant_id: tenantId,
      branch_id: branchId,
      branch_name: branchName,
      code: terminalCode,
      name: body.terminalName.trim(),
      workstation_type: body.appSurface === 'HEAD_OFFICE' ? 'BACKOFFICE_REGISTER' : 'COUNTER_POS',
      app_surface: body.appSurface,
      status: 'ACTIVE',
      is_default: false,
      activation_code: body.activationCode ?? null,
      activated_at: nowIso,
    });
    if (terminalError) throw new ApiError(502, 'Failed to create terminal in Supabase', 'SUPABASE_WRITE_FAILED');

    db.prepare(`
      INSERT INTO terminals (id, tenant_id, code, name, branch_id, branch_name, workstation_type, status, is_default)
      VALUES (@id, @tenant_id, @code, @name, @branch_id, @branch_name, @workstation_type, @status, @is_default)
    `).run({
      id: terminalId, tenant_id: tenantId, code: terminalCode, name: body.terminalName.trim(),
      branch_id: branchId, branch_name: branchName,
      workstation_type: body.appSurface === 'HEAD_OFFICE' ? 'BACKOFFICE_REGISTER' : 'COUNTER_POS',
      status: 'ACTIVE', is_default: 0,
    });

    persistInstallationConfig({
      installationId,
      tenantId,
      branchId,
      terminalId,
      appSurface: body.appSurface,
      activationCode: body.activationCode ?? null,
    });

    const { startBackgroundSync } = await import('../index');
    startBackgroundSync();

    // Warm the staff roster before the client moves on to STAFF_ACCESS —
    // this install has never pulled this tenant's staff before, and the
    // interval-based pull startBackgroundSync just kicked off is
    // fire-and-forget, so wait for one explicit pull here instead of
    // racing the PIN-entry screen against it.
    await pullStaffFromSupabase();
    await pullTenantFromSupabase();

    res.status(201).json({
      tenant: { id: tenantId },
      branch: { id: branchId, name: branchName },
      terminal: { id: terminalId, name: body.terminalName.trim(), appSurface: body.appSurface },
      installationId,
    });
  })
);

export default router;
