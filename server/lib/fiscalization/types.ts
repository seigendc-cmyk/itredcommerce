// Pluggable fiscalization interface (Prompt 11, DL-003). One shape every
// fiscal authority integration implements — Zimbabwe (ZIMRA, built this
// prompt), Kenya (KRA eTIMS, a minimal reference implementation only), and
// Zambia/Malawi/Mozambique (not built yet, but must slot in later without
// touching any call site or the Settings UI structure). See
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Fiscalization addendum for the
// confirmed decisions this interface encodes.

export interface FiscalCredentialFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required: boolean;
  helpText?: string;
}

export type FiscalSubmissionMode = 'PER_TRANSACTION' | 'BATCH_ADAPTER';

// Static metadata the Settings UI renders generically — adding a new
// provider means adding a descriptor + implementation to the registry,
// never touching SettingsView.tsx's structure.
export interface FiscalizationProviderDescriptor {
  providerKey: string;
  countryCode: string; // ISO 3166-1 alpha-2
  displayName: string;
  integrationPath: string; // human label, e.g. 'Virtual Fiscalisation API (FDMS)'
  submissionMode: FiscalSubmissionMode;
  credentialFields: FiscalCredentialFieldDef[];
  sandboxNote?: string;
}

export interface FiscalInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface FiscalInvoiceRequest {
  saleId: string;
  saleNumber: string;
  branchId: string;
  invoiceSequenceNumber: number; // allocated by claim_next_fiscal_sequence just before this is built
  issuedAt: string; // ISO timestamp
  currency: string;
  lines: FiscalInvoiceLine[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  customerName?: string;
  customerTaxId?: string;
}

// A credit note is its own fiscal document type (a CreditDebitNote in
// ZIMRA's terms), not a negative-amount invoice — it references the
// original receipt being credited. originalReceiptReference is best-effort:
// populated from the original sale's own fiscal_submissions row when one
// exists (a SUBMITTED sale on a fiscalized branch), omitted otherwise (the
// original sale predates fiscalization, or was never fiscalized) — a
// provider that requires this reference for a valid submission should
// treat its absence as a non-retryable rejection, not guess at one.
export interface FiscalCreditNoteRequest {
  creditNoteId: string;
  creditNoteNumber: string;
  branchId: string;
  invoiceSequenceNumber: number; // allocated by claim_next_fiscal_sequence, same as an invoice
  issuedAt: string;
  currency: string;
  lines: FiscalInvoiceLine[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  customerName?: string;
  customerTaxId?: string;
  originalReceiptReference?: {
    fiscalReferenceNumber?: string;
    invoiceSequenceNumber?: number;
  };
}

export type FiscalSubmissionOutcome = 'SUBMITTED' | 'QUEUED_FOR_BATCH' | 'FAILED';

export interface FiscalSubmissionResult {
  outcome: FiscalSubmissionOutcome;
  fiscalReferenceNumber?: string; // e.g. ZIMRA receipt/verification code, ZRA Mark ID
  qrCodePayload?: string;
  rawResponseSummary?: string; // short, non-sensitive summary for the audit log — never raw credentials
  errorMessage?: string;
  /**
   * Only meaningful when outcome is 'FAILED'. true (or omitted) means the
   * failure looks transient (network error, 5xx, timeout) and should be
   * retried automatically without limit — a fiscal submission is a
   * compliance obligation, not something to give up on. Set explicitly
   * false only for a definitive rejection (e.g. a 4xx validation error)
   * that retrying the identical payload can never fix on its own.
   */
  retryable?: boolean;
}

export interface FiscalConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface FiscalizationProvider {
  readonly descriptor: FiscalizationProviderDescriptor;

  testConnection(credentials: Record<string, string>): Promise<FiscalConnectionTestResult>;

  /**
   * The one call site every submission mode goes through. Per-transaction
   * providers (Zimbabwe/Zambia/Malawi) submit immediately and return
   * SUBMITTED/FAILED. Batch providers (Mozambique, future) buffer locally
   * and return QUEUED_FOR_BATCH — callers never need to know which kind
   * they're talking to.
   */
  submitInvoice(credentials: Record<string, string>, request: FiscalInvoiceRequest): Promise<FiscalSubmissionResult>;

  /**
   * The credit-note counterpart to submitInvoice — a deliberate, explicit
   * departure from this interface's original "submitInvoice is the only
   * method any caller ever calls" design (see the governance doc's
   * ZIMRA FISCALIZATION ADDENDUM follow-up decision). A credit note is a
   * distinct fiscal document type in ZIMRA's own model (references the
   * original receipt), not representable as a negative-amount invoice
   * without misrepresenting what's actually being submitted. Required on
   * every provider — every real fiscal integration needs credit-note
   * support, the same way every one needs invoice support.
   */
  submitCreditNote(credentials: Record<string, string>, request: FiscalCreditNoteRequest): Promise<FiscalSubmissionResult>;

  /**
   * Batch-mode providers only — invisible to call sites, invoked by a
   * scheduled job specific to that provider. Per-transaction providers
   * simply don't implement this.
   */
  runPeriodicBatch?(credentials: Record<string, string>): Promise<{ submitted: number; failed: number }>;
}
