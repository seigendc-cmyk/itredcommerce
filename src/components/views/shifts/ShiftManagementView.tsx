import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Store, 
  Monitor, 
  Clock, 
  UserCheck, 
  DollarSign, 
  Plus, 
  History, 
  Receipt, 
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { StaffMember, Terminal, Branch, Shift, SaleTransaction, HeldSale, OperationalException, CashUpMode, TenderReconciliationEntry, ActivityReasonCode, ExceptionSeverity } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { ShiftOpeningModal } from './ShiftOpeningModal';
import { ShiftClosureModal } from './ShiftClosureModal';
import { ShiftSlipModal } from './ShiftSlipModal';

export interface ShiftManagementViewProps {
  currentStaff: StaffMember;
  terminals?: Terminal[];
  branches?: Branch[];
  shifts?: Shift[];
  transactions?: SaleTransaction[];
  heldSales?: HeldSale[];
  exceptions?: OperationalException[];
  currentTerminalId: string;
  onOpenShift: (shiftData: {
    terminalId: string;
    branchId: string;
    cashierStaffId: string;
    openingFloat: number;
    openingNotes?: string;
  }) => void;
  onCloseShift: (shiftId: string, closureData: {
    closingFloat: number;
    countedCash: number;
    cashVariance: number;
    closingNotes: string;
    requiresApproval: boolean;
    cashUpMode?: CashUpMode;
    tenderReconciliation?: TenderReconciliationEntry[];
    originalBlindCounts?: Record<string, number>;
    reasonCode?: ActivityReasonCode;
    severity?: ExceptionSeverity;
    managerApproved?: boolean;
    managerApprovedBy?: string;
  }) => void;
  onBackToLanding: () => void;
  onNavigateToEOD: () => void;
  onNavigateToApprovals: () => void;
}

export const ShiftManagementView: React.FC<ShiftManagementViewProps> = ({
  currentStaff,
  terminals = [],
  branches = [],
  shifts = [],
  transactions = [],
  heldSales = [],
  exceptions = [],
  currentTerminalId,
  onOpenShift,
  onCloseShift,
  onBackToLanding,
  onNavigateToEOD,
  onNavigateToApprovals,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'TERMINALS' | 'HISTORY'>('TERMINALS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modals
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [closingShiftTarget, setClosingShiftTarget] = useState<Shift | null>(null);
  const [selectedSlipShift, setSelectedSlipShift] = useState<Shift | null>(null);

  const safeTerminals = Array.isArray(terminals) ? terminals : [];
  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];

  const todayStr = new Date().toISOString().split('T')[0];

  // Detect unclosed shifts from earlier days
  const unclosedShifts = safeShifts.filter((s) => 
    s.status === 'REQUIRES_CLOSURE' || 
    (s.status === 'OPEN' && s.openingDate < todayStr)
  );

  // Filter terminals
  const filteredTerminals = safeTerminals.filter((term) => {
    if (selectedBranchId !== 'ALL' && term.branchId !== selectedBranchId) return false;
    if (searchTerm) {
      const termMatch = (term.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (term.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      return termMatch;
    }
    return true;
  });

  // Filter shifts history
  const filteredShifts = safeShifts.filter((s) => {
    if (selectedBranchId !== 'ALL' && s.branchId !== selectedBranchId) return false;
    if (searchTerm) {
      const match = (s.shiftNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (s.cashierStaffName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (s.terminalName || '').toLowerCase().includes(searchTerm.toLowerCase());
      return match;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
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
              <Lock className="w-5 h-5 text-[#FF6B00]" />
              Shift & Register Controls
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Terminal assignment, cash float management, and trading session reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToEOD}
            className="text-xs font-bold uppercase tracking-wider"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1 text-blue-600" />
            End of Day (EOD)
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsOpeningModalOpen(true)}
            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 mr-1" />
            Open New Shift
          </Button>
        </div>
      </div>

      {/* Prominent Warning for Unclosed Shifts */}
      {unclosedShifts.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-600 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-bold uppercase tracking-wider text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-pulse" />
              <span>Previous Shift Requires Closure ({unclosedShifts.length} Terminal{unclosedShifts.length > 1 ? 's' : ''})</span>
            </div>
            <span className="bg-rose-600 text-white font-mono text-[11px] font-bold px-2 py-0.5 uppercase">
              Action Mandatory
            </span>
          </div>
          <p className="text-xs text-rose-900">
            One or more terminals have active shifts remaining open from prior calendar days. 
            POS checkout and shift rollovers are restricted on these terminals until reconciled and closed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {unclosedShifts.map((unShift) => (
              <div key={unShift.id} className="bg-white p-2.5 border border-rose-300 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900 text-xs">{unShift.terminalName}</div>
                  <div className="text-[11px] text-gray-500 font-mono">
                    Shift #{unShift.shiftNumber} • Opened: {unShift.openedDateTime} by {unShift.cashierStaffName}
                  </div>
                  <div className="text-[11px] text-rose-700 font-bold font-mono">
                    Expected Cash: ${unShift.expectedCash.toFixed(2)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setClosingShiftTarget(unShift)}
                  className="text-xs font-bold shrink-0 ml-2"
                >
                  Close & Reconcile
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Tabs Strip */}
      <div className="bg-white p-3 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex border border-gray-300">
            <button
              type="button"
              onClick={() => setActiveTab('TERMINALS')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'TERMINALS'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active Terminals ({terminals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'HISTORY'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Shift Journal History ({shifts.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-gray-500 hidden md:inline" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search terminal or shift..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-xs focus:border-[#FF6B00] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'TERMINALS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTerminals.map((term) => {
            // Find active shift for this terminal
            const activeShift = shifts.find((s) => s.terminalId === term.id && (s.status === 'OPEN' || s.status === 'REQUIRES_CLOSURE'));
            const isUnclosedPriorDay = activeShift && (activeShift.status === 'REQUIRES_CLOSURE' || (activeShift.status === 'OPEN' && activeShift.openingDate < todayStr));

            return (
              <div 
                key={term.id} 
                className={`bg-white border-2 shadow-2xs flex flex-col justify-between transition-all ${
                  isUnclosedPriorDay 
                    ? 'border-rose-500 bg-rose-50/20' 
                    : activeShift 
                      ? 'border-emerald-500' 
                      : 'border-gray-300'
                }`}
              >
                {/* Terminal Header */}
                <div className={`p-3 border-b flex items-center justify-between ${
                  isUnclosedPriorDay ? 'bg-rose-100/70 border-rose-300' : activeShift ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-100 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-700" />
                    <div>
                      <span className="font-bold text-gray-900 text-xs block">{term.name}</span>
                      <span className="text-[10px] font-mono text-gray-500">{term.code} • {term.branchName || 'Downtown'}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                    isUnclosedPriorDay
                      ? 'bg-rose-600 text-white'
                      : activeShift
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                  }`}>
                    {isUnclosedPriorDay ? 'Requires Closure' : activeShift ? 'Shift Open' : 'Till Closed'}
                  </span>
                </div>

                {/* Shift Body Details */}
                <div className="p-3.5 space-y-3 text-xs flex-1">
                  {activeShift ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-gray-400 block">Cashier</span>
                          <span className="font-bold text-gray-900">{activeShift.cashierStaffName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-gray-400 block">Shift Number</span>
                          <span className="font-mono text-gray-800">#{activeShift.shiftNumber}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-gray-400 block">Opening Time</span>
                          <span className="font-mono text-gray-800">{activeShift.openedDateTime}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-gray-400 block">Opening Float</span>
                          <span className="font-mono font-bold text-gray-900">${activeShift.openingFloat.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-2 border border-gray-200 grid grid-cols-3 gap-1 text-[11px] font-mono text-center">
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase block">Sales</span>
                          <span className="font-bold text-gray-800">${activeShift.grossSales.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase block">Cash In Till</span>
                          <span className="font-bold text-emerald-700">${activeShift.expectedCash.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase block">Txs Count</span>
                          <span className="font-bold text-gray-800">{activeShift.totalSalesCount}</span>
                        </div>
                      </div>

                      {activeShift.openingNotes && (
                        <p className="text-[10px] text-gray-500 italic bg-white p-1 border border-gray-200">
                          "{activeShift.openingNotes}"
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-6 text-center text-gray-400 space-y-1.5">
                      <Lock className="w-6 h-6 mx-auto text-gray-300" />
                      <p className="text-xs font-medium text-gray-600">Register is currently idle / locked.</p>
                      <p className="text-[10px] font-mono text-gray-400">Open a trading shift to allow checkout sales.</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
                  {activeShift ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedSlipShift(activeShift)}
                        className="text-xs"
                        title="View X-Reading (Mid-shift tally slip)"
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1 text-gray-600" />
                        X-Reading Slip
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setClosingShiftTarget(activeShift)}
                        className="text-xs font-bold"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        Close Shift
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsOpeningModalOpen(true)}
                      className="w-full justify-center bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold"
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1" />
                      Open Shift on This Terminal
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Shift History Journal */
        <div className="bg-white border border-gray-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Shift Number</th>
                  <th className="py-2.5 px-3">Terminal / Branch</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Opened</th>
                  <th className="py-2.5 px-3">Closed</th>
                  <th className="py-2.5 px-3 text-right">Opening Float</th>
                  <th className="py-2.5 px-3 text-right">Gross Sales</th>
                  <th className="py-2.5 px-3 text-right">Cash Expected</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Audit Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                {filteredShifts.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-gray-900">{s.shiftNumber}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-sans font-medium text-gray-900 block">{s.terminalName}</span>
                      <span className="text-[10px] text-gray-500">{s.branchName}</span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-gray-800">{s.cashierStaffName}</td>
                    <td className="py-2.5 px-3 text-gray-600">{s.openedDateTime}</td>
                    <td className="py-2.5 px-3 text-gray-600">{s.closedDateTime || '—'}</td>
                    <td className="py-2.5 px-3 text-right text-gray-900">${s.openingFloat.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">${s.grossSales.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">${s.expectedCash.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      (s.cashVariance || 0) < 0 ? 'text-rose-600' : (s.cashVariance || 0) > 0 ? 'text-amber-600' : 'text-gray-400'
                    }`}>
                      {s.cashVariance !== undefined ? (s.cashVariance === 0 ? '$0.00' : `${s.cashVariance < 0 ? '-' : '+'}$${Math.abs(s.cashVariance).toFixed(2)}`) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                        s.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : s.status === 'REQUIRES_CLOSURE'
                            ? 'bg-rose-100 text-rose-800 border border-rose-400'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}>
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedSlipShift(s)}
                        className="text-[#FF6B00] hover:text-[#E05E00] font-sans font-bold underline text-xs cursor-pointer"
                      >
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shift Slip Modal */}
      <ShiftSlipModal
        isOpen={!!selectedSlipShift}
        onClose={() => setSelectedSlipShift(null)}
        shift={selectedSlipShift}
        exceptions={exceptions}
      />

      {/* Opening Modal */}
      <ShiftOpeningModal
        isOpen={isOpeningModalOpen}
        onClose={() => setIsOpeningModalOpen(false)}
        currentStaff={currentStaff}
        terminals={terminals}
        branches={branches}
        allShifts={shifts}
        currentTerminalId={currentTerminalId}
        onOpenShift={(data) => {
          onOpenShift(data);
          setIsOpeningModalOpen(false);
        }}
        onResolveUnclosedShift={(unclosed) => {
          setIsOpeningModalOpen(false);
          setClosingShiftTarget(unclosed);
        }}
      />

      {/* Closure Modal */}
      <ShiftClosureModal
        isOpen={!!closingShiftTarget}
        onClose={() => setClosingShiftTarget(null)}
        shift={closingShiftTarget}
        currentStaff={currentStaff}
        transactions={transactions}
        heldSales={heldSales}
        onConfirmCloseShift={(shiftId, data) => {
          onCloseShift(shiftId, data);
          setClosingShiftTarget(null);
        }}
      />
    </div>
  );
};
