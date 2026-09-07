import { db } from '../../db/connection';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { env, isSupabaseConfigured } from '../../env';
import { generateId, nowIso } from '../ids';
import { connectivityMonitor } from '../../sync/connectivityInstance';
import { decryptFiscalCredentials } from '../fiscalCrypto';
import { getProvider } from './registry';
import type { FiscalInvoiceLine } from './types';

// Credit-note counterpart to fiscalSubmissionService.ts — mirrors its
// shape deliberately (same two entry points, same PENDING/retry/mark-result
// flow) rather than sharing code with it, since fiscal_credit_note_submissions
// is a separate table (see that migration's header comment for why) and the
// two entities' source data (sales_transactions+sale_line_items vs.
// credit_notes+credit_note_items) don't unify cleanly enough to be worth a
// shared abstraction over two call sites.
//
//   - queueCreditNoteForFiscalization(): called once, right after a credit
//     note commits, from server/routes/creditNotes.ts. Fast, local-only,
//     never throws — same non-blocking discipline as sale submission.
//   - attemptCreditNoteSubmission(): called by queueCreditNoteForFiscalization
//     itself (fire-and-forget) and again by fiscalDrainLoop.ts on every
//     drain tick for any row still PENDING.

export interface CreditNoteForFiscalization {
  creditNoteId: string;
  creditNoteNumber: string;
  branchId: string;
  dateTime: string;
  currency?: string;
  lines: FiscalInvoiceLine[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  customerName?: string | null;
  customerTaxId?: string | null;
  originalSaleId?: string | null;
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

export function queueCreditNoteForFiscalization(creditNote: CreditNoteForFiscalization): void {
  try {
    const registration = loadRegistrationForBranch(creditNote.branchId);
    if (!registration || registration.status !== 'ACTIVE') return;

    const provider = getProvider(registration.provider_key);
    if (!provider) {
      console.error(`[fiscalCreditNoteSubmission] branch ${creditNote.branchId} registration references unknown provider "${registration.provider_key}"`);
      return;
    }

    const id = generateId('FISCCN');
    const now = nowIso();
    db.prepare(
      `INSERT INTO fiscal_credit_note_submissions (id, branch_id, registration_id, credit_note_id, credit_note_number, submission_mode, status, created_at, updated_at)
       VALUES (@id, @branchId, @registrationId, @creditNoteId, @creditNoteNumber, @submissionMode, 'PENDING', @createdAt, @updatedAt)`
    ).run({
      id,
      branchId: creditNote.branchId,
      registrationId: registration.id,
      creditNoteId: creditNote.creditNoteId,
      creditNoteNumber: creditNote.creditNoteNumber,
      submissionMode: provider.descriptor.submissionMode,
      createdAt: now,
      updatedAt: now,
    });

    void attemptCreditNoteSubmission(id, creditNote).catch((err) => {
      console.error(`[fiscalCreditNoteSubmission] unexpected error attempting submission ${id}:`, err);
    });
  } catch (err) {
    console.error('[fiscalCreditNoteSubmission] failed to queue credit note for fiscalization:', err);
  }
}

interface LocalCreditNoteSubmissionRow {
  id: string;
  branch_id: string;
  registration_id: string | null;
  credit_note_id: string;
  credit_note_number: string;
  submission_mode: string;
  status: string;
  attempt_count: number;
  non_retryable: number;
}

export async function attemptCreditNoteSubmission(submissionId: string, creditNoteHint?: CreditNoteForFiscalization): Promise<void> {
  const row = db.prepare('SELECT * FROM fiscal_credit_note_submissions WHERE id = ?').get(submissionId) as any as LocalCreditNoteSubmissionRow | undefined;
  if (!row) return;
  if (row.status !== 'PENDING' || row.non_retryable) return;

  if (connectivityMonitor.getState() !== 'ONLINE') return;

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
    markResult(row, {
      outcome: 'FAILED',
      errorMessage: `Cannot decrypt fiscal credentials on this terminal: ${err instanceof Error ? err.message : String(err)}`,
      retryable: false,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

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
    console.error(`[fiscalCreditNoteSubmission] failed to claim a fiscal sequence number for ${row.id}:`, err);
    return;
  }

  const creditNote = creditNoteHint ?? loadCreditNoteForFiscalization(row.credit_note_id, row.branch_id);
  if (!creditNote) {
    markResult(row, { outcome: 'FAILED', errorMessage: `Credit note ${row.credit_note_id} could not be loaded locally.`, retryable: false });
    return;
  }

  // Best-effort: if the original sale was itself fiscalized and already
  // submitted, reference its receipt/sequence — see FiscalCreditNoteRequest's
  // own doc comment on why this is omitted rather than guessed when absent.
  const originalSubmission = creditNote.originalSaleId
    ? (db
        .prepare(`SELECT invoice_sequence_number, fiscal_reference_number FROM fiscal_submissions WHERE sale_id = ? AND status = 'SUBMITTED' ORDER BY submitted_at DESC LIMIT 1`)
        .get(creditNote.originalSaleId) as { invoice_sequence_number: number | null; fiscal_reference_number: string | null } | undefined)
    : undefined;

  const result = await provider.submitCreditNote(credentials, {
    creditNoteId: creditNote.creditNoteId,
    creditNoteNumber: creditNote.creditNoteNumber,
    branchId: creditNote.branchId,
    invoiceSequenceNumber,
    issuedAt: creditNote.dateTime,
    currency: creditNote.currency ?? 'USD',
    lines: creditNote.lines,
    subtotal: creditNote.subtotal,
    taxTotal: creditNote.taxTotal,
    grandTotal: creditNote.grandTotal,
    customerName: creditNote.customerName ?? undefined,
    customerTaxId: creditNote.customerTaxId ?? undefined,
    originalReceiptReference: originalSubmission
      ? {
          fiscalReferenceNumber: originalSubmission.fiscal_reference_number ?? undefined,
          invoiceSequenceNumber: originalSubmission.invoice_sequence_number ?? undefined,
        }
      : undefined,
  });

  markResult(row, result, invoiceSequenceNumber);
}

function loadCreditNoteForFiscalization(creditNoteId: string, branchId: string): CreditNoteForFiscalization | undefined {
  const cnRow = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(creditNoteId) as any;
  if (!cnRow) return undefined;
  const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(creditNoteId) as any[];
  const originalSaleRow = cnRow.original_sale_number
    ? (db.prepare('SELECT sale_id FROM sales_transactions WHERE sale_number = ?').get(cnRow.original_sale_number) as { sale_id: string } | undefined)
    : undefined;
  return {
    creditNoteId: cnRow.id,
    creditNoteNumber: cnRow.id,
    branchId,
    dateTime: cnRow.date_time,
    lines: itemRows.map((r) => ({
      description: r.item_name ?? r.sku,
      quantity: r.return_qty,
      unitPrice: r.unit_price,
      taxRate: r.tax_rate ?? 0,
      taxAmount: r.tax_amount ?? 0,
      lineTotal: r.line_total ?? r.return_qty * r.unit_price,
    })),
    subtotal: itemRows.reduce((sum, r) => sum + ((r.line_total ?? 0) - (r.tax_amount ?? 0)), 0),
    taxTotal: itemRows.reduce((sum, r) => sum + (r.tax_amount ?? 0), 0),
    grandTotal: cnRow.total_refund_amount,
    customerName: cnRow.customer_name,
    originalSaleId: originalSaleRow?.sale_id ?? null,
  };
}

function incrementAttempt(id: string) {
  db.prepare('UPDATE fiscal_credit_note_submissions SET attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
}

export function resetCreditNoteSubmissionForRetry(id: string): void {
  db.prepare(`UPDATE fiscal_credit_note_submissions SET status = 'PENDING', non_retryable = 0, error_message = NULL, updated_at = ? WHERE id = ?`).run(
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

function markResult(row: LocalCreditNoteSubmissionRow, result: SubmitOutcomeLike, invoiceSequenceNumber?: number) {
  const now = nowIso();
  const nextAttemptCount = row.attempt_count + 1;

  if (result.outcome === 'SUBMITTED' || result.outcome === 'QUEUED_FOR_BATCH') {
    db.prepare(
      `UPDATE fiscal_credit_note_submissions
         SET status = ?, invoice_sequence_number = COALESCE(?, invoice_sequence_number), fiscal_reference_number = ?,
             qr_code_payload = ?, attempt_count = ?, error_message = NULL, submitted_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(result.outcome, invoiceSequenceNumber ?? null, result.fiscalReferenceNumber ?? null, result.qrCodePayload ?? null, nextAttemptCount, now, now, row.id);
  } else {
    const nonRetryable = result.retryable === false;
    db.prepare(
      `UPDATE fiscal_credit_note_submissions
         SET status = 'PENDING', invoice_sequence_number = COALESCE(?, invoice_sequence_number), attempt_count = ?,
             non_retryable = ?, error_message = ?, updated_at = ?
       WHERE id = ?`
    ).run(invoiceSequenceNumber ?? null, nextAttemptCount, nonRetryable ? 1 : 0, result.errorMessage ?? null, now, row.id);
  }

  void mirrorSubmissionToSupabase(row.id).catch((err) => {
    console.error(`[fiscalCreditNoteSubmission] failed to mirror submission ${row.id} to Supabase:`, err);
  });
}

async function mirrorSubmissionToSupabase(localId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const row = db.prepare('SELECT * FROM fiscal_credit_note_submissions WHERE id = ?').get(localId) as any;
  if (!row) return;

  const { error } = await supabase.from('fiscal_credit_note_submissions').upsert({
    id: row.id,
    tenant_id: env.tenantId,
    branch_id: row.branch_id,
    registration_id: row.registration_id,
    credit_note_id: row.credit_note_id,
    credit_note_number: row.credit_note_number,
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
