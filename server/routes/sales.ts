import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToSale(saleRow: any, itemRows: any[], paymentRows: any[]) {
  return {
    saleId: saleRow.sale_id,
    saleNumber: saleRow.sale_number,
    dateTime: saleRow.date_time,
    customerId: saleRow.customer_id,
    customerName: saleRow.customer_name,
    cashierId: saleRow.cashier_id,
    cashierName: saleRow.cashier_name,
    subtotal: saleRow.subtotal,
    taxTotal: saleRow.tax_total,
    discountTotal: saleRow.discount_total,
    grandTotal: saleRow.grand_total,
    changeGiven: saleRow.change_given,
    transactionType: saleRow.transaction_type,
    status: saleRow.status,
    terminalId: saleRow.terminal_id,
    shiftId: saleRow.shift_id,
    branchId: saleRow.branch_id,
    branchName: saleRow.branch_name,
    idempotencyKey: saleRow.idempotency_key,
    totalCostBasis: saleRow.total_cost_basis,
    grossMargin: saleRow.gross_margin,
    notes: saleRow.notes,
    items: itemRows.map((r) => ({
      sku: r.sku,
      itemName: r.item_name,
      partNumber: r.part_number,
      oemNumber: r.oem_number,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      discountPercent: r.discount_percent,
      discountAmount: r.discount_amount,
      taxRate: r.tax_rate,
      taxAmount: r.tax_amount,
      unitCostBasis: r.unit_cost_basis,
      costTotal: r.cost_total,
      netSubtotal: r.net_subtotal,
      lineTotal: r.line_total,
    })),
    payments: paymentRows.map((r) => ({ method: r.method, amount: r.amount, reference: r.reference })),
  };
}

function loadSale(saleId: string) {
  const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_id = ?').get(saleId) as any;
  if (!saleRow) return null;
  const itemRows = db.prepare('SELECT * FROM sale_line_items WHERE sale_id = ?').all(saleId) as any[];
  const paymentRows = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId) as any[];
  return rowToSale(saleRow, itemRows, paymentRows);
}

interface CheckoutBody {
  sale: {
    saleId: string;
    saleNumber: string;
    dateTime: string;
    customer?: { id: string } | null;
    customerId?: string;
    customerName?: string;
    cashier?: { id: string; name: string };
    shiftId: string;
    items: Array<{
      sku: string;
      itemName?: string;
      partNumber?: string;
      oemNumber?: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      discountAmount?: number;
      taxRate?: number;
      taxAmount?: number;
      unitCostBasis?: number;
      costTotal?: number;
      netSubtotal?: number;
      lineTotal: number;
    }>;
    payments: Array<{ method: string; amount: number; reference?: string }>;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    changeGiven: number;
    transactionType: string;
    idempotencyKey: string;
    totalCostBasis?: number;
    grossMargin?: number;
    notes?: string;
  };
  updatedInventory?: Array<{ sku: string; stockOnHand: number; status?: string }>;
  newMovements?: Array<{
    id?: string;
    timestamp?: string;
    movementType: string;
    sku: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
    referenceDocument?: string;
    staffId?: string;
    staffName: string;
    reasonCode?: string;
    notes?: string;
  }>;
  newActivityEvent?: {
    id?: string;
    eventType: string;
    timestamp?: string;
    description?: string;
    staffId?: string;
    staffName?: string;
    amount?: number;
    quantity?: number;
  };
  updatedCustomer?: {
    id: string;
    currentBalance: number;
    availableCredit: number;
    lastPurchaseDate?: string;
    lastPurchaseAmount?: number;
    lastPurchaseRef?: string;
  };
}

// Checkout: persists exactly what saleTransactionEngine.ts already computed
// and validated client-side (this is a single-user till, not a public API —
// see the Prompt 3 plan's "checkout trusts the client" decision). Structural
// validation and durable idempotency are this route's job, not re-deriving
// pricing/eligibility.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as CheckoutBody;
    const { sale } = body;
    if (!sale?.saleId || !sale.saleNumber || !sale.shiftId || !Array.isArray(sale.items) || sale.items.length === 0) {
      throw new ApiError(400, 'sale.saleId, saleNumber, shiftId and a non-empty items array are required');
    }
    if (!Array.isArray(sale.payments) || sale.payments.length === 0) {
      throw new ApiError(400, 'sale.payments must be a non-empty array');
    }
    if (!sale.idempotencyKey) {
      throw new ApiError(400, 'sale.idempotencyKey is required');
    }

    // Durable idempotency: a resubmit of an already-processed checkout
    // (double-click, retried timeout) returns the original sale rather than
    // erroring or double-booking inventory.
    const existing = db.prepare('SELECT sale_id FROM sales_transactions WHERE idempotency_key = ?').get(sale.idempotencyKey) as
      | { sale_id: string }
      | undefined;
    if (existing) {
      res.status(200).json({ sale: loadSale(existing.sale_id), alreadyProcessed: true });
      return;
    }

    const shiftRow = db.prepare('SELECT * FROM shifts WHERE id = ?').get(sale.shiftId) as any;
    if (!shiftRow) throw new ApiError(404, 'Unknown shift', 'SHIFT_NOT_FOUND');
    if (shiftRow.status !== 'OPEN') {
      throw new ApiError(409, 'Shift is not open — cannot record a sale against it', 'SHIFT_NOT_OPEN');
    }

    const staff = req.currentStaff!;
    const dateTime = sale.dateTime || nowIso();
    const customerId = sale.customer?.id ?? sale.customerId ?? null;

    try {
      applyBatchWithOutbox({
        db,
        tenantId: null,
        originTerminalId: shiftRow.terminal_id,
        apply: () => {
          const entries: BatchEntry[] = [];

          db.prepare(
            `INSERT INTO sales_transactions (sale_id, sale_number, date_time, customer_id, customer_name, cashier_id, cashier_name, subtotal, tax_total, discount_total, grand_total, change_given, transaction_type, status, terminal_id, shift_id, branch_id, branch_name, idempotency_key, total_cost_basis, gross_margin, notes)
             VALUES (@saleId, @saleNumber, @dateTime, @customerId, @customerName, @cashierId, @cashierName, @subtotal, @taxTotal, @discountTotal, @grandTotal, @changeGiven, @transactionType, 'COMPLETED', @terminalId, @shiftId, @branchId, @branchName, @idempotencyKey, @totalCostBasis, @grossMargin, @notes)`
          ).run({
            saleId: sale.saleId,
            saleNumber: sale.saleNumber,
            dateTime,
            customerId,
            customerName: sale.customerName ?? null,
            cashierId: sale.cashier?.id ?? staff.id,
            cashierName: sale.cashier?.name ?? staff.name,
            subtotal: sale.subtotal,
            taxTotal: sale.taxTotal,
            discountTotal: sale.discountTotal,
            grandTotal: sale.grandTotal,
            changeGiven: sale.changeGiven,
            transactionType: sale.transactionType,
            terminalId: shiftRow.terminal_id,
            shiftId: sale.shiftId,
            branchId: shiftRow.branch_id,
            branchName: shiftRow.branch_name,
            idempotencyKey: sale.idempotencyKey,
            totalCostBasis: sale.totalCostBasis ?? null,
            grossMargin: sale.grossMargin ?? null,
            notes: sale.notes ?? null,
          });
          entries.push({
            table: 'sales_transactions',
            pkColumn: 'sale_id',
            pk: sale.saleId,
            operation: 'INSERT',
            payload: sale as unknown as Record<string, unknown>,
          });

          const lineStmt = db.prepare(
            `INSERT INTO sale_line_items (sale_id, sku, item_name, part_number, oem_number, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, unit_cost_basis, cost_total, net_subtotal, line_total)
             VALUES (@saleId, @sku, @itemName, @partNumber, @oemNumber, @quantity, @unitPrice, @discountPercent, @discountAmount, @taxRate, @taxAmount, @unitCostBasis, @costTotal, @netSubtotal, @lineTotal)`
          );
          for (const item of sale.items) {
            lineStmt.run({
              saleId: sale.saleId,
              sku: item.sku,
              itemName: item.itemName ?? null,
              partNumber: item.partNumber ?? null,
              oemNumber: item.oemNumber ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent ?? 0,
              discountAmount: item.discountAmount ?? 0,
              taxRate: item.taxRate ?? 0,
              taxAmount: item.taxAmount ?? 0,
              unitCostBasis: item.unitCostBasis ?? 0,
              costTotal: item.costTotal ?? 0,
              netSubtotal: item.netSubtotal ?? item.lineTotal,
              lineTotal: item.lineTotal,
            });
            const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
            entries.push({
              table: 'sale_line_items',
              pkColumn: 'id',
              pk: lineId,
              operation: 'INSERT',
              payload: { ...item, saleId: sale.saleId },
            });
          }

          const paymentStmt = db.prepare(
            `INSERT INTO sale_payments (sale_id, method, amount, reference) VALUES (?, ?, ?, ?)`
          );
          for (const payment of sale.payments) {
            paymentStmt.run(sale.saleId, payment.method, payment.amount, payment.reference ?? null);
            const paymentId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
            entries.push({
              table: 'sale_payments',
              pkColumn: 'id',
              pk: paymentId,
              operation: 'INSERT',
              payload: { ...payment, saleId: sale.saleId },
            });
          }

          for (const inv of body.updatedInventory ?? []) {
            db.prepare(
              `UPDATE inventory_items SET stock_on_hand = ?, status = COALESCE(?, status), last_updated = ? WHERE sku = ?`
            ).run(inv.stockOnHand, inv.status ?? null, dateTime, inv.sku);
            entries.push({
              table: 'inventory_items',
              pkColumn: 'sku',
              pk: inv.sku,
              operation: 'UPDATE',
              payload: inv as unknown as Record<string, unknown>,
            });
          }

          const movementStmt = db.prepare(
            `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, reference_document, staff_id, staff_name, shift_id, terminal_id, reason_code, notes)
             VALUES (@id, @timestamp, @movementType, @sku, @itemName, @quantity, @unitCost, @totalValue, @referenceDocument, @staffId, @staffName, @shiftId, @terminalId, @reasonCode, @notes)`
          );
          for (const movement of body.newMovements ?? []) {
            const id = movement.id || generateId('MOV');
            movementStmt.run({
              id,
              timestamp: movement.timestamp || dateTime,
              movementType: movement.movementType,
              sku: movement.sku,
              itemName: movement.itemName,
              quantity: movement.quantity,
              unitCost: movement.unitCost,
              totalValue: movement.totalValue,
              referenceDocument: movement.referenceDocument ?? sale.saleNumber,
              staffId: movement.staffId ?? staff.id,
              staffName: movement.staffName ?? staff.name,
              shiftId: sale.shiftId,
              terminalId: shiftRow.terminal_id,
              reasonCode: movement.reasonCode ?? null,
              notes: movement.notes ?? null,
            });
            entries.push({
              table: 'inventory_movements',
              pkColumn: 'id',
              pk: id,
              operation: 'INSERT',
              payload: { ...movement, id },
            });
          }

          if (body.updatedCustomer) {
            const c = body.updatedCustomer;
            db.prepare(
              `UPDATE customers SET current_balance = ?, available_credit = ?, last_purchase_date = ?, last_purchase_amount = ?, last_purchase_ref = ? WHERE id = ?`
            ).run(c.currentBalance, c.availableCredit, c.lastPurchaseDate ?? dateTime, c.lastPurchaseAmount ?? sale.grandTotal, c.lastPurchaseRef ?? sale.saleNumber, c.id);
            entries.push({
              table: 'customers',
              pkColumn: 'id',
              pk: c.id,
              operation: 'UPDATE',
              payload: c as unknown as Record<string, unknown>,
            });
          }

          if (body.newActivityEvent) {
            const evt = body.newActivityEvent;
            const id = evt.id || generateId('EVT');
            db.prepare(
              `INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, terminal_id, reference_document, amount, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              id,
              evt.eventType,
              evt.timestamp || dateTime,
              evt.description ?? null,
              evt.staffId ?? staff.id,
              evt.staffName ?? staff.name,
              shiftRow.terminal_id,
              sale.saleNumber,
              evt.amount ?? sale.grandTotal,
              evt.quantity ?? null
            );
            entries.push({
              table: 'activity_events',
              pkColumn: 'id',
              pk: id,
              operation: 'INSERT',
              payload: { ...evt, id },
            });
          }

          return { result: undefined, entries };
        },
      });
    } catch (err: any) {
      // Race: two near-simultaneous submits of the same idempotency key.
      if (typeof err?.message === 'string' && err.message.includes('idempotency_key')) {
        const race = db.prepare('SELECT sale_id FROM sales_transactions WHERE idempotency_key = ?').get(sale.idempotencyKey) as
          | { sale_id: string }
          | undefined;
        if (race) {
          res.status(200).json({ sale: loadSale(race.sale_id), alreadyProcessed: true });
          return;
        }
      }
      throw err;
    }

    res.status(201).json({ sale: loadSale(sale.saleId), alreadyProcessed: false });
  })
);

router.get(
  '/:saleNumber',
  asyncHandler(async (req, res) => {
    const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_number = ?').get(req.params.saleNumber) as any;
    if (!saleRow) throw new ApiError(404, 'Sale not found');
    const itemRows = db.prepare('SELECT * FROM sale_line_items WHERE sale_id = ?').all(saleRow.sale_id) as any[];
    const paymentRows = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleRow.sale_id) as any[];
    res.json(rowToSale(saleRow, itemRows, paymentRows));
  })
);

export default router;
