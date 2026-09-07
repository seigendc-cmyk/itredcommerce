import { db } from '../../db/connection';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { env, isSupabaseConfigured } from '../../env';
import { generateId, nowIso } from '../ids';
import { connectivityMonitor } from '../../sync/connectivityInstance';
import { decryptFiscalCredentials } from '../fiscalCrypto';
import { getProvider } from './registry';
import type { FiscalInvoiceLine } from './types';

// Orchestrates fiscal submission for a completed sale (Prompt 11). Two
// entry points:
//   - queueSaleForFiscalization(): called once, right after a sale
//     commits, from server/routes/sales.ts. Fast, local-only, and never
//     throws — a fiscalization problem must never surface as a sale
//     failure (see the confirmed non-blocking design in the governance
//     doc's Fiscalization addendum).
//   - attemptSubmission(): called by queueSaleForFiscalization itself
//     (fire-and-forget, not awaited by the sale route) and again by
//     server/sync/fiscalDrainLoop.ts on every drain tick for any row still
//     PENDING. Idempotent to call repeatedly — a row that's already
//     SUBMITTED/QUEUED_FOR_BATCH/non-retryable-FAILED is a no-op.

export interface SaleForFiscalization {
  saleId: string;
  saleNumber: string;
  branchId: string;
  dateTime: string;
  currency?: string;
  items: FiscalInvoiceLine[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  customerName?: string | null;
  customerTaxId?: string | null;
}

interface RegistrationCacheRow {
  id: string;
  branch_id: string;
  provider_key: string;
  status: string;
  credentials_ciphertext: string | null;
  credentials_iv: string | null;
  credentials_auth_tag: string | null;
}

function loadRegistrationForBranch(branchId: string): RegistrationCacheRow | undefined {
  return db.prepare('SELECT * FROM fiscal_registration_cache WHERE branch_id = ?').get(branchId) as any;
}

export function queueSaleForFiscalization(sale: SaleForFiscalization): void {
  try {
    const registration = loadRegistrationForBranch(sale.branchId);
    // No registration configured for this branch, or not yet promoted to
    // ACTIVE (still TEST / NOT_CONFIGURED) — fiscalization simply isn't
    // required for this sale. Nothing to log; this is the normal case for
    // any tenant/branch that hasn't set up fiscalization.
    if (!registration || registration.status !== 'ACTIVE') return;

    const provider = getProvider(registration.provider_key);
    if (!provider) {
      console.error(`[fiscalSubmission] branch ${sale.branchId} registration references unknown provider "${registration.provider_key}"`);
      return;
    }

    const id = generateId('FISC');
    const now = nowIso();
    db.prepare(
      `INSERT INTO fiscal_submissions (id, branch_id, registration_id, sale_id, sale_number, submission_mode, status, created_at, updated_at)
       VALUES (@id, @branchId, @registrationId, @saleId, @saleNumber, @submissionMode, 'PENDING', @createdAt, @updatedAt)`
    ).run({
      id,
      branchId: sale.branchId,
      registrationId: registration.id,
      saleId: sale.saleId,
      saleNumber: sale.saleNumber,
      submissionMode: provider.descriptor.submissionMode,
      createdAt: now,
      updatedAt: now,
    });

    // Fire-and-forget — the sale route must return immediately regardless
    // of whether this succeeds, fails, or the terminal is offline.
    void attemptSubmission(id, sale).catch((err) => {
      console.error(`[fiscalSubmission] unexpected error attempting submission ${id}:`, err);
    });
  } catch (err) {
    // Queueing itself must never throw back into the sale route.
    console.error('[fiscalSubmission] failed to queue sale for fiscalization:', err);
  }
}

interface LocalSubmissionRow {
  id: string;
  branch_id: string;
  registration_id: string | null;
  sale_id: string;
  sale_number: string;
  submission_mode: string;
  status: string;
  attempt_count: number;
  non_retryable: number;
}

/**
 * Attempts (or re-attempts) one queued submission. Safe to call more than
 * once for the same id — a row already past PENDING is a no-op. `saleHint`
 * lets the immediate post-checkout call skip a DB round-trip for line
 * items it already has in memory; the drain loop (which doesn't have that
 * in-memory data) omits it and this function reloads from local SQLite.
 */
export async function attemptSubmission(submissionId: string, saleHint?: SaleForFiscalization): Promise<void> {
  const row = db.prepare('SELECT * FROM fiscal_submissions WHERE id = ?').get(submissionId) as any as LocalSubmissionRow | undefined;
  if (!row) return;
  if (row.status !== 'PENDING' || row.non_retryable) return;

  if (connectivityMonitor.getState() !== 'ONLINE') return; // stays PENDING, drain loop will retry

  const registration = row.registration_id
    ? (db.prepare('SELECT * FROM fiscal_registration_cache WHERE id = ?').get(row.registration_id) as any)
    : loadRegistrationForBranch(row.branch_id);
  if (!registration || registration.status !== 'ACTIVE') {
    markResult(row, { outcome: 'FAILED', errorMessage: 'Fiscal registration for this branch is no longer active.', retryable: true });
    return;
  }

  const provider = getProvider(registration.provider_key);
  if (!provider) {
    markResult(row, { outcome: 'FAILED', errorMessage: `Unknown provider "${registration.provider_key}".`, retryable: false });
    return;
  }

  let credentials: Record<string, string>;
  try {
    if (!registration.credentials_ciphertext || !registration.credentials_iv || !registration.credentials_auth_tag) {
      throw new Error('No credentials saved for this registration.');
    }
    credentials = decryptFiscalCredentials({
      ciphertext: registration.credentials_ciphertext,
      iv: registration.credentials_iv,
      authTag: registration.credentials_auth_tag,
    });
  } catch (err) {
    // A local misconfiguration (missing/wrong FISCAL_CREDENTIALS_KEY, or
    // no credentials saved) — retrying without a fix won't help.
    markResult(row, {
      outcome: 'FAILED',
      errorMessage: `Cannot decrypt fiscal credentials on this terminal: ${err instanceof Error ? err.message : String(err)}`,
      retryable: false,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return; // Supabase unreachable — sequence numbers can only be claimed there; stays PENDING.

  let invoiceSequenceNumber: number;
  try {
    const { data, error } = await supabase.rpc('claim_next_fiscal_sequence', {
      p_tenant_id: env.tenantId,
      p_branch_id: row.branch_id,
    });
    if (error) throw error;
    invoiceSequenceNumber = data as number;
  } catch (err) {
    incrementAttempt(row.id);
    console.error(`[fiscalSubmission] failed to claim a fiscal sequence number for ${row.id}:`, err);
    return; // transient — stays PENDING
  }

  const sale = saleHint ?? loadSaleForFiscalization(row.sale_id, row.branch_id);
  if (!sale) {
    markResult(row, { outcome: 'FAILED', errorMessage: `Sale ${row.sale_id} could not be loaded locally.`, retryable: false });
    return;
  }

  const result = await provider.submitInvoice(credentials, {
    saleId: sale.saleId,
    saleNumber: sale.saleNumber,
    branchId: sale.branchId,
    invoiceSequenceNumber,
    issuedAt: sale.dateTime,
    currency: sale.currency ?? 'USD',
    lines: sale.items,
    subtotal: sale.subtotal,
    taxTotal: sale.taxTotal,
    grandTotal: sale.grandTotal,
    customerName: sale.customerName ?? undefined,
    customerTaxId: sale.customerTaxId ?? undefined,
  });

  markResult(row, result, invoiceSequenceNumber);
}

// Exported for server/sync/fiscalBackfillSweep.ts, which has only a bare
// sale_id/branch_id (no in-memory sale object the way the post-checkout
// call site does) and needs to build a real SaleForFiscalization to hand
// to queueSaleForFiscalization — reusing this rather than duplicating the
// cold-load shape.
export function loadSaleForFiscalization(saleId: string, branchId: string): SaleForFiscalization | undefined {
  const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_id = ?').get(saleId) as any;
  if (!saleRow) return undefined;
  const itemRows = db.prepare('SELECT * FROM sale_line_items WHERE sale_id = ?').all(saleId) as any[];
  return {
    saleId: saleRow.sale_id,
    saleNumber: saleRow.sale_number,
    branchId,
    dateTime: saleRow.date_time,
    items: itemRows.map((r) => ({
      description: r.item_name ?? r.sku,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      taxRate: r.tax_rate ?? 0,
      taxAmount: r.tax_amount ?? 0,
      lineTotal: r.line_total,
    })),
    subtotal: saleRow.subtotal,
    taxTotal: saleRow.tax_total,
    grandTotal: saleRow.grand_total,
    customerName: saleRow.customer_name,
  };
}

function incrementAttempt(id: string) {
  db.prepare('UPDATE fiscal_submissions SET attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
}

/**
 * Resets a submission back to a retryable PENDING state — the one place
 * both a same-terminal manual retry (server/routes/fiscalization.ts) and a
 * cross-terminal remote retry (server/sync/fiscalDrainLoop.ts's
 * applyRemoteRetryRequests, see DL-037) prepare a row before the next
 * drain tick actually attempts it. Does not call attemptSubmission itself —
 * callers either await it directly or rely on the caller's own PENDING scan
 * picking the row up.
 */
export function resetSubmissionForRetry(id: string): void {
  db.prepare(`UPDATE fiscal_submissions SET status = 'PENDING', non_retryable = 0, error_message = NULL, updated_at = ? WHERE id = ?`).run(
    nowIso(),
    id
  );
}

interface SubmitOutcomeLike {
  outcome: 'SUBMITTED' | 'QUEUED_FOR_BATCH' | 'FAILED';
  fiscalReferenceNumber?: string;
  qrCodePayload?: string;
  errorMessage?: string;
  retryable?: boolean;
}

function markResult(row: LocalSubmissionRow, result: SubmitOutcomeLike, invoiceSequenceNumber?: number) {
  const now = nowIso();
  const nextAttemptCount = row.attempt_count + 1;

  if (result.outcome === 'SUBMITTED' || result.outcome === 'QUEUED_FOR_BATCH') {
    db.prepare(
      `UPDATE fiscal_submissions
         SET status = ?, invoice_sequence_number = COALESCE(?, invoice_sequence_number), fiscal_reference_number = ?,
             qr_code_payload = ?, attempt_count = ?, error_message = NULL, submitted_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(result.outcome, invoiceSequenceNumber ?? null, result.fiscalReferenceNumber ?? null, result.qrCodePayload ?? null, nextAttemptCount, now, now, row.id);
  } else {
    const nonRetryable = result.retryable === false;
    db.prepare(
      `UPDATE fiscal_submissions
         SET status = 'PENDING', invoice_sequence_number = COALESCE(?, invoice_sequence_number), attempt_count = ?,
             non_retryable = ?, error_message = ?, updated_at = ?
       WHERE id = ?`
    ).run(invoiceSequenceNumber ?? null, nextAttemptCount, nonRetryable ? 1 : 0, result.errorMessage ?? null, now, row.id);
  }

  void mirrorSubmissionToSupabase(row.id).catch((err) => {
    console.error(`[fiscalSubmission] failed to mirror submission ${row.id} to Supabase:`, err);
  });
}

// Best-effort cross-terminal audit mirror — the Settings page (Head
// Office App, its own separate local install) has no access to another
// terminal's local SQLite, so the tenant-wide status/drill-down view it
// shows reads from Supabase, not any one terminal's local cache. See the
// governance doc addendum.
async function mirrorSubmissionToSupabase(localId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const row = db.prepare('SELECT * FROM fiscal_submissions WHERE id = ?').get(localId) as any;
  if (!row) return;

  const { error } = await supabase.from('fiscal_submissions').upsert({
    id: row.id,
    tenant_id: env.tenantId,
    branch_id: row.branch_id,
    registration_id: row.registration_id,
    sale_id: row.sale_id,
    sale_number: row.sale_number,
    submission_mode: row.submission_mode,
    status: row.status,
    invoice_sequence_number: row.invoice_sequence_number,
    fiscal_reference_number: row.fiscal_reference_number,
    qr_code_payload: row.qr_code_payload,
    attempt_count: row.attempt_count,
    non_retryable: !!row.non_retryable,
    error_message: row.error_message,
    submitted_at: row.submitted_at,
  });
  if (error) throw error;
}
