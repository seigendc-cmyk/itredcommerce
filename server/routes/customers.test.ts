import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// Prompt 15 (DL-069/070/084): recordDebtorPayment's FIFO allocation and
// idempotency are inherently about real DB side effects across multiple
// rows, so this is a genuine integration test against a real (temp,
// isolated) SQLite db, matching creditNotes.test.ts/stockTransfers.test.ts's
// convention for this codebase's write-path tests.
process.env.DB_PATH = path.join(os.tmpdir(), `itred-customers-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../db/connection');
const { runMigrations } = await import('../db/migrate');
const { recordDebtorPayment } = await import('./customers');
const { ApiError } = await import('../lib/http');

runMigrations();

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function seedCustomer(overrides: Partial<{ id: string; creditLimit: number }> = {}) {
  const id = overrides.id ?? uniqueId('CUST');
  db.prepare(
    `INSERT INTO customers (id, account_number, name, phone, status, is_credit_approved, credit_limit, current_balance, available_credit, created_date)
     VALUES (?, ?, ?, '0770000000', 'APPROVED', 1, ?, 0, ?, '2026-01-01')`
  ).run(id, `ACC-${id}`, `Customer ${id}`, overrides.creditLimit ?? 5000, overrides.creditLimit ?? 5000);
  return id;
}

function seedInvoice(customerId: string, opts: { dueDate: string; amount: number; dateTime?: string }) {
  const id = uniqueId('DTX');
  db.prepare(
    `INSERT INTO debtor_transactions (id, customer_id, customer_name, account_number, date_time, transaction_type, reference_number, description, debit, credit, running_balance, due_date, status)
     VALUES (?, ?, 'Test Customer', 'ACC-X', ?, 'INVOICE', ?, 'Invoice', ?, 0, ?, ?, 'UNPAID')`
  ).run(id, customerId, opts.dateTime ?? '2026-08-01 10:00', id, opts.amount, opts.amount, opts.dueDate);
  return id;
}

function openBalance(id: string): number {
  return (db.prepare('SELECT running_balance FROM debtor_transactions WHERE id = ?').get(id) as { running_balance: number }).running_balance;
}

test('worked example: a partial payment fully clears the older (45-day) invoice and partially clears the newer (10-day) one', () => {
  const custId = seedCustomer();
  const older = seedInvoice(custId, { dueDate: '2026-07-24', amount: 300 }); // 45 days overdue as of 2026-09-07
  const newer = seedInvoice(custId, { dueDate: '2026-08-28', amount: 200 }); // 10 days overdue

  const result = recordDebtorPayment({
    customerId: custId,
    amount: 350, // fully clears the 300 older invoice, leaves 50 applied to the newer
    method: 'CASH',
    reference: 'PAY-REC-1',
    staffName: 'Cashier One',
    idempotencyKey: uniqueId('IDEMP'),
  });

  assert.equal(result.alreadyProcessed, false);
  assert.equal(openBalance(older), 0);
  assert.equal(openBalance(newer), 150); // 200 - 50

  const olderRow = db.prepare('SELECT status FROM debtor_transactions WHERE id = ?').get(older) as { status: string };
  const newerRow = db.prepare('SELECT status FROM debtor_transactions WHERE id = ?').get(newer) as { status: string };
  assert.equal(olderRow.status, 'PAID');
  assert.equal(newerRow.status, 'PARTIAL');

  assert.equal(result.payment.credit, 350);
  assert.equal(result.payment.runningBalance, 0);
  assert.equal(result.customer.currentBalance, 150); // live-computed: 0 (older) + 150 (newer)

  const touchedIds = result.updatedInvoices.map((t) => t.id).sort();
  assert.deepEqual(touchedIds, [older, newer].sort());
});

test('a payment that exactly matches a single open invoice fully allocates and does not touch other invoices', () => {
  const custId = seedCustomer();
  const inv = seedInvoice(custId, { dueDate: '2026-09-01', amount: 100 });

  const result = recordDebtorPayment({
    customerId: custId,
    amount: 100,
    method: 'CASH',
    staffName: 'Cashier One',
    idempotencyKey: uniqueId('IDEMP'),
  });

  assert.equal(openBalance(inv), 0);
  assert.equal(result.updatedInvoices.length, 1);
  assert.equal(result.updatedInvoices[0].id, inv);
});

test('a payment exceeding the customer total outstanding balance is rejected with 400, and applies nothing', () => {
  const custId = seedCustomer();
  const inv = seedInvoice(custId, { dueDate: '2026-09-01', amount: 100 });

  assert.throws(
    () =>
      recordDebtorPayment({
        customerId: custId,
        amount: 150,
        method: 'CASH',
        staffName: 'Cashier One',
        idempotencyKey: uniqueId('IDEMP'),
      }),
    (err: unknown) => err instanceof ApiError && err.status === 400
  );

  assert.equal(openBalance(inv), 100, 'the invoice must be untouched after a rejected overpayment attempt');
});

test('a retried payment (same idempotencyKey) is not double-applied', () => {
  const custId = seedCustomer();
  const inv = seedInvoice(custId, { dueDate: '2026-09-01', amount: 200 });
  const idempotencyKey = uniqueId('IDEMP');

  const first = recordDebtorPayment({
    customerId: custId,
    amount: 80,
    method: 'CASH',
    staffName: 'Cashier One',
    idempotencyKey,
  });
  assert.equal(first.alreadyProcessed, false);
  assert.equal(openBalance(inv), 120);

  const retry = recordDebtorPayment({
    customerId: custId,
    amount: 80,
    method: 'CASH',
    staffName: 'Cashier One',
    idempotencyKey,
  });
  assert.equal(retry.alreadyProcessed, true);
  assert.equal(retry.payment.id, first.payment.id);
  assert.equal(openBalance(inv), 120, 'a retried payment must not allocate a second time');
});

test('FIFO allocation orders by due_date ascending regardless of insertion order', () => {
  const custId = seedCustomer();
  // Insert the newer-due invoice first to prove ordering comes from due_date, not row order.
  const newer = seedInvoice(custId, { dueDate: '2026-09-15', amount: 50 });
  const older = seedInvoice(custId, { dueDate: '2026-08-01', amount: 50 });

  recordDebtorPayment({
    customerId: custId,
    amount: 50,
    method: 'CASH',
    staffName: 'Cashier One',
    idempotencyKey: uniqueId('IDEMP'),
  });

  assert.equal(openBalance(older), 0, 'the earlier due_date invoice must be cleared first');
  assert.equal(openBalance(newer), 50, 'the later due_date invoice must be untouched');
});
