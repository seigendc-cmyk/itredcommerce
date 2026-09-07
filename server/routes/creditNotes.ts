import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';
import { calculateRefundAmount, roundCurrency } from '../../src/utils/saleCalculationEngine';

const router = Router();
router.use(requireAuth);

function rowToCreditNote(row: any, itemRows: any[]) {
  return {
    id: row.id,
    originalSaleNumber: row.original_sale_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    dateTime: row.date_time,
    totalRefundAmount: row.total_refund_amount,
    refundMethod: row.refund_method,
    reasonCategory: row.reason_category,
    status: row.status,
    // DL-068 (Prompt 14): the fields shiftReconciliation.ts now needs to
    // attribute this refund to the terminal/shift that actually issued it,
    // rather than the shift of the original sale.
    terminalId: row.terminal_id ?? undefined,
    branchId: row.branch_id ?? undefined,
    shiftId: row.shift_id ?? undefined,
    returnedItems: itemRows.map((r) => ({
      sku: r.sku,
      itemName: r.item_name,
      returnQty: r.return_qty,
      unitPrice: r.unit_price,
      reason: r.reason,
      restock: !!r.restock,
    })),
  };
}

// Lookup for the return flow: what was actually sold on this sale number, so
// CreditNotesView can cap returnQty against real sold quantities instead of
// trusting free-text entry (the pre-wiring behavior this route replaces).
router.get(
  '/sale/:saleNumber',
  asyncHandler(async (req, res) => {
    const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_number = ?').get(req.params.saleNumber) as any;
    if (!saleRow) throw new ApiError(404, 'Sale not found');
    const itemRows = db.prepare('SELECT * FROM sale_line_items WHERE sale_id = ?').all(saleRow.sale_id) as any[];
    res.json({
      saleNumber: saleRow.sale_number,
      customerId: saleRow.customer_id,
      customerName: saleRow.customer_name,
      items: itemRows.map((r) => ({ sku: r.sku, itemName: r.item_name, quantitySold: r.quantity, unitPrice: r.unit_price, taxRate: r.tax_rate })),
    });
  })
);

interface CreateCreditNoteBody {
  originalSaleNumber?: string;
  customerId?: string;
  customerName?: string;
  returnedItems: Array<{ sku: string; itemName?: string; returnQty: number; unitPrice: number; reason: string; restock?: boolean }>;
  refundMethod: string;
  reasonCategory: string;
  /** Required (Prompt 14 / DL-068) — the shift actually processing this return, so the refund is attributed correctly rather than hardcoded/guessed. */
  shiftId: string;
  /** Required (Prompt 14) — a resubmit of the same issuance attempt returns the already-created note instead of double-issuing a refund. */
  idempotencyKey: string;
}

export interface IssueCreditNoteParams {
  body: CreateCreditNoteBody;
  staffId: string;
  staffName: string;
}

export interface IssueCreditNoteResult {
  creditNote: ReturnType<typeof rowToCreditNote>;
  alreadyProcessed: boolean;
}

/**
 * The credit-note issuance logic, deliberately decoupled from Express
 * (req/res) so it can be exercised directly in tests against a real SQLite
 * db without needing an HTTP layer — same reasoning as this codebase's
 * existing pure-function-extraction precedent, just applied to a route
 * whose core behavior is inherently DB side effects (persistence, restock,
 * dedup) rather than a pure calculation.
 */
export function issueCreditNote({ body, staffId, staffName }: IssueCreditNoteParams): IssueCreditNoteResult {
  if (!Array.isArray(body.returnedItems) || body.returnedItems.length === 0) {
    throw new ApiError(400, 'returnedItems must be a non-empty array');
  }
  if (!body.shiftId) {
    throw new ApiError(400, 'shiftId is required');
  }
  if (!body.idempotencyKey) {
    throw new ApiError(400, 'idempotencyKey is required');
  }

  // Idempotency (Prompt 14): a resubmit (double-click, retried timeout) of
  // the exact same issuance attempt returns the already-created note rather
  // than double-issuing a refund and double-restocking. Mirrors POST
  // /sales's pattern (sales.ts:154-167).
  const existingByKey = db.prepare('SELECT id FROM credit_notes WHERE idempotency_key = ?').get(body.idempotencyKey) as
    | { id: string }
    | undefined;
  if (existingByKey) {
    const row = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(existingByKey.id) as any;
    const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(existingByKey.id) as any[];
    return { creditNote: rowToCreditNote(row, itemRows), alreadyProcessed: true };
  }

  const shiftRow = db.prepare('SELECT * FROM shifts WHERE id = ?').get(body.shiftId) as any;
  if (!shiftRow) throw new ApiError(404, 'Unknown shift', 'SHIFT_NOT_FOUND');
  if (shiftRow.status !== 'OPEN') {
    throw new ApiError(409, 'Shift is not open — cannot process a return against it', 'SHIFT_NOT_OPEN');
  }

  const id = generateId('CN');
  const dateTime = nowIso();

  const originalSaleRow = body.originalSaleNumber
    ? (db.prepare('SELECT sale_id FROM sales_transactions WHERE sale_number = ?').get(body.originalSaleNumber) as
        | { sale_id: string }
        | undefined)
    : undefined;
  const originalLineStmt = db.prepare(
    'SELECT quantity, unit_price, discount_percent, tax_rate FROM sale_line_items WHERE sale_id = ? AND sku = ?'
  );
  const inventoryLookupStmt = db.prepare(
    'SELECT sku, name, stock_on_hand, reorder_level, unit_cost, tax_rate FROM inventory_items WHERE sku = ?'
  );
  // Refund cap (step 6): sum every returnQty already recorded against this
  // exact original sale + sku across every previously-issued credit note,
  // so two sequential partial returns can't jointly exceed what was ever
  // sold on that line.
  const alreadyReturnedStmt = db.prepare(
    `SELECT COALESCE(SUM(cni.return_qty), 0) AS qty
     FROM credit_note_items cni
     JOIN credit_notes cn ON cn.id = cni.credit_note_id
     WHERE cn.original_sale_number = ? AND cni.sku = ?`
  );

  let totalRefundAmount = 0;
  const refundAmountBySku = new Map<string, number>();

  for (const item of body.returnedItems) {
    if (!(item.returnQty > 0)) {
      throw new ApiError(400, `returnQty for ${item.sku} must be greater than 0`);
    }

    const originalLine = originalSaleRow
      ? (originalLineStmt.get(originalSaleRow.sale_id, item.sku) as
          | { quantity: number; unit_price: number; discount_percent: number; tax_rate: number }
          | undefined)
      : undefined;

    let refundAmount: number;
    if (originalLine) {
      // Only enforceable when there's a real original line to check
      // against — a "Direct Return" with no originalSaleNumber, or a SKU
      // that isn't actually on the referenced sale, has nothing to cap
      // against (same accepted trust-boundary class as credit-limit
      // enforcement elsewhere in this codebase; flagged, not silently
      // treated as fully solved).
      const alreadyReturned = (alreadyReturnedStmt.get(body.originalSaleNumber, item.sku) as { qty: number }).qty;
      if (alreadyReturned + item.returnQty > originalLine.quantity) {
        throw new ApiError(
          409,
          `Cannot return ${item.returnQty} of ${item.sku} — ${alreadyReturned} of ${originalLine.quantity} sold units already returned, only ${Math.max(0, originalLine.quantity - alreadyReturned)} remain returnable.`,
          'RETURN_EXCEEDS_SOLD_QUANTITY'
        );
      }

      const { refundAmount: amt } = calculateRefundAmount(
        {
          originalQuantity: originalLine.quantity,
          unitPrice: originalLine.unit_price,
          taxRate: originalLine.tax_rate ?? 0,
          discountPercent: originalLine.discount_percent ?? 0,
        },
        item.returnQty
      );
      refundAmount = amt;
    } else {
      const invRow = inventoryLookupStmt.get(item.sku) as { tax_rate: number } | undefined;
      const taxRate = invRow?.tax_rate ?? 0;
      refundAmount = roundCurrency(item.returnQty * item.unitPrice * (1 + taxRate / 100));
    }

    refundAmountBySku.set(item.sku, refundAmount);
    totalRefundAmount += refundAmount;
  }
  totalRefundAmount = roundCurrency(totalRefundAmount);

  applyBatchWithOutbox({
    db,
    tenantId: null,
    originTerminalId: shiftRow.terminal_id,
    apply: () => {
      const entries: BatchEntry[] = [];

      db.prepare(
        `INSERT INTO credit_notes (id, original_sale_number, customer_id, customer_name, cashier_id, cashier_name, date_time, total_refund_amount, refund_method, reason_category, status, terminal_id, branch_id, shift_id, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?, ?, ?)`
      ).run(
        id,
        body.originalSaleNumber ?? null,
        body.customerId ?? null,
        body.customerName ?? null,
        staffId,
        staffName,
        dateTime,
        totalRefundAmount,
        body.refundMethod,
        body.reasonCategory,
        shiftRow.terminal_id,
        shiftRow.branch_id,
        shiftRow.id,
        body.idempotencyKey
      );
      entries.push({
        table: 'credit_notes',
        pkColumn: 'id',
        pk: id,
        operation: 'INSERT',
        payload: { id, ...body, totalRefundAmount },
      });

      const itemStmt = db.prepare(
        `INSERT INTO credit_note_items (credit_note_id, sku, item_name, return_qty, unit_price, reason, restock)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of body.returnedItems) {
        const doRestock = item.restock !== false;
        itemStmt.run(id, item.sku, item.itemName ?? null, item.returnQty, item.unitPrice, item.reason, doRestock ? 1 : 0);
        const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
        entries.push({ table: 'credit_note_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, creditNoteId: id } });

        // Step 7: restock/quarantine, immediate at issuance (confirmed
        // approach (a) — see this prompt's proposal). Always writes an
        // inventory_movements audit row; only a restock-flagged line
        // actually increments stock_on_hand.
        const invItem = inventoryLookupStmt.get(item.sku) as
          | { sku: string; name: string | null; stock_on_hand: number; reorder_level: number; unit_cost: number }
          | undefined;
        if (invItem) {
          if (doRestock) {
            const newStock = invItem.stock_on_hand + item.returnQty;
            const newStatus = newStock === 0 ? 'Out of Stock' : newStock <= invItem.reorder_level ? 'Low Stock' : 'In Stock';
            db.prepare('UPDATE inventory_items SET stock_on_hand = ?, status = ?, last_updated = ? WHERE sku = ?').run(
              newStock,
              newStatus,
              dateTime,
              item.sku
            );
            entries.push({
              table: 'inventory_items',
              pkColumn: 'sku',
              pk: item.sku,
              operation: 'UPDATE',
              payload: { sku: item.sku, stockOnHand: newStock, status: newStatus },
            });
          }

          const movementId = generateId('MOV');
          db.prepare(
            `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, reference_document, staff_id, staff_name, shift_id, terminal_id, reason_code, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            movementId,
            dateTime,
            doRestock ? 'Sale Return' : 'Sale Return - Quarantined',
            item.sku,
            item.itemName ?? invItem.name,
            doRestock ? item.returnQty : 0,
            invItem.unit_cost,
            doRestock ? roundCurrency(item.returnQty * invItem.unit_cost) : 0,
            id,
            staffId,
            staffName,
            shiftRow.id,
            shiftRow.terminal_id,
            null,
            doRestock
              ? `Restocked ${item.returnQty} units from credit note ${id}.`
              : `Quarantined ${item.returnQty} units from credit note ${id} — not returned to sellable stock.`
          );
          entries.push({
            table: 'inventory_movements',
            pkColumn: 'id',
            pk: movementId,
            operation: 'INSERT',
            payload: { id: movementId, sku: item.sku, quantity: doRestock ? item.returnQty : 0 },
          });
        }
      }

      return { result: undefined, entries };
    },
  });

  const row = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(id) as any;
  const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(id) as any[];
  return { creditNote: rowToCreditNote(row, itemRows), alreadyProcessed: false };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as CreateCreditNoteBody;
    const staff = req.currentStaff!;

    let result: IssueCreditNoteResult;
    try {
      result = issueCreditNote({ body, staffId: staff.id, staffName: staff.name });
    } catch (err: any) {
      // Race: two near-simultaneous submits of the same idempotency key.
      if (typeof err?.message === 'string' && err.message.includes('idempotency_key')) {
        const race = db.prepare('SELECT id FROM credit_notes WHERE idempotency_key = ?').get(body.idempotencyKey) as
          | { id: string }
          | undefined;
        if (race) {
          const row = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(race.id) as any;
          const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(race.id) as any[];
          res.status(200).json(rowToCreditNote(row, itemRows));
          return;
        }
      }
      throw err;
    }

    res.status(result.alreadyProcessed ? 200 : 201).json(result.creditNote);
  })
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM credit_notes ORDER BY date_time DESC').all() as any[];
    const result = rows.map((row) => {
      const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(row.id) as any[];
      return rowToCreditNote(row, itemRows);
    });
    res.json(result);
  })
);

export default router;
