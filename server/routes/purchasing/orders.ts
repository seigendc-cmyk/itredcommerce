import { Router } from 'express';
import { db } from '../../db/connection';
import { asyncHandler, ApiError } from '../../lib/http';
import { requireAccessRole } from '../../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../../lib/accessRoles';
import { applyBatchWithOutbox, type BatchEntry } from '../../sync/outboxWriter';

const router = Router();

function rowToPO(poRow: any, itemRows: any[]) {
  return {
    poNumber: poRow.po_number,
    supplierName: poRow.supplier_name,
    supplierCode: poRow.supplier_code,
    dateCreated: poRow.date_created,
    deliveryDueDate: poRow.delivery_due_date,
    destinationWarehouseId: poRow.destination_warehouse_id,
    destinationWarehouseName: poRow.destination_warehouse_name,
    totalItems: poRow.total_items,
    subtotal: poRow.subtotal,
    taxRate: poRow.tax_rate,
    taxAmount: poRow.tax_amount,
    totalAmount: poRow.total_amount,
    currency: poRow.currency,
    status: poRow.status,
    paymentTerms: poRow.payment_terms,
    authorizedBy: poRow.authorized_by,
    notes: poRow.notes,
    originMemoNumber: poRow.origin_memo_number,
    items: itemRows.map((r) => ({
      sku: r.sku,
      description: r.description,
      orderedQty: r.ordered_qty,
      receivedQty: r.received_qty,
      unitCost: r.unit_cost,
      totalCost: r.total_cost,
    })),
  };
}

function loadPO(poNumber: string) {
  const poRow = db.prepare('SELECT * FROM purchase_orders WHERE po_number = ?').get(poNumber) as any;
  if (!poRow) return null;
  const itemRows = db.prepare('SELECT * FROM purchase_order_items WHERE po_number = ?').all(poNumber) as any[];
  return rowToPO(poRow, itemRows);
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const poRows = (
      status && status !== 'All'
        ? db.prepare('SELECT * FROM purchase_orders WHERE status = ? ORDER BY date_created DESC').all(status)
        : db.prepare('SELECT * FROM purchase_orders ORDER BY date_created DESC').all()
    ) as any[];
    const items = db.prepare('SELECT * FROM purchase_order_items').all() as any[];
    const itemsByPO = new Map<string, any[]>();
    for (const it of items) {
      if (!itemsByPO.has(it.po_number)) itemsByPO.set(it.po_number, []);
      itemsByPO.get(it.po_number)!.push(it);
    }
    res.json(poRows.map((r) => rowToPO(r, itemsByPO.get(r.po_number) ?? [])));
  })
);

router.get(
  '/:poNumber',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (req, res) => {
    const po = loadPO(req.params.poNumber);
    if (!po) throw new ApiError(404, 'Purchase order not found');
    res.json(po);
  })
);

interface POBody {
  poNumber: string;
  supplierName: string;
  supplierCode: string;
  dateCreated: string;
  deliveryDueDate: string;
  destinationWarehouseId?: string;
  destinationWarehouseName?: string;
  totalItems: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentTerms: string;
  authorizedBy: string;
  notes?: string;
  originMemoNumber?: string;
  items: Array<{ sku: string; description: string; orderedQty: number; receivedQty?: number; unitCost: number; totalCost: number }>;
}

// Trusts client-generated poNumber, same precedent as sales.ts's checkout.
router.post(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const po = req.body as POBody;
    if (!po?.poNumber || !po.supplierName || !Array.isArray(po.items) || po.items.length === 0) {
      throw new ApiError(400, 'poNumber, supplierName and a non-empty items array are required');
    }

    try {
      applyBatchWithOutbox({
        db,
        tenantId: null,
        apply: () => {
          const entries: BatchEntry[] = [];
          db.prepare(
            `INSERT INTO purchase_orders (po_number, supplier_name, supplier_code, date_created, delivery_due_date, destination_warehouse_id, destination_warehouse_name, total_items, subtotal, tax_rate, tax_amount, total_amount, currency, status, payment_terms, authorized_by, notes, origin_memo_number)
             VALUES (@poNumber, @supplierName, @supplierCode, @dateCreated, @deliveryDueDate, @destinationWarehouseId, @destinationWarehouseName, @totalItems, @subtotal, @taxRate, @taxAmount, @totalAmount, @currency, @status, @paymentTerms, @authorizedBy, @notes, @originMemoNumber)`
          ).run({
            poNumber: po.poNumber,
            supplierName: po.supplierName,
            supplierCode: po.supplierCode ?? null,
            dateCreated: po.dateCreated,
            deliveryDueDate: po.deliveryDueDate,
            destinationWarehouseId: po.destinationWarehouseId ?? null,
            destinationWarehouseName: po.destinationWarehouseName ?? null,
            totalItems: po.totalItems,
            subtotal: po.subtotal ?? null,
            taxRate: po.taxRate ?? null,
            taxAmount: po.taxAmount ?? null,
            totalAmount: po.totalAmount,
            currency: po.currency ?? 'USD',
            status: po.status ?? 'Open',
            paymentTerms: po.paymentTerms,
            authorizedBy: po.authorizedBy,
            notes: po.notes ?? null,
            originMemoNumber: po.originMemoNumber ?? null,
          });
          entries.push({ table: 'purchase_orders', pkColumn: 'po_number', pk: po.poNumber, operation: 'INSERT', payload: po as unknown as Record<string, unknown> });

          const itemStmt = db.prepare(
            `INSERT INTO purchase_order_items (po_number, sku, description, ordered_qty, received_qty, unit_cost, total_cost)
             VALUES (@poNumber, @sku, @description, @orderedQty, @receivedQty, @unitCost, @totalCost)`
          );
          for (const item of po.items) {
            itemStmt.run({
              poNumber: po.poNumber,
              sku: item.sku,
              description: item.description,
              orderedQty: item.orderedQty,
              receivedQty: item.receivedQty ?? 0,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
            });
            const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
            entries.push({ table: 'purchase_order_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, poNumber: po.poNumber } });
          }

          return { result: undefined, entries };
        },
      });
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('purchase_orders')) {
        res.status(200).json(loadPO(po.poNumber));
        return;
      }
      throw err;
    }

    res.status(201).json(loadPO(po.poNumber));
  })
);

export default router;
