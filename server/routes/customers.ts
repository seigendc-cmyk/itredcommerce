import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyWithOutbox, applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';
import { rowToDebtorTransaction } from '../lib/debtorLedger';

const router = Router();
router.use(requireAuth);

// DL-084: current_balance/available_credit/overdue_amount are deprecated
// stored aggregates — computed live here from debtor_transactions instead,
// so every reader (checkout credit-limit check, DebtorsView, executive
// rollups eventually) sees the real ledger rather than a column that
// nothing keeps in sync. The columns themselves are left in place (not
// dropped) per DL-084, for one release cycle, in case something still reads
// them directly — nothing in this codebase does; see the Prompt 15 report.
const CUSTOMERS_WITH_LIVE_BALANCE_SQL = `
  SELECT c.*,
    COALESCE(b.live_balance, 0) AS live_current_balance,
    COALESCE(b.live_overdue, 0) AS live_overdue_amount
  FROM customers c
  LEFT JOIN (
    SELECT customer_id,
      SUM(running_balance) AS live_balance,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < date('now') THEN running_balance ELSE 0 END) AS live_overdue
    FROM debtor_transactions
    GROUP BY customer_id
  ) b ON b.customer_id = c.id
`;

function rowToCustomer(row: any) {
  const currentBalance = row.live_current_balance ?? row.current_balance ?? 0;
  const overdueAmount = row.live_overdue_amount ?? row.overdue_amount ?? 0;
  return {
    id: row.id,
    accountNumber: row.account_number,
    name: row.name,
    companyName: row.company_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    taxNumber: row.tax_number,
    taxExempt: !!row.tax_exempt,
    taxExemptionCertNumber: row.tax_exemption_cert_number,
    status: row.status,
    creditStatus: row.credit_status,
    debtorStatus: row.debtor_status,
    isCreditApproved: !!row.is_credit_approved,
    creditLimit: row.credit_limit,
    currentBalance,
    availableCredit: Math.max(0, (row.credit_limit ?? 0) - currentBalance),
    overdueAmount,
    paymentTerms: row.payment_terms,
    paymentTermsDays: row.payment_terms_days,
    createdDate: row.created_date,
    notes: row.notes,
  };
}

function loadCustomerLive(id: string) {
  const row = db.prepare(`${CUSTOMERS_WITH_LIVE_BALANCE_SQL} WHERE c.id = ?`).get(id) as any;
  return row ? rowToCustomer(row) : null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const rows = q
      ? (db
          .prepare(`${CUSTOMERS_WITH_LIVE_BALANCE_SQL} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.account_number LIKE ? ORDER BY c.name ASC`)
          .all(`%${q}%`, `%${q}%`, `%${q}%`) as any[])
      : (db.prepare(`${CUSTOMERS_WITH_LIVE_BALANCE_SQL} ORDER BY c.name ASC`).all() as any[]);
    res.json(rows.map(rowToCustomer));
  })
);

// Full debtor-ledger row set — this app's offline-first head-office views
// load everything into local state up front (same pattern as /inventory/items
// and this router's own GET /), matching DL-084's decision that DebtorsView
// computes ageing locally rather than depending on connectivity.
router.get(
  '/debtor-transactions',
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT * FROM debtor_transactions ORDER BY date_time DESC').all() as any[];
    res.json(rows.map(rowToDebtorTransaction));
  })
);

// Walk-in customer registration at the point of sale (CustomerSelectorModal's
// "create new"). Non-balance fields only — this is CONFIG-category data per
// DL-007, not a debtor-ledger operation. Cashier-created accounts default to
// PENDING_APPROVAL with no credit authorized — cashiers can't grant credit
// facilities, only a store manager can, matching the pre-existing UI policy.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, phone, email, companyName, address, taxNumber, notes } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      companyName?: string;
      address?: string;
      taxNumber?: string;
      notes?: string;
    };
    if (!name || !phone) {
      throw new ApiError(400, 'name and phone are required');
    }

    const id = generateId('CUST');
    const accountNumber = generateId('ACC');
    const createdDate = nowIso().slice(0, 10);
    const staff = req.currentStaff!;

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'customers',
      pkColumn: 'id',
      pk: id,
      operation: 'INSERT',
      payload: { id, accountNumber, name, phone, email: email ?? null, companyName: companyName ?? null, address: address ?? null, createdDate },
      apply: () => {
        db.prepare(
          `INSERT INTO customers (id, account_number, name, company_name, phone, email, address, tax_number, status, is_credit_approved, credit_limit, current_balance, available_credit, created_date, created_by_staff_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', 0, 0, 0, 0, ?, ?, ?)`
        ).run(
          id,
          accountNumber,
          name,
          companyName ?? null,
          phone,
          email ?? null,
          address ?? null,
          taxNumber ?? null,
          createdDate,
          staff.id,
          notes ?? `Registered at POS by ${staff.name}. Pending credit approval.`
        );
      },
    });

    res.status(201).json(loadCustomerLive(id));
  })
);

// ============================================================
// PAYMENT RECORDING (DL-069/070/084, Prompt 15) — replaces DebtorsView's
// setState-only handleRecordPayment, which never persisted anywhere. Posts
// a real PAYMENT debtor_transactions row and allocates it FIFO (oldest
// due_date first) against this customer's open (debit > 0, running_balance
// > 0) rows, atomically via applyBatchWithOutbox. A payment that would
// exceed the customer's total outstanding balance is rejected outright
// (400) rather than silently creating a credit balance — overpayment
// handling isn't part of this prompt's scope; see the Prompt 15 report.
// ============================================================
export interface RecordDebtorPaymentParams {
  customerId: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  staffName: string;
  idempotencyKey: string;
}

function isDebtorPaymentIdempotencyRace(err: any): boolean {
  return typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('idempotency_key');
}

function loadDebtorPaymentResult(paymentId: string, customerId: string, alreadyProcessed: boolean, updatedInvoiceIds: string[] = []) {
  const paymentRow = db.prepare('SELECT * FROM debtor_transactions WHERE id = ?').get(paymentId) as any;
  const updatedInvoices = updatedInvoiceIds.map((id) =>
    rowToDebtorTransaction(db.prepare('SELECT * FROM debtor_transactions WHERE id = ?').get(id))
  );
  return {
    payment: rowToDebtorTransaction(paymentRow),
    updatedInvoices,
    customer: loadCustomerLive(customerId)!,
    alreadyProcessed,
  };
}

export function recordDebtorPayment(params: RecordDebtorPaymentParams) {
  const { customerId, amount, method, reference, notes, staffName, idempotencyKey } = params;
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new ApiError(400, 'idempotencyKey is required');
  }
  if (!(amount > 0)) {
    throw new ApiError(400, 'amount must be greater than zero');
  }

  const existing = db.prepare('SELECT id FROM debtor_transactions WHERE idempotency_key = ?').get(idempotencyKey) as
    | { id: string }
    | undefined;
  if (existing) {
    return loadDebtorPaymentResult(existing.id, customerId, true);
  }

  const customerRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  if (!customerRow) throw new ApiError(404, 'Customer not found');

  // FIFO by due_date, oldest first; date_time as a tiebreaker for same-day
  // due dates. "Open" is defined by the ledger semantics (debit > 0 = an
  // invoice/opening-balance row) rather than a hardcoded transaction_type
  // list, so it keeps working if another debit-side type is added later.
  const openRows = db
    .prepare(
      `SELECT * FROM debtor_transactions
       WHERE customer_id = ? AND debit > 0 AND running_balance > 0.0001
       ORDER BY (due_date IS NULL) ASC, due_date ASC, date_time ASC`
    )
    .all(customerId) as any[];

  const totalOpen = Math.round(openRows.reduce((sum, r) => sum + r.running_balance, 0) * 100) / 100;
  const roundedAmount = Math.round(amount * 100) / 100;
  if (roundedAmount > totalOpen + 0.01) {
    throw new ApiError(
      400,
      `Payment amount ($${roundedAmount.toFixed(2)}) exceeds this customer's total outstanding balance ($${totalOpen.toFixed(2)})`,
      'PAYMENT_EXCEEDS_BALANCE'
    );
  }

  const dateTime = nowIso();
  const paymentId = generateId('DTX');
  const updatedInvoiceIds: string[] = [];
  const referenceNumber = reference?.trim() || paymentId;

  applyBatchWithOutbox({
    db,
    tenantId: null,
    apply: () => {
      const entries: BatchEntry[] = [];
      let remaining = roundedAmount;

      const updateStmt = db.prepare('UPDATE debtor_transactions SET running_balance = ?, status = ? WHERE id = ?');
      for (const row of openRows) {
        if (remaining <= 0.0001) break;
        const applied = Math.min(remaining, row.running_balance);
        const newBalance = Math.round((row.running_balance - applied) * 100) / 100;
        const newStatus = newBalance <= 0.0001 ? 'PAID' : 'PARTIAL';
        updateStmt.run(newBalance, newStatus, row.id);
        remaining = Math.round((remaining - applied) * 100) / 100;
        updatedInvoiceIds.push(row.id);
        entries.push({
          table: 'debtor_transactions',
          pkColumn: 'id',
          pk: row.id,
          operation: 'UPDATE',
          payload: { id: row.id, runningBalance: newBalance, status: newStatus },
        });
      }

      const paymentPayload = {
        id: paymentId,
        customerId,
        customerName: customerRow.name,
        accountNumber: customerRow.account_number,
        dateTime,
        referenceNumber,
        description: notes?.trim() || 'Customer account settlement payment',
        debit: 0,
        credit: roundedAmount,
        runningBalance: 0,
        status: 'PAID',
        paymentMethod: method,
        cashierOrStaffName: staffName,
        idempotencyKey,
      };
      db.prepare(
        `INSERT INTO debtor_transactions (id, customer_id, customer_name, account_number, date_time, transaction_type, reference_number, description, debit, credit, running_balance, status, payment_method, cashier_or_staff_name, idempotency_key)
         VALUES (@id, @customerId, @customerName, @accountNumber, @dateTime, 'PAYMENT', @referenceNumber, @description, @debit, @credit, @runningBalance, @status, @paymentMethod, @cashierOrStaffName, @idempotencyKey)`
      ).run(paymentPayload);
      entries.push({ table: 'debtor_transactions', pkColumn: 'id', pk: paymentId, operation: 'INSERT', payload: paymentPayload });

      const lastPaymentDate = dateTime.slice(0, 10);
      db.prepare(
        `UPDATE customers SET last_payment_date = ?, last_payment_amount = ?, last_payment_ref = ? WHERE id = ?`
      ).run(lastPaymentDate, roundedAmount, referenceNumber, customerId);
      entries.push({
        table: 'customers',
        pkColumn: 'id',
        pk: customerId,
        operation: 'UPDATE',
        payload: { id: customerId, lastPaymentDate, lastPaymentAmount: roundedAmount, lastPaymentRef: referenceNumber },
      });

      return { result: undefined, entries };
    },
  });

  return loadDebtorPaymentResult(paymentId, customerId, false, updatedInvoiceIds);
}

router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const staff = req.currentStaff!;
    const { amount, method, reference, notes, idempotencyKey } = req.body as {
      amount?: number;
      method?: string;
      reference?: string;
      notes?: string;
      idempotencyKey?: string;
    };
    try {
      const result = recordDebtorPayment({
        customerId: req.params.id,
        amount: Number(amount),
        method: method || 'CASH',
        reference,
        notes,
        staffName: staff.name,
        idempotencyKey: idempotencyKey!,
      });
      res.json(result);
    } catch (err: any) {
      if (isDebtorPaymentIdempotencyRace(err)) {
        const winning = db.prepare('SELECT id FROM debtor_transactions WHERE idempotency_key = ?').get(idempotencyKey) as
          | { id: string }
          | undefined;
        if (winning) {
          res.json(loadDebtorPaymentResult(winning.id, req.params.id, true));
          return;
        }
      }
      throw err;
    }
  })
);

export default router;
