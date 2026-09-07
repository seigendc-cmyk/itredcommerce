import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// The fiscal-submission backfill sweep's own SQL query is the thing worth
// testing directly — see findOrphanedCompletedSales's own export comment.
process.env.DB_PATH = path.join(os.tmpdir(), `itred-fiscal-backfill-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../db/connection');
const { runMigrations } = await import('../db/migrate');
const { findOrphanedCompletedSales } = await import('./fiscalBackfillSweep');

runMigrations();

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function seedActiveRegistration(branchId: string) {
  db.prepare(
    `INSERT INTO fiscal_registration_cache (id, branch_id, country, provider_key, integration_path, status, invoice_sequence_counter)
     VALUES (?, ?, 'ZW', 'zimra_virtual', 'Virtual Fiscalisation API (FDMS)', 'ACTIVE', 0)`
  ).run(uniqueId('FISCREG'), branchId);
}

function seedCompletedSale(saleId: string, branchId: string) {
  db.prepare(
    `INSERT INTO sales_transactions (sale_id, sale_number, date_time, transaction_type, status, branch_id)
     VALUES (?, ?, '2026-09-07 10:00', 'CASH_SALE', 'COMPLETED', ?)`
  ).run(saleId, uniqueId('INV'), branchId);
}

function seedFiscalSubmission(saleId: string, branchId: string) {
  db.prepare(
    `INSERT INTO fiscal_submissions (id, branch_id, sale_id, sale_number, status, created_at)
     VALUES (?, ?, ?, ?, 'SUBMITTED', '2026-09-07 10:01')`
  ).run(uniqueId('FISC'), branchId, saleId, uniqueId('INV'));
}

test('a COMPLETED sale at an actively-fiscalized branch with no fiscal_submissions row is found as orphaned', () => {
  const branchId = uniqueId('BR');
  const saleId = uniqueId('SALE');
  seedActiveRegistration(branchId);
  seedCompletedSale(saleId, branchId);

  const orphans = findOrphanedCompletedSales();
  assert.ok(orphans.some((o) => o.sale_id === saleId), 'expected the orphaned sale to be found');
});

test('a COMPLETED sale that already has a fiscal_submissions row is not orphaned', () => {
  const branchId = uniqueId('BR');
  const saleId = uniqueId('SALE');
  seedActiveRegistration(branchId);
  seedCompletedSale(saleId, branchId);
  seedFiscalSubmission(saleId, branchId);

  const orphans = findOrphanedCompletedSales();
  assert.ok(!orphans.some((o) => o.sale_id === saleId), 'a sale with an existing submission row must not be re-flagged');
});

test('a COMPLETED sale at a branch with no active fiscal registration is not flagged', () => {
  const branchId = uniqueId('BR'); // deliberately not registered
  const saleId = uniqueId('SALE');
  seedCompletedSale(saleId, branchId);

  const orphans = findOrphanedCompletedSales();
  assert.ok(!orphans.some((o) => o.sale_id === saleId), 'fiscalization is optional for an unregistered branch — nothing to backfill');
});
