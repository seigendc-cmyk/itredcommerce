import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

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
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as CreateCreditNoteBody;
    if (!Array.isArray(body.returnedItems) || body.returnedItems.length === 0) {
      throw new ApiError(400, 'returnedItems must be a non-empty array');
    }

    const staff = req.currentStaff!;
    const id = generateId('CN');
    const dateTime = nowIso();

    // Compute the refund total server-side from each item's real tax_rate
    // (looked up from inventory_items) rather than trusting a client-supplied
    // total — this fixes the hardcoded-15%-tax bug in the pre-wiring UI.
    const taxRateStmt = db.prepare('SELECT tax_rate FROM inventory_items WHERE sku = ?');
    let totalRefundAmount = 0;
    for (const item of body.returnedItems) {
      const invRow = taxRateStmt.get(item.sku) as { tax_rate: number } | undefined;
      const taxRate = invRow?.tax_rate ?? 0;
      totalRefundAmount += item.returnQty * item.unitPrice * (1 + taxRate / 100);
    }

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `INSERT INTO credit_notes (id, original_sale_number, customer_id, customer_name, cashier_id, cashier_name, date_time, total_refund_amount, refund_method, reason_category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED')`
        ).run(id, body.originalSaleNumber ?? null, body.customerId ?? null, body.customerName ?? null, staff.id, staff.name, dateTime, totalRefundAmount, body.refundMethod, body.reasonCategory);
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
          itemStmt.run(id, item.sku, item.itemName ?? null, item.returnQty, item.unitPrice, item.reason, item.restock === false ? 0 : 1);
          const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'credit_note_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, creditNoteId: id } });
        }

        return { result: undefined, entries };
      },
    });

    const row = db.prepare('SELECT * FROM credit_notes WHERE id = ?').get(id) as any;
    const itemRows = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?').all(id) as any[];
    res.status(201).json(rowToCreditNote(row, itemRows));
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
