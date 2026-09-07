import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// Prompt 18 (DL-078): approve/dispatch/receive/reject's core behavior —
// stock_on_hand movement, idempotency dedup, and the reject state guard —
// is inherently about real DB side effects, not a pure calculation, so
// this mirrors creditNotes.test.ts's real-temp-SQLite integration test
// approach rather than the pure-function-test convention the rest of this
// codebase's tests follow. DB_PATH must be set before any module that
// transitively imports server/db/connection is loaded — hence the dynamic
// imports below rather than static ones (which Node hoists above this
// assignment).
process.env.DB_PATH = path.join(os.tmpdir(), `itred-stock-transfers-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../db/connection');
const { runMigrations } = await import('../db/migrate');
const { approveTransfer, dispatchTransfer, receiveTransfer, rejectTransfer } = await import('./stockTransfers');
const { ApiError } = await import('../lib/http');

runMigrations();

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function seedInventoryItem(sku: string, stockOnHand: number) {
  db.prepare(
    `INSERT INTO inventory_items (sku, name, stock_on_hand, reorder_level, unit_cost, retail_price, tax_rate, status)
     VALUES (?, ?, ?, 2, 10, 20, 15, 'In Stock')`
  ).run(sku, `Item ${sku}`, stockOnHand);
}

function currentStock(sku: string): number {
  return (db.prepare('SELECT stock_on_hand FROM inventory_items WHERE sku = ?').get(sku) as { stock_on_hand: number }).stock_on_hand;
}

function countMovements(sku: string, movementType: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM inventory_movements WHERE sku = ? AND movement_type = ?').get(sku, movementType) as { n: number }).n;
}

function seedTransfer(
  id: string,
  items: Array<{ sku: string; requestedQty: number; unitCost?: number }>,
  overrides: Partial<{ status: string }> = {}
) {
  db.prepare(
    `INSERT INTO stock_transfers (id, transfer_number, origin_location_id, origin_location_name, destination_location_id, destination_location_name, request_date, status, requested_by_staff_name)
     VALUES (?, ?, 'BR-SRC', 'Source Branch', 'BR-DST', 'Dest Branch', '2026-09-07', ?, 'Requester One')`
  ).run(id, `TRF-${id}`, overrides.status ?? 'Requested');
  const itemStmt = db.prepare(
    `INSERT INTO stock_transfer_items (transfer_id, sku, description, requested_qty, dispatched_qty, received_qty, unit_cost) VALUES (?, ?, ?, ?, 0, 0, ?)`
  );
  for (const item of items) {
    itemStmt.run(id, item.sku, `Item ${item.sku}`, item.requestedQty, item.unitCost ?? 10);
  }
}

test('worked example: 10 units dispatched when source only has 6 on hand (warning, not blocked), then received in full', () => {
  const sku = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  seedInventoryItem(sku, 6);
  seedTransfer(transferId, [{ sku, requestedQty: 10 }], { status: 'Approved' });

  // inventory_items.stock_on_hand has no per-branch split anywhere in this
  // codebase (a single tenant-wide figure per SKU) — so "before/after at
  // both branches" is really one figure that dips during transit and
  // recovers on receipt, not two independent branch totals.
  assert.equal(currentStock(sku), 6, 'before dispatch: 6 on hand');

  const dispatchResult = dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(dispatchResult.transfer.status, 'Dispatched');
  assert.equal(dispatchResult.transfer.hasDispatchStockWarning, true);
  assert.deepEqual(dispatchResult.dispatchWarnings, [{ sku, requestedQty: 10, stockOnHandBeforeDispatch: 6, shortfallQty: 4 }]);
  assert.equal(currentStock(sku), -4, 'after dispatch: 6 - 10 = -4 (uncapped, visible for reconciliation)');

  const outMovement = db.prepare(`SELECT * FROM inventory_movements WHERE sku = ? AND movement_type = 'Transfer Out'`).get(sku) as any;
  assert.ok(outMovement, 'expected a Transfer Out ledger row');
  assert.equal(outMovement.quantity, -10);

  const receiveResult = receiveTransfer({ transferId, staffId: 'STF-2', staffName: 'Receiver One', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(receiveResult.transfer.status, 'Received');
  assert.equal(currentStock(sku), 6, 'after receive: -4 + 10 = 6 (back to the original total, goods relocated not lost)');

  const inMovement = db.prepare(`SELECT * FROM inventory_movements WHERE sku = ? AND movement_type = 'Transfer In'`).get(sku) as any;
  assert.ok(inMovement, 'expected a Transfer In ledger row');
  assert.equal(inMovement.quantity, 10);
});

test('a multi-line transfer decrements each line at dispatch and increments each line at receive', () => {
  const skuA = uniqueId('SKU');
  const skuB = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  seedInventoryItem(skuA, 20);
  seedInventoryItem(skuB, 15);
  seedTransfer(transferId, [{ sku: skuA, requestedQty: 5 }, { sku: skuB, requestedQty: 3 }], { status: 'Approved' });

  const dispatchResult = dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(dispatchResult.dispatchWarnings.length, 0, 'sufficient stock on both lines — no warning');
  assert.equal(currentStock(skuA), 15);
  assert.equal(currentStock(skuB), 12);

  receiveTransfer({ transferId, staffId: 'STF-2', staffName: 'Receiver One', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(currentStock(skuA), 20);
  assert.equal(currentStock(skuB), 15);
});

test('idempotent retry of dispatch with the same key does not double-decrement stock or duplicate the movement row', () => {
  const sku = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  const idempotencyKey = uniqueId('IDEMP');
  seedInventoryItem(sku, 20);
  seedTransfer(transferId, [{ sku, requestedQty: 5 }], { status: 'Approved' });

  const first = dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey });
  assert.equal(first.alreadyProcessed, false);

  const retry = dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey });
  assert.equal(retry.alreadyProcessed, true);

  assert.equal(currentStock(sku), 15, '20 - 5, not 20 - 10 — the retry never re-ran the decrement');
  assert.equal(countMovements(sku, 'Transfer Out'), 1);
});

test('idempotent retry of receive with the same key does not double-increment stock or duplicate the movement row', () => {
  const sku = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  const receiveKey = uniqueId('IDEMP');
  seedInventoryItem(sku, 20);
  seedTransfer(transferId, [{ sku, requestedQty: 5 }], { status: 'Approved' });
  dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') });

  const first = receiveTransfer({ transferId, staffId: 'STF-2', staffName: 'Receiver One', idempotencyKey: receiveKey });
  assert.equal(first.alreadyProcessed, false);

  const retry = receiveTransfer({ transferId, staffId: 'STF-2', staffName: 'Receiver One', idempotencyKey: receiveKey });
  assert.equal(retry.alreadyProcessed, true);

  assert.equal(currentStock(sku), 20, '15 + 5, not 15 + 10 — the retry never re-ran the increment');
  assert.equal(countMovements(sku, 'Transfer In'), 1);
});

test('idempotent retry of approve is a no-op on the second call', () => {
  const transferId = uniqueId('TRF');
  const idempotencyKey = uniqueId('IDEMP');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Requested' });

  const first = approveTransfer({ transferId, staffName: 'Approver One', idempotencyKey });
  assert.equal(first.alreadyProcessed, false);
  assert.equal(first.transfer.status, 'Approved');

  const retry = approveTransfer({ transferId, staffName: 'Approver One', idempotencyKey });
  assert.equal(retry.alreadyProcessed, true);
  assert.equal(retry.transfer.status, 'Approved');
});

test('idempotent retry of reject is a no-op on the second call', () => {
  const transferId = uniqueId('TRF');
  const idempotencyKey = uniqueId('IDEMP');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Requested' });

  const first = rejectTransfer({ transferId, reason: 'no capacity', idempotencyKey });
  assert.equal(first.alreadyProcessed, false);
  assert.equal(first.transfer.status, 'Rejected');

  const retry = rejectTransfer({ transferId, reason: 'no capacity', idempotencyKey });
  assert.equal(retry.alreadyProcessed, true);
});

test('reject succeeds from Requested', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Requested' });
  const result = rejectTransfer({ transferId, reason: 'test', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(result.transfer.status, 'Rejected');
});

test('reject succeeds from Approved', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Approved' });
  const result = rejectTransfer({ transferId, reason: 'test', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(result.transfer.status, 'Rejected');
});

test('reject is refused on a Dispatched transfer — goods are already in transit, no reversal exists', () => {
  const sku = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  seedInventoryItem(sku, 20);
  seedTransfer(transferId, [{ sku, requestedQty: 5 }], { status: 'Approved' });
  dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') });
  assert.equal(currentStock(sku), 15);

  assert.throws(
    () => rejectTransfer({ transferId, reason: 'changed mind', idempotencyKey: uniqueId('IDEMP') }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_TRANSFER_STATE'
  );

  // Confirms the guard actually blocked it — status and stock untouched.
  const row = db.prepare('SELECT status FROM stock_transfers WHERE id = ?').get(transferId) as { status: string };
  assert.equal(row.status, 'Dispatched');
  assert.equal(currentStock(sku), 15);
});

test('reject is refused on a Received transfer', () => {
  const sku = uniqueId('SKU');
  const transferId = uniqueId('TRF');
  seedInventoryItem(sku, 20);
  seedTransfer(transferId, [{ sku, requestedQty: 5 }], { status: 'Approved' });
  dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') });
  receiveTransfer({ transferId, staffId: 'STF-2', staffName: 'Receiver One', idempotencyKey: uniqueId('IDEMP') });

  assert.throws(
    () => rejectTransfer({ transferId, reason: 'too late', idempotencyKey: uniqueId('IDEMP') }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_TRANSFER_STATE'
  );
});

test('dispatch is refused unless the transfer is Approved', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Requested' });

  assert.throws(
    () => dispatchTransfer({ transferId, staffId: 'STF-1', staffName: 'Dispatcher One', idempotencyKey: uniqueId('IDEMP') }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_TRANSFER_STATE'
  );
});

test('receive is refused unless the transfer is Dispatched', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Approved' });

  assert.throws(
    () => receiveTransfer({ transferId, staffId: 'STF-1', staffName: 'Receiver One', idempotencyKey: uniqueId('IDEMP') }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_TRANSFER_STATE'
  );
});

test('approve is refused unless the transfer is Requested', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Approved' });

  assert.throws(
    () => approveTransfer({ transferId, staffName: 'Approver One', idempotencyKey: uniqueId('IDEMP') }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_TRANSFER_STATE'
  );
});

test('a missing idempotencyKey is rejected with a 400, not silently allowed through', () => {
  const transferId = uniqueId('TRF');
  seedTransfer(transferId, [{ sku: uniqueId('SKU'), requestedQty: 1 }], { status: 'Requested' });

  assert.throws(
    () => approveTransfer({ transferId, staffName: 'Approver One', idempotencyKey: '' as any }),
    (err: unknown) => err instanceof ApiError && err.status === 400
  );
});
