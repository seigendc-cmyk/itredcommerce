import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// Prompt 14 (DL-068): issueCreditNote's core behavior — refund-cap
// enforcement, restock persistence, and idempotency dedup — is inherently
// about real DB side effects, not a pure calculation, so this is a genuine
// integration test against a real (temp, isolated) SQLite db rather than
// the extracted-pure-function convention the rest of this codebase's tests
// follow. DB_PATH must be set before any module that transitively imports
// server/db/connection is loaded — env.ts reads it once, at import time —
// hence the dynamic imports below rather than static ones (which Node
// hoists above this assignment).
process.env.DB_PATH = path.join(os.tmpdir(), `itred-credit-notes-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../db/connection');
const { runMigrations } = await import('../db/migrate');
const { issueCreditNote } = await import('./creditNotes');
const { ApiError } = await import('../lib/http');

runMigrations();

function seedShift(id: string, overrides: Partial<{ terminalId: string; branchId: string; status: string }> = {}) {
  db.prepare(
    `INSERT INTO shifts (id, shift_number, terminal_id, terminal_name, branch_id, branch_name, cashier_staff_id, cashier_staff_name, opened_date_time, opening_date, opening_float, status)
     VALUES (?, ?, ?, 'Terminal 1', ?, 'Main', 'STF-1', 'Cashier One', '2026-09-07 08:00', '2026-09-07', 100, ?)`
  ).run(id, `SHIFT-${id}`, overrides.terminalId ?? 'TERM-1', overrides.branchId ?? 'BR-01', overrides.status ?? 'OPEN');
}

function seedInventoryItem(sku: string, overrides: Partial<{ stockOnHand: number; taxRate: number; unitCost: number }> = {}) {
  db.prepare(
    `INSERT INTO inventory_items (sku, name, stock_on_hand, reorder_level, unit_cost, retail_price, tax_rate, status)
     VALUES (?, ?, ?, 2, ?, 100, ?, 'In Stock')`
  ).run(sku, `Item ${sku}`, overrides.stockOnHand ?? 10, overrides.unitCost ?? 40, overrides.taxRate ?? 15);
}

function seedSaleWithLine(
  saleId: string,
  saleNumber: string,
  sku: string,
  overrides: Partial<{ quantity: number; unitPrice: number; taxRate: number; discountPercent: number }> = {}
) {
  db.prepare(
    `INSERT INTO sales_transactions (sale_id, sale_number, date_time, transaction_type, status)
     VALUES (?, ?, '2026-09-01 10:00', 'CASH_SALE', 'COMPLETED')`
  ).run(saleId, saleNumber);
  db.prepare(
    `INSERT INTO sale_line_items (sale_id, sku, quantity, unit_price, discount_percent, tax_rate)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(saleId, sku, overrides.quantity ?? 3, overrides.unitPrice ?? 100, overrides.discountPercent ?? 0, overrides.taxRate ?? 15);
}

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

test('a valid return: refund entity carries the issuing shift/terminal, and restock increments stock_on_hand', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  seedShift(shiftId, { terminalId: 'TERM-A' });
  seedInventoryItem(sku, { stockOnHand: 5 });
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3, unitPrice: 100, taxRate: 15 });

  const result = issueCreditNote({
    body: {
      originalSaleNumber: saleNumber,
      customerName: 'Walk-in',
      refundMethod: 'CASH',
      reasonCategory: 'CUSTOMER_RETURN',
      shiftId,
      idempotencyKey: uniqueId('IDEMP'),
      returnedItems: [{ sku, returnQty: 2, unitPrice: 100, reason: 'Changed mind', restock: true }],
    },
    staffId: 'STF-1',
    staffName: 'Cashier One',
  });

  assert.equal(result.alreadyProcessed, false);
  // 2 of 3 units @ $100, 15% tax, no discount -> (200 * 1.15) = 230
  assert.equal(result.creditNote.totalRefundAmount, 230);
  assert.equal(result.creditNote.shiftId, shiftId);
  assert.equal(result.creditNote.terminalId, 'TERM-A');

  const invRow = db.prepare('SELECT stock_on_hand FROM inventory_items WHERE sku = ?').get(sku) as { stock_on_hand: number };
  assert.equal(invRow.stock_on_hand, 7); // 5 + 2 restocked

  const movement = db.prepare(`SELECT * FROM inventory_movements WHERE sku = ? AND movement_type = 'Sale Return'`).get(sku) as any;
  assert.ok(movement, 'expected an inventory_movements row for the restock');
  assert.equal(movement.quantity, 2);
});

test('worked example: qty 3 sold, partial return of 2 succeeds, a second partial return of 2 is rejected as exceeding what remains', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  seedShift(shiftId);
  seedInventoryItem(sku, { stockOnHand: 0 });
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3, unitPrice: 100, taxRate: 15 });

  const firstReturn = issueCreditNote({
    body: {
      originalSaleNumber: saleNumber,
      refundMethod: 'CASH',
      reasonCategory: 'CUSTOMER_RETURN',
      shiftId,
      idempotencyKey: uniqueId('IDEMP'),
      returnedItems: [{ sku, returnQty: 2, unitPrice: 100, reason: 'first return', restock: true }],
    },
    staffId: 'STF-1',
    staffName: 'Cashier One',
  });
  assert.equal(firstReturn.alreadyProcessed, false);

  assert.throws(
    () =>
      issueCreditNote({
        body: {
          originalSaleNumber: saleNumber,
          refundMethod: 'CASH',
          reasonCategory: 'CUSTOMER_RETURN',
          shiftId,
          idempotencyKey: uniqueId('IDEMP'),
          returnedItems: [{ sku, returnQty: 2, unitPrice: 100, reason: 'second return', restock: true }],
        },
        staffId: 'STF-1',
        staffName: 'Cashier One',
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'RETURN_EXCEEDS_SOLD_QUANTITY'
  );

  // Only the first return's 2 units were ever restocked.
  const invRow = db.prepare('SELECT stock_on_hand FROM inventory_items WHERE sku = ?').get(sku) as { stock_on_hand: number };
  assert.equal(invRow.stock_on_hand, 2);
});

test('a single over-return (more than was ever sold) is rejected outright', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  seedShift(shiftId);
  seedInventoryItem(sku);
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3 });

  assert.throws(
    () =>
      issueCreditNote({
        body: {
          originalSaleNumber: saleNumber,
          refundMethod: 'CASH',
          reasonCategory: 'CUSTOMER_RETURN',
          shiftId,
          idempotencyKey: uniqueId('IDEMP'),
          returnedItems: [{ sku, returnQty: 4, unitPrice: 100, reason: 'too many', restock: true }],
        },
        staffId: 'STF-1',
        staffName: 'Cashier One',
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'RETURN_EXCEEDS_SOLD_QUANTITY'
  );
});

test('a quarantined (non-restock) return does not increment stock_on_hand but still records the movement', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  seedShift(shiftId);
  seedInventoryItem(sku, { stockOnHand: 5 });
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3 });

  issueCreditNote({
    body: {
      originalSaleNumber: saleNumber,
      refundMethod: 'CASH',
      reasonCategory: 'DEFECTIVE',
      shiftId,
      idempotencyKey: uniqueId('IDEMP'),
      returnedItems: [{ sku, returnQty: 1, unitPrice: 100, reason: 'damaged', restock: false }],
    },
    staffId: 'STF-1',
    staffName: 'Cashier One',
  });

  const invRow = db.prepare('SELECT stock_on_hand FROM inventory_items WHERE sku = ?').get(sku) as { stock_on_hand: number };
  assert.equal(invRow.stock_on_hand, 5); // unchanged — quarantined, not restocked

  const movement = db.prepare(`SELECT * FROM inventory_movements WHERE sku = ? AND movement_type = 'Sale Return - Quarantined'`).get(sku) as any;
  assert.ok(movement, 'expected an audit movement row even though stock was not restocked');
  assert.equal(movement.quantity, 0);
});

test('a duplicate submission with the same idempotency key is deduplicated, not double-issued or double-restocked', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  const idempotencyKey = uniqueId('IDEMP');
  seedShift(shiftId);
  seedInventoryItem(sku, { stockOnHand: 5 });
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3 });

  const params = {
    body: {
      originalSaleNumber: saleNumber,
      refundMethod: 'CASH' as const,
      reasonCategory: 'CUSTOMER_RETURN' as const,
      shiftId,
      idempotencyKey,
      returnedItems: [{ sku, returnQty: 1, unitPrice: 100, reason: 'retry test', restock: true }],
    },
    staffId: 'STF-1',
    staffName: 'Cashier One',
  };

  const first = issueCreditNote(params as any);
  assert.equal(first.alreadyProcessed, false);

  const retry = issueCreditNote(params as any);
  assert.equal(retry.alreadyProcessed, true);
  assert.equal(retry.creditNote.id, first.creditNote.id);

  const count = (db.prepare('SELECT COUNT(*) AS n FROM credit_notes WHERE idempotency_key = ?').get(idempotencyKey) as { n: number }).n;
  assert.equal(count, 1);

  const invRow = db.prepare('SELECT stock_on_hand FROM inventory_items WHERE sku = ?').get(sku) as { stock_on_hand: number };
  assert.equal(invRow.stock_on_hand, 6); // 5 + 1, not +2 — the retry never re-ran the restock
});

test('a return with no originalSaleNumber ("Direct Return") has no line to cap against and is not rejected', () => {
  const shiftId = uniqueId('SHIFT');
  const sku = uniqueId('SKU');
  seedShift(shiftId);
  seedInventoryItem(sku, { stockOnHand: 5, taxRate: 15 });

  const result = issueCreditNote({
    body: {
      refundMethod: 'CASH',
      reasonCategory: 'CUSTOMER_RETURN',
      shiftId,
      idempotencyKey: uniqueId('IDEMP'),
      returnedItems: [{ sku, returnQty: 100, unitPrice: 100, reason: 'no receipt', restock: true }],
    },
    staffId: 'STF-1',
    staffName: 'Cashier One',
  });

  assert.equal(result.alreadyProcessed, false);
  // Falls back to live inventory tax rate, no discount netting — same as before this prompt for this specific unreferenced case.
  assert.equal(result.creditNote.totalRefundAmount, 100 * 100 * 1.15);
});

test('issuing against a shift that is not OPEN is rejected', () => {
  const shiftId = uniqueId('SHIFT');
  const saleId = uniqueId('SALE');
  const saleNumber = uniqueId('INV');
  const sku = uniqueId('SKU');
  seedShift(shiftId, { status: 'CLOSED' });
  seedInventoryItem(sku);
  seedSaleWithLine(saleId, saleNumber, sku, { quantity: 3 });

  assert.throws(
    () =>
      issueCreditNote({
        body: {
          originalSaleNumber: saleNumber,
          refundMethod: 'CASH',
          reasonCategory: 'CUSTOMER_RETURN',
          shiftId,
          idempotencyKey: uniqueId('IDEMP'),
          returnedItems: [{ sku, returnQty: 1, unitPrice: 100, reason: 'x', restock: true }],
        },
        staffId: 'STF-1',
        staffName: 'Cashier One',
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'SHIFT_NOT_OPEN'
  );
});
