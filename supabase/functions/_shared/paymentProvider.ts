// Payment provider abstraction (DL-054). DL-044's aggregator choice
// (Paynow vs. an equivalent Zimbabwe-market alternative) is still
// unresolved — this interface exists specifically so invoice-payment
// confirmation and TerminalActivationToken renewal (console-confirm-invoice-
// payment) never hardcode a specific aggregator's SDK/API calls. Whichever
// aggregator is eventually chosen becomes a new class implementing
// PaymentProvider; nothing in the invoice/renewal flow changes.
export interface PaymentConfirmationInput {
  invoiceId: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface PaymentConfirmationResult {
  confirmed: boolean;
  reason?: string;
}

export interface PaymentProvider {
  confirmPayment(input: PaymentConfirmationInput): Promise<PaymentConfirmationResult>;
}

// The only concrete implementation until DL-044 resolves: trusts the
// console operator's own confirmation that a payment was received (an
// EcoCash/bank transaction the operator verified out-of-band, e.g. against
// a WhatsApp payment notification or a bank statement) — exactly the same
// trust assumption the direct "Mark paid" RLS update this replaces already
// made, just now funneled through one place so a future real aggregator
// can be swapped in without touching invoice/renewal logic. A real
// aggregator's implementation of this same interface would instead call
// out to that aggregator's API/webhook to verify the reference server-side
// rather than trusting the operator's word for it.
export class ManualPaymentProvider implements PaymentProvider {
  async confirmPayment(input: PaymentConfirmationInput): Promise<PaymentConfirmationResult> {
    if (!input.reference?.trim()) {
      return { confirmed: false, reason: 'A payment reference is required' };
    }
    return { confirmed: true };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}
