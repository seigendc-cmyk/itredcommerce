// DL-069/070/084 (Prompt 15): shared debtor-ledger helpers used by both the
// startup backfill and server/routes/customers.ts's read/write paths.

import type { DatabaseSync } from 'node:sqlite';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';
import { generateId, nowIso } from './ids';

export function rowToDebtorTransaction(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    accountNumber: row.account_number,
    dateTime: row.date_time,
    transactionType: row.transaction_type,
    referenceNumber: row.reference_number,
    description: row.description,
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.running_balance,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    allocatedAmount: row.allocated_amount ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
    cashierOrStaffName: row.cashier_or_staff_name ?? undefined,
  };
}

/**
 * One-time-per-customer opening-balance backfill (DL-069). Idempotent: run
 * on every server startup rather than as a manual one-shot step, since the
 * NOT EXISTS guard plus the deterministic `DTX-OPEN-<customerId>` id make a
 * repeat call a cheap no-op once every existing customer has been covered.
 * due_date is the migration/run date itself (DL-084) — no real historical
 * due date exists for a balance carried forward from before the ledger
 * existed, and backdating it would just be a different kind of invented
 * ageing data.
 */
export function backfillOpeningBalances(db: DatabaseSync): { inserted: number } {
  const candidates = db
    .prepare(
      `SELECT c.id, c.name, c.account_number, c.current_balance
       FROM customers c
       WHERE c.current_balance > 0
         AND NOT EXISTS (
           SELECT 1 FROM debtor_transactions dt
           WHERE dt.customer_id = c.id AND dt.transaction_type = 'OPENING_BALANCE'
         )`
    )
    .all() as Array<{ id: string; name: string; account_number: string; current_balance: number }>;

  if (candidates.length === 0) return { inserted: 0 };

  const dateTime = nowIso();
  const migrationDate = dateTime.slice(0, 10);

  applyBatchWithOutbox({
    db,
    tenantId: null,
    apply: () => {
      const entries: BatchEntry[] = [];
      const insertStmt = db.prepare(
        `INSERT INTO debtor_transactions (id, customer_id, customer_name, account_number, date_time, transaction_type, reference_number, description, debit, credit, running_balance, due_date, status, cashier_or_staff_name)
         VALUES (@id, @customerId, @customerName, @accountNumber, @dateTime, 'OPENING_BALANCE', @referenceNumber, @description, @debit, 0, @runningBalance, @dueDate, 'UNPAID', 'SYSTEM')`
      );
      for (const c of candidates) {
        const id = `DTX-OPEN-${c.id}`;
        const payload = {
          id,
          customerId: c.id,
          customerName: c.name,
          accountNumber: c.account_number,
          dateTime,
          referenceNumber: `OPENING-${c.id}`,
          description: 'Opening balance carried forward at debtor-ledger migration',
          debit: c.current_balance,
          runningBalance: c.current_balance,
          dueDate: migrationDate,
        };
        insertStmt.run(payload);
        entries.push({ table: 'debtor_transactions', pkColumn: 'id', pk: id, operation: 'INSERT', payload });
      }
      return { result: undefined, entries };
    },
  });

  return { inserted: candidates.length };
}

/** Default when a customer has no payment_terms_days set (flagged, not
 * silently assumed correct — see DL-085). Pulled out as a named constant so
 * a future confirmed value only needs changing in one place. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 30;

export function computeInvoiceDueDate(saleDateOnly: string, paymentTermsDays: number | null | undefined): string {
  const dueDateObj = new Date(`${saleDateOnly}T00:00:00Z`);
  dueDateObj.setUTCDate(dueDateObj.getUTCDate() + (paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS));
  return dueDateObj.toISOString().slice(0, 10);
}

/**
 * Posts a real debtor_transactions INVOICE row for a CREDIT_SALE checkout
 * (DL-069/084), closing the gap where only the deprecated
 * customers.current_balance aggregate was updated. Returns the outbox entry
 * for the caller (sales.ts, inside its own applyBatchWithOutbox) to push —
 * this function performs the INSERT but does not open its own transaction,
 * since it must run inside the sale's existing one. Returns null if the
 * customer doesn't exist (defensive; the caller already trusts customerId
 * came from an existing sale.customer reference).
 */
export function insertCreditSaleInvoice(
  db: DatabaseSync,
  params: { customerId: string; saleNumber: string; saleDateTime: string; grandTotal: number }
): BatchEntry | null {
  const { customerId, saleNumber, saleDateTime, grandTotal } = params;
  const customerRow = db
    .prepare('SELECT name, account_number, payment_terms_days FROM customers WHERE id = ?')
    .get(customerId) as { name: string; account_number: string; payment_terms_days: number | null } | undefined;
  if (!customerRow) return null;

  const dueDate = computeInvoiceDueDate(saleDateTime.slice(0, 10), customerRow.payment_terms_days);
  const invoiceId = generateId('DTX');
  const payload = {
    id: invoiceId,
    customerId,
    customerName: customerRow.name,
    accountNumber: customerRow.account_number,
    dateTime: saleDateTime,
    referenceNumber: saleNumber,
    description: `Credit sale ${saleNumber}`,
    debit: grandTotal,
    runningBalance: grandTotal,
    dueDate,
  };
  db.prepare(
    `INSERT INTO debtor_transactions (id, customer_id, customer_name, account_number, date_time, transaction_type, reference_number, description, debit, credit, running_balance, due_date, status)
     VALUES (@id, @customerId, @customerName, @accountNumber, @dateTime, 'INVOICE', @referenceNumber, @description, @debit, 0, @runningBalance, @dueDate, 'UNPAID')`
  ).run(payload);

  return { table: 'debtor_transactions', pkColumn: 'id', pk: invoiceId, operation: 'INSERT', payload };
}
