import type { TerminalActivationTokenRow, TerminalActivationConfirmationRow } from './consoleApi';

export type TokenReconciliationStatus = 'confirmed' | 'awaiting-confirmation';

export interface TokenReconciliationRow {
  token: TerminalActivationTokenRow;
  status: TokenReconciliationStatus;
  confirmation: TerminalActivationConfirmationRow | null;
}

// DL-042/DL-057: pure matching logic between the console's own issuance
// ledger (terminal_activation_tokens) and the tenant's independently-kept
// activation ledger (terminal_activation_confirmations), reconciled by
// (tenant_id, terminal_id, issued_at ↔ token_issued_at) exactly as DL-042
// specifies. Split out from TokenReconciliationPage.tsx so it's testable
// without Supabase — same discipline as billingEngine.ts's
// calculateInvoiceLineItems.
//
// Matches on exact issued_at/token_issued_at equality rather than nearest-
// in-time: both sides record the same signed token's own issuedAt field
// (see server/lib/terminalActivationConfirmations.ts and
// console-issue-terminal-activation-token), so an exact match is always
// available for a confirmation that actually corresponds to this token —
// a near-miss would only ever mask a genuine gap, which is exactly what
// this view exists to surface.
export function reconcileTerminalActivationTokens(
  tokens: TerminalActivationTokenRow[],
  confirmations: TerminalActivationConfirmationRow[]
): TokenReconciliationRow[] {
  return tokens.map((token) => {
    const confirmation =
      confirmations.find(
        (c) =>
          c.tenant_id === token.tenant_id &&
          c.terminal_id === token.terminal_id &&
          c.token_issued_at === token.issued_at
      ) ?? null;

    return {
      token,
      status: confirmation ? 'confirmed' : 'awaiting-confirmation',
      confirmation,
    };
  });
}
