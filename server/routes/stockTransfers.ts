import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, applyWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToTransfer(row: any, itemRows: any[]) {
  return {
    id: row.id,
    transferNumber: row.transfer_number,
    flowType: row.flow_type,
    originLocationId: row.origin_location_id,
    originLocationType: row.origin_location_type,
    originLocationName: row.origin_location_name,
    destinationLocationId: row.destination_location_id,
    destinationLocationType: row.destination_location_type,
    destinationLocationName: row.destination_location_name,
    requestDate: row.request_date,
    status: row.status,
    requestedByStaffName: row.requested_by_staff_name,
    approvedByStaffName: row.approved_by_staff_name,
    approvedDate: row.approved_date,
    dispatchedByStaffName: row.dispatched_by_staff_name,
    dispatchedDate: row.dispatched_date,
    carrierOrVehicle: row.carrier_or_vehicle,
    dispatchNotes: row.dispatch_notes,
    receivedByStaffName: row.received_by_staff_name,
    receivedDate: row.received_date,
    receivingNotes: row.receiving_notes,
    rejectionReason: row.rejection_reason,
    notes: row.notes,
    hasDiscrepancy: !!row.has_discrepancy,
    discrepancyReason: row.discrepancy_reason,
    discrepancyNotes: row.discrepancy_notes,
    items: itemRows.map((r) => ({
      sku: r.sku,
      description: r.description,
      requestedQty: r.requested_qty,
      dispatchedQty: r.dispatched_qty,
      receivedQty: r.received_qty,
      varianceQty: r.variance_qty,
      discrepancyReason: r.discrepancy_reason,
      discrepancyNotes: r.discrepancy_notes,
      unitCost: r.unit_cost,
    })),
  };
}

function loadTransfer(id: string) {
  const row = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(id) as any;
  if (!row) return null;
  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(id) as any[];
  return rowToTransfer(row, items);
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM stock_transfers ORDER BY request_date DESC').all() as any[];
    const items = db.prepare('SELECT * FROM stock_transfer_items').all() as any[];
    const itemsByTransfer = new Map<string, any[]>();
    for (const it of items) {
      if (!itemsByTransfer.has(it.transfer_id)) itemsByTransfer.set(it.transfer_id, []);
      itemsByTransfer.get(it.transfer_id)!.push(it);
    }
    res.json(rows.map((r) => rowToTransfer(r, itemsByTransfer.get(r.id) ?? [])));
  })
);

interface TransferBody {
  id: string;
  transferNumber: string;
  flowType?: string;
  originLocationId?: string;
  sourceLocationId?: string;
  originLocationType?: string;
  sourceLocationType?: string;
  originLocationName?: string;
  sourceLocationName?: string;
  destinationLocationId: string;
  destinationLocationType?: string;
  destinationLocationName: string;
  requestDate?: string;
  status?: string;
  requestedByStaffName: string;
  notes?: string;
  items: Array<{ sku: string; description: string; requestedQty: number; unitCost: number }>;
}

// Trusts client-generated id/transferNumber, same precedent as sales.ts's checkout.
router.post(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const transfer = req.body as TransferBody;
    if (!transfer?.id || !transfer.transferNumber || !Array.isArray(transfer.items) || transfer.items.length === 0) {
      throw new ApiError(400, 'id, transferNumber and a non-empty items array are required');
    }

    try {
      applyBatchWithOutbox({
        db,
        tenantId: null,
        apply: () => {
          const entries: BatchEntry[] = [];
          db.prepare(
            `INSERT INTO stock_transfers (id, transfer_number, flow_type, origin_location_id, origin_location_type, origin_location_name, destination_location_id, destination_location_type, destination_location_name, request_date, status, requested_by_staff_name, notes)
             VALUES (@id, @transferNumber, @flowType, @originLocationId, @originLocationType, @originLocationName, @destinationLocationId, @destinationLocationType, @destinationLocationName, @requestDate, @status, @requestedByStaffName, @notes)`
          ).run({
            id: transfer.id,
            transferNumber: transfer.transferNumber,
            flowType: transfer.flowType ?? null,
            originLocationId: transfer.originLocationId ?? transfer.sourceLocationId ?? null,
            originLocationType: transfer.originLocationType ?? transfer.sourceLocationType ?? null,
            originLocationName: transfer.originLocationName ?? transfer.sourceLocationName ?? null,
            destinationLocationId: transfer.destinationLocationId,
            destinationLocationType: transfer.destinationLocationType ?? null,
            destinationLocationName: transfer.destinationLocationName,
            requestDate: transfer.requestDate ?? nowIso(),
            status: transfer.status ?? 'Requested',
            requestedByStaffName: transfer.requestedByStaffName,
            notes: transfer.notes ?? null,
          });
          entries.push({ table: 'stock_transfers', pkColumn: 'id', pk: transfer.id, operation: 'INSERT', payload: transfer as unknown as Record<string, unknown> });

          const itemStmt = db.prepare(
            `INSERT INTO stock_transfer_items (transfer_id, sku, description, requested_qty, dispatched_qty, received_qty, unit_cost)
             VALUES (@transferId, @sku, @description, @requestedQty, 0, 0, @unitCost)`
          );
          for (const item of transfer.items) {
            itemStmt.run({ transferId: transfer.id, sku: item.sku, description: item.description, requestedQty: item.requestedQty, unitCost: item.unitCost });
            const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
            entries.push({ table: 'stock_transfer_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, transferId: transfer.id } });
          }

          return { result: undefined, entries };
        },
      });
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('stock_transfers')) {
        res.status(200).json(loadTransfer(transfer.id));
        return;
      }
      throw err;
    }

    res.status(201).json(loadTransfer(transfer.id));
  })
);

router.post(
  '/:id/approve',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(req.params.id) as any;
    if (!row) throw new ApiError(404, 'Transfer not found');
    const staff = req.currentStaff!;
    const approvedDate = nowIso().slice(0, 10);

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'stock_transfers',
      pkColumn: 'id',
      pk: row.id,
      operation: 'UPDATE',
      payload: { id: row.id, status: 'Approved', approvedByStaffName: staff.name, approvedDate },
      apply: () => {
        db.prepare(`UPDATE stock_transfers SET status = 'Approved', approved_by_staff_name = ?, approved_date = ? WHERE id = ?`).run(
          staff.name,
          approvedDate,
          row.id
        );
      },
    });

    res.json(loadTransfer(row.id));
  })
);

router.post(
  '/:id/dispatch',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(req.params.id) as any;
    if (!row) throw new ApiError(404, 'Transfer not found');
    const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(row.id) as any[];
    const staff = req.currentStaff!;
    const dispatchedDate = nowIso().slice(0, 10);
    const timestamp = nowIso();

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(`UPDATE stock_transfers SET status = 'Dispatched', dispatched_by_staff_name = ?, dispatched_date = ? WHERE id = ?`).run(
          staff.name,
          dispatchedDate,
          row.id
        );
        entries.push({ table: 'stock_transfers', pkColumn: 'id', pk: row.id, operation: 'UPDATE', payload: { id: row.id, status: 'Dispatched' } });

        const movStmt = db.prepare(
          `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name)
           VALUES (@id, @timestamp, 'Transfer Out', @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName)`
        );
        for (const item of items) {
          db.prepare('UPDATE stock_transfer_items SET dispatched_qty = requested_qty WHERE transfer_id = ? AND sku = ?').run(row.id, item.sku);
          entries.push({ table: 'stock_transfer_items', pkColumn: 'transfer_id', pk: `${row.id}:${item.sku}`, operation: 'UPDATE', payload: { transferId: row.id, sku: item.sku, dispatchedQty: item.requested_qty } });

          const movId = generateId('MOV');
          movStmt.run({
            id: movId,
            timestamp,
            sku: item.sku,
            itemName: item.description,
            quantity: -item.requested_qty,
            unitCost: item.unit_cost,
            totalValue: item.requested_qty * item.unit_cost,
            sourceLocationId: row.origin_location_id,
            sourceLocationName: row.origin_location_name,
            destinationLocationId: row.destination_location_id,
            destinationLocationName: row.destination_location_name,
            referenceDocument: row.transfer_number,
            staffId: staff.id,
            staffName: staff.name,
          });
          entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId } });
        }

        return { result: undefined, entries };
      },
    });

    res.json(loadTransfer(row.id));
  })
);

router.post(
  '/:id/receive',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(req.params.id) as any;
    if (!row) throw new ApiError(404, 'Transfer not found');
    const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(row.id) as any[];
    const staff = req.currentStaff!;
    const receivedDate = nowIso().slice(0, 10);
    const timestamp = nowIso();

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(`UPDATE stock_transfers SET status = 'Received', received_by_staff_name = ?, received_date = ? WHERE id = ?`).run(
          staff.name,
          receivedDate,
          row.id
        );
        entries.push({ table: 'stock_transfers', pkColumn: 'id', pk: row.id, operation: 'UPDATE', payload: { id: row.id, status: 'Received' } });

        const movStmt = db.prepare(
          `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name)
           VALUES (@id, @timestamp, 'Transfer In', @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName)`
        );
        for (const item of items) {
          const dispatched = item.dispatched_qty || item.requested_qty;
          const received = dispatched; // no per-line override UI exists today — see StockTransfersView.onReceiveTransfer
          db.prepare('UPDATE stock_transfer_items SET received_qty = ? WHERE transfer_id = ? AND sku = ?').run(received, row.id, item.sku);
          entries.push({ table: 'stock_transfer_items', pkColumn: 'transfer_id', pk: `${row.id}:${item.sku}`, operation: 'UPDATE', payload: { transferId: row.id, sku: item.sku, receivedQty: received } });

          const movId = generateId('MOV');
          movStmt.run({
            id: movId,
            timestamp,
            sku: item.sku,
            itemName: item.description,
            quantity: received,
            unitCost: item.unit_cost,
            totalValue: received * item.unit_cost,
            sourceLocationId: row.origin_location_id,
            sourceLocationName: row.origin_location_name,
            destinationLocationId: row.destination_location_id,
            destinationLocationName: row.destination_location_name,
            referenceDocument: row.transfer_number,
            staffId: staff.id,
            staffName: staff.name,
          });
          entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId } });

          if (received !== dispatched) {
            const discQty = received - dispatched;
            const discVal = Math.abs(discQty * item.unit_cost);
            const excId = generateId('EXC');
            db.prepare(
              `INSERT INTO operational_exceptions (id, exception_number, title, category, date_time, branch_id, branch_name, staff_id, staff_name, related_transaction_ref, severity, status, variance_amount, variance_units, details, opened_at)
               VALUES (@id, @exceptionNumber, @title, 'TRANSFER_DISCREPANCY', @dateTime, @branchId, @branchName, @staffId, @staffName, @relatedRef, @severity, 'OPEN', @varianceAmount, @varianceUnits, @details, @openedAt)`
            ).run({
              id: excId,
              exceptionNumber: excId,
              title: `Stock Transfer Discrepancy: ${item.sku}`,
              dateTime: timestamp,
              branchId: row.destination_location_id,
              branchName: row.destination_location_name,
              staffId: staff.id,
              staffName: staff.name,
              relatedRef: row.transfer_number,
              severity: discVal > 100 ? 'HIGH' : 'MEDIUM',
              varianceAmount: discVal,
              varianceUnits: discQty,
              details: `Transfer #${row.transfer_number} received ${received} units vs dispatched ${dispatched} units.`,
              openedAt: timestamp,
            });
            entries.push({ table: 'operational_exceptions', pkColumn: 'id', pk: excId, operation: 'INSERT', payload: { id: excId } });
          }
        }

        return { result: undefined, entries };
      },
    });

    res.json(loadTransfer(row.id));
  })
);

router.post(
  '/:id/reject',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(req.params.id) as any;
    if (!row) throw new ApiError(404, 'Transfer not found');
    const { reason } = req.body as { reason?: string };

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'stock_transfers',
      pkColumn: 'id',
      pk: row.id,
      operation: 'UPDATE',
      payload: { id: row.id, status: 'Rejected', rejectionReason: reason },
      apply: () => {
        db.prepare(`UPDATE stock_transfers SET status = 'Rejected', rejection_reason = ? WHERE id = ?`).run(reason ?? null, row.id);
      },
    });

    res.json(loadTransfer(row.id));
  })
);

export default router;
