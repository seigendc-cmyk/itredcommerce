import { db, withTransaction } from '../db/connection';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env } from '../env';

// Pull-only cache, same shape as staffPull.ts (DL-012): fiscal
// registration — including the encrypted credential ciphertext — is
// authored once in Settings (Head Office App) and must reach every
// terminal at the same branch for a shared registration to actually work
// (Prompt 11's confirmed shared-registration decision). Supabase is the
// source of truth; this refreshes the local read-through cache used by
// fiscalSubmissionService.ts. Ciphertext is copied byte-for-byte — this
// job never decrypts anything, so it works identically whether or not
// this specific terminal even has FISCAL_CREDENTIALS_KEY set (decryption
// is only attempted at actual submission time).
export async function pullFiscalRegistrationsFromSupabase(): Promise<{ pulled: number } | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from('fiscal_registrations')
    .select(
      'id, branch_id, country, provider_key, integration_path, status, fiscal_day_status, fiscal_day_number, fiscal_day_opened_at, last_z_report_number, last_z_report_at, invoice_sequence_counter, credentials_ciphertext, credentials_iv, credentials_auth_tag, credentials_updated_at, updated_at'
    )
    .eq('tenant_id', env.tenantId);

  if (error || !data) {
    console.error('[fiscalRegistrationPull] failed to pull fiscal registrations from Supabase:', error);
    return null;
  }

  const upsert = db.prepare(`
    INSERT INTO fiscal_registration_cache (
      id, branch_id, country, provider_key, integration_path, status, fiscal_day_status, fiscal_day_number,
      fiscal_day_opened_at, last_z_report_number, last_z_report_at, invoice_sequence_counter,
      credentials_ciphertext, credentials_iv, credentials_auth_tag, credentials_updated_at, updated_at
    ) VALUES (
      @id, @branchId, @country, @providerKey, @integrationPath, @status, @fiscalDayStatus, @fiscalDayNumber,
      @fiscalDayOpenedAt, @lastZReportNumber, @lastZReportAt, @invoiceSequenceCounter,
      @credentialsCiphertext, @credentialsIv, @credentialsAuthTag, @credentialsUpdatedAt, @updatedAt
    )
    ON CONFLICT(branch_id) DO UPDATE SET
      id = excluded.id,
      country = excluded.country,
      provider_key = excluded.provider_key,
      integration_path = excluded.integration_path,
      status = excluded.status,
      fiscal_day_status = excluded.fiscal_day_status,
      fiscal_day_number = excluded.fiscal_day_number,
      fiscal_day_opened_at = excluded.fiscal_day_opened_at,
      last_z_report_number = excluded.last_z_report_number,
      last_z_report_at = excluded.last_z_report_at,
      invoice_sequence_counter = excluded.invoice_sequence_counter,
      credentials_ciphertext = excluded.credentials_ciphertext,
      credentials_iv = excluded.credentials_iv,
      credentials_auth_tag = excluded.credentials_auth_tag,
      credentials_updated_at = excluded.credentials_updated_at,
      updated_at = excluded.updated_at
  `);

  withTransaction(() => {
    for (const row of data) {
      upsert.run({
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
    }
  });

  console.log(`[fiscalRegistrationPull] synced ${data.length} fiscal registration(s) from Supabase`);
  return { pulled: data.length };
}
