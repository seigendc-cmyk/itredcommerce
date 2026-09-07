import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShiftTenderMetrics } from './shiftReconciliation';
import type { Shift, CreditNote } from '../types';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'SHIFT-1',
    shiftNumber: 'SHIFT-0001',
    terminalId: 'TERM-1',
    terminalName: 'Terminal 1',
    branchId: 'BR-01',
    branchName: 'Main',
    cashierStaffId: 'STF-1',
    cashierStaffName: 'Cashier One',
    openedDateTime: '2026-09-07 08:00',
    openingDate: '2026-09-07',
    openingFloat: 100,
    status: 'OPEN',
    expectedCash: 0,
    ...overrides,
  } as unknown as Shift;
}

function makeCreditNote(overrides: Partial<CreditNote> = {}): CreditNote {
  return {
    id: 'CN-1',
    totalRefundAmount: 50,
    status: 'ISSUED',
    // DL-072: cash by default in these fixtures, since most of this file's
    // existing cases are testing shift/terminal attribution, not the
    // refundMethod filter — that gets its own dedicated tests below.
    refundMethod: 'CASH',
    ...overrides,
  } as unknown as CreditNote;
}

// DL-068 (Prompt 14): refunds now come from real credit notes, attributed
// to the shift/terminal that actually issued them — not from scanning
// transactions for a REFUNDED status (nothing produces one of those
// anymore).

test('a credit note matching this shift by shiftId reduces expectedCash', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [makeCreditNote({ shiftId: 'SHIFT-1', totalRefundAmount: 30 })];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 30);
  assert.equal(metrics.expectedCash, 70); // 100 opening float - 30 refund, no sales
});

test('a credit note issued on a different shift is excluded entirely', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [makeCreditNote({ shiftId: 'SHIFT-OTHER', totalRefundAmount: 30 })];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 0);
  assert.equal(metrics.expectedCash, 100);
});

test('a credit note with no shiftId (pre-migration row) falls back to matching terminalId', () => {
  const shift = makeShift({ id: 'SHIFT-1', terminalId: 'TERM-1', openingFloat: 100 });
  const creditNotes = [makeCreditNote({ terminalId: 'TERM-1', totalRefundAmount: 20 })];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 20);
});

test('a credit note with neither shiftId nor a matching terminalId is excluded', () => {
  const shift = makeShift({ id: 'SHIFT-1', terminalId: 'TERM-1', openingFloat: 100 });
  const creditNotes = [makeCreditNote({ terminalId: 'TERM-OTHER', totalRefundAmount: 20 })];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 0);
});

test('multiple credit notes on the same shift sum together', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [
    makeCreditNote({ id: 'CN-1', shiftId: 'SHIFT-1', totalRefundAmount: 10 }),
    makeCreditNote({ id: 'CN-2', shiftId: 'SHIFT-1', totalRefundAmount: 15.5 }),
  ];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 25.5);
});

test('a SaleTransaction with a REFUNDED status no longer contributes to refunds (that mechanism is removed)', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const transactions = [
    { status: 'REFUNDED', grandTotal: -999, terminalId: 'TERM-1' } as any,
  ];
  const metrics = computeShiftTenderMetrics(shift, transactions, [], []);
  assert.equal(metrics.cashMovements.cashRefunds, 0);
});

// DL-072: a refund only reduces till cash if it actually left the till.

test('a CASH refund and a CUSTOMER_CREDIT refund of equal amounts on the same shift — only the CASH one reduces expectedCash', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [
    makeCreditNote({ id: 'CN-CASH', shiftId: 'SHIFT-1', totalRefundAmount: 40, refundMethod: 'CASH' }),
    makeCreditNote({ id: 'CN-CREDIT', shiftId: 'SHIFT-1', totalRefundAmount: 40, refundMethod: 'CUSTOMER_CREDIT' }),
  ];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 40); // only the CASH refund
  assert.equal(metrics.expectedCash, 60); // 100 opening float - 40, not - 80
});

test('an ORIGINAL_METHOD refund is excluded from cashRefunds too (no record of what the original tender was)', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [makeCreditNote({ shiftId: 'SHIFT-1', totalRefundAmount: 40, refundMethod: 'ORIGINAL_METHOD' })];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 0);
});

test('a shift with only non-cash refunds has zero cashRefunds even though real refunds were issued', () => {
  const shift = makeShift({ id: 'SHIFT-1', openingFloat: 100 });
  const creditNotes = [
    makeCreditNote({ id: 'CN-1', shiftId: 'SHIFT-1', totalRefundAmount: 25, refundMethod: 'CUSTOMER_CREDIT' }),
    makeCreditNote({ id: 'CN-2', shiftId: 'SHIFT-1', totalRefundAmount: 15, refundMethod: 'CUSTOMER_CREDIT' }),
  ];
  const metrics = computeShiftTenderMetrics(shift, [], [], creditNotes);
  assert.equal(metrics.cashMovements.cashRefunds, 0);
  assert.equal(metrics.expectedCash, 100); // opening float untouched
});
