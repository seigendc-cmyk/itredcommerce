import { Router } from 'express';
import { db } from '../../db/connection';
import { asyncHandler, ApiError } from '../../lib/http';
import { requireAccessRole } from '../../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../../lib/accessRoles';
import { generateId, generateDocumentNumber, nowIso } from '../../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../../sync/outboxWriter';

const router = Router();

function rowToGRN(grnRow: any, itemRows: any[]) {
  return {
    id: grnRow.id,
    grnNumber: grnRow.grn_number,
    poNumber: grnRow.po_number,
    supplierCode: grnRow.supplier_code,
    supplierName: grnRow.supplier_name,
    destinationWarehouseId: grnRow.destination_warehouse_id,
    destinationWarehouseName: grnRow.destination_warehouse_name,
    receivedDate: grnRow.received_date,
    receivedByStaffName: grnRow.received_by_staff_name,
    deliveryNoteNumber: grnRow.delivery_note_number,
    totalUnitsReceived: grnRow.total_units_received,
    totalValuation: grnRow.total_valuation,
    status: grnRow.status,
    notes: grnRow.notes,
    items: itemRows.map((r) => ({
      sku: r.sku,
      description: r.description,
      orderedQty: r.ordered_qty,
      receivedQty: r.received_qty,
      unitCost: r.unit_cost,
      totalCost: r.total_cost,
      batchNumber: r.batch_number,
      expiryDate: r.expiry_date,
      condition: r.condition,
    })),
  };
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const grnRows = db.prepare('SELECT * FROM goods_receipt_notes ORDER BY received_date DESC').all() as any[];
    const items = db.prepare('SELECT * FROM goods_receipt_note_items').all() as any[];
    const itemsByGrn = new Map<string, any[]>();
    for (const it of items) {
      if (!itemsByGrn.has(it.grn_id)) itemsByGrn.set(it.grn_id, []);
      itemsByGrn.get(it.grn_id)!.push(it);
    }
    res.json(grnRows.map((r) => rowToGRN(r, itemsByGrn.get(r.id) ?? [])));
  })
);

interface ReceiptLine {
  sku: string;
  itemName: string;
  qtyReceiving: number;
  unitCost: number;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  binLocation?: string;
}

interface ReceiptBody {
  poNumber: string | null;
  warehouseId: string;
  lines: ReceiptLine[];
  notes?: string;
}

// Mirrors ReceiveStockView.onConfirmReceiving's signature (poNumber can be
// null — an ad-hoc receipt with no PO reference) rather than a pre-built
// GoodsReceiptNote, since the component never builds one client-side. The
// server assigns id/grnNumber/status and, when poNumber is given, updates
// the PO's received quantities and flags a variance exception per line
// whose receipt differs from what was still outstanding on the PO.
router.post(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const body = req.body as ReceiptBody;
    if (!body?.warehouseId || !Array.isArray(body.lines) || body.lines.length === 0) {
      throw new ApiError(400, 'warehouseId and a non-empty lines array are required');
    }

    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(body.warehouseId) as any;
    if (!warehouse) throw new ApiError(404, 'Unknown warehouse', 'WAREHOUSE_NOT_FOUND');

    let poRow: any = null;
    let outstandingBySku = new Map<string, number>();
    if (body.poNumber) {
      poRow = db.prepare('SELECT * FROM purchase_orders WHERE po_number = ?').get(body.poNumber) as any;
      if (!poRow) throw new ApiError(404, 'Unknown purchase order', 'PO_NOT_FOUND');
      const poItems = db.prepare('SELECT * FROM purchase_order_items WHERE po_number = ?').all(body.poNumber) as any[];
      for (const it of poItems) {
        outstandingBySku.set(it.sku, Math.max(0, it.ordered_qty - it.received_qty));
      }
    }

    const staff = req.currentStaff!;
    const receivedDate = nowIso();
    const id = generateId('GRN');
    const grnNumber = generateDocumentNumber('GRN');
    const totalUnitsReceived = body.lines.reduce((sum, l) => sum + l.qtyReceiving, 0);
    const totalValuation = body.lines.reduce((sum, l) => sum + l.qtyReceiving * l.unitCost, 0);
    const hasAnyVariance = body.poNumber
      ? body.lines.some((l) => l.qtyReceiving !== (outstandingBySku.get(l.sku) ?? l.qtyReceiving))
      : false;

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `INSERT INTO goods_receipt_notes (id, grn_number, po_number, supplier_code, supplier_name, destination_warehouse_id, destination_warehouse_name, received_date, received_by_staff_name, delivery_note_number, total_units_received, total_valuation, status, notes)
           VALUES (@id, @grnNumber, @poNumber, @supplierCode, @supplierName, @warehouseId, @warehouseName, @receivedDate, @staffName, @deliveryNoteNumber, @totalUnitsReceived, @totalValuation, @status, @notes)`
        ).run({
          id,
          grnNumber,
          poNumber: body.poNumber ?? null,
          supplierCode: poRow?.supplier_code ?? null,
          supplierName: poRow?.supplier_name ?? null,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          receivedDate,
          staffName: staff.name,
          deliveryNoteNumber: null,
          totalUnitsReceived,
          totalValuation,
          status: hasAnyVariance ? 'ACCEPTED_WITH_DISCREPANCY' : 'ACCEPTED',
          notes: body.notes ?? null,
        });
        entries.push({ table: 'goods_receipt_notes', pkColumn: 'id', pk: id, operation: 'INSERT', payload: { id, grnNumber, ...body } });

        const itemStmt = db.prepare(
          `INSERT INTO goods_receipt_note_items (grn_id, sku, description, ordered_qty, received_qty, unit_cost, total_cost, batch_number, expiry_date, condition)
           VALUES (@grnId, @sku, @description, @orderedQty, @receivedQty, @unitCost, @totalCost, @batchNumber, @expiryDate, @condition)`
        );
        const movementStmt = db.prepare(
          `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, destination_location_id, destination_location_name, reference_document, staff_id, staff_name, notes)
           VALUES (@id, @timestamp, 'Supplier Receipt', @sku, @itemName, @quantity, @unitCost, @totalValue, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName, @notes)`
        );

        for (const line of body.lines) {
          const outstanding = outstandingBySku.get(line.sku);
          const isVariance = body.poNumber ? line.qtyReceiving !== (outstanding ?? line.qtyReceiving) : false;

          itemStmt.run({
            grnId: id,
            sku: line.sku,
            description: line.itemName,
            orderedQty: outstanding ?? line.qtyReceiving,
            receivedQty: line.qtyReceiving,
            unitCost: line.unitCost,
            totalCost: line.qtyReceiving * line.unitCost,
            batchNumber: line.batchNumber ?? null,
            expiryDate: line.expiryDate ?? null,
            condition: isVariance ? 'DISCREPANCY' : 'GOOD',
          });
          const grnItemId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'goods_receipt_note_items', pkColumn: 'id', pk: grnItemId, operation: 'INSERT', payload: { ...line, grnId: id } });

          if (body.poNumber) {
            db.prepare('UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE po_number = ? AND sku = ?').run(
              line.qtyReceiving,
              body.poNumber,
              line.sku
            );
            entries.push({
              table: 'purchase_order_items',
              pkColumn: 'po_number',
              pk: `${body.poNumber}:${line.sku}`,
              operation: 'UPDATE',
              payload: { poNumber: body.poNumber, sku: line.sku, receivedQtyDelta: line.qtyReceiving },
            });
          }

          const movId = generateId('MOV');
          movementStmt.run({
            id: movId,
            timestamp: receivedDate,
            sku: line.sku,
            itemName: line.itemName,
            quantity: line.qtyReceiving,
            unitCost: line.unitCost,
            totalValue: line.qtyReceiving * line.unitCost,
            destinationLocationId: warehouse.id,
            destinationLocationName: warehouse.name,
            referenceDocument: `${grnNumber}${body.poNumber ? ` (PO: ${body.poNumber})` : ''}`,
            staffId: staff.id,
            staffName: staff.name,
            notes: null,
          });
          entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId, sku: line.sku, quantity: line.qtyReceiving } });

          db.prepare('UPDATE inventory_items SET stock_on_hand = stock_on_hand + ?, last_updated = ? WHERE sku = ?').run(
            line.qtyReceiving,
            receivedDate,
            line.sku
          );
          entries.push({ table: 'inventory_items', pkColumn: 'sku', pk: line.sku, operation: 'UPDATE', payload: { sku: line.sku, stockOnHandDelta: line.qtyReceiving } });

          if (isVariance) {
            const varQty = line.qtyReceiving - (outstanding ?? 0);
            const varVal = Math.abs(varQty * line.unitCost);
            const excId = generateId('EXC');
            const excNumber = generateDocumentNumber('EXC');
            db.prepare(
              `INSERT INTO operational_exceptions (id, exception_number, title, category, date_time, branch_id, branch_name, staff_id, staff_name, related_transaction_ref, severity, status, variance_amount, variance_units, details, opened_at)
               VALUES (@id, @exceptionNumber, @title, 'SUPPLIER_RECEIVING_VARIANCE', @dateTime, @warehouseId, @warehouseName, @staffId, @staffName, @relatedRef, @severity, 'OPEN', @varianceAmount, @varianceUnits, @details, @openedAt)`
            ).run({
              id: excId,
              exceptionNumber: excNumber,
              title: `Supplier Delivery Variance: ${line.sku}`,
              dateTime: receivedDate,
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              staffId: staff.id,
              staffName: staff.name,
              relatedRef: grnNumber,
              severity: varVal > 150 ? 'HIGH' : 'MEDIUM',
              varianceAmount: varVal,
              varianceUnits: varQty,
              details: `GRN #${grnNumber} (PO #${body.poNumber}): Received ${line.qtyReceiving} units vs ${outstanding ?? 0} outstanding (${varQty > 0 ? '+' : ''}${varQty} units variance, Valuation: $${varVal.toFixed(2)}).`,
              openedAt: receivedDate,
            });
            entries.push({ table: 'operational_exceptions', pkColumn: 'id', pk: excId, operation: 'INSERT', payload: { id: excId } });

            const evtId = generateId('EVT');
            db.prepare(
              `INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, reference_document, amount, quantity)
               VALUES (@id, 'SUPPLIER_RECEIVING_VARIANCE', @timestamp, @description, @staffId, @staffName, @referenceDocument, @amount, @quantity)`
            ).run({
              id: evtId,
              timestamp: receivedDate,
              description: `Supplier delivery variance on ${grnNumber} for SKU ${line.sku}: ${line.qtyReceiving} received vs ${outstanding ?? 0} outstanding.`,
              staffId: staff.id,
              staffName: staff.name,
              referenceDocument: grnNumber,
              amount: varVal,
              quantity: varQty,
            });
            entries.push({ table: 'activity_events', pkColumn: 'id', pk: evtId, operation: 'INSERT', payload: { id: evtId } });
          }
        }

        if (body.poNumber) {
          const updatedItems = db.prepare('SELECT ordered_qty, received_qty FROM purchase_order_items WHERE po_number = ?').all(body.poNumber) as any[];
          const allComplete = updatedItems.every((it) => it.received_qty >= it.ordered_qty);
          const anyReceived = updatedItems.some((it) => it.received_qty > 0);
          const newStatus = allComplete ? 'Completed' : anyReceived ? 'Part Received' : poRow.status;
          db.prepare('UPDATE purchase_orders SET status = ? WHERE po_number = ?').run(newStatus, body.poNumber);
          entries.push({ table: 'purchase_orders', pkColumn: 'po_number', pk: body.poNumber, operation: 'UPDATE', payload: { poNumber: body.poNumber, status: newStatus } });
        }

        return { result: undefined, entries };
      },
    });

    const grnRow = db.prepare('SELECT * FROM goods_receipt_notes WHERE id = ?').get(id) as any;
    const itemRows = db.prepare('SELECT * FROM goods_receipt_note_items WHERE grn_id = ?').all(id) as any[];
    res.status(201).json(rowToGRN(grnRow, itemRows));
  })
);

export default router;
