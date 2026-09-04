import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

// End-of-day reconciliation — aggregates already-CLOSED shifts' frozen
// totals (populated at shift-close time from shiftReconciliation.ts's
// immutable snapshot, see server/routes/shifts.ts) rather than
// recomputing anything from raw sales_transactions. This is what "reconcile
// against shiftReconciliation.ts, which must remain immutable/versioned"
// requires: EOD never second-guesses a closed shift's numbers, it only sums
// them.
//
// KNOWN LIMITATION (flagged, not fixed here — see
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Branch Terminal Core Flows
// addendum): shifts.total_refunds / total_payouts / total_layaway_receipts
// are never populated by any real write path today — credit notes (returns)
// live in their own ledger with no link back to the issuing shift, and
// there is no cash-payout feature anywhere in this codebase. REFUNDS and
// PAYOUTS will therefore always aggregate to $0.00 here, understating what
// a manager actually needs to reconcile. The client surfaces this
// explicitly rather than presenting a falsely-complete number.
const router = Router();
router.use(requireAuth);

const EOD_CATEGORIES: { category: string; label: string; shiftColumn: string }[] = [
  { category: 'CASH', label: 'Cash Tender (Floats + Sales)', shiftColumn: 'total_cash_sales' },
  { category: 'MOBILE_MONEY', label: 'Mobile Money (EcoCash / OneMoney)', shiftColumn: 'total_mobile_money_sales' },
  { category: 'CARD_BANK', label: 'Bank Debit & Credit Cards', shiftColumn: 'total_card_sales' },
  { category: 'CREDIT_SALES', label: 'Commercial Customer Credit Sales', shiftColumn: 'total_credit_sales' },
  { category: 'LAYAWAYS', label: 'Layaway Installment Receipts', shiftColumn: 'total_layaway_receipts' },
  { category: 'REFUNDS', label: 'Sales Returns & Refunds Paid Out', shiftColumn: 'total_refunds' },
  { category: 'PAYOUTS', label: 'Petty Cash Disbursements / Payouts', shiftColumn: 'total_payouts' },
];

function loadExpectedAmounts(branchId: string, date: string) {
  const closedShifts = db
    .prepare(`SELECT * FROM shifts WHERE branch_id = ? AND status = 'CLOSED' AND opening_date = ?`)
    .all(branchId, date) as any[];

  const expected: Record<string, number> = {};
  for (const cat of EOD_CATEGORIES) {
    expected[cat.category] = closedShifts.reduce((sum, s) => sum + (Number(s[cat.shiftColumn]) || 0), 0);
  }
  const grossSales = closedShifts.reduce((sum, s) => sum + (Number(s.gross_sales) || 0), 0);

  const openTillsCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM shifts WHERE branch_id = ? AND status IN ('OPEN', 'REQUIRES_CLOSURE')`).get(branchId) as any
  ).c;

  return { expected, grossSales, closedShiftsCount: closedShifts.length, openTillsCount };
}

router.get(
  '/reconciliation',
  asyncHandler(async (req, res) => {
    const { branchId, date } = req.query as { branchId?: string; date?: string };
    if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

    const { expected, grossSales, closedShiftsCount, openTillsCount } = loadExpectedAmounts(branchId, date);

    res.json({
      branchId,
      date,
      grossSales,
      closedShiftsCount,
      openTillsCount,
      reconciliation: EOD_CATEGORIES.map((c) => ({
        category: c.category,
        label: c.label,
        expectedAmount: expected[c.category],
      })),
    });
  })
);

function rowToEodReport(row: any, entries: any[]) {
  return {
    id: row.id,
    reportNumber: row.report_number,
    date: row.date,
    branchId: row.branch_id,
    branchName: row.branch_name,
    terminalId: row.terminal_id,
    terminalName: row.terminal_name,
    generatedByStaffId: row.generated_by_staff_id,
    generatedByStaffName: row.generated_by_staff_name,
    status: row.status,
    reconciliation: entries.map((e) => ({
      category: e.category,
      label: e.label,
      expectedAmount: e.expected_amount,
      countedAmount: e.counted_amount,
      variance: e.variance,
      notes: e.notes,
    })),
    totalSales: row.total_sales,
    totalCashExpected: row.total_cash_expected,
    totalCashCounted: row.total_cash_counted,
    totalVariance: row.total_variance,
    unresolvedHeldSalesCount: row.unresolved_held_sales_count,
    unresolvedHeldSalesValue: row.unresolved_held_sales_value,
    unapprovedRefundsCount: row.unapproved_refunds_count,
    unapprovedRefundsValue: row.unapproved_refunds_value,
    openTillsCount: row.open_tills_count,
    pendingStockAdjustmentsCount: row.pending_stock_adjustments_count,
    managerApprovedBy: row.manager_approved_by,
    managerApprovalDate: row.manager_approval_date,
    managerNotes: row.manager_notes,
    createdDateTime: row.created_date_time,
  };
}

router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const { branchId } = req.query as { branchId?: string };
    const clause = branchId ? 'WHERE branch_id = @branchId' : '';
    const rows = db.prepare(`SELECT * FROM eod_reports ${clause} ORDER BY created_date_time DESC LIMIT 200`).all({ branchId }) as any[];
    const entriesStmt = db.prepare('SELECT * FROM eod_reconciliation_entries WHERE eod_report_id = ?');
    res.json(rows.map((row) => rowToEodReport(row, entriesStmt.all(row.id) as any[])));
  })
);

interface FinalizeBody {
  branchId: string;
  branchName: string;
  date: string;
  countedEntries: Record<string, number>;
  entryNotes?: Record<string, string>;
  managerNotes?: string;
  managerApproved?: boolean;
  unresolvedHeldSalesCount?: number;
  unresolvedHeldSalesValue?: number;
  unapprovedRefundsCount?: number;
  unapprovedRefundsValue?: number;
  pendingStockAdjustmentsCount?: number;
}

router.post(
  '/reports',
  asyncHandler(async (req, res) => {
    const body = req.body as FinalizeBody;
    if (!body?.branchId || !body.date || !body.countedEntries) {
      throw new ApiError(400, 'branchId, date and countedEntries are required');
    }
    const staff = req.currentStaff!;

    // Expected amounts are always recomputed server-side from real closed
    // shifts — the client only ever supplies counted (physically verified)
    // amounts and notes, never expected ones, so a stale/tampered client
    // value can't misstate what the system actually recorded.
    const { expected, grossSales, openTillsCount } = loadExpectedAmounts(body.branchId, body.date);

    const reconciliation = EOD_CATEGORIES.map((c) => {
      const expectedAmount = expected[c.category];
      const countedAmount = body.countedEntries[c.category] ?? expectedAmount;
      return {
        category: c.category,
        label: c.label,
        expectedAmount,
        countedAmount,
        variance: countedAmount - expectedAmount,
        notes: body.entryNotes?.[c.category] ?? null,
      };
    });

    const totalVariance = reconciliation.reduce((sum, r) => sum + r.variance, 0);
    const hasVariance = Math.abs(totalVariance) > 0.01;
    const status = hasVariance ? 'DISCREPANCY_FLAGGED' : body.managerApproved ? 'APPROVED' : 'SUBMITTED';

    const id = generateId('EOD');
    const reportNumber = `EOD-${body.date.replace(/-/g, '')}-${body.branchId}`;
    const createdDateTime = nowIso();
    const cashEntry = reconciliation.find((r) => r.category === 'CASH')!;

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        db.prepare(
          `INSERT INTO eod_reports (id, report_number, date, branch_id, branch_name, terminal_id, terminal_name,
             generated_by_staff_id, generated_by_staff_name, status, total_sales, total_cash_expected,
             total_cash_counted, total_variance, unresolved_held_sales_count, unresolved_held_sales_value,
             unapproved_refunds_count, unapproved_refunds_value, open_tills_count, pending_stock_adjustments_count,
             manager_approved_by, manager_approval_date, manager_notes, created_date_time)
           VALUES (@id, @reportNumber, @date, @branchId, @branchName, 'ALL_CONSOLIDATED', 'Consolidated Branch Terminals',
             @generatedByStaffId, @generatedByStaffName, @status, @totalSales, @totalCashExpected,
             @totalCashCounted, @totalVariance, @unresolvedHeldSalesCount, @unresolvedHeldSalesValue,
             @unapprovedRefundsCount, @unapprovedRefundsValue, @openTillsCount, @pendingStockAdjustmentsCount,
             @managerApprovedBy, @managerApprovalDate, @managerNotes, @createdDateTime)`
        ).run({
          id,
          reportNumber,
          date: body.date,
          branchId: body.branchId,
          branchName: body.branchName ?? body.branchId,
          generatedByStaffId: staff.id,
          generatedByStaffName: staff.name,
          status,
          totalSales: grossSales,
          totalCashExpected: cashEntry.expectedAmount,
          totalCashCounted: cashEntry.countedAmount,
          totalVariance,
          unresolvedHeldSalesCount: body.unresolvedHeldSalesCount ?? 0,
          unresolvedHeldSalesValue: body.unresolvedHeldSalesValue ?? 0,
          unapprovedRefundsCount: body.unapprovedRefundsCount ?? 0,
          unapprovedRefundsValue: body.unapprovedRefundsValue ?? 0,
          openTillsCount,
          pendingStockAdjustmentsCount: body.pendingStockAdjustmentsCount ?? 0,
          managerApprovedBy: body.managerApproved ? staff.name : null,
          managerApprovalDate: body.managerApproved ? createdDateTime : null,
          managerNotes: body.managerNotes?.trim() || null,
          createdDateTime,
        });

        const entries: BatchEntry[] = [
          { table: 'eod_reports', pkColumn: 'id', pk: id, operation: 'INSERT', payload: { id } },
        ];

        const insertEntry = db.prepare(
          `INSERT INTO eod_reconciliation_entries (eod_report_id, category, label, expected_amount, counted_amount, variance, notes)
           VALUES (@eodReportId, @category, @label, @expectedAmount, @countedAmount, @variance, @notes)`
        );
        for (const r of reconciliation) {
          insertEntry.run({ eodReportId: id, ...r });
          const rowId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'eod_reconciliation_entries', pkColumn: 'id', pk: rowId, operation: 'INSERT', payload: { id: rowId, eodReportId: id } });
        }

        return { result: undefined, entries };
      },
    });

    const row = db.prepare('SELECT * FROM eod_reports WHERE id = ?').get(id);
    const entries = db.prepare('SELECT * FROM eod_reconciliation_entries WHERE eod_report_id = ?').all(id);
    res.status(201).json(rowToEodReport(row, entries as any[]));
  })
);

export default router;
