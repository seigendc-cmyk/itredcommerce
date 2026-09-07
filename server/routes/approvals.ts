import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getInstallationConfig } from '../lib/installationConfig';
import { insertPurchaseMemoRecord } from './purchasing/memos';
import { authorizeApprovalDecision } from '../lib/approvalAuthorization';

// DL-065's flagged gap: `approval_requests` had no route at all — not even
// a GET — so a BI_RULE_REDIRECT ticket biRuleGate.ts writes here was
// invisible to this app (Decision Flows in executive-pwa can only see it,
// never act on it — that app is read-only by design). This is the first
// and only place a ticket gets decided, for every approval_requests row
// regardless of type, not just BI Brain's.

const router = Router();
router.use(requireAuth);

interface ApprovalRequestRow {
  id: string;
  request_number: string | null;
  type: string | null;
  title: string | null;
  description: string | null;
  amount: number | null;
  reference_id: string | null;
  reference_type: string | null;
  location_name: string | null;
  requested_by_staff_id: string | null;
  requested_by_staff_name: string | null;
  requested_by_role: string | null;
  requested_date_time: string | null;
  reason: string | null;
  priority: string;
  status: string;
  decided_by_staff_id: string | null;
  decided_by_staff_name: string | null;
  decided_by_role: string | null;
  decision_date_time: string | null;
  decision_notes: string | null;
  meta: string;
}

function rowToApprovalRequest(row: ApprovalRequestRow) {
  return {
    id: row.id,
    requestNumber: row.request_number,
    type: row.type,
    title: row.title,
    description: row.description,
    amount: row.amount ?? undefined,
    referenceId: row.reference_id ?? undefined,
    referenceType: row.reference_type ?? undefined,
    locationName: row.location_name,
    requestedByStaffId: row.requested_by_staff_id,
    requestedByStaffName: row.requested_by_staff_name,
    requestedByRole: row.requested_by_role,
    requestedDateTime: row.requested_date_time,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    decidedByStaffId: row.decided_by_staff_id ?? undefined,
    decidedByStaffName: row.decided_by_staff_name ?? undefined,
    decidedByRole: row.decided_by_role ?? undefined,
    decisionDateTime: row.decision_date_time ?? undefined,
    decisionNotes: row.decision_notes ?? undefined,
    meta: row.meta ? JSON.parse(row.meta) : {},
  };
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(`SELECT * FROM approval_requests ORDER BY requested_date_time DESC`)
      .all() as unknown as ApprovalRequestRow[];
    res.json(rows.map(rowToApprovalRequest));
  })
);

interface DecideBody {
  status: 'APPROVED' | 'REJECTED';
  decisionNotes?: string;
}

// What "approve" actually does to the action a ticket blocked, keyed by
// meta.actionType (mirrors server/sync/biRuleGatedActionReconciler.ts's own
// action_type switch — same reasoning: ships only the one pairing this
// prompt's example rule needs, extend the switch rather than inventing a
// parallel mechanism when a second one exists).
function resolveApprovedAction(actionType: string, payload: unknown): { createdPurchaseMemo: unknown } {
  if (actionType === 'CREATE_PURCHASE_MEMO') {
    insertPurchaseMemoRecord(payload as any);
    const memoRow = db.prepare('SELECT * FROM purchase_memos WHERE id = ?').get((payload as any).id) as any;
    const itemRows = db.prepare('SELECT * FROM purchase_memo_items WHERE memo_id = ?').all((payload as any).id) as any[];
    return {
      createdPurchaseMemo: {
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
      },
    };
  }
  console.error(`[approvals] approved ticket references unknown actionType "${actionType}" — decision recorded, no downstream action taken`);
  return { createdPurchaseMemo: null };
}

router.patch(
  '/:id/decide',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id) as unknown as
      | ApprovalRequestRow
      | undefined;
    if (!row) throw new ApiError(404, 'Approval request not found');
    if (row.status !== 'PENDING') {
      throw new ApiError(409, `This request was already ${row.status.toLowerCase()} — it cannot be decided again`, 'ALREADY_DECIDED');
    }

    // DL-066's flagged gap: enforce server-side the same "manager-or-above,
    // not the original requester" rule ApprovalDetailModal.tsx already
    // enforces client-side (see server/lib/approvalAuthorization.ts) —
    // BACK_OFFICE_WRITE_ROLES alone was too coarse (it also admits e.g. a
    // non-manager HEAD_OFFICE_STAFF role, and doesn't block self-approval).
    const decider = req.currentStaff!;
    const auth = authorizeApprovalDecision(decider, row.requested_by_staff_id);
    if (!auth.allowed) {
      throw new ApiError(
        403,
        auth.reason === 'SELF_APPROVAL'
          ? 'You cannot decide a request you submitted yourself'
          : 'Only a Store Manager or System Administrator may decide an approval request',
        `FORBIDDEN_${auth.reason}`
      );
    }

    const body = req.body as DecideBody;
    if (body.status !== 'APPROVED' && body.status !== 'REJECTED') {
      throw new ApiError(400, 'status must be APPROVED or REJECTED');
    }

    const decisionDateTime = new Date().toISOString();
    // Decided-by identity comes from the authenticated session, never the
    // request body — a client-supplied decidedByStaffId would let the
    // self-approval check above be defeated just by lying about who's
    // deciding.
    const decidedByStaffId = decider.id;
    const decidedByStaffName = decider.name;
    const decidedByRole = decider.roleTitle;

    db.prepare(
      `UPDATE approval_requests
       SET status = @status, decided_by_staff_id = @decidedByStaffId, decided_by_staff_name = @decidedByStaffName,
           decided_by_role = @decidedByRole, decision_date_time = @decisionDateTime, decision_notes = @decisionNotes
       WHERE id = @id`
    ).run({
      id: row.id,
      status: body.status,
      decidedByStaffId,
      decidedByStaffName,
      decidedByRole,
      decisionDateTime,
      decisionNotes: body.decisionNotes ?? null,
    });

    // Mirrored the same way biRuleGate.ts's createApprovalTicket() writes
    // the ticket itself: a direct Supabase write, not the outbox (the
    // general drain loop has no live caller — DL-057's Open Items). Without
    // this, executive-pwa's Decision Flows (reads Supabase directly) would
    // never see the decision this route just made.
    const supabase = getSupabaseAdmin();
    const installation = getInstallationConfig();
    if (supabase && installation?.tenantId) {
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: body.status,
          decided_by_staff_id: decidedByStaffId,
          decided_by_staff_name: decidedByStaffName,
          decided_by_role: decidedByRole,
          decision_date_time: decisionDateTime,
          decision_notes: body.decisionNotes ?? null,
        })
        .eq('id', row.id)
        .eq('tenant_id', installation.tenantId);
      if (error) console.error('[approvals] failed to mirror decision to Supabase:', error);
    }

    let createdPurchaseMemo: unknown = null;
    if (body.status === 'APPROVED' && row.type === 'BI_RULE_REDIRECT') {
      const meta = JSON.parse(row.meta) as { actionType?: string; payload?: unknown };
      if (meta.actionType && meta.payload !== undefined) {
        createdPurchaseMemo = resolveApprovedAction(meta.actionType, meta.payload).createdPurchaseMemo;
      }
    }

    const updatedRow = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(row.id) as unknown as ApprovalRequestRow;
    res.json({ request: rowToApprovalRequest(updatedRow), createdPurchaseMemo });
  })
);

export default router;
