// KRA eTIMS (Kenya) — reference implementation only, per Prompt 11
// requirement 5 ("move existing KRA eTIMS logic behind the interface as a
// reference implementation, not primary"). There was no prior WORKING
// eTIMS integration in this codebase to move — a repo-wide search found
// only a cosmetic QR-verification URL string inside the old mock
// FiscalizationView UI (src/components/views/system/FiscalizationView.tsx),
// never a real client. This file is a from-scratch minimal implementation
// whose only purpose is to prove the FiscalizationProvider interface holds
// for a second country's per-transaction model — it is NOT a production
// target and is not wired to any real eTIMS sandbox. It only ever appears
// as an offered provider when a tenant's country is 'KE'.
import type {
  FiscalizationProvider,
  FiscalizationProviderDescriptor,
  FiscalConnectionTestResult,
  FiscalSubmissionResult,
} from '../types';

const descriptor: FiscalizationProviderDescriptor = {
  providerKey: 'kra_etims_reference',
  countryCode: 'KE',
  displayName: 'KRA eTIMS (reference implementation)',
  integrationPath: 'eTIMS API',
  submissionMode: 'PER_TRANSACTION',
  sandboxNote: 'Reference implementation only — not validated against a real eTIMS sandbox. Do not activate for a live tenant.',
  credentialFields: [
    { key: 'apiBaseUrl', label: 'eTIMS API Base URL', type: 'text', required: true },
    { key: 'kraPin', label: 'KRA PIN', type: 'text', required: true },
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
  ],
};

export const kraETimsReferenceProvider: FiscalizationProvider = {
  descriptor,

  async testConnection(credentials): Promise<FiscalConnectionTestResult> {
    if (!credentials.apiBaseUrl?.trim() || !credentials.kraPin?.trim() || !credentials.apiKey?.trim()) {
      return { ok: false, message: 'All eTIMS credential fields are required before testing.' };
    }
    return { ok: false, message: 'KRA eTIMS is a reference implementation only in this build and is not wired to a live sandbox.' };
  },

  async submitInvoice(): Promise<FiscalSubmissionResult> {
    return {
      outcome: 'FAILED',
      errorMessage: 'KRA eTIMS is a reference implementation only in this build — not wired to a live endpoint.',
      retryable: false,
    };
  },
};
