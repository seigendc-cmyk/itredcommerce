import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  DollarSign, 
  Store, 
  Monitor, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  ArrowRight,
  History,
  Lock
} from 'lucide-react';
import { StaffMember, Terminal, Branch, Shift } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface ShiftOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffMember;
  terminals: Terminal[];
  branches: Branch[];
  allShifts: Shift[];
  currentTerminalId: string;
  onOpenShift: (shiftData: {
    terminalId: string;
    branchId: string;
    cashierStaffId: string;
    openingFloat: number;
    openingNotes?: string;
  }) => void;
  onResolveUnclosedShift?: (shift: Shift) => void;
}

export const ShiftOpeningModal: React.FC<ShiftOpeningModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  terminals = [],
  branches = [],
  allShifts = [],
  currentTerminalId,
  onOpenShift,
  onResolveUnclosedShift,
}) => {
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(currentTerminalId || (terminals?.[0]?.id || 'TERM-01'));
  const [openingFloat, setOpeningFloat] = useState<string>('150.00');
  const [openingNotes, setOpeningNotes] = useState<string>('Morning trading till verified.');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const activeTerminal = terminals?.find((t) => t.id === selectedTerminalId) || terminals?.[0];
  const activeBranch = branches?.find((b) => b.id === activeTerminal?.branchId) || branches?.[0];

  // Check if this terminal has a previous shift that was left unclosed from an earlier day
  const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const unclosedShift = (allShifts || []).find((s) => 
    s.terminalId === selectedTerminalId && 
    (s.status === 'REQUIRES_CLOSURE' || (s.status === 'OPEN' && s.openingDate < todayStr))
  );

  // Check if terminal already has an active OPEN shift for today
  const existingOpenShiftToday = (allShifts || []).find((s) => 
    s.terminalId === selectedTerminalId && 
    s.status === 'OPEN' && 
    s.openingDate >= todayStr
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (unclosedShift) {
      setErrorMsg('This terminal cannot open a new shift because a previous shift remains unclosed. Please close or reconcile it first.');
      return;
    }

    if (existingOpenShiftToday) {
      setErrorMsg(`Terminal ${activeTerminal.name} already has an active open shift (#${existingOpenShiftToday.shiftNumber}) for Cashier ${existingOpenShiftToday.cashierStaffName}.`);
      return;
    }

    const floatNum = parseFloat(openingFloat);
    if (isNaN(floatNum) || floatNum < 0) {
      setErrorMsg('Please specify a valid opening cash float amount (e.g. 0.00 or higher).');
      return;
    }

    onOpenShift({
      terminalId: activeTerminal.id,
      branchId: activeBranch.id,
      cashierStaffId: currentStaff.id,
      openingFloat: floatNum,
      openingNotes: openingNotes.trim() || undefined,
    });
  };

  const nowFormatted = new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-[#FF6B00] flex items-center justify-center text-white font-bold text-sm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                Open Trading Shift
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                Mandatory Terminal & Cashier Activation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 transition-colors"
            title="Cancel & Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Prominent Warning if previous shift remains open from earlier day */}
          {unclosedShift && (
            <div className="bg-rose-50 border-2 border-rose-600 p-4 space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2 text-rose-800 font-bold uppercase tracking-wider text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Previous Shift Requires Closure</span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                Terminal <strong>{activeTerminal.name}</strong> has an open shift from{' '}
                <strong>{unclosedShift.openingDate}</strong> (#{unclosedShift.shiftNumber} by {unclosedShift.cashierStaffName}) 
                that was never closed. Operating rules prohibit opening a new shift until the previous shift is reconciled.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (onResolveUnclosedShift) {
                      onResolveUnclosedShift(unclosedShift);
                    }
                  }}
                  className="w-full justify-center text-xs font-bold uppercase tracking-wider"
                >
                  <History className="w-3.5 h-3.5 mr-1.5" />
                  Reconcile & Close Previous Shift
                </Button>
              </div>
            </div>
          )}

          {errorMsg && (
            <Alert type="error" message={errorMsg} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operator & Terminal Identity Strip */}
            <div className="bg-gray-50 border border-gray-300 p-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Cashier / Staff
                </label>
                <div className="font-bold text-gray-900 text-xs">
                  {currentStaff.name}
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  {currentStaff.role} ({currentStaff.code})
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Opening Date / Time
                </label>
                <div className="font-bold text-gray-900 text-xs font-mono">
                  {nowFormatted}
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  • Real-time system synchronized
                </div>
              </div>
            </div>

            {/* Terminal & Branch Selection */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Assigned Terminal / Till <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedTerminalId}
                    onChange={(e) => {
                      setSelectedTerminalId(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] focus:outline-hidden"
                  >
                    {terminals.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name} ({term.code}) — {term.branchName || 'Downtown'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Assigned Branch
                </label>
                <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-xs font-medium text-gray-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-gray-600" />
                    {activeBranch ? activeBranch.name : 'Main Downtown Branch'}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 uppercase">
                    ID: {activeBranch?.code || 'BR-01'}
                  </span>
                </div>
              </div>

              {/* Opening Cash Float */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Opening Cash Float (USD / Base) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-bold">
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-300 bg-white pl-8 pr-3 py-2 text-xs font-mono font-bold text-gray-900 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] focus:outline-hidden"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Enter physical currency counted in till drawer prior to first sale.
                </p>
              </div>

              {/* Quick Float Shortcuts */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 mr-1">Quick Float:</span>
                {[50, 100, 150, 200, 250].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningFloat(amt.toFixed(2))}
                    className="px-2 py-0.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-[10px] font-mono font-bold text-gray-700 transition-colors"
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Opening Shift Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Shift Notes / Handover Remarks
                </label>
                <textarea
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional verification remarks or till handover notes..."
                  className="w-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] focus:outline-hidden resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!!unclosedShift}
                className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Confirm & Open Shift
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
