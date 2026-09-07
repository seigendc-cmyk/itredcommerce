import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDebtorAgingBuckets } from './debtorAgeing';
import type { Customer, DebtorTransaction } from '../types';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'CUST-1',
    accountNumber: 'ACC-1',
    name: 'Acme Garage',
    phone: '0770000000',
    status: 'APPROVED',
    isCreditApproved: true,
    creditLimit: 5000,
    currentBalance: 0,
    availableCredit: 5000,
    createdDate: '2026-01-01',
    ...overrides,
  } as unknown as Customer;
}

function makeTx(overrides: Partial<DebtorTransaction> = {}): DebtorTransaction {
  return {
    id: 'DTX-1',
    customerId: 'CUST-1',
    customerName: 'Acme Garage',
    accountNumber: 'ACC-1',
    dateTime: '2026-08-01 10:00',
    transactionType: 'INVOICE',
    referenceNumber: 'INV-1',
    description: 'Invoice',
    debit: 100,
    credit: 0,
    runningBalance: 100,
    status: 'UNPAID',
    ...overrides,
  } as unknown as DebtorTransaction;
}

const NOW = new Date('2026-09-07T12:00:00Z');

test('an invoice not yet due (due_date in the future) buckets into current 0-30', () => {
  const customers = [makeCustomer()];
  const transactions = [makeTx({ dueDate: '2026-09-20', runningBalance: 150 })];
  const [row] = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(row.current0To30, 150);
  assert.equal(row.days31To60, 0);
  assert.equal(row.total, 150);
});

test('an invoice 45 days past due_date buckets into 31-60', () => {
  const customers = [makeCustomer()];
  // NOW is 2026-09-07; 45 days earlier is 2026-07-24
  const transactions = [makeTx({ dueDate: '2026-07-24', runningBalance: 200 })];
  const [row] = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(row.current0To30, 0);
  assert.equal(row.days31To60, 200);
  assert.equal(row.days61To90, 0);
});

test('an invoice 120 days past due_date buckets into 90+', () => {
  const customers = [makeCustomer()];
  const transactions = [makeTx({ dueDate: '2026-05-10', runningBalance: 75 })];
  const [row] = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(row.days90Plus, 75);
  assert.equal(row.total, 75);
});

test('a fully paid invoice (running_balance 0) is excluded entirely, even though it once had debit', () => {
  const customers = [makeCustomer()];
  const transactions = [makeTx({ dueDate: '2026-05-10', runningBalance: 0, status: 'PAID' })];
  const buckets = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(buckets.length, 0);
});

test('a PAYMENT row (debit 0, credit-only) never contributes to any bucket', () => {
  const customers = [makeCustomer()];
  const transactions = [
    makeTx({ id: 'DTX-2', transactionType: 'PAYMENT', debit: 0, credit: 50, runningBalance: 0, dueDate: undefined }),
  ];
  const buckets = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(buckets.length, 0);
});

test('a partially paid invoice buckets only its remaining running_balance, not the original debit', () => {
  const customers = [makeCustomer()];
  const transactions = [makeTx({ debit: 500, runningBalance: 120, dueDate: '2026-09-01', status: 'PARTIAL' })];
  const [row] = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(row.current0To30, 120);
  assert.equal(row.total, 120);
});

test('multiple open invoices for the same customer across different buckets sum correctly per bucket and in total', () => {
  const customers = [makeCustomer()];
  const transactions = [
    makeTx({ id: 'DTX-A', dueDate: '2026-08-28', runningBalance: 100 }), // 10 days overdue -> current
    makeTx({ id: 'DTX-B', dueDate: '2026-07-24', runningBalance: 200 }), // 45 days overdue -> 31-60
    makeTx({ id: 'DTX-C', dueDate: '2026-05-10', runningBalance: 50 }),  // 120 days overdue -> 90+
  ];
  const [row] = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(row.current0To30, 100);
  assert.equal(row.days31To60, 200);
  assert.equal(row.days90Plus, 50);
  assert.equal(row.total, 350);
});

test('transactions for a customer not in the customers list are silently skipped', () => {
  const customers = [makeCustomer({ id: 'CUST-1' })];
  const transactions = [makeTx({ customerId: 'CUST-UNKNOWN' })];
  const buckets = computeDebtorAgingBuckets(customers, transactions, NOW);
  assert.equal(buckets.length, 0);
});
