import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLineTotal, calculateCartTotals, calculateRefundAmount, roundCurrency } from './saleCalculationEngine';

test('roundCurrency rounds half-away-from-zero to 2dp, symmetrically for negatives', () => {
  assert.equal(roundCurrency(2.005), 2.01);
  assert.equal(roundCurrency(2.004), 2.0);
  assert.equal(roundCurrency(-2.005), -2.01);
  assert.equal(roundCurrency(19.995), 20.0);
});

test('calculateLineTotal applies discount before tax, on the taxable amount', () => {
  const result = calculateLineTotal({ quantity: 1, unitPrice: 100, taxRate: 15, discountPercent: 10 });
  // gross 100, discount 10 -> taxable 90, tax 15% of 90 = 13.50, total 103.50
  assert.equal(result.lineGross, 100);
  assert.equal(result.discountAmount, 10);
  assert.equal(result.taxableAmount, 90);
  assert.equal(result.taxAmount, 13.5);
  assert.equal(result.lineTotal, 103.5);
});

test('a mixed-tax-rate cart sums each line at its own rate, not one flat rate for the whole cart', () => {
  // The bug this replaces: SalesView.tsx used to apply a single 15% to
  // taxableAmount regardless of each item's real rate.
  const totals = calculateCartTotals([
    { quantity: 1, unitPrice: 100, taxRate: 15 }, // tax 15.00
    { quantity: 2, unitPrice: 50, taxRate: 5 }, // gross 100, tax 5.00
  ]);
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.totalDiscount, 0);
  assert.equal(totals.totalTax, 20); // 15.00 + 5.00, NOT 200 * 0.15 = 30.00
  assert.equal(totals.grandTotal, 220);
  // Sum of per-line tax must equal the aggregate — the two never agreed in the old code.
  const sumOfLineTax = totals.lines.reduce((s, l) => s + l.taxAmount, 0);
  assert.equal(roundCurrency(sumOfLineTax), totals.totalTax);
});

test('a quantity change is reflected fully on recompute — no stale taxAmount from the original add', () => {
  // Old bug: taxAmount was computed once at qty=1 and never revisited when
  // quantity later changed, so a line's stored tax figure silently
  // undercounted for any line whose quantity grew after first adding it.
  const atAddTime = calculateLineTotal({ quantity: 1, unitPrice: 50, taxRate: 5 });
  assert.equal(atAddTime.taxAmount, 2.5);

  const afterIncrementingToQtyThree = calculateLineTotal({ quantity: 3, unitPrice: 50, taxRate: 5 });
  assert.equal(afterIncrementingToQtyThree.taxAmount, 7.5); // 150 * 5% = 7.50, not the stale 2.50
  assert.equal(afterIncrementingToQtyThree.lineTotal, 157.5);
});

test('a global discount applied uniformly per line reproduces the same aggregate discount as applying it once to the subtotal', () => {
  const totals = calculateCartTotals(
    [
      { quantity: 1, unitPrice: 100, taxRate: 15 },
      { quantity: 2, unitPrice: 50, taxRate: 5 },
    ],
    { globalDiscountPercent: 10 }
  );
  // subtotal 200, 10% off = 20.00, matching (200 * 10 / 100) computed on the whole cart at once.
  assert.equal(totals.totalDiscount, 20);
});

test('calculateRefundAmount nets out the original discount and uses the frozen tax rate, not a rate that changed since the sale', () => {
  // Original sale: 2 units @ $100, 15% tax rate charged at the time, 10% discount applied.
  // Customer actually paid: gross 200, discount 20 -> taxable 180, tax 27.00 -> total 207.00 for both units.
  const original = { originalQuantity: 2, unitPrice: 100, taxRate: 15, discountPercent: 10 };

  // The item's CURRENT inventory tax rate has since changed to 18% — must be ignored.
  const fullReturn = calculateRefundAmount(original, 2);
  assert.equal(fullReturn.refundAmount, 207);
  assert.equal(fullReturn.refundTax, 27);
  assert.equal(fullReturn.refundDiscount, 20);

  // Partial-quantity return: 1 of the 2 units -> exactly half of the full-line figures.
  const partialReturn = calculateRefundAmount(original, 1);
  assert.equal(partialReturn.refundAmount, 103.5);
  assert.equal(partialReturn.refundTax, 13.5);
  assert.equal(partialReturn.refundDiscount, 10);
});

test('calculateRefundAmount rejects returning more than was originally sold', () => {
  assert.throws(() => calculateRefundAmount({ originalQuantity: 2, unitPrice: 100, taxRate: 15, discountPercent: 0 }, 3));
});

test('calculateRefundAmount returns zero for a non-positive returnQty without throwing', () => {
  const result = calculateRefundAmount({ originalQuantity: 2, unitPrice: 100, taxRate: 15, discountPercent: 0 }, 0);
  assert.deepEqual(result, { refundAmount: 0, refundTax: 0, refundDiscount: 0 });
});
