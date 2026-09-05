import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ManualPaymentProvider } from './paymentProvider';

const BASE_INPUT = { invoiceId: 'INV-1', amount: 100, currency: 'USD', reference: 'ECOCASH-REF-123' };

test('ManualPaymentProvider confirms a payment when a reference is given', async () => {
  const result = await new ManualPaymentProvider().confirmPayment(BASE_INPUT);
  assert.equal(result.confirmed, true);
});

test('ManualPaymentProvider rejects a missing payment reference — the failed-payment path that skips renewal entirely', async () => {
  const result = await new ManualPaymentProvider().confirmPayment({ ...BASE_INPUT, reference: '' });
  assert.equal(result.confirmed, false);
  assert.ok(result.reason);
});

test('ManualPaymentProvider rejects a whitespace-only payment reference', async () => {
  const result = await new ManualPaymentProvider().confirmPayment({ ...BASE_INPUT, reference: '   ' });
  assert.equal(result.confirmed, false);
});
