// Centralized ZIMRA fiscal device service (Prompt 16, DL-073/074/075) —
// sole holder of the device certificate and private key, sole caller of
// the ZIMRA API. Mirrors whatsapp-notify's architecture: a single Deno
// Edge Function holding a secret no other part of this system ever sees,
// invoked either by the till/head-office Express backend (a staff-
// initiated register/syncConfig/renewCertificate action, authenticated by
// a shared secret header — this app's staff auth via verify_staff_pin
// never produces a Supabase Auth JWT, so this cannot use the
// admin.auth.getUser() pattern console-issue-terminal-activation-token
// uses) or by pg_cron's daily certificate-renewal sweep (via pg_net, same
// shared-secret-header shape as trigger_whatsapp_notification_drain).
//
// Deploy this function with JWT verification DISABLED (same as
// whatsapp-notify — a deployment-time CLI flag, `supabase functions deploy
// zimra-fiscal-service --no-verify-jwt`, not something a migration or this
// source file can set) since neither caller ever carries a Supabase Auth
// JWT; ZIMRA_SERVICE_SECRET (checked below) is this function's own
// authentication instead.
//
// *** registerDevice / getConfig / issueCertificate wire format is a
// PLACEHOLDER — see buildRegisterDevicePayload / buildGetConfigRequest /
// buildIssueCertificatePayload below and docs/fiscalization/zimra-
// reference.md. Endpoint paths, request/response field names, and the
// exact authentication transport for calls made AFTER registration
// (this file assumes the issued client certificate authenticates the
// call, but whether that's true mTLS — a TLS client certificate, which may
// or may not be reachable via Deno.createHttpClient inside Supabase's
// specific Edge Runtime sandbox — or a certificate-derived bearer value is
// UNCONFIRMED) must be verified against the real FDMS API docs before this
// is pointed at anything but a dry run. This is a different, narrower
// unknown than Section 13's receipt-signing procedure: nothing in this
// file signs a receipt or approximates receiptDeviceSignature. ***
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateZimraDeviceKeypair, generateZimraCsr, exportPrivateKeyPkcs8Pem } from '../_shared/zimraCsr.ts';
import { encryptZimraSecret, decryptZimraSecret } from '../_shared/zimraCrypto.ts';

// PLACEHOLDER — see docs/fiscalization/zimra-reference.md: "exact sandbox
// hostname isn't published publicly... do not hardcode a sandbox URL from
// a third-party repo without confirming it's current." Set per-tenant (or
// per-deployment, if every tenant shares one FDMS environment) via this
// Edge Function secret once ZIMRA's Fiscalisation Team issues it.
const FDMS_BASE_URL = Deno.env.get('ZIMRA_FDMS_BASE_URL') ?? '';

// Spec's own recommendation: renew with roughly a month of lead time.
const CERTIFICATE_RENEWAL_LEAD_DAYS = 30;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface RegisterBody {
  action: 'register';
  tenantId: string;
  deviceId: number;
  serialNo: string;
  activationKey: string;
}
interface SyncConfigBody {
  action: 'syncConfig';
  tenantId: string;
}
interface RenewCertificateBody {
  action: 'renewCertificate';
  tenantId: string;
}
interface RenewCertificateSweepBody {
  action: 'renewCertificateSweep';
}
type RequestBody = RegisterBody | SyncConfigBody | RenewCertificateBody | RenewCertificateSweepBody;

// PLACEHOLDER shape — see file header.
async function callFdms(path: string, body: unknown, clientCert?: { certificatePem: string; privateKeyPem: string }): Promise<{ ok: boolean; status: number; json: any }> {
  if (!FDMS_BASE_URL) {
    throw new Error('ZIMRA_FDMS_BASE_URL is not configured on this Edge Function.');
  }
  // PLACEHOLDER auth — see file header's note on the unconfirmed
  // post-registration authentication transport. clientCert is accepted
  // here (and currently unused beyond this comment) so the call site below
  // stays correct once the real mechanism is confirmed, rather than
  // needing every call site rewritten.
  void clientCert;
  const res = await fetch(`${FDMS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseJson = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: responseJson };
}

// PLACEHOLDER — see file header.
function buildRegisterDevicePayload(deviceId: number, activationKey: string, csrPem: string) {
  return { deviceID: deviceId, activationKey, csrPem };
}

// PLACEHOLDER — see file header.
function buildGetConfigRequest(deviceId: number) {
  return { deviceID: deviceId };
}

// PLACEHOLDER — see file header.
function buildIssueCertificatePayload(deviceId: number, csrPem: string) {
  return { deviceID: deviceId, csrPem };
}

interface DeviceRow {
  id: string;
  tenant_id: string;
  status: string;
  device_id: string | null;
  serial_no: string | null;
  certificate_pem: string | null;
  certificate_valid_till: string | null;
  private_key_ciphertext: string | null;
  private_key_iv: string | null;
  private_key_auth_tag: string | null;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function handleRegister(admin: ReturnType<typeof createClient>, body: RegisterBody) {
  const { tenantId, deviceId, serialNo, activationKey } = body;
  if (!tenantId || !deviceId || !serialNo || !activationKey) {
    return json({ error: 'tenantId, deviceId, serialNo and activationKey are all required' }, 400);
  }

  const keys = await generateZimraDeviceKeypair();
  const { csrPem } = await generateZimraCsr(keys, serialNo, deviceId);

  let result: { ok: boolean; status: number; json: any };
  try {
    result = await callFdms('/device/register', buildRegisterDevicePayload(deviceId, activationKey, csrPem));
  } catch (err) {
    console.error('[zimra-fiscal-service] registerDevice call failed:', err);
    return json({ error: 'Could not reach FDMS to register device', detail: err instanceof Error ? err.message : String(err) }, 502);
  }
  if (!result.ok) {
    return json({ error: 'FDMS rejected device registration', status: result.status, response: result.json }, 502);
  }

  // PLACEHOLDER response shape — see file header. Assumes registerDevice
  // returns the issued certificate and its validity directly; if FDMS
  // instead requires a separate call to retrieve it, this needs revisiting
  // once the real contract is in hand.
  const certificatePem: string | undefined = result.json.certificate ?? result.json.certificatePem;
  const certificateValidTill: string | undefined = result.json.certificateValidTill;
  if (!certificatePem) {
    return json({ error: 'FDMS registration response did not include a certificate', response: result.json }, 502);
  }

  const privateKeyPem = await exportPrivateKeyPkcs8Pem(keys.privateKey);
  const encryptedKey = await encryptZimraSecret(privateKeyPem);

  const id = genId('ZIMDEV');
  const now = new Date().toISOString();
  const { error } = await admin
    .from('zimra_fiscal_device')
    .upsert(
      {
        id,
        tenant_id: tenantId,
        status: 'REGISTERED',
        device_id: String(deviceId),
        serial_no: serialNo,
        csr_pem: csrPem,
        certificate_pem: certificatePem,
        certificate_valid_till: certificateValidTill ?? null,
        private_key_ciphertext: encryptedKey.ciphertext,
        private_key_iv: encryptedKey.iv,
        private_key_auth_tag: encryptedKey.authTag,
        updated_at: now,
      },
      { onConflict: 'tenant_id' }
    );
  if (error) {
    console.error('[zimra-fiscal-service] failed to persist device registration:', error);
    return json({ error: 'Registered with FDMS but failed to persist locally — do not retry registration; contact support' }, 500);
  }

  return json({ ok: true, status: 'REGISTERED', deviceId, certificateValidTill: certificateValidTill ?? null });
}

async function loadDevice(admin: ReturnType<typeof createClient>, tenantId: string): Promise<DeviceRow | null> {
  const { data, error } = await admin.from('zimra_fiscal_device').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  return (data as DeviceRow | null) ?? null;
}

async function handleSyncConfig(admin: ReturnType<typeof createClient>, body: SyncConfigBody) {
  const { tenantId } = body;
  if (!tenantId) return json({ error: 'tenantId is required' }, 400);

  const device = await loadDevice(admin, tenantId);
  if (!device || !device.certificate_pem || !device.device_id) {
    return json({ error: 'No registered ZIMRA device for this tenant — register first' }, 409);
  }

  let privateKeyPem: string;
  try {
    privateKeyPem = await decryptZimraSecret({
      ciphertext: device.private_key_ciphertext!,
      iv: device.private_key_iv!,
      authTag: device.private_key_auth_tag!,
    });
  } catch (err) {
    console.error('[zimra-fiscal-service] failed to decrypt device private key:', err);
    return json({ error: 'Cannot decrypt this device\'s private key on this deployment (ZIMRA_CREDENTIALS_KEY mismatch or unset)' }, 500);
  }

  let result: { ok: boolean; status: number; json: any };
  try {
    result = await callFdms('/device/config', buildGetConfigRequest(Number(device.device_id)), {
      certificatePem: device.certificate_pem,
      privateKeyPem,
    });
  } catch (err) {
    console.error('[zimra-fiscal-service] getConfig call failed:', err);
    return json({ error: 'Could not reach FDMS for config sync', detail: err instanceof Error ? err.message : String(err) }, 502);
  }
  if (!result.ok) {
    return json({ error: 'FDMS rejected the config request', status: result.status, response: result.json }, 502);
  }

  // PLACEHOLDER response shape — see file header. Field names below match
  // Prompt 16 item 3's own list verbatim; verify against the real getConfig
  // response once available.
  const cfg = result.json;
  const now = new Date().toISOString();
  const { error } = await admin
    .from('zimra_fiscal_device')
    .update({
      status: 'CONFIG_SYNCED',
      device_operating_mode: cfg.deviceOperatingMode ?? null,
      tax_payer_name: cfg.taxPayerName ?? null,
      tax_payer_tin: cfg.taxPayerTIN ?? null,
      vat_number: cfg.vatNumber ?? null,
      tax_payer_day_max_hrs: cfg.taxPayerDayMaxHrs ?? null,
      taxpayer_day_end_notification_hrs: cfg.taxpayerDayEndNotificationHrs ?? null,
      applicable_taxes: cfg.applicableTaxes ?? [],
      qr_url: cfg.qrUrl ?? null,
      certificate_valid_till: cfg.certificateValidTill ?? device.certificate_valid_till,
      config_synced_at: now,
      updated_at: now,
    })
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('[zimra-fiscal-service] failed to persist config sync:', error);
    return json({ error: 'Fetched config from FDMS but failed to persist it' }, 500);
  }

  return json({
    ok: true,
    status: 'CONFIG_SYNCED',
    applicableTaxesCount: Array.isArray(cfg.applicableTaxes) ? cfg.applicableTaxes.length : 0,
    certificateValidTill: cfg.certificateValidTill ?? device.certificate_valid_till,
  });
}

async function renewOneDevice(admin: ReturnType<typeof createClient>, device: DeviceRow): Promise<{ tenantId: string; ok: boolean; detail?: string }> {
  if (!device.device_id || !device.serial_no) {
    return { tenantId: device.tenant_id, ok: false, detail: 'Missing device_id/serial_no — cannot renew a device that was never fully registered' };
  }

  // Fresh keypair + CSR for renewal, rather than re-submitting the old CSR
  // — standard PKI practice (a certificate renewal is an opportunity to
  // rotate the key, not just extend its validity), and avoids any question
  // of whether FDMS would even accept a previously-used CSR a second time.
  const keys = await generateZimraDeviceKeypair();
  const { csrPem } = await generateZimraCsr(keys, device.serial_no, Number(device.device_id));

  let result: { ok: boolean; status: number; json: any };
  try {
    result = await callFdms('/device/issue-certificate', buildIssueCertificatePayload(Number(device.device_id), csrPem));
  } catch (err) {
    return { tenantId: device.tenant_id, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
  if (!result.ok) {
    return { tenantId: device.tenant_id, ok: false, detail: `FDMS rejected renewal (HTTP ${result.status})` };
  }

  const certificatePem: string | undefined = result.json.certificate ?? result.json.certificatePem;
  const certificateValidTill: string | undefined = result.json.certificateValidTill;
  if (!certificatePem) {
    return { tenantId: device.tenant_id, ok: false, detail: 'FDMS renewal response did not include a certificate' };
  }

  const privateKeyPem = await exportPrivateKeyPkcs8Pem(keys.privateKey);
  const encryptedKey = await encryptZimraSecret(privateKeyPem);
  const now = new Date().toISOString();

  const { error } = await admin
    .from('zimra_fiscal_device')
    .update({
      status: 'REGISTERED',
      csr_pem: csrPem,
      certificate_pem: certificatePem,
      certificate_valid_till: certificateValidTill ?? null,
      private_key_ciphertext: encryptedKey.ciphertext,
      private_key_iv: encryptedKey.iv,
      private_key_auth_tag: encryptedKey.authTag,
      updated_at: now,
    })
    .eq('tenant_id', device.tenant_id);
  if (error) {
    return { tenantId: device.tenant_id, ok: false, detail: `Renewed with FDMS but failed to persist: ${error.message}` };
  }

  return { tenantId: device.tenant_id, ok: true };
}

async function handleRenewCertificate(admin: ReturnType<typeof createClient>, body: RenewCertificateBody) {
  const { tenantId } = body;
  if (!tenantId) return json({ error: 'tenantId is required' }, 400);

  const device = await loadDevice(admin, tenantId);
  if (!device) return json({ error: 'No registered ZIMRA device for this tenant' }, 409);

  const outcome = await renewOneDevice(admin, device);
  return json(outcome.ok ? { ok: true, status: 'REGISTERED' } : { ok: false, error: outcome.detail }, outcome.ok ? 200 : 502);
}

async function handleRenewCertificateSweep(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() + CERTIFICATE_RENEWAL_LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('zimra_fiscal_device')
    .select('*')
    .not('certificate_valid_till', 'is', null)
    .lte('certificate_valid_till', cutoff)
    .neq('status', 'SUSPENDED');
  if (error) {
    console.error('[zimra-fiscal-service] renewal sweep query failed:', error);
    return json({ error: 'Failed to query devices due for renewal' }, 500);
  }

  const results = [];
  for (const device of (data ?? []) as DeviceRow[]) {
    results.push(await renewOneDevice(admin, device));
  }
  return json({ checked: (data ?? []).length, renewed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = req.headers.get('x-zimra-service-secret');
  if (!secret || secret !== Deno.env.get('ZIMRA_SERVICE_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  try {
    switch (body.action) {
      case 'register':
        return await handleRegister(admin, body);
      case 'syncConfig':
        return await handleSyncConfig(admin, body);
      case 'renewCertificate':
        return await handleRenewCertificate(admin, body);
      case 'renewCertificateSweep':
        return await handleRenewCertificateSweep(admin);
      default:
        return json({ error: `Unknown action "${(body as { action?: string }).action}"` }, 400);
    }
  } catch (err) {
    console.error('[zimra-fiscal-service] unexpected error:', err);
    return json({ error: 'Internal error', detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
