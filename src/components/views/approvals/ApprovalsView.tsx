import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  ArrowLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCheck, 
  DollarSign, 
  AlertTriangle, 
  Tag, 
  Store, 
  Layers, 
  FileText,
  Lock,
  ArrowRight,
  Printer,
  Sparkles,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { StaffMember, ApprovalRequest, ApprovalType, ApprovalStatus } from '../../../types';
import { Button } from '../../ui/Button';
import { ApprovalDetailModal } from './ApprovalDetailModal';

export interface ApprovalsViewProps {
  currentStaff: StaffMember;
  approvalRequests: ApprovalRequest[];
  onDecision: (requestId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => void;
  onBackToLanding: () => void;
  onNavigateToShifts: () => void;
  onNavigateToEOD: () => void;
  onNavigateToStocktake: () => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  currentStaff,
  approvalRequests,
  onDecision,
  onBackToLanding,
  onNavigateToShifts,
  onNavigateToEOD,
  onNavigateToStocktake,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | ApprovalStatus>('PENDING');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);

  const isManager = currentStaff.role === 'STORE_MANAGER' || currentStaff.role === 'SYS_ADMIN';

  // Counts
  const pendingCount = approvalRequests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = approvalRequests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = approvalRequests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = useMemo(() => {
    return approvalRequests.filter((req) => {
      if (selectedStatus !== 'ALL' && req.status !== selectedStatus) return false;
      if (selectedType !== 'ALL' && req.type !== selectedType) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const match = req.title.toLowerCase().includes(query) ||
                      req.requestNumber.toLowerCase().includes(query) ||
                      req.requestedByStaffName.toLowerCase().includes(query) ||
                      (req.referenceId && req.referenceId.toLowerCase().includes(query));
        if (!match) return false;
      }
      return true;
    });
  }, [approvalRequests, selectedStatus, selectedType, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onBackToLanding}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#FF6B00]" />
              Management Controls & Approvals Area
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Authorization center for sensitive commercial overrides, adjustments, credit, and variances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToShifts}
            className="text-xs font-bold uppercase"
          >
            <Lock className="w-3.5 h-3.5 mr-1" />
            Shifts
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToEOD}
            className="text-xs font-bold uppercase"
          >
            <Clock className="w-3.5 h-3.5 mr-1" />
            EOD
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToStocktake}
            className="text-xs font-bold uppercase"
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            Stocktake
          </Button>
        </div>
      </div>

      {/* Operator Role Status Banner */}
      <div className={`p-3 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs ${
        isManager ? 'bg-blue-50/60 border-blue-300 text-blue-950' : 'bg-amber-50/60 border-amber-300 text-amber-950'
      }`}>
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wide">
              Active Security Context: {currentStaff.name} ({currentStaff.role})
            </span>
            <p className="text-[11px] text-gray-600 font-mono">
              {isManager 
                ? 'Supervisor authorization level active. You have full sign-off permissions for all operational requests.' 
                : 'Cashier view: You may submit override requests and review historical audit logs, but cannot approve your own actions.'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 border border-gray-300 shrink-0 uppercase">
          Policy: Separation of Duties
        </span>
      </div>

      {/* Filter and Tab Strip */}
      <div className="bg-white p-3 border border-gray-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex border border-gray-300">
            <button
              type="button"
              onClick={() => setSelectedStatus('PENDING')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                selectedStatus === 'PENDING' ? 'bg-[#FF6B00] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>Pending Action</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 font-bold ${
                selectedStatus === 'PENDING' ? 'bg-black/20 text-white' : 'bg-amber-200 text-amber-950'
              }`}>
                {pendingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                selectedStatus === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>Approved</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 font-bold ${
                selectedStatus === 'APPROVED' ? 'bg-black/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {approvedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                selectedStatus === 'REJECTED' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>Rejected</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 font-bold ${
                selectedStatus === 'REJECTED' ? 'bg-black/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {rejectedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                selectedStatus === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Records ({approvalRequests.length})
            </button>
          </div>

          {/* Type Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500 hidden sm:inline" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
            >
              <option value="ALL">All Approval Categories</option>
              <option value="CUSTOMER_APPROVAL">Customer Approval</option>
              <option value="CREDIT_LIMIT_OVERRIDE">Credit Limit Override</option>
              <option value="STOCK_ADJUSTMENT">Stock Adjustment Write-off</option>
              <option value="PRICE_OVERRIDE">Price Override</option>
              <option value="DISCOUNT_OVERRIDE">Discount Override</option>
              <option value="SALES_RETURN">Sales Return & Refund</option>
              <option value="CREDIT_NOTE">Credit Note Issuance</option>
              <option value="CASH_VARIANCE">Till Cash Variance</option>
              <option value="STOCKTAKE_VARIANCE">Stocktake Variance</option>
              <option value="UNRESOLVED_HELD_SALE">Unresolved Held Sale</option>
              <option value="SENSITIVE_CONFIG_CHANGE">Sensitive Config Change</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search request #, requester, reason..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-xs focus:border-[#FF6B00] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-gray-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Req Number</th>
                <th className="py-2.5 px-3">Category / Action</th>
                <th className="py-2.5 px-3">Title & Request Details</th>
                <th className="py-2.5 px-3 text-right">Amount / Impact</th>
                <th className="py-2.5 px-3">Requested By</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3 text-center">Priority</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Audit Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-gray-900">{req.requestNumber}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 text-[10px] font-mono font-bold text-gray-800 uppercase">
                      {req.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-bold text-gray-900 text-xs">{req.title}</div>
                    <div className="text-[11px] text-gray-500 line-clamp-1 italic">
                      "{req.reason}"
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-gray-900">
                    {req.amount !== undefined ? `$${Math.abs(req.amount).toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-3 font-sans text-gray-800">
                    <div className="font-medium">{req.requestedByStaffName}</div>
                    <span className="text-[10px] text-gray-500 font-mono">{req.locationName}</span>
                  </td>
                  <td className="py-3 px-3 text-gray-600 text-[10px]">{req.requestedDateTime}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      req.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : req.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : req.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <Button
                      type="button"
                      variant={req.status === 'PENDING' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedRequest(req)}
                      className={`text-xs font-bold ${
                        req.status === 'PENDING' 
                          ? 'bg-[#FF6B00] hover:bg-[#E05E00] text-white' 
                          : 'text-gray-700'
                      }`}
                    >
                      {req.status === 'PENDING' ? 'Review & Decide' : 'View Audit'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="py-12 text-center text-gray-400 space-y-2 font-mono text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-sans font-bold text-gray-700 text-sm">No Pending Approvals in This Filter</p>
            <p>All sensitive operational requests and overrides have been reconciled.</p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ApprovalDetailModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        currentStaff={currentStaff}
        onDecision={(id, decision, notes) => {
          onDecision(id, decision, notes);
          setSelectedRequest(null);
        }}
      />
    </div>
  );
};
