import { hasRole, MANAGER_ROLES } from './roles';

export interface ApprovalDecider {
  id: string;
  role: string;
}

export type ApprovalDecisionAuthResult =
  | { allowed: true }
  | { allowed: false; reason: 'NOT_MANAGER' | 'SELF_APPROVAL' };

// DL-066's flagged gap: ApprovalDetailModal.tsx already enforces "must be
// STORE_MANAGER or SYS_ADMIN, and not the ticket's own requester" but only
// client-side — server/routes/approvals.ts's decide route had no equivalent
// check of its own, and trusted the client-supplied decidedByStaffId for
// the audit record rather than the session-authenticated staff member.
// Pure so it can be unit tested without a db or express request.
export function authorizeApprovalDecision(
  decider: ApprovalDecider,
  requestedByStaffId: string | null
): ApprovalDecisionAuthResult {
  if (!hasRole(decider.role, ...MANAGER_ROLES)) {
    return { allowed: false, reason: 'NOT_MANAGER' };
  }
  if (requestedByStaffId !== null && decider.id === requestedByStaffId) {
    return { allowed: false, reason: 'SELF_APPROVAL' };
  }
  return { allowed: true };
}
