// Shared tax/discount/line-total calculation engine (Prompt 13, per the
// SALES FLOW AUDIT & REMEDIATION ADDENDUM). Before this file, cash/credit
// sale checkout (SalesView.tsx) and credit-note refunds (creditNotes.ts)
// each implemented this math independently and had already diverged — see
// the addendum's audit findings and DL-071. This module is the single
// place both now call into.
//
// Lives in src/utils/ (not server/) because it's pure, framework-free
// TypeScript imported directly by both a browser React component and an
// Express route — the same dual-runtime pattern shiftReconciliation.ts
// already establishes (imported by App.tsx/EODSummaryView.tsx/
// ShiftClosureModal.tsx on the client and server/routes/shifts.ts on the
// server, via the same relative-path import this module uses too).
//
// Rounding rule (confirmed 2026-09-07): 2 decimal places, round-half-
// away-from-zero, applied per line — lineDiscount, then lineTax on the
// discounted taxable amount — before summing into cart/refund totals.
// Cart-level totals are sums of already-rounded per-line values, never
// independently re-rounded, so a total always ties out exactly to the sum
// of the line figures it's printed alongside.

/** Rounds to 2 decimal places, half-away-from-zero (commercial rounding), symmetric for negative values so it also behaves correctly on refund amounts. */
export function roundCurrency(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export interface CalculateLineTotalParams {
  quantity: number;
  unitPrice: number;
  /** Percent, e.g. 15 for 15%. */
  taxRate: number;
  /** Percent, e.g. 10 for 10%. Defaults to 0. */
  discountPercent?: number;
}

export interface LineCalculationResult {
  /** quantity * unitPrice, before any discount. */
  lineGross: number;
  discountAmount: number;
  /** lineGross - discountAmount. */
  taxableAmount: number;
  taxAmount: number;
  /** taxableAmount + taxAmount — the amount actually charged for this line. */
  lineTotal: number;
}

/**
 * Computes a line's discount/tax/total fresh from its current inputs every
 * call — deliberately stateless so a caller can never end up holding a
 * stale result the way SalesView.tsx's cart used to (taxAmount was
 * computed once on first add and never recomputed when quantity changed).
 */
export function calculateLineTotal(params: CalculateLineTotalParams): LineCalculationResult {
  const { quantity, unitPrice, taxRate, discountPercent = 0 } = params;
  const lineGross = roundCurrency(quantity * unitPrice);
  const discountAmount = roundCurrency((lineGross * discountPercent) / 100);
  const taxableAmount = roundCurrency(lineGross - discountAmount);
  const taxAmount = roundCurrency((taxableAmount * taxRate) / 100);
  const lineTotal = roundCurrency(taxableAmount + taxAmount);
  return { lineGross, discountAmount, taxableAmount, taxAmount, lineTotal };
}

export interface CartLineInput {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  /** Overrides options.globalDiscountPercent for this one line, if given. */
  discountPercent?: number;
}

export interface CalculateCartTotalsOptions {
  /** Applied to every line that doesn't specify its own discountPercent — this is how a single cart-wide discount (SalesView.tsx's globalDiscountPercent) is expressed without changing that discount's existing all-or-nothing behavior. */
  globalDiscountPercent?: number;
}

export interface CartTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  /** Per-line breakdown, same order as the input — e.g. for persisting sale_line_items. */
  lines: LineCalculationResult[];
}

/**
 * Sums per-line tax rather than applying one flat rate to the whole cart
 * (the bug this replaces: SalesView.tsx used to compute
 * `taxableAmount * 0.15` regardless of each item's real taxRate). Every
 * component of the returned totals is a sum of the already-rounded
 * per-line values, so totalTax always equals the sum of each line's
 * taxAmount exactly.
 */
export function calculateCartTotals(lines: CartLineInput[], options: CalculateCartTotalsOptions = {}): CartTotals {
  const results = lines.map((line) =>
    calculateLineTotal({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      discountPercent: line.discountPercent ?? options.globalDiscountPercent ?? 0,
    })
  );

  return {
    subtotal: roundCurrency(results.reduce((sum, r) => sum + r.lineGross, 0)),
    totalDiscount: roundCurrency(results.reduce((sum, r) => sum + r.discountAmount, 0)),
    totalTax: roundCurrency(results.reduce((sum, r) => sum + r.taxAmount, 0)),
    grandTotal: roundCurrency(results.reduce((sum, r) => sum + r.lineTotal, 0)),
    lines: results,
  };
}

export interface OriginalSaleLineForRefund {
  /** The quantity actually sold on the original line — caps returnQty. */
  originalQuantity: number;
  /** Pre-discount unit price, as frozen on sale_line_items.unit_price. */
  unitPrice: number;
  /** Frozen at time of sale — sale_line_items.tax_rate, never inventory_items.tax_rate (DL-071: that can have changed since). */
  taxRate: number;
  /** Frozen at time of sale — sale_line_items.discount_percent. */
  discountPercent: number;
}

export interface RefundCalculationResult {
  /** The tax-inclusive, discount-netted refund for returnQty units of this line. */
  refundAmount: number;
  /** Portion of refundAmount that is tax. */
  refundTax: number;
  /** Portion of the original line's discount netted out, proportional to returnQty. */
  refundDiscount: number;
}

/**
 * DL-071: a return refunds what the customer actually paid for those
 * units, not the item's pre-discount tag price and not today's tax rate —
 * both netted out proportionally by returnQty / originalQuantity against
 * the original line's own frozen inputs.
 */
export function calculateRefundAmount(original: OriginalSaleLineForRefund, returnQty: number): RefundCalculationResult {
  if (returnQty <= 0) {
    return { refundAmount: 0, refundTax: 0, refundDiscount: 0 };
  }
  if (original.originalQuantity <= 0 || returnQty > original.originalQuantity) {
    throw new Error(
      `Cannot refund ${returnQty} units — only ${original.originalQuantity} were sold on this line.`
    );
  }

  const originalLine = calculateLineTotal({
    quantity: original.originalQuantity,
    unitPrice: original.unitPrice,
    taxRate: original.taxRate,
    discountPercent: original.discountPercent,
  });

  const proportion = returnQty / original.originalQuantity;

  return {
    refundAmount: roundCurrency(originalLine.lineTotal * proportion),
    refundTax: roundCurrency(originalLine.taxAmount * proportion),
    refundDiscount: roundCurrency(originalLine.discountAmount * proportion),
  };
}
