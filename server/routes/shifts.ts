import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, generateDocumentNumber, nowIso } from '../lib/ids';
import { applyWithOutbox, applyBatchWithOutbox, assertUpdateAllowed, ImmutabilityViolationError, type BatchEntry } from '../sync/outboxWriter';
import {
  buildImmutableReconciliationSnapshot,
  createOperationalExceptionFromVariance,
} from '../../src/utils/shiftReconciliation';
import type { Shift, SaleTransaction, HeldSale, StaffMember, CashUpMode, TenderReconciliationEntry } from '../../src/types';

const router = Router();
router.use(requireAuth);

function rowToShift(row: any): Shift {
  return {
    id: row.id,
    shiftNumber: row.shift_number,
    terminalId: row.terminal_id,
    terminalName: row.terminal_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    cashierStaffId: row.cashier_staff_id,
    cashierStaffName: row.cashier_staff_name,
    openedDateTime: row.opened_date_time,
    openingDate: row.opening_date,
    openingFloat: row.opening_float,
    openingNotes: row.opening_notes,
    closedDateTime: row.closed_date_time,
    closingFloat: row.closing_float,
    status: row.status,
    expectedCash: row.expected_cash,
    countedCash: row.counted_cash,
    cashVariance: row.cash_variance,
    cashVarianceTolerance: row.cash_variance_tolerance,
    cashUpMode: row.cash_up_mode,
    closePolicy: row.close_policy,
    totalSalesCount: row.total_sales_count,
    grossSales: row.gross_sales,
    totalCashSales: row.total_cash_sales,
    totalMobileMoneySales: row.total_mobile_money_sales,
    totalCardSales: row.total_card_sales,
    totalCreditSales: row.total_credit_sales,
    totalRefunds: row.total_refunds,
    totalPayouts: row.total_payouts,
    totalHeldSales: row.total_held_sales,
    totalLayawayReceipts: row.total_layaway_receipts,
    tenderReconciliation: row.tender_reconciliation ? JSON.parse(row.tender_reconciliation) : undefined,
    cashMovements: row.cash_movements ? JSON.parse(row.cash_movements) : undefined,
    reconciliationSnapshot: row.reconciliation_snapshot ? JSON.parse(row.reconciliation_snapshot) : undefined,
    closureReasonCode: row.closure_reason_code,
    cashDiscrepancySeverity: row.cash_discrepancy_severity,
    closingNotes: row.closing_notes,
    approvedByStaffName: row.approved_by_staff_name,
    approvedDateTime: row.approved_date_time,
  };
}

// Only the fields computeShiftTenderMetrics/buildImmutableReconciliationSnapshot
// actually read (terminalId, status, grandTotal, payments, transactionType) —
// deliberately under-populated vs. the full SaleTransaction shape, since this
// array is built purely to feed those pure functions and never leaves this route.
function rowToSaleForMetrics(row: any): SaleTransaction {
  return {
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    dateTime: row.date_time,
    grandTotal: row.grand_total,
    changeGiven: row.change_given,
    subtotal: row.subtotal,
    taxTotal: row.tax_total,
    discountTotal: row.discount_total,
    transactionType: row.transaction_type,
    status: row.status,
    terminalId: row.terminal_id,
    payments: (row.paymentsJson ? JSON.parse(row.paymentsJson) : []),
  } as unknown as SaleTransaction;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { terminalId, openingFloat, openingNotes } = req.body as {
      terminalId?: string;
      openingFloat?: number;
      openingNotes?: string;
    };
    if (!terminalId || typeof openingFloat !== 'number') {
      throw new ApiError(400, 'terminalId and openingFloat are required');
    }

    const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(terminalId) as any;
    if (!terminal) {
      throw new ApiError(404, 'Unknown terminal', 'TERMINAL_NOT_FOUND');
    }

    const openShift = db
      .prepare(`SELECT id FROM shifts WHERE terminal_id = ? AND status IN ('OPEN', 'REQUIRES_CLOSURE')`)
      .get(terminalId);
    if (openShift) {
      throw new ApiError(409, 'A shift is already open on this terminal', 'SHIFT_ALREADY_OPEN');
    }

    const id = generateId('SHIFT');
    const shiftNumber = generateDocumentNumber('SHIFT');
    const openedDateTime = nowIso();
    const openingDate = openedDateTime.slice(0, 10);
    const staff = req.currentStaff!;

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'shifts',
      pkColumn: 'id',
      pk: id,
      operation: 'INSERT',
      payload: { id, shiftNumber, terminalId, openingFloat, openingNotes: openingNotes ?? null, openedDateTime },
      apply: () => {
        db.prepare(
          `INSERT INTO shifts (id, shift_number, terminal_id, terminal_name, branch_id, branch_name, cashier_staff_id, cashier_staff_name, opened_date_time, opening_date, opening_float, opening_notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`
        ).run(id, shiftNumber, terminalId, terminal.name, terminal.branch_id, terminal.branch_name, staff.id, staff.name, openedDateTime, openingDate, openingFloat, openingNotes ?? null);
      },
    });

    const row = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
    res.status(201).json(rowToShift(row));
  })
);

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const terminalId = req.query.terminalId as string | undefined;
    if (!terminalId) throw new ApiError(400, 'terminalId is required');
    const row = db
      .prepare(`SELECT * FROM shifts WHERE terminal_id = ? AND status IN ('OPEN', 'REQUIRES_CLOSURE') ORDER BY opened_date_time DESC LIMIT 1`)
      .get(terminalId);
    res.json(row ? rowToShift(row) : null);
  })
);

router.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const shiftId = req.params.id;
    const shiftRow = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
    if (!shiftRow) throw new ApiError(404, 'Shift not found');
    if (shiftRow.status === 'CLOSED') {
      throw new ApiError(409, 'Shift is already closed', 'SHIFT_ALREADY_CLOSED');
    }

    const body = req.body as {
      closingFloat: number;
      countedCash: number;
      cashVariance: number;
      closingNotes?: string;
      requiresApproval?: boolean;
      cashUpMode?: CashUpMode;
      tenderReconciliation?: TenderReconciliationEntry[];
      originalBlindCounts?: Record<string, number>;
      reasonCode?: string;
      managerApproved?: boolean;
      managerApprovedBy?: string;
    };
    if (typeof body.closingFloat !== 'number' || typeof body.countedCash !== 'number' || typeof body.cashVariance !== 'number') {
      throw new ApiError(400, 'closingFloat, countedCash and cashVariance are required');
    }

    const shift = rowToShift(shiftRow);

    const saleRows = db
      .prepare(
        `SELECT st.*, (
           SELECT json_group_array(json_object('method', sp.method, 'amount', sp.amount))
           FROM sale_payments sp WHERE sp.sale_id = st.sale_id
         ) AS paymentsJson
         FROM sales_transactions st WHERE st.shift_id = ?`
      )
      .all(shiftId) as any[];
    const transactions = saleRows.map(rowToSaleForMetrics);

    const heldSales = (db.prepare(`SELECT * FROM held_sales WHERE status = 'OUTSTANDING'`).all() as any[]).map(
      (r) => ({ status: r.status, grandTotal: r.grand_total } as unknown as HeldSale)
    );

    const closedByStaff = { name: req.currentStaff!.name } as StaffMember;
    const closedDateTime = nowIso();

    const exceptionEntries: BatchEntry[] = [];
    let exceptionId: string | undefined;
    if (Math.abs(body.cashVariance) > 0.01) {
      const exception = createOperationalExceptionFromVariance({
        shift,
        closureData: {
          closingFloat: body.closingFloat,
          countedCash: body.countedCash,
          cashVariance: body.cashVariance,
          closingNotes: body.closingNotes,
          reasonCode: body.reasonCode as any,
        },
        staff: closedByStaff,
      });
      exceptionId = exception.id;
      exceptionEntries.push({
        table: 'operational_exceptions',
        pkColumn: 'id',
        pk: exception.id,
        operation: 'INSERT',
        payload: exception as unknown as Record<string, unknown>,
      });
    }

    const snapshot = buildImmutableReconciliationSnapshot({
      shift,
      closureData: {
        closingFloat: body.closingFloat,
        countedCash: body.countedCash,
        cashVariance: body.cashVariance,
        closingNotes: body.closingNotes ?? '',
        requiresApproval: !!body.requiresApproval,
        cashUpMode: body.cashUpMode,
        tenderReconciliation: body.tenderReconciliation,
        originalBlindCounts: body.originalBlindCounts,
        reasonCode: body.reasonCode as any,
        managerApproved: body.managerApproved,
        managerApprovedBy: body.managerApprovedBy,
      },
      closedByStaff,
      transactions,
      heldSales,
      exceptionIds: exceptionId ? [exceptionId] : [],
    });

    try {
      applyBatchWithOutbox({
        db,
        tenantId: null,
        apply: () => {
          assertUpdateAllowed(db, 'shifts', 'id', shiftId);

        db.prepare(
          `UPDATE shifts SET
             closed_date_time = ?, closing_float = ?, status = 'CLOSED',
             counted_cash = ?, cash_variance = ?, cash_up_mode = ?,
             total_sales_count = ?, gross_sales = ?, total_cash_sales = ?,
             total_mobile_money_sales = ?, total_card_sales = ?, total_credit_sales = ?,
             expected_cash = ?,
             tender_reconciliation = ?, cash_movements = ?, reconciliation_snapshot = ?,
             closure_reason_code = ?, cash_discrepancy_severity = ?, closing_notes = ?,
             approved_by_staff_name = ?, approved_date_time = ?
           WHERE id = ?`
        ).run(
          closedDateTime,
          body.closingFloat,
          body.countedCash,
          body.cashVariance,
          body.cashUpMode ?? 'STANDARD',
          snapshot.totalSalesCount,
          snapshot.grossSales,
          snapshot.cashMovements.cashSales,
          snapshot.tenderReconciliation.find((t) => t.tenderType === 'MOBILE_MONEY')?.expectedAmount ?? 0,
          snapshot.tenderReconciliation.find((t) => t.tenderType === 'DEBIT_CARD')?.expectedAmount ?? 0,
          snapshot.tenderReconciliation.find((t) => t.tenderType === 'CUSTOMER_CREDIT')?.expectedAmount ?? 0,
          snapshot.expectedCash,
          JSON.stringify(snapshot.tenderReconciliation),
          JSON.stringify(snapshot.cashMovements),
          JSON.stringify(snapshot),
          body.reasonCode ?? null,
          exceptionId ? 'MEDIUM' : null,
          body.closingNotes ?? null,
          body.managerApprovedBy ?? null,
          body.managerApproved ? closedDateTime : null,
          shiftId
        );

        if (exceptionId) {
          const exceptionPayload = exceptionEntries[0].payload as any;
          db.prepare(
            `INSERT INTO operational_exceptions (id, exception_number, title, category, date_time, branch_id, branch_name, terminal_id, terminal_name, staff_id, staff_name, related_transaction_ref, severity, status, variance_amount, opened_at, details)
             VALUES (@id, @exceptionNumber, @title, @category, @dateTime, @branchId, @branchName, @terminalId, @terminalName, @staffId, @staffName, @relatedTransactionRef, @severity, @status, @varianceAmount, @openedAt, @details)`
          ).run({
            id: exceptionPayload.id,
            exceptionNumber: exceptionPayload.exceptionNumber,
            title: exceptionPayload.title,
            category: exceptionPayload.category,
            dateTime: exceptionPayload.dateTime,
            branchId: exceptionPayload.branchId ?? null,
            branchName: exceptionPayload.branchName ?? null,
            terminalId: exceptionPayload.terminalId ?? null,
            terminalName: exceptionPayload.terminalName ?? null,
            staffId: exceptionPayload.staffId ?? null,
            staffName: exceptionPayload.staffName ?? null,
            relatedTransactionRef: exceptionPayload.relatedTransactionRef ?? null,
            severity: exceptionPayload.severity,
            status: exceptionPayload.status,
            varianceAmount: exceptionPayload.varianceAmount ?? null,
            openedAt: exceptionPayload.openedAt,
            details: exceptionPayload.details ?? null,
          });
        }

          const entries: BatchEntry[] = [
            {
              table: 'shifts',
              pkColumn: 'id',
              pk: shiftId,
              operation: 'UPDATE',
              payload: { id: shiftId, status: 'CLOSED', closedDateTime, ...body },
            },
            ...exceptionEntries,
          ];

          return { result: undefined, entries };
        },
      });
    } catch (err) {
      if (err instanceof ImmutabilityViolationError) {
        throw new ApiError(409, err.message, 'SHIFT_ALREADY_CLOSED');
      }
      throw err;
    }

    const updatedRow = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
    res.json(rowToShift(updatedRow));
  })
);

export default router;
