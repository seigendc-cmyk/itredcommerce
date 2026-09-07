// ZIMRA Virtual Fiscalisation (FDMS API) provider — Zimbabwe, primary
// launch market (Prompt 11). Per-transaction submission mode.
//
// *** WIRE FORMAT IS A PLACEHOLDER — READ BEFORE CHANGING ANYTHING HERE ***
// ZIMRA's actual FDMS request/response JSON contract is not publicly
// published; it's issued directly by ZIMRA's Fiscalisation Team once a
// taxpayer registers for the FDMS TEST environment (see
// docs/fiscalization/zimra-reference.md — "exact sandbox hostname isn't
// published publicly... do not hardcode a sandbox URL from a third-party
// repo without confirming it's current"). The request/response shapes
// below are a reasonable, best-effort structure based on what a fiscal
// invoice submission generally needs (taxpayer identity, device identity,
// invoice lines, totals) — they are NOT a confirmed ZIMRA contract. Every
// field name, endpoint path, and auth mechanism here must be verified,
// and very likely adjusted, against the real FDMS API docs once obtained.
// This structure exists so that swap-in is a change to buildInvoicePayload/
// callFdms only — no call site (fiscalSubmissionService, the Settings
// routes, the sale-completion hook) needs to change.
import type {
  FiscalizationProvider,
  FiscalizationProviderDescriptor,
  FiscalConnectionTestResult,
  FiscalInvoiceRequest,
  FiscalCreditNoteRequest,
  FiscalSubmissionResult,
} from '../types';

const descriptor: FiscalizationProviderDescriptor = {
  providerKey: 'zimra_virtual',
  countryCode: 'ZW',
  displayName: 'ZIMRA — Virtual Fiscalisation (FDMS API)',
  integrationPath: 'Virtual Fiscalisation API (FDMS)',
  submissionMode: 'PER_TRANSACTION',
  sandboxNote:
    "FDMS TEST environment endpoint details are issued directly by ZIMRA's Fiscalisation Team upon registration (see docs/fiscalization/zimra-reference.md) — enter exactly what ZIMRA gave you, never guess a sandbox URL.",
  credentialFields: [
    {
      key: 'apiBaseUrl',
      label: 'FDMS API Base URL',
      type: 'text',
      required: true,
      placeholder: 'https://<issued-by-zimra>',
      helpText: "Issued by ZIMRA's Fiscalisation Team at TEST registration.",
    },
    { key: 'taxpayerTin', label: 'Taxpayer TIN', type: 'text', required: true },
    { key: 'deviceId', label: 'Registered Device ID', type: 'text', required: true, helpText: 'Assigned by ZIMRA once your virtual device is registered.' },
    { key: 'apiKey', label: 'API Key / Certificate', type: 'password', required: true },
  ],
};

const REQUIRED_CREDENTIAL_KEYS = ['apiBaseUrl', 'taxpayerTin', 'deviceId', 'apiKey'] as const;

function missingCredentialFields(credentials: Record<string, string>): string[] {
  return REQUIRED_CREDENTIAL_KEYS.filter((key) => !credentials[key]?.trim());
}

async function callFdms(
  credentials: Record<string, string>,
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; json: any }> {
  const baseUrl = credentials.apiBaseUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.apiKey}`,
      'X-Device-Id': credentials.deviceId,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function buildInvoicePayload(credentials: Record<string, string>, request: FiscalInvoiceRequest) {
  // PLACEHOLDER shape — see file header.
  return {
    taxpayerTin: credentials.taxpayerTin,
    deviceId: credentials.deviceId,
    invoiceNumber: request.invoiceSequenceNumber,
    issuedAt: request.issuedAt,
    currency: request.currency,
    lines: request.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      taxAmount: l.taxAmount,
      lineTotal: l.lineTotal,
    })),
    subtotal: request.subtotal,
    taxTotal: request.taxTotal,
    grandTotal: request.grandTotal,
    buyer: request.customerTaxId ? { name: request.customerName, tin: request.customerTaxId } : undefined,
  };
}

// PLACEHOLDER shape — see file header. Distinct endpoint/shape from an
// invoice: a CreditDebitNote references the original receipt being
// credited, per ZIMRA's own document model.
function buildCreditNotePayload(credentials: Record<string, string>, request: FiscalCreditNoteRequest) {
  return {
    taxpayerTin: credentials.taxpayerTin,
    deviceId: credentials.deviceId,
    creditNoteNumber: request.invoiceSequenceNumber,
    issuedAt: request.issuedAt,
    currency: request.currency,
    lines: request.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      taxAmount: l.taxAmount,
      lineTotal: l.lineTotal,
    })),
    subtotal: request.subtotal,
    taxTotal: request.taxTotal,
    grandTotal: request.grandTotal,
    buyer: request.customerTaxId ? { name: request.customerName, tin: request.customerTaxId } : undefined,
    originalReceipt: request.originalReceiptReference
      ? {
          fiscalReferenceNumber: request.originalReceiptReference.fiscalReferenceNumber,
          invoiceSequenceNumber: request.originalReceiptReference.invoiceSequenceNumber,
        }
      : undefined,
  };
}

export const zimraVirtualProvider: FiscalizationProvider = {
  descriptor,

  async testConnection(credentials): Promise<FiscalConnectionTestResult> {
    const missing = missingCredentialFields(credentials);
    if (missing.length > 0) {
      return { ok: false, message: `Missing required field(s): ${missing.join(', ')}` };
    }
    try {
      // PLACEHOLDER endpoint path — a real "ping"/status endpoint name
      // must come from the actual FDMS API docs. See file header.
      const { ok, status, json } = await callFdms(credentials, '/status', {});
      if (ok) {
        return { ok: true, message: `FDMS TEST environment reachable (device ${credentials.deviceId}).` };
      }
      return { ok: false, message: `FDMS responded with status ${status}: ${JSON.stringify(json).slice(0, 300)}` };
    } catch (err) {
      return { ok: false, message: `Could not reach FDMS TEST environment: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  async submitInvoice(credentials, request): Promise<FiscalSubmissionResult> {
    const missing = missingCredentialFields(credentials);
    if (missing.length > 0) {
      return { outcome: 'FAILED', errorMessage: `Missing required field(s): ${missing.join(', ')}`, retryable: false };
    }
    try {
      // PLACEHOLDER endpoint path — see file header.
      const { ok, status, json } = await callFdms(credentials, '/invoices', buildInvoicePayload(credentials, request));
      if (ok) {
        return {
          outcome: 'SUBMITTED',
          fiscalReferenceNumber: json.referenceNumber ?? json.receiptId ?? undefined,
          qrCodePayload: json.qrCodePayload ?? json.verificationUrl ?? undefined,
          rawResponseSummary: `HTTP ${status}`,
        };
      }
      // A 4xx means FDMS rejected this exact payload (e.g. validation
      // error) — retrying it unchanged can't succeed. A 5xx is FDMS's own
      // failure, worth retrying.
      const retryable = status >= 500 || status === 0;
      return {
        outcome: 'FAILED',
        errorMessage: `FDMS rejected the invoice (HTTP ${status}): ${JSON.stringify(json).slice(0, 500)}`,
        retryable,
      };
    } catch (err) {
      // Network-level failure (DNS, timeout, connection refused) — always
      // transient from this provider's point of view.
      return { outcome: 'FAILED', errorMessage: err instanceof Error ? err.message : String(err), retryable: true };
    }
  },

  async submitCreditNote(credentials, request): Promise<FiscalSubmissionResult> {
    const missing = missingCredentialFields(credentials);
    if (missing.length > 0) {
      return { outcome: 'FAILED', errorMessage: `Missing required field(s): ${missing.join(', ')}`, retryable: false };
    }
    try {
      // PLACEHOLDER endpoint path — see file header.
      const { ok, status, json } = await callFdms(credentials, '/credit-notes', buildCreditNotePayload(credentials, request));
      if (ok) {
        return {
          outcome: 'SUBMITTED',
          fiscalReferenceNumber: json.referenceNumber ?? json.receiptId ?? undefined,
          qrCodePayload: json.qrCodePayload ?? json.verificationUrl ?? undefined,
          rawResponseSummary: `HTTP ${status}`,
        };
      }
      const retryable = status >= 500 || status === 0;
      return {
        outcome: 'FAILED',
        errorMessage: `FDMS rejected the credit note (HTTP ${status}): ${JSON.stringify(json).slice(0, 500)}`,
        retryable,
      };
    } catch (err) {
      return { outcome: 'FAILED', errorMessage: err instanceof Error ? err.message : String(err), retryable: true };
    }
  },
};
