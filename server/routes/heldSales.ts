import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, generateDocumentNumber, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToHeldSale(row: any, itemRows: any[]) {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    subtotal: row.subtotal,
    grandTotal: row.grand_total,
    dateTime: row.date_time,
    expectedSettlementTime: row.expected_settlement_time,
    status: row.status,
    notes: row.notes,
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

interface HoldBody {
  customer?: { id: string; name: string } | null;
  items: Array<{ sku: string; itemName?: string; quantity: number; unitPrice: number; discountPercent?: number; taxAmount?: number; lineTotal: number }>;
  subtotal: number;
  grandTotal: number;
  expectedSettlementTime?: string;
  notes?: string;
}

// Park cart / hold sale (ParkCartModal, HeldSaleModal) — a SINGLE_OWNER_WORKFLOW
// record per DL-007, not a ledger fact, so it's fine for this to be mutated/
// removed later (recall/settle) rather than being insert-once.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as HoldBody;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new ApiError(400, 'items must be a non-empty array');
    }

    const staff = req.currentStaff!;
    const id = generateId('HELD');
    const saleNumber = generateDocumentNumber('HOLD');
    const dateTime = nowIso();

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `INSERT INTO held_sales (id, sale_number, customer_id, customer_name, cashier_id, cashier_name, subtotal, grand_total, date_time, expected_settlement_time, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OUTSTANDING', ?)`
        ).run(id, saleNumber, body.customer?.id ?? null, body.customer?.name ?? null, staff.id, staff.name, body.subtotal, body.grandTotal, dateTime, body.expectedSettlementTime ?? null, body.notes ?? null);
        entries.push({ table: 'held_sales', pkColumn: 'id', pk: id, operation: 'INSERT', payload: { id, saleNumber, ...body } });

        const itemStmt = db.prepare(
          `INSERT INTO held_sale_items (held_sale_id, sku, item_name, quantity, unit_price, discount_percent, tax_amount, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const item of body.items) {
          itemStmt.run(id, item.sku, item.itemName ?? null, item.quantity, item.unitPrice, item.discountPercent ?? 0, item.taxAmount ?? 0, item.lineTotal);
          const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'held_sale_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, heldSaleId: id } });
        }

        return { result: undefined, entries };
      },
    });

    const row = db.prepare('SELECT * FROM held_sales WHERE id = ?').get(id) as any;
    const itemRows = db.prepare('SELECT * FROM held_sale_items WHERE held_sale_id = ?').all(id) as any[];
    res.status(201).json(rowToHeldSale(row, itemRows));
  })
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare(`SELECT * FROM held_sales WHERE status = 'OUTSTANDING' ORDER BY date_time DESC`).all() as any[];
    const result = rows.map((row) => {
      const itemRows = db.prepare('SELECT * FROM held_sale_items WHERE held_sale_id = ?').all(row.id) as any[];
      return rowToHeldSale(row, itemRows);
    });
    res.json(result);
  })
);

// Recall (pull back into the cart) removes the held-sale record — once
// recalled it's no longer "held"; if the resulting cart is later completed
// or re-parked, that's a fresh transaction/hold.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT id FROM held_sales WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'Held sale not found');

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        db.prepare('DELETE FROM held_sales WHERE id = ?').run(id);
        return {
          result: undefined,
          entries: [{ table: 'held_sales', pkColumn: 'id', pk: id, operation: 'DELETE', payload: { id } }] as BatchEntry[],
        };
      },
    });

    res.status(204).send();
  })
);

export default router;
