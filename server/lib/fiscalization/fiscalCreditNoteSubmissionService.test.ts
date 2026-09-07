import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

process.env.DB_PATH = path.join(os.tmpdir(), `itred-fiscal-cn-submission-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

const { db } = await import('../../db/connection');
const { runMigrations } = await import('../../db/migrate');
const { queueCreditNoteForFiscalization } = await import('./fiscalCreditNoteSubmissionService');

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

function baseCreditNote(overrides: Partial<{ branchId: string }> = {}) {
  return {
    creditNoteId: uniqueId('CN'),
    creditNoteNumber: uniqueId('CN'),
    branchId: overrides.branchId ?? uniqueId('BR'),
    dateTime: '2026-09-07 10:00',
    lines: [{ description: 'Item', quantity: 1, unitPrice: 100, taxRate: 15, taxAmount: 15, lineTotal: 115 }],
    subtotal: 100,
    taxTotal: 15,
    grandTotal: 115,
  };
}

test('a branch with an ACTIVE fiscal registration gets a PENDING fiscal_credit_note_submissions row queued', () => {
  const branchId = uniqueId('BR');
  seedActiveRegistration(branchId);
  const creditNote = baseCreditNote({ branchId });

  queueCreditNoteForFiscalization(creditNote);

  const row = db.prepare('SELECT * FROM fiscal_credit_note_submissions WHERE credit_note_id = ?').get(creditNote.creditNoteId) as any;
  assert.ok(row, 'expected a fiscal_credit_note_submissions row to be inserted');
  assert.equal(row.status, 'PENDING');
  assert.equal(row.branch_id, branchId);
});

test('a branch with no fiscal registration at all is a silent no-op', () => {
  const creditNote = baseCreditNote(); // branchId never registered

  queueCreditNoteForFiscalization(creditNote);

  const row = db.prepare('SELECT * FROM fiscal_credit_note_submissions WHERE credit_note_id = ?').get(creditNote.creditNoteId) as any;
  assert.equal(row, undefined, 'no registration configured for this branch — nothing should be queued');
});

test('queueing itself never throws even if something is malformed', () => {
  // Passing a branchId that matches nothing and a minimal shape should be
  // handled gracefully — the whole point of this function is that a
  // fiscalization problem must never surface as a return failure.
  assert.doesNotThrow(() => queueCreditNoteForFiscalization(baseCreditNote()));
});
