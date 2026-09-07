import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

process.env.DB_PATH = path.join(os.tmpdir(), `itred-debtor-ledger-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../db/connection');
const { runMigrations } = await import('../db/migrate');
const { backfillOpeningBalances, computeInvoiceDueDate, insertCreditSaleInvoice, DEFAULT_PAYMENT_TERMS_DAYS } = await import(
  './debtorLedger'
);

runMigrations();

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function seedCustomer(overrides: Partial<{ id: string; currentBalance: number; paymentTermsDays: number | null }> = {}) {
  const id = overrides.id ?? uniqueId('CUST');
  db.prepare(
    `INSERT INTO customers (id, account_number, name, phone, status, is_credit_approved, credit_limit, current_balance, available_credit, payment_terms_days, created_date)
     VALUES (?, ?, ?, '0770000000', 'APPROVED', 1, 5000, ?, 5000, ?, '2026-01-01')`
  ).run(id, `ACC-${id}`, `Customer ${id}`, overrides.currentBalance ?? 0, overrides.paymentTermsDays ?? null);
  return id;
}

test('computeInvoiceDueDate adds the given payment-terms days to the sale date', () => {
  assert.equal(computeInvoiceDueDate('2026-08-01', 30), '2026-08-31');
  assert.equal(computeInvoiceDueDate('2026-08-01', 15), '2026-08-16');
});

test('computeInvoiceDueDate falls back to the documented default (30 days) when payment_terms_days is null', () => {
  assert.equal(DEFAULT_PAYMENT_TERMS_DAYS, 30);
  assert.equal(computeInvoiceDueDate('2026-08-01', null), '2026-08-31');
  assert.equal(computeInvoiceDueDate('2026-08-01', undefined), '2026-08-31');
});

test('backfillOpeningBalances inserts exactly one OPENING_BALANCE row per customer with a non-zero balance', () => {
  const custWithBalance = seedCustomer({ currentBalance: 750 });
  const custZeroBalance = seedCustomer({ currentBalance: 0 });

  const result = backfillOpeningBalances(db);
  assert.ok(result.inserted >= 1);

  const row = db
    .prepare(`SELECT * FROM debtor_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'`)
    .get(custWithBalance) as any;
  assert.ok(row, 'expected an OPENING_BALANCE row for the customer with a balance');
  assert.equal(row.debit, 750);
  assert.equal(row.running_balance, 750);
  assert.equal(row.status, 'UNPAID');

  const zeroRow = db
    .prepare(`SELECT * FROM debtor_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'`)
    .get(custZeroBalance) as any;
  assert.equal(zeroRow, undefined, 'a customer with a zero balance should get no opening-balance row');
});

test('backfillOpeningBalances is idempotent: running it twice does not double-insert', () => {
  const custId = seedCustomer({ currentBalance: 300 });

  backfillOpeningBalances(db);
  const firstCount = (
    db.prepare(`SELECT COUNT(*) AS n FROM debtor_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'`).get(custId) as {
      n: number;
    }
  ).n;
  assert.equal(firstCount, 1);

  backfillOpeningBalances(db);
  const secondCount = (
    db.prepare(`SELECT COUNT(*) AS n FROM debtor_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'`).get(custId) as {
      n: number;
    }
  ).n;
  assert.equal(secondCount, 1, 're-running the backfill must not create a second row for the same customer');
});

test('insertCreditSaleInvoice posts an INVOICE row with debit/running_balance = grandTotal and a due date from payment_terms_days', () => {
  const custId = seedCustomer({ paymentTermsDays: 15 });
  const saleNumber = uniqueId('INV');

  const entry = insertCreditSaleInvoice(db, {
    customerId: custId,
    saleNumber,
    saleDateTime: '2026-09-07 10:00',
    grandTotal: 460,
  });

  assert.ok(entry);
  assert.equal(entry!.table, 'debtor_transactions');

  const row = db.prepare('SELECT * FROM debtor_transactions WHERE id = ?').get(entry!.pk) as any;
  assert.equal(row.transaction_type, 'INVOICE');
  assert.equal(row.customer_id, custId);
  assert.equal(row.reference_number, saleNumber);
  assert.equal(row.debit, 460);
  assert.equal(row.running_balance, 460);
  assert.equal(row.due_date, '2026-09-22'); // 2026-09-07 + 15 days
  assert.equal(row.status, 'UNPAID');
});

test('insertCreditSaleInvoice falls back to the default terms when the customer has no payment_terms_days set', () => {
  const custId = seedCustomer({ paymentTermsDays: null });
  const entry = insertCreditSaleInvoice(db, {
    customerId: custId,
    saleNumber: uniqueId('INV'),
    saleDateTime: '2026-09-07 10:00',
    grandTotal: 100,
  });
  const row = db.prepare('SELECT * FROM debtor_transactions WHERE id = ?').get(entry!.pk) as any;
  assert.equal(row.due_date, '2026-10-07'); // + default 30 days
});

test('insertCreditSaleInvoice returns null for an unknown customer rather than throwing', () => {
  const entry = insertCreditSaleInvoice(db, {
    customerId: 'CUST-DOES-NOT-EXIST',
    saleNumber: uniqueId('INV'),
    saleDateTime: '2026-09-07 10:00',
    grandTotal: 100,
  });
  assert.equal(entry, null);
});
