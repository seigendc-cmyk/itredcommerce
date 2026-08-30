import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToHeldReceipt(row: any, itemRows: any[]) {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    parkedAt: row.parked_at,
    note: row.note,
    totalAmount: row.total_amount,
    items: itemRows.map((r) => ({
      sku: r.sku,
      itemName: r.item_name,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      discountPercent: r.discount_percent,
      taxAmount: r.tax_amount,
      lineTotal: r.line_total,
    })),
  };
}

interface ParkCartBody {
  customer?: { id: string; name: string } | null;
  items: Array<{ sku: string; itemName?: string; quantity: number; unitPrice: number; discountPercent?: number; taxAmount?: number; lineTotal: number }>;
  totalAmount: number;
  note?: string;
}

// Park cart (ParkCartModal) — a quick, notes-only cart parking distinct from
// HeldSale's expected-settlement-time workflow, backed by its own table per
// the pre-existing schema.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as ParkCartBody;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new ApiError(400, 'items must be a non-empty array');
    }

    const staff = req.currentStaff!;
    const id = generateId('PARK');
    const parkedAt = nowIso();

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `INSERT INTO held_receipts (id, cashier_id, cashier_name, customer_id, customer_name, parked_at, note, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, staff.id, staff.name, body.customer?.id ?? null, body.customer?.name ?? null, parkedAt, body.note ?? null, body.totalAmount);
        entries.push({ table: 'held_receipts', pkColumn: 'id', pk: id, operation: 'INSERT', payload: { id, ...body } });

        const itemStmt = db.prepare(
          `INSERT INTO held_receipt_items (held_receipt_id, sku, item_name, quantity, unit_price, discount_percent, tax_amount, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const item of body.items) {
          itemStmt.run(id, item.sku, item.itemName ?? null, item.quantity, item.unitPrice, item.discountPercent ?? 0, item.taxAmount ?? 0, item.lineTotal);
          const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'held_receipt_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, heldReceiptId: id } });
        }

        return { result: undefined, entries };
      },
    });

    const row = db.prepare('SELECT * FROM held_receipts WHERE id = ?').get(id) as any;
    const itemRows = db.prepare('SELECT * FROM held_receipt_items WHERE held_receipt_id = ?').all(id) as any[];
    res.status(201).json(rowToHeldReceipt(row, itemRows));
  })
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM held_receipts ORDER BY parked_at DESC').all() as any[];
    const result = rows.map((row) => {
      const itemRows = db.prepare('SELECT * FROM held_receipt_items WHERE held_receipt_id = ?').all(row.id) as any[];
      return rowToHeldReceipt(row, itemRows);
    });
    res.json(result);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT id FROM held_receipts WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'Parked cart not found');

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        db.prepare('DELETE FROM held_receipts WHERE id = ?').run(id);
        return {
          result: undefined,
          entries: [{ table: 'held_receipts', pkColumn: 'id', pk: id, operation: 'DELETE', payload: { id } }] as BatchEntry[],
        };
      },
    });

    res.status(204).send();
  })
);

export default router;
