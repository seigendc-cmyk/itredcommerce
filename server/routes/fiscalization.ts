import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env, isSupabaseConfigured } from '../env';
import { encryptFiscalCredentials, redactCredentialsForLogging } from '../lib/fiscalCrypto';
import { providersForCountry, getProvider } from '../lib/fiscalization/registry';
import { attemptSubmission } from '../lib/fiscalization/fiscalSubmissionService';

// Fiscalization Settings routes (Prompt 11). Registration read/write is
// deliberately Supabase-only, with no local-SQLite fallback — the same
// "connected-only operation" shape DL-012 already established for staff
// administration (server/routes/staff.ts), and for the same reason:
// fiscal credentials are business-critical secrets, and trusting an
// offline-entered credential set until it eventually syncs has no safe
// resolution. Submission status/history reads local SQLite (today's
// actual single-shared-backend deployment reality — see the "Second
// Tauri flag" note in the governance doc — makes this correct now; once
// genuine per-install separation lands this will need to read the
// Supabase mirror instead, exactly the kind of gap already flagged
// elsewhere in this codebase rather than solved speculatively here).
const router = Router();
router.use(requireAuth);

// Narrower than the general back-office set — matches app_is_fiscal_admin_role()
// on the Postgres side (excludes 'executive', which is read-only per DL-002).
const FISCAL_ADMIN_ROLES = BACK_OFFICE_WRITE_ROLES;

function requireSupabase() {
  const client = getSupabaseAdmin();
  if (!isSupabaseConfigured || !client) {
    throw new ApiError(503, 'Fiscalization settings require a configured connection to the central system', 'SUPABASE_UNAVAILABLE');
  }
  return client;
}

router.get(
  '/providers',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const country = String(req.query.country || '').trim();
    if (!country) throw new ApiError(400, 'country is required');
    res.json(providersForCountry(country));
  })
);

router.get(
  '/tenant-country',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('tenants').select('country').eq('id', env.tenantId).single();
    if (error || !data) throw new ApiError(502, 'Failed to load tenant country');
    res.json({ country: data.country });
  })
);

function maskRegistration(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    branchId: row.branch_id,
    country: row.country,
    providerKey: row.provider_key,
    integrationPath: row.integration_path,
    status: row.status,
    fiscalDayStatus: row.fiscal_day_status,
    fiscalDayNumber: row.fiscal_day_number,
    lastZReportNumber: row.last_z_report_number,
    lastZReportAt: row.last_z_report_at,
    hasCredentials: !!row.credentials_ciphertext,
    credentialsUpdatedAt: row.credentials_updated_at,
    updatedAt: row.updated_at,
    // Credentials are NEVER returned, not even masked/partial — the
    // Settings UI only ever shows "configured: yes/no" plus when they were
    // last updated.
  };
}

router.get(
  '/registration/:branchId',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('fiscal_registrations')
      .select('*')
      .eq('tenant_id', env.tenantId)
      .eq('branch_id', req.params.branchId)
      .maybeSingle();
    if (error) throw new ApiError(502, 'Failed to load fiscal registration');
    res.json(maskRegistration(data));
  })
);

interface SaveRegistrationBody {
  providerKey?: string;
  integrationPath?: string;
  credentials?: Record<string, string>;
}

router.post(
  '/registration/:branchId',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const branchId = req.params.branchId;
    const body = req.body as SaveRegistrationBody;
    if (!body.providerKey) throw new ApiError(400, 'providerKey is required');
    if (!body.credentials || typeof body.credentials !== 'object') throw new ApiError(400, 'credentials is required');

    const supabase = requireSupabase();

    const { data: tenantRow, error: tenantErr } = await supabase.from('tenants').select('country').eq('id', env.tenantId).single();
    if (tenantErr || !tenantRow) throw new ApiError(502, 'Failed to load tenant country');

    const provider = getProvider(body.providerKey);
    const availableForCountry = providersForCountry(tenantRow.country);
    if (!provider || !availableForCountry.some((d) => d.providerKey === body.providerKey)) {
      throw new ApiError(400, `"${body.providerKey}" is not an available fiscalization provider for country "${tenantRow.country}"`);
    }

    const missingFields = provider.descriptor.credentialFields.filter((f) => f.required && !body.credentials![f.key]?.trim());
    if (missingFields.length > 0) {
      throw new ApiError(400, `Missing required credential field(s): ${missingFields.map((f) => f.label).join(', ')}`);
    }

    let encrypted;
    try {
      encrypted = encryptFiscalCredentials(body.credentials);
    } catch (err) {
      console.error('[fiscalization] failed to encrypt credentials:', err); // never log body.credentials itself
      throw new ApiError(500, err instanceof Error ? err.message : 'Failed to encrypt credentials', 'FISCAL_CRYPTO_UNAVAILABLE');
    }

    const now = nowIso();
    const id = generateId('FISCREG');

    // Any credential save resets status to TEST — a fresh connection test
    // must pass before this registration can be flagged ACTIVE (the
    // prompt's own requirement: "Test connection action against the
    // sandbox before allowing live credentials to be saved as active").
    const { data: upserted, error: upsertErr } = await supabase
      .from('fiscal_registrations')
      .upsert(
        {
          id,
          tenant_id: env.tenantId,
          branch_id: branchId,
          country: tenantRow.country,
          provider_key: body.providerKey,
          integration_path: body.integrationPath ?? provider.descriptor.integrationPath,
          status: 'TEST',
          credentials_ciphertext: encrypted.ciphertext,
          credentials_iv: encrypted.iv,
          credentials_auth_tag: encrypted.authTag,
          credentials_updated_at: now,
        },
        { onConflict: 'tenant_id,branch_id' }
      )
      .select()
      .single();

    if (upsertErr || !upserted) {
      console.error('[fiscalization] failed to save registration:', upsertErr, redactCredentialsForLogging(body.credentials));
      throw new ApiError(502, 'Failed to save fiscal registration');
    }

    mirrorRegistrationToLocalCache(upserted);
    res.status(200).json(maskRegistration(upserted));
  })
);

interface TestConnectionBody {
  credentials?: Record<string, string>;
}

router.post(
  '/registration/:branchId/test-connection',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const branchId = req.params.branchId;
    const body = req.body as TestConnectionBody;
    const supabase = requireSupabase();

    const { data: existing, error: fetchErr } = await supabase
      .from('fiscal_registrations')
      .select('*')
      .eq('tenant_id', env.tenantId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (fetchErr) throw new ApiError(502, 'Failed to load fiscal registration');

    let credentials = body.credentials;
    if (!credentials) {
      if (!existing?.credentials_ciphertext) {
        throw new ApiError(400, 'No saved credentials to test — save credentials first or provide them in this request.');
      }
      const { decryptFiscalCredentials } = await import('../lib/fiscalCrypto');
      try {
        credentials = decryptFiscalCredentials({
          ciphertext: existing.credentials_ciphertext,
          iv: existing.credentials_iv,
          authTag: existing.credentials_auth_tag,
        });
      } catch (err) {
        throw new ApiError(500, err instanceof Error ? err.message : 'Failed to decrypt saved credentials', 'FISCAL_CRYPTO_UNAVAILABLE');
      }
    }

    const providerKey = existing?.provider_key ?? req.body.providerKey;
    const provider = getProvider(providerKey);
    if (!provider) throw new ApiError(400, `Unknown provider "${providerKey}"`);

    const result = await provider.testConnection(credentials);

    if (result.ok && existing) {
      const { data: activated, error: activateErr } = await supabase
        .from('fiscal_registrations')
        .update({ status: 'ACTIVE' })
        .eq('tenant_id', env.tenantId)
        .eq('branch_id', branchId)
        .select()
        .single();
      if (!activateErr && activated) mirrorRegistrationToLocalCache(activated);
    }

    res.json(result);
  })
);

function mirrorRegistrationToLocalCache(row: any) {
  try {
    db.prepare(
      `INSERT INTO fiscal_registration_cache (
        id, branch_id, country, provider_key, integration_path, status, fiscal_day_status, fiscal_day_number,
        fiscal_day_opened_at, last_z_report_number, last_z_report_at, invoice_sequence_counter,
        credentials_ciphertext, credentials_iv, credentials_auth_tag, credentials_updated_at, updated_at
      ) VALUES (
        @id, @branchId, @country, @providerKey, @integrationPath, @status, @fiscalDayStatus, @fiscalDayNumber,
        @fiscalDayOpenedAt, @lastZReportNumber, @lastZReportAt, @invoiceSequenceCounter,
        @credentialsCiphertext, @credentialsIv, @credentialsAuthTag, @credentialsUpdatedAt, @updatedAt
      )
      ON CONFLICT(branch_id) DO UPDATE SET
        id = excluded.id, country = excluded.country, provider_key = excluded.provider_key,
        integration_path = excluded.integration_path, status = excluded.status,
        fiscal_day_status = excluded.fiscal_day_status, fiscal_day_number = excluded.fiscal_day_number,
        fiscal_day_opened_at = excluded.fiscal_day_opened_at, last_z_report_number = excluded.last_z_report_number,
        last_z_report_at = excluded.last_z_report_at, invoice_sequence_counter = excluded.invoice_sequence_counter,
        credentials_ciphertext = excluded.credentials_ciphertext, credentials_iv = excluded.credentials_iv,
        credentials_auth_tag = excluded.credentials_auth_tag, credentials_updated_at = excluded.credentials_updated_at,
        updated_at = excluded.updated_at`
    ).run({
      id: row.id,
      branchId: row.branch_id,
      country: row.country,
      providerKey: row.provider_key,
      integrationPath: row.integration_path,
      status: row.status,
      fiscalDayStatus: row.fiscal_day_status,
      fiscalDayNumber: row.fiscal_day_number,
      fiscalDayOpenedAt: row.fiscal_day_opened_at,
      lastZReportNumber: row.last_z_report_number,
      lastZReportAt: row.last_z_report_at,
      invoiceSequenceCounter: row.invoice_sequence_counter,
      credentialsCiphertext: row.credentials_ciphertext,
      credentialsIv: row.credentials_iv,
      credentialsAuthTag: row.credentials_auth_tag,
      credentialsUpdatedAt: row.credentials_updated_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    // Best-effort — the next scheduled fiscalRegistrationPull will
    // reconcile this terminal's cache regardless.
    console.error('[fiscalization] failed to mirror registration to local cache:', err);
  }
}

const PENDING_ALERT_THRESHOLD_COUNT = 5;
const PENDING_ALERT_THRESHOLD_MINUTES = 60;

router.get(
  '/submissions',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (branchId) {
      clauses.push('branch_id = @branchId');
      params.branchId = branchId;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM fiscal_submissions ${where} ORDER BY created_at DESC LIMIT 200`).all(params) as any[];

    const pending = rows.filter((r) => r.status === 'PENDING' && !r.non_retryable);
    const failed = rows.filter((r) => r.status === 'FAILED' || r.non_retryable);
    const oldestPendingAgeMinutes =
      pending.length > 0
        ? Math.round((Date.now() - new Date(pending[pending.length - 1].created_at).getTime()) / 60000)
        : 0;

    res.json({
      submissions: rows.map((r) => ({
        id: r.id,
        branchId: r.branch_id,
        saleId: r.sale_id,
        saleNumber: r.sale_number,
        submissionMode: r.submission_mode,
        status: r.status,
        invoiceSequenceNumber: r.invoice_sequence_number,
        fiscalReferenceNumber: r.fiscal_reference_number,
        qrCodePayload: r.qr_code_payload,
        attemptCount: r.attempt_count,
        nonRetryable: !!r.non_retryable,
        errorMessage: r.error_message,
        submittedAt: r.submitted_at,
        createdAt: r.created_at,
      })),
      summary: {
        pendingCount: pending.length,
        failedCount: failed.length,
        oldestPendingAgeMinutes,
        alert: pending.length >= PENDING_ALERT_THRESHOLD_COUNT || oldestPendingAgeMinutes >= PENDING_ALERT_THRESHOLD_MINUTES,
      },
    });
  })
);

router.post(
  '/submissions/:id/retry',
  requireAccessRole(...FISCAL_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM fiscal_submissions WHERE id = ?').get(id) as any;
    if (!row) throw new ApiError(404, 'Fiscal submission not found on this terminal');

    db.prepare(`UPDATE fiscal_submissions SET status = 'PENDING', non_retryable = 0, error_message = NULL, updated_at = ? WHERE id = ?`).run(
      nowIso(),
      id
    );

    void attemptSubmission(id).catch((err) => console.error(`[fiscalization] manual retry of ${id} failed:`, err));

    res.json({ ok: true });
  })
);

export default router;
