import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyWithOutbox } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToCustomer(row: any) {
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
    currentBalance: row.current_balance,
    availableCredit: row.available_credit,
    paymentTerms: row.payment_terms,
    paymentTermsDays: row.payment_terms_days,
    createdDate: row.created_date,
    notes: row.notes,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const rows = q
      ? (db
          .prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR account_number LIKE ? ORDER BY name ASC`)
          .all(`%${q}%`, `%${q}%`, `%${q}%`) as any[])
      : (db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as any[]);
    res.json(rows.map(rowToCustomer));
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

    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.status(201).json(rowToCustomer(row));
  })
);

export default router;
