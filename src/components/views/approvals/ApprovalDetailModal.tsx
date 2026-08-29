import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  X, 
  Clock, 
  UserCheck, 
  Tag, 
  DollarSign, 
  FileText, 
  AlertTriangle, 
  Lock,
  ArrowRight,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { StaffMember, ApprovalRequest } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApprovalRequest | null;
  currentStaff: StaffMember;
  onDecision: (requestId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => void;
}

export const ApprovalDetailModal: React.FC<ApprovalDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  currentStaff,
  onDecision,
}) => {
  if (!isOpen || !request) return null;

  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Critical operational rule: Cashiers must not approve their own restricted actions!
  // And requires role STORE_MANAGER or SYS_ADMIN
  const isManagerOrAdmin = currentStaff.role === 'STORE_MANAGER' || currentStaff.role === 'SYS_ADMIN';
  const isSelfRequested = currentStaff.id === request.requestedByStaffId;
  const canDecide = isManagerOrAdmin && !isSelfRequested;

  const handleApprove = () => {
    setErrorMsg('');
    if (!canDecide) {
      setErrorMsg('Unauthorized: Operating rules strictly prohibit cashiers or requestors from approving their own sensitive action.');
      return;
    }
    onDecision(request.id, 'APPROVED', decisionNotes.trim() || 'Approved by supervisor in compliance with operational policies.');
  };

  const handleReject = () => {
    setErrorMsg('');
    if (!canDecide) {
      setErrorMsg('Unauthorized: Operating rules strictly prohibit cashiers or requestors from approving their own sensitive action.');
      return;
    }
    if (!decisionNotes.trim()) {
      setErrorMsg('Rejection requires mandatory explanation notes.');
      return;
    }
    onDecision(request.id, 'REJECTED', decisionNotes.trim());
  };

  const isPending = request.status === 'PENDING';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 flex items-center justify-center text-white font-bold text-sm ${
              request.priority === 'CRITICAL' ? 'bg-rose-600' : request.priority === 'HIGH' ? 'bg-amber-600' : 'bg-blue-600'
            }`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                Approval Request Review
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                {request.requestNumber} • {request.type.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && <Alert type="error" message={errorMsg} />}

          {/* Self-approval or Role Warning */}
          {isPending && isSelfRequested && (
            <div className="bg-rose-50 border border-rose-400 p-3 flex items-center gap-2.5 text-rose-900 text-xs">
              <Ban className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong>Self-Approval Prohibited:</strong> You requested this override. Another authorized Store Manager must review and sign off.
              </div>
            </div>
          )}

          {isPending && !isManagerOrAdmin && !isSelfRequested && (
            <div className="bg-amber-50 border border-amber-400 p-3 flex items-center gap-2.5 text-amber-900 text-xs">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong>Manager Role Required:</strong> Only users with Store Manager or Administrator rights can approve sensitive overrides.
              </div>
            </div>
          )}

          {/* Core Request Information */}
          <div className="bg-gray-50 border border-gray-300 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                request.priority === 'CRITICAL' ? 'bg-rose-600 text-white' : request.priority === 'HIGH' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
              }`}>
                {request.priority} Priority
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                request.status === 'APPROVED' ? 'bg-emerald-600 text-white' : request.status === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                Status: {request.status}
              </span>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-sm">{request.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{request.description}</p>
            </div>

            {request.amount !== undefined && (
              <div className="bg-white p-2 border border-gray-200 flex items-center justify-between font-mono">
                <span className="text-[11px] text-gray-500 uppercase font-sans">Financial Impact / Amount:</span>
                <span className="font-bold text-sm text-gray-900">${Math.abs(request.amount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Requested Details Audit Box */}
          <div className="border border-gray-200 p-3 space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Originating Request Audit Trail
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-500 block">Requested By:</span>
                <span className="font-bold text-gray-900">{request.requestedByStaffName}</span>
                <span className="text-gray-500 text-[10px] block">({request.requestedByRole})</span>
              </div>
              <div>
                <span className="text-gray-500 block">Requested Time:</span>
                <span className="font-mono text-gray-900">{request.requestedDateTime}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Location:</span>
                <span className="text-gray-900">{request.locationName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Reference ID:</span>
                <span className="font-mono text-gray-900">{request.referenceId || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <span className="text-gray-500 text-[10px] uppercase font-bold block">Justification / Reason:</span>
              <p className="text-xs text-gray-800 bg-gray-50 p-2 border border-gray-200 mt-1 italic">
                "{request.reason}"
              </p>
            </div>
          </div>

          {/* Historical Decision Details if already decided */}
          {!isPending && (
            <div className={`p-3 border space-y-2 text-xs ${
              request.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                {request.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>Decision Record (Immutable Audit Trail)</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500 block">Decided By:</span>
                  <span className="font-bold text-gray-900">{request.decidedByStaffName}</span>
                  <span className="text-gray-500 text-[10px] block">({request.decidedByRole})</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Decision Time:</span>
                  <span className="font-mono text-gray-900">{request.decisionDateTime}</span>
                </div>
              </div>

              {request.decisionNotes && (
                <div className="pt-1.5 border-t border-gray-200">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Decision Remarks:</span>
                  <p className="text-xs text-gray-800 mt-0.5">"{request.decisionNotes}"</p>
                </div>
              )}
            </div>
          )}

          {/* Pending Decision Form */}
          {isPending && (
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Manager Decision Remarks / Conditions
                </label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={2}
                  placeholder="Enter decision audit notes (required for rejection)..."
                  className="w-full border border-gray-300 p-2 text-xs text-gray-900 resize-none focus:border-[#FF6B00] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={!canDecide}
                  onClick={handleReject}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Reject Request
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={!canDecide}
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Authorize & Approve
                </Button>
              </div>
            </div>
          )}

          {!isPending && (
            <div className="pt-2 border-t border-gray-200 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
              >
                Close Record
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
