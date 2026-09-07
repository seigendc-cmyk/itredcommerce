import { Router } from 'express';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env, isSupabaseConfigured } from '../env';

// Thin proxy to the centralized zimra-fiscal-service Edge Function (Prompt
// 16, DL-073/074/075). This backend never holds the ZIMRA device
// certificate or private key — it only relays a staff-initiated action and
// the shared ZIMRA_SERVICE_SECRET header, exactly the same "Supabase-only,
// no local-SQLite fallback" shape server/routes/fiscalization.ts already
// established for the generic fiscal registration routes, and for the
// same reason: this is business-critical secret material with no safe
// offline story.
const router = Router();
router.use(requireAuth);

const FISCAL_ADMIN_ROLES = BACK_OFFICE_WRITE_ROLES;

function requireZimraServiceConfigured() {
  if (!isSupabaseConfigured()) {
    throw new ApiError(503, 'ZIMRA fiscal service requires a configured connection to the central system', 'SUPABASE_UNAVAILABLE');
  }
  if (!env.zimraServiceSecret) {
    throw new ApiError(503, 'ZIMRA_SERVICE_SECRET is not configured on this install', 'ZIMRA_SERVICE_NOT_CONFIGURED');
  }
}

async function callZimraFiscalService(action: string, extra: Record<string, unknown> = {}): Promise<any> {
  const url = `${env.supabaseUrl.replace(/\/+$/, '')}/functions/v1/zimra-fiscal-service`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-zimra-service-secret': env.zimraServiceSecret },
    body: JSON.stringify({ action, tenantId: env.tenantId, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, body?.error || `ZIMRA fiscal service returned HTTP ${res.status}`, 'ZIMRA_SERVICE_ERROR');
  }
  return body;
}

interface RegisterBody {
  deviceId?: number;
  serialNo?: string;
  activationKey?: string;
}

router.post(
  '/register',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    requireZimraServiceConfigured();
    const body = req.body as RegisterBody;
    if (!body.deviceId || !body.serialNo || !body.activationKey) {
      throw new ApiError(400, 'deviceId, serialNo and activationKey are all required');
    }
    const result = await callZimraFiscalService('register', {
      deviceId: body.deviceId,
      serialNo: body.serialNo,
      activationKey: body.activationKey,
    });
    res.json(result);
  })
);

router.post(
  '/sync-config',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    requireZimraServiceConfigured();
    const result = await callZimraFiscalService('syncConfig');
    res.json(result);
  })
);

router.post(
  '/renew-certificate',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    requireZimraServiceConfigured();
    const result = await callZimraFiscalService('renewCertificate');
    res.json(result);
  })
);

// Read-only status for the Settings UI — reads Supabase directly (this
// route already holds the service-role key via getSupabaseAdmin(), same as
// fiscalization.ts's registration/submissions routes) rather than round-
// tripping through the Edge Function, since no secret material needs
// decrypting just to report status. Never returns the certificate or any
// key material.
router.get(
  '/status',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    if (!isSupabaseConfigured() || !supabase) {
      throw new ApiError(503, 'ZIMRA fiscal service requires a configured connection to the central system', 'SUPABASE_UNAVAILABLE');
    }
    const { data, error } = await supabase
      .from('zimra_fiscal_device')
      .select(
        'status, device_id, serial_no, certificate_valid_till, device_operating_mode, tax_payer_name, tax_payer_tin, vat_number, tax_payer_day_max_hrs, taxpayer_day_end_notification_hrs, applicable_taxes, qr_url, config_synced_at, updated_at'
      )
      .eq('tenant_id', env.tenantId)
      .maybeSingle();
    if (error) throw new ApiError(502, 'Failed to load ZIMRA device status');
    res.json(
      data
        ? {
            status: data.status,
            deviceId: data.device_id,
            serialNo: data.serial_no,
            certificateValidTill: data.certificate_valid_till,
            deviceOperatingMode: data.device_operating_mode,
            taxPayerName: data.tax_payer_name,
            taxPayerTIN: data.tax_payer_tin,
            vatNumber: data.vat_number,
            taxPayerDayMaxHrs: data.tax_payer_day_max_hrs,
            taxpayerDayEndNotificationHrs: data.taxpayer_day_end_notification_hrs,
            applicableTaxes: data.applicable_taxes,
            qrUrl: data.qr_url,
            configSyncedAt: data.config_synced_at,
            updatedAt: data.updated_at,
          }
        : null
    );
  })
);

export default router;
