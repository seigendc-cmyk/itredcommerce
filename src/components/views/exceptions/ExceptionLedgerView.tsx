import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  Building2, 
  Monitor, 
  User, 
  FileText, 
  Coins, 
  Boxes, 
  TrendingDown, 
  Eye, 
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { OperationalException, ExceptionCategory, ExceptionSeverity, ExceptionStatus, StaffMember, ActivityEvent } from '../../../types';
import { Button } from '../../ui/Button';

export interface ExceptionLedgerViewProps {
  exceptions?: OperationalException[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateException: (updated: OperationalException) => void;
  onEmitActivityEvent?: (event: Partial<ActivityEvent>) => void;
}

export const ExceptionLedgerView: React.FC<ExceptionLedgerViewProps> = ({
  exceptions = [],
  currentStaff,
  onBackToLanding,
  onUpdateException,
  onEmitActivityEvent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeException, setActiveException] = useState<OperationalException | null>(null);
  
  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ExceptionStatus>('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');
  const [resolveError, setResolveError] = useState<string>('');

  const safeExceptions = Array.isArray(exceptions) ? exceptions : [];

  const isSupervisorOrManager = currentStaff.roleId === 'ROLE-01' || 
    (currentStaff.roleTitle || '').toLowerCase().includes('manager') || 
    (currentStaff.roleTitle || '').toLowerCase().includes('admin') ||
    (currentStaff.roleTitle || '').toLowerCase().includes('supervisor');

  const categories: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Categories' },
    { key: 'CASH_VARIANCE', label: 'Cash Variance' },
    { key: 'TENDER_VARIANCE', label: 'Tender Variance' },
    { key: 'STOCKTAKE_VARIANCE', label: 'Stocktake Variance' },
    { key: 'NEGATIVE_MARGIN_ATTEMPT', label: 'Negative Margin Attempt' },
    { key: 'PRICE_OVERRIDE', label: 'Price Override' },
    { key: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment' },
    { key: 'UNRESOLVED_HELD_SALE', label: 'Unresolved Held Sale' },
    { key: 'OVERDUE_SHIFT', label: 'Overdue Shift' },
    { key: 'MISSING_SELLING_PRICE', label: 'Missing Selling Price' },
    { key: 'MISSING_COST', label: 'Missing Cost' },
    { key: 'FAILED_SYNCHRONIZATION', label: 'Sync Discrepancy' },
    { key: 'PENDING_FISCAL_DOCUMENT', label: 'Pending Fiscal Doc' },
  ];

  const filteredExceptions = useMemo(() => {
    return safeExceptions.filter((exc) => {
      const title = exc.title || '';
      const num = exc.exceptionNumber || '';
      const staff = exc.staffName || '';
      const ref = exc.relatedTransactionRef || '';
      const details = exc.details || '';

      const matchesSearch = 
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        num.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        details.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || exc.category === selectedCategory;
      const matchesSev = selectedSeverity === 'ALL' || exc.severity === selectedSeverity;
      const matchesStat = selectedStatus === 'ALL' || exc.status === selectedStatus;

      return matchesSearch && matchesCat && matchesSev && matchesStat;
    });
  }, [safeExceptions, searchQuery, selectedCategory, selectedSeverity, selectedStatus]);

  const openCount = safeExceptions.filter((e) => e.status === 'OPEN').length;
  const underReviewCount = safeExceptions.filter((e) => e.status === 'UNDER_REVIEW').length;
  const criticalCount = safeExceptions.filter((e) => e.severity === 'CRITICAL' && (e.status === 'OPEN' || e.status === 'UNDER_REVIEW')).length;
  const totalVarianceValue = safeExceptions.reduce((sum, e) => sum + (e.varianceAmount || 0), 0);

  const getCategoryBadge = (category: ExceptionCategory) => {
    switch (category) {
      case 'CASH_VARIANCE':
      case 'TENDER_VARIANCE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 font-mono">CASH & TENDER</span>;
      case 'STOCKTAKE_VARIANCE':
      case 'STOCK_ADJUSTMENT':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300 font-mono">INVENTORY</span>;
      case 'NEGATIVE_MARGIN_ATTEMPT':
      case 'PRICE_OVERRIDE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 font-mono">PRICE & MARGIN</span>;
      case 'OVERDUE_SHIFT':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300 font-mono">SHIFT GOVERNANCE</span>;
      case 'PENDING_FISCAL_DOCUMENT':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-red-100 text-red-900 border border-red-300 font-mono">FISCAL ESD</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-300 font-mono">{category}</span>;
    }
  };

  const getSeverityBadge = (severity: ExceptionSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-red-700 text-white font-mono">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300 font-mono">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 font-mono">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300 font-mono">LOW</span>;
    }
  };

  const getStatusBadge = (status: ExceptionStatus) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">OPEN</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">UNDER REVIEW</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">APPROVED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">REJECTED</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">RESOLVED</span>;
    }
  };

  const handleOpenResolveModal = (exc: OperationalException, status: ExceptionStatus) => {
    setActiveException(exc);
    setTargetStatus(status);
    setResolutionText(exc.resolution || '');
    setResolveError('');
    setShowResolveModal(true);
  };

  const handleSaveResolution = () => {
    if (!activeException) return;
    setResolveError('');

    const isOwnException = activeException.staffId === currentStaff.id || activeException.staffName === currentStaff.name;

    if (targetStatus === 'APPROVED' && !isSupervisorOrManager && isOwnException) {
      setResolveError('Cashiers are not permitted to approve their own cash/tender variance exceptions. Supervisor or Manager signoff is strictly required.');
      if (onEmitActivityEvent) {
        onEmitActivityEvent({
          eventType: 'ACCESS_DENIED',
          outcome: 'BLOCKED',
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          description: `Cashier ${currentStaff.name} attempted unauthorized self-approval of variance exception ${activeException.exceptionNumber}`,
        });
      }
      return;
    }

    if (!resolutionText.trim()) {
      setResolveError('Resolution/investigation notes are required before committing status changes.');
      return;
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const updated: OperationalException = {
      ...activeException,
      status: targetStatus,
      resolution: resolutionText.trim(),
      assignedOrReviewedBy: `${currentStaff.name} (${currentStaff.roleTitle})`,
      reviewedDateTime: formattedDate,
      resolvedAt: targetStatus === 'RESOLVED' || targetStatus === 'APPROVED' ? formattedDate : undefined,
    };

    onUpdateException(updated);

    if (onEmitActivityEvent) {
      if (targetStatus === 'APPROVED') {
        onEmitActivityEvent({
          eventType: 'APPROVAL_APPROVED',
          outcome: 'APPROVED',
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          entityType: 'OPERATIONAL_EXCEPTION',
          entityId: activeException.id,
          description: `Exception ${activeException.exceptionNumber} approved by supervisor ${currentStaff.name}`,
        });
      } else if (targetStatus === 'REJECTED') {
        onEmitActivityEvent({
          eventType: 'APPROVAL_REJECTED',
          outcome: 'REJECTED',
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          entityType: 'OPERATIONAL_EXCEPTION',
          entityId: activeException.id,
          description: `Exception ${activeException.exceptionNumber} rejected by supervisor ${currentStaff.name}`,
        });
      }
    }

    setShowResolveModal(false);
    setActiveException(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* Header bar */}
      <div className="bg-white border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLanding}
            className="p-2 border border-gray-300 hover:bg-gray-100 cursor-pointer text-gray-700 transition-colors"
            title="Back to Landing"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 bg-[#FF6B00] text-white flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              Operational Exception Ledger
              <span className="text-xs bg-orange-100 text-[#FF6B00] px-2 py-0.5 font-mono font-bold">
                ACCOUNTABILITY ENGINE
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Immutable ledger for cash variances, stock discrepancies, negative margin attempts & shift exceptions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-mono">
            <div>
              <span className="text-gray-500">Open:</span>{' '}
              <strong className="text-rose-600">{openCount}</strong>
            </div>
            <div className="h-4 w-[1px] bg-gray-300" />
            <div>
              <span className="text-gray-500">Under Review:</span>{' '}
              <strong className="text-amber-600">{underReviewCount}</strong>
            </div>
            <div className="h-4 w-[1px] bg-gray-300" />
            <div>
              <span className="text-gray-500">Critical:</span>{' '}
              <strong className="text-red-700">{criticalCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase text-gray-500">Open Exceptions</div>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">{openCount}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Requiring supervisor investigation</div>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase text-gray-500">Under Review</div>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{underReviewCount}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Manager signoff in progress</div>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase text-gray-500">Net Variance Value</div>
          <div className={`text-2xl font-black mt-1 font-mono ${totalVarianceValue < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
            ${totalVarianceValue.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Cumulative cash & stock valuation delta</div>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-mono uppercase text-gray-500">Governance Policy</div>
          <div className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Zero Auto-Overwrites</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">All variances require explanation</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search exceptions, references, staff names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 focus:bg-white focus:border-[#FF6B00] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 font-medium focus:border-[#FF6B00] focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 font-medium focus:border-[#FF6B00] focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 font-medium focus:border-[#FF6B00] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Exception Table */}
      <div className="bg-white border border-gray-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-mono text-[11px] uppercase">
              <th className="py-2.5 px-3">Ref #</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Exception Details</th>
              <th className="py-2.5 px-3">Branch / Till</th>
              <th className="py-2.5 px-3">Responsible Staff</th>
              <th className="py-2.5 px-3">Related Trans</th>
              <th className="py-2.5 px-3 text-right">Variance</th>
              <th className="py-2.5 px-3 text-center">Severity</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredExceptions.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 font-mono">
                  No exceptions matching the selected criteria.
                </td>
              </tr>
            ) : (
              filteredExceptions.map((exc) => (
                <tr key={exc.id} className="hover:bg-orange-50/40 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-gray-900">
                    {exc.exceptionNumber}
                    <div className="text-[10px] text-gray-400 font-normal">{exc.dateTime}</div>
                  </td>
                  <td className="py-3 px-3">
                    {getCategoryBadge(exc.category)}
                  </td>
                  <td className="py-3 px-3 max-w-[280px]">
                    <div className="font-bold text-gray-900">{exc.title}</div>
                    {exc.details && (
                      <div className="text-[11px] text-gray-600 truncate mt-0.5">{exc.details}</div>
                    )}
                    {exc.assignedOrReviewedBy && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Reviewed by: <strong className="text-gray-700">{exc.assignedOrReviewedBy}</strong>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-gray-900 font-medium">{exc.branchName}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{exc.terminalName || 'Branch Central'}</div>
                  </td>
                  <td className="py-3 px-3 font-medium text-gray-800">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{exc.staffName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-gray-700">
                    {exc.relatedTransactionRef || '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {exc.varianceAmount !== undefined ? (
                      <span className={exc.varianceAmount < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                        {exc.varianceAmount < 0 ? '-' : '+'}${Math.abs(exc.varianceAmount).toFixed(2)}
                      </span>
                    ) : exc.varianceUnits !== undefined ? (
                      <span className={exc.varianceUnits < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                        {exc.varianceUnits} Units
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {getSeverityBadge(exc.severity)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {getStatusBadge(exc.status)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenResolveModal(exc, exc.status === 'OPEN' ? 'UNDER_REVIEW' : 'RESOLVED')}
                        className="px-2 py-1 bg-white border border-gray-300 hover:border-[#FF6B00] hover:text-[#FF6B00] text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Review / Resolve"
                      >
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Review / Resolve Modal */}
      {showResolveModal && activeException && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-300 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-bold text-base text-gray-900">
                  Exception Review & Resolution
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-gray-500">
                {activeException.exceptionNumber}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 space-y-1">
                <div className="font-bold text-gray-900 text-sm">{activeException.title}</div>
                <div className="text-gray-600">{activeException.details}</div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-mono text-[11px]">
                  <span>Staff: <strong>{activeException.staffName}</strong></span>
                  <span>Ref: <strong>{activeException.relatedTransactionRef || 'N/A'}</strong></span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Change Status To
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['UNDER_REVIEW', 'APPROVED', 'RESOLVED', 'REJECTED'] as ExceptionStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTargetStatus(st)}
                      className={`py-1.5 px-2 text-center font-bold border transition-colors cursor-pointer ${
                        targetStatus === st
                          ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                          : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {resolveError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Authorization Restriction</strong>
                    {resolveError}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Manager Investigation & Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Enter audit explanation, supervisor signoff details, or remedial actions taken..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 text-xs focus:bg-white focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowResolveModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveResolution}
                className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
              >
                Commit Exception Update
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
