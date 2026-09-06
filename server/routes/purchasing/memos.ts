import { Router } from 'express';
import { db } from '../../db/connection';
import { asyncHandler, ApiError } from '../../lib/http';
import { requireAccessRole } from '../../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../../lib/accessRoles';
import { applyBatchWithOutbox, applyWithOutbox, type BatchEntry } from '../../sync/outboxWriter';
import { evaluateAndGate } from '../../lib/biRuleGate';
import { computeSalesSinceLastRequest } from '../../lib/biRules/deadStockRestockFacts';

const router = Router();

function rowToMemo(memoRow: any, itemRows: any[]) {
  return {
    id: memoRow.id,
    memoNumber: memoRow.memo_number,
    supplierName: memoRow.supplier_name,
    supplierCode: memoRow.supplier_code,
    requestDate: memoRow.request_date,
    requiredDate: memoRow.required_date,
    requestedByStaffId: memoRow.requested_by_staff_id,
    requestedByStaffName: memoRow.requested_by_staff_name,
    department: memoRow.department,
    destinationWarehouseId: memoRow.destination_warehouse_id,
    destinationWarehouseName: memoRow.destination_warehouse_name,
    priority: memoRow.priority,
    status: memoRow.status,
    notes: memoRow.notes,
    convertedPoNumber: memoRow.converted_po_number,
    approvedByStaffName: memoRow.approved_by_staff_name,
    approvalDate: memoRow.approval_date,
    items: itemRows.map((r) => ({
      sku: r.sku,
      description: r.description,
      requestedQty: r.requested_qty,
      estimatedUnitCost: r.estimated_unit_cost,
      notes: r.notes,
    })),
  };
}

function loadMemo(id: string) {
  const memoRow = db.prepare('SELECT * FROM purchase_memos WHERE id = ?').get(id) as any;
  if (!memoRow) return null;
  const itemRows = db.prepare('SELECT * FROM purchase_memo_items WHERE memo_id = ?').all(id) as any[];
  return rowToMemo(memoRow, itemRows);
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const memoRows = db.prepare('SELECT * FROM purchase_memos ORDER BY request_date DESC').all() as any[];
    const items = db.prepare('SELECT * FROM purchase_memo_items').all() as any[];
    const itemsByMemo = new Map<string, any[]>();
    for (const it of items) {
      if (!itemsByMemo.has(it.memo_id)) itemsByMemo.set(it.memo_id, []);
      itemsByMemo.get(it.memo_id)!.push(it);
    }
    res.json(memoRows.map((r) => rowToMemo(r, itemsByMemo.get(r.id) ?? [])));
  })
);

interface MemoBody {
  id: string;
  memoNumber: string;
  supplierName?: string;
  supplierCode?: string;
  requestDate: string;
  requiredDate?: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  department: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  notes?: string;
  items: Array<{ sku: string; description: string; requestedQty: number; estimatedUnitCost?: number; notes?: string }>;
}

// Factored out of the POST handler so server/sync/biRuleGatedActionReconciler.ts
// can replay an offline-blocked memo request identically once connectivity
// returns and the gate re-evaluation lets it through (DL-062).
export function insertPurchaseMemoRecord(memo: MemoBody): void {
  try {
    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];
        db.prepare(
          `INSERT INTO purchase_memos (id, memo_number, supplier_name, supplier_code, request_date, required_date, requested_by_staff_id, requested_by_staff_name, department, destination_warehouse_id, destination_warehouse_name, priority, status, notes)
           VALUES (@id, @memoNumber, @supplierName, @supplierCode, @requestDate, @requiredDate, @requestedByStaffId, @requestedByStaffName, @department, @destinationWarehouseId, @destinationWarehouseName, @priority, @status, @notes)`
        ).run({
          id: memo.id,
          memoNumber: memo.memoNumber,
          supplierName: memo.supplierName ?? null,
          supplierCode: memo.supplierCode ?? null,
          requestDate: memo.requestDate,
          requiredDate: memo.requiredDate ?? null,
          requestedByStaffId: memo.requestedByStaffId,
          requestedByStaffName: memo.requestedByStaffName,
          department: memo.department,
          destinationWarehouseId: memo.destinationWarehouseId,
          destinationWarehouseName: memo.destinationWarehouseName,
          priority: memo.priority ?? 'MEDIUM',
          status: memo.status ?? 'Submitted',
          notes: memo.notes ?? null,
        });
        entries.push({ table: 'purchase_memos', pkColumn: 'id', pk: memo.id, operation: 'INSERT', payload: memo as unknown as Record<string, unknown> });

        const itemStmt = db.prepare(
          `INSERT INTO purchase_memo_items (memo_id, sku, description, requested_qty, estimated_unit_cost, notes)
           VALUES (@memoId, @sku, @description, @requestedQty, @estimatedUnitCost, @notes)`
        );
        for (const item of memo.items) {
          itemStmt.run({
            memoId: memo.id,
            sku: item.sku,
            description: item.description,
            requestedQty: item.requestedQty,
            estimatedUnitCost: item.estimatedUnitCost ?? null,
            notes: item.notes ?? null,
          });
          const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
          entries.push({ table: 'purchase_memo_items', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, memoId: memo.id } });
        }

        return { result: undefined, entries };
      },
    });
  } catch (err: any) {
    // A retried/replayed memo id landing here twice is a benign no-op, not
    // an error — same UNIQUE-violation tolerance the original route already
    // had for its own retry case.
    if (typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('purchase_memos')) {
      return;
    }
    throw err;
  }
}

// DL-058-063 example rule: BI-DEADSTOCK-RESTOCK-001. Evaluated once per
// distinct sku in the request — if any fires, the whole memo is gated
// rather than letting some items through and not others in one request.
async function evaluateDeadStockGate(memo: MemoBody, requestedByStaffId: string, requestedByStaffName: string) {
  for (const item of memo.items) {
    if (!item.sku) continue;
    const facts = { salesSinceLastRequest: computeSalesSinceLastRequest(item.sku) };
    const result = await evaluateAndGate({
      ruleId: 'BI-DEADSTOCK-RESTOCK-001',
      facts,
      actionType: 'CREATE_PURCHASE_MEMO',
      payload: memo,
      referenceId: item.sku,
      referenceType: 'inventory_item',
      requestedByStaffId,
      requestedByStaffName,
    });
    if (result.outcome !== 'PROCEED') return result;
  }
  return { outcome: 'PROCEED' as const };
}

// Trusts client-generated id/memoNumber, same precedent as sales.ts's
// checkout — this is still effectively a single-desk system until the
// deferred Tauri per-desk work lands (see governance addendum).
router.post(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const memo = req.body as MemoBody;
    if (!memo?.id || !memo.memoNumber || !Array.isArray(memo.items) || memo.items.length === 0) {
      throw new ApiError(400, 'id, memoNumber and a non-empty items array are required');
    }

    const gate = await evaluateDeadStockGate(memo, memo.requestedByStaffId, memo.requestedByStaffName);
    if (gate.outcome === 'BLOCKED_OFFLINE') {
      res.status(503).json({
        error: 'This restock request needs manager approval, which requires connectivity — it will be automatically re-checked once this terminal is back online.',
        code: 'BI_RULE_BLOCKED_OFFLINE',
        gatedActionId: gate.gatedActionId,
      });
      return;
    }
    if (gate.outcome === 'REDIRECTED_TO_APPROVAL') {
      res.status(202).json({
        status: 'pending_approval',
        message: 'This restock request needs manager approval before the memo is created.',
        approvalRequestId: gate.approvalRequestId,
      });
      return;
    }

    insertPurchaseMemoRecord(memo);
    res.status(201).json(loadMemo(memo.id));
  })
);

interface MemoPatchBody {
  status?: string;
  approvedByStaffName?: string;
  approvalDate?: string;
  convertedPoNumber?: string;
  rejectionReason?: string;
}

router.patch(
  '/:id',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const memoRow = db.prepare('SELECT * FROM purchase_memos WHERE id = ?').get(req.params.id) as any;
    if (!memoRow) throw new ApiError(404, 'Purchase memo not found');

    const body = req.body as MemoPatchBody;
    // purchase_memos has no dedicated rejection-reason column — fold it
    // into notes rather than adding a schema column for one optional field.
    const notes = body.rejectionReason ? `${memoRow.notes ? memoRow.notes + ' ' : ''}Rejected: ${body.rejectionReason}` : memoRow.notes;

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'purchase_memos',
      pkColumn: 'id',
      pk: memoRow.id,
      operation: 'UPDATE',
      payload: { id: memoRow.id, ...body },
      apply: () => {
        db.prepare(
          `UPDATE purchase_memos SET status = ?, approved_by_staff_name = ?, approval_date = ?, converted_po_number = ?, notes = ? WHERE id = ?`
        ).run(
          body.status ?? memoRow.status,
          body.approvedByStaffName ?? memoRow.approved_by_staff_name,
          body.approvalDate ?? memoRow.approval_date,
          body.convertedPoNumber ?? memoRow.converted_po_number,
          notes,
          memoRow.id
        );
      },
    });

    res.json(loadMemo(memoRow.id));
  })
);

export default router;
