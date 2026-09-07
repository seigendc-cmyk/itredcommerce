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
    // Prompt 18 / DL-078: over-dispatch is allowed, not blocked — this is
    // the transfer-level rollup so a list view can flag it without joining
    // into line items; per-line detail is on each item below.
    hasDispatchStockWarning: !!row.has_dispatch_stock_warning,
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
      stockOnHandAtDispatch: r.stock_on_hand_at_dispatch,
      dispatchShortfallQty: r.dispatch_shortfall_qty,
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

interface StockTransferRow {
  id: string;
  status: string;
  origin_location_id: string | null;
  origin_location_name: string | null;
  destination_location_id: string | null;
  destination_location_name: string | null;
  transfer_number: string;
  approve_idempotency_key: string | null;
  dispatch_idempotency_key: string | null;
  receive_idempotency_key: string | null;
  reject_idempotency_key: string | null;
}

function loadTransferRow(id: string): StockTransferRow | undefined {
  return db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(id) as any as StockTransferRow | undefined;
}

function requireIdempotencyKey(idempotencyKey: unknown): string {
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new ApiError(400, 'idempotencyKey is required');
  }
  return idempotencyKey;
}

// ============================================================
// APPROVE — Requested -> Approved. No inventory impact.
// ============================================================
export interface ApproveTransferParams {
  transferId: string;
  staffName: string;
  idempotencyKey: string;
}
export interface ApproveTransferResult {
  transfer: NonNullable<ReturnType<typeof loadTransfer>>;
  alreadyProcessed: boolean;
}

export function approveTransfer(params: ApproveTransferParams): ApproveTransferResult {
  const { transferId, staffName, idempotencyKey } = params;
  requireIdempotencyKey(idempotencyKey);
  const row = loadTransferRow(transferId);
  if (!row) throw new ApiError(404, 'Transfer not found');

  if (row.approve_idempotency_key === idempotencyKey) {
    return { transfer: loadTransfer(transferId)!, alreadyProcessed: true };
  }
  if (row.status !== 'Requested') {
    throw new ApiError(409, `Transfer must be in Requested status to approve it (currently ${row.status})`, 'INVALID_TRANSFER_STATE');
  }

  const approvedDate = nowIso().slice(0, 10);
  applyWithOutbox({
    db,
    tenantId: null,
    table: 'stock_transfers',
    pkColumn: 'id',
    pk: row.id,
    operation: 'UPDATE',
    payload: { id: row.id, status: 'Approved', approvedByStaffName: staffName, approvedDate },
    apply: () => {
      db.prepare(
        `UPDATE stock_transfers SET status = 'Approved', approved_by_staff_name = ?, approved_date = ?, approve_idempotency_key = ? WHERE id = ?`
      ).run(staffName, approvedDate, idempotencyKey, row.id);
    },
  });

  return { transfer: loadTransfer(transferId)!, alreadyProcessed: false };
}

// ============================================================
// DISPATCH — Approved -> Dispatched. Decrements inventory_items.
// stock_on_hand for each line (uncapped — over-dispatch is allowed and
// flagged, not blocked, per DL-078) and writes the 'Transfer Out' ledger
// row, atomically in the same local transaction.
// ============================================================
export interface DispatchTransferParams {
  transferId: string;
  staffId: string;
  staffName: string;
  idempotencyKey: string;
}
export interface DispatchWarning {
  sku: string;
  requestedQty: number;
  stockOnHandBeforeDispatch: number;
  shortfallQty: number;
}
export interface DispatchTransferResult {
  transfer: NonNullable<ReturnType<typeof loadTransfer>>;
  alreadyProcessed: boolean;
  dispatchWarnings: DispatchWarning[];
}

export function dispatchTransfer(params: DispatchTransferParams): DispatchTransferResult {
  const { transferId, staffId, staffName, idempotencyKey } = params;
  requireIdempotencyKey(idempotencyKey);
  const row = loadTransferRow(transferId);
  if (!row) throw new ApiError(404, 'Transfer not found');

  if (row.dispatch_idempotency_key === idempotencyKey) {
    const transfer = loadTransfer(transferId)!;
    const dispatchWarnings: DispatchWarning[] = transfer.items
      .filter((it) => (it.dispatchShortfallQty ?? 0) > 0)
      .map((it) => ({
        sku: it.sku,
        requestedQty: it.requestedQty,
        stockOnHandBeforeDispatch: (it.stockOnHandAtDispatch ?? 0) as number,
        shortfallQty: it.dispatchShortfallQty as number,
      }));
    return { transfer, alreadyProcessed: true, dispatchWarnings };
  }
  if (row.status !== 'Approved') {
    throw new ApiError(409, `Transfer must be in Approved status to dispatch it (currently ${row.status})`, 'INVALID_TRANSFER_STATE');
  }

  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(row.id) as any[];
  const dispatchedDate = nowIso().slice(0, 10);
  const timestamp = nowIso();
  const dispatchWarnings: DispatchWarning[] = [];

  applyBatchWithOutbox({
    db,
    tenantId: null,
    apply: () => {
      const entries: BatchEntry[] = [];

      const invStmt = db.prepare('SELECT sku, stock_on_hand FROM inventory_items WHERE sku = ?');
      const updateInvStmt = db.prepare('UPDATE inventory_items SET stock_on_hand = ?, last_updated = ? WHERE sku = ?');
      const movStmt = db.prepare(
        `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name)
         VALUES (@id, @timestamp, 'Transfer Out', @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName)`
      );

      for (const item of items) {
        const invRow = invStmt.get(item.sku) as { sku: string; stock_on_hand: number } | undefined;
        const stockBefore = invRow?.stock_on_hand ?? 0;
        const shortfallQty = Math.max(0, item.requested_qty - stockBefore);
        // Uncapped by design (DL-078): the resulting figure is allowed to
        // go negative rather than clamp at zero — clamping would hide the
        // exact deficit from the aggregate figure and defeat the "visible
        // for reconciliation" purpose the warning flag exists for. This
        // codebase's inventory_items.stock_on_hand has no per-branch
        // split (a single tenant-wide figure per SKU — see the header
        // comment on 20260829120300_inventory.sql), so this decrement
        // reflects the goods leaving the pool entirely while in transit,
        // symmetric with receive's increment putting them back.
        const newStock = stockBefore - item.requested_qty;

        if (invRow) {
          updateInvStmt.run(newStock, timestamp, item.sku);
          entries.push({ table: 'inventory_items', pkColumn: 'sku', pk: item.sku, operation: 'UPDATE', payload: { sku: item.sku, stockOnHand: newStock } });
        }

        db.prepare(
          'UPDATE stock_transfer_items SET dispatched_qty = requested_qty, stock_on_hand_at_dispatch = ?, dispatch_shortfall_qty = ? WHERE transfer_id = ? AND sku = ?'
        ).run(stockBefore, shortfallQty > 0 ? shortfallQty : null, row.id, item.sku);
        entries.push({
          table: 'stock_transfer_items',
          pkColumn: 'transfer_id',
          pk: `${row.id}:${item.sku}`,
          operation: 'UPDATE',
          payload: { transferId: row.id, sku: item.sku, dispatchedQty: item.requested_qty, stockOnHandAtDispatch: stockBefore, dispatchShortfallQty: shortfallQty > 0 ? shortfallQty : null },
        });

        if (shortfallQty > 0) {
          dispatchWarnings.push({ sku: item.sku, requestedQty: item.requested_qty, stockOnHandBeforeDispatch: stockBefore, shortfallQty });
        }

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
          staffId,
          staffName,
        });
        entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId } });
      }

      const hasWarning = dispatchWarnings.length > 0;
      db.prepare(
        `UPDATE stock_transfers SET status = 'Dispatched', dispatched_by_staff_name = ?, dispatched_date = ?, dispatch_idempotency_key = ?, has_dispatch_stock_warning = ? WHERE id = ?`
      ).run(staffName, dispatchedDate, idempotencyKey, hasWarning ? 1 : 0, row.id);
      entries.push({ table: 'stock_transfers', pkColumn: 'id', pk: row.id, operation: 'UPDATE', payload: { id: row.id, status: 'Dispatched', hasDispatchStockWarning: hasWarning } });

      return { result: undefined, entries };
    },
  });

  return { transfer: loadTransfer(transferId)!, alreadyProcessed: false, dispatchWarnings };
}

// ============================================================
// RECEIVE — Dispatched -> Received. Increments inventory_items.
// stock_on_hand for each line (received qty — still computed as
// dispatched_qty || requested_qty; no per-line override UI exists today,
// unchanged by this prompt) and writes the 'Transfer In' ledger row,
// atomically in the same local transaction.
// ============================================================
export interface ReceiveTransferParams {
  transferId: string;
  staffId: string;
  staffName: string;
  idempotencyKey: string;
}
export interface ReceiveTransferResult {
  transfer: NonNullable<ReturnType<typeof loadTransfer>>;
  alreadyProcessed: boolean;
}

export function receiveTransfer(params: ReceiveTransferParams): ReceiveTransferResult {
  const { transferId, staffId, staffName, idempotencyKey } = params;
  requireIdempotencyKey(idempotencyKey);
  const row = loadTransferRow(transferId);
  if (!row) throw new ApiError(404, 'Transfer not found');

  if (row.receive_idempotency_key === idempotencyKey) {
    return { transfer: loadTransfer(transferId)!, alreadyProcessed: true };
  }
  if (row.status !== 'Dispatched') {
    throw new ApiError(409, `Transfer must be in Dispatched status to receive it (currently ${row.status})`, 'INVALID_TRANSFER_STATE');
  }

  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(row.id) as any[];
  const receivedDate = nowIso().slice(0, 10);
  const timestamp = nowIso();

  applyBatchWithOutbox({
    db,
    tenantId: null,
    apply: () => {
      const entries: BatchEntry[] = [];

      const invStmt = db.prepare('SELECT sku, stock_on_hand FROM inventory_items WHERE sku = ?');
      const updateInvStmt = db.prepare('UPDATE inventory_items SET stock_on_hand = ?, last_updated = ? WHERE sku = ?');
      const movStmt = db.prepare(
        `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name)
         VALUES (@id, @timestamp, 'Transfer In', @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName)`
      );

      for (const item of items) {
        const dispatched = item.dispatched_qty || item.requested_qty;
        const received = dispatched; // no per-line override UI exists today — see StockTransfersView.onReceiveTransfer

        const invRow = invStmt.get(item.sku) as { sku: string; stock_on_hand: number } | undefined;
        const stockBefore = invRow?.stock_on_hand ?? 0;
        const newStock = stockBefore + received;
        if (invRow) {
          updateInvStmt.run(newStock, timestamp, item.sku);
          entries.push({ table: 'inventory_items', pkColumn: 'sku', pk: item.sku, operation: 'UPDATE', payload: { sku: item.sku, stockOnHand: newStock } });
        }

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
          staffId,
          staffName,
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
            staffId,
            staffName,
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

      db.prepare(`UPDATE stock_transfers SET status = 'Received', received_by_staff_name = ?, received_date = ?, receive_idempotency_key = ? WHERE id = ?`).run(
        staffName,
        receivedDate,
        idempotencyKey,
        row.id
      );
      entries.push({ table: 'stock_transfers', pkColumn: 'id', pk: row.id, operation: 'UPDATE', payload: { id: row.id, status: 'Received' } });

      return { result: undefined, entries };
    },
  });

  return { transfer: loadTransfer(transferId)!, alreadyProcessed: false };
}

// ============================================================
// REJECT — only valid from Requested or Approved (DL-078). Once
// Dispatched, goods are physically in transit and stock has already
// moved — rejection with reversal is a separate, not-yet-designed
// capability (see governance doc).
// ============================================================
export interface RejectTransferParams {
  transferId: string;
  reason?: string;
  idempotencyKey: string;
}
export interface RejectTransferResult {
  transfer: NonNullable<ReturnType<typeof loadTransfer>>;
  alreadyProcessed: boolean;
}

export function rejectTransfer(params: RejectTransferParams): RejectTransferResult {
  const { transferId, reason, idempotencyKey } = params;
  requireIdempotencyKey(idempotencyKey);
  const row = loadTransferRow(transferId);
  if (!row) throw new ApiError(404, 'Transfer not found');

  if (row.reject_idempotency_key === idempotencyKey) {
    return { transfer: loadTransfer(transferId)!, alreadyProcessed: true };
  }
  if (row.status !== 'Requested' && row.status !== 'Approved') {
    throw new ApiError(
      409,
      `Transfer must be in Requested or Approved status to reject it (currently ${row.status}) — once Dispatched, goods are in transit and rejection is no longer valid`,
      'INVALID_TRANSFER_STATE'
    );
  }

  applyWithOutbox({
    db,
    tenantId: null,
    table: 'stock_transfers',
    pkColumn: 'id',
    pk: row.id,
    operation: 'UPDATE',
    payload: { id: row.id, status: 'Rejected', rejectionReason: reason },
    apply: () => {
      db.prepare(`UPDATE stock_transfers SET status = 'Rejected', rejection_reason = ?, reject_idempotency_key = ? WHERE id = ?`).run(reason ?? null, idempotencyKey, row.id);
    },
  });

  return { transfer: loadTransfer(transferId)!, alreadyProcessed: false };
}

function isIdempotencyKeyRaceError(err: any, column: string): boolean {
  return typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes(column);
}

router.post(
  '/:id/approve',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const staff = req.currentStaff!;
    const { idempotencyKey } = req.body as { idempotencyKey?: string };
    try {
      const { transfer } = approveTransfer({ transferId: req.params.id, staffName: staff.name, idempotencyKey: idempotencyKey! });
      res.json(transfer);
    } catch (err: any) {
      if (isIdempotencyKeyRaceError(err, 'approve_idempotency_key')) {
        res.json(loadTransfer(req.params.id));
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/:id/dispatch',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const staff = req.currentStaff!;
    const { idempotencyKey } = req.body as { idempotencyKey?: string };
    try {
      const { transfer, dispatchWarnings } = dispatchTransfer({ transferId: req.params.id, staffId: staff.id, staffName: staff.name, idempotencyKey: idempotencyKey! });
      res.json({ ...transfer, dispatchWarnings });
    } catch (err: any) {
      if (isIdempotencyKeyRaceError(err, 'dispatch_idempotency_key')) {
        res.json({ ...loadTransfer(req.params.id), dispatchWarnings: [] });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/:id/receive',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const staff = req.currentStaff!;
    const { idempotencyKey } = req.body as { idempotencyKey?: string };
    try {
      const { transfer } = receiveTransfer({ transferId: req.params.id, staffId: staff.id, staffName: staff.name, idempotencyKey: idempotencyKey! });
      res.json(transfer);
    } catch (err: any) {
      if (isIdempotencyKeyRaceError(err, 'receive_idempotency_key')) {
        res.json(loadTransfer(req.params.id));
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/:id/reject',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const { reason, idempotencyKey } = req.body as { reason?: string; idempotencyKey?: string };
    try {
      const { transfer } = rejectTransfer({ transferId: req.params.id, reason, idempotencyKey: idempotencyKey! });
      res.json(transfer);
    } catch (err: any) {
      if (isIdempotencyKeyRaceError(err, 'reject_idempotency_key')) {
        res.json(loadTransfer(req.params.id));
        return;
      }
      throw err;
    }
  })
);

export default router;
