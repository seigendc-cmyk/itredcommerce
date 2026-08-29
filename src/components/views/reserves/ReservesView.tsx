import React, { useState, useMemo } from 'react';
import { 
  PiggyBank, 
  ArrowLeft, 
  Plus, 
  Minus, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck, 
  Layers, 
  Receipt, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Percent, 
  Sparkles,
  Lock,
  Landmark,
  Building,
  Users,
  AlertCircle
} from 'lucide-react';
import { 
  BusinessReserve, 
  ReserveTransferRecord, 
  StaffMember, 
  CashBankAccount 
} from '../../../types';
import { Button } from '../../ui/Button';

export interface ReservesViewProps {
  currentStaff: StaffMember;
  reserves?: BusinessReserve[];
  transfers?: ReserveTransferRecord[];
  bankAccounts?: CashBankAccount[];
  onUpdateReserve: (reserve: BusinessReserve) => void;
  onAddTransfer: (transfer: ReserveTransferRecord) => void;
  onBackToLanding: () => void;
}

export const ReservesView: React.FC<ReservesViewProps> = ({
  currentStaff,
  reserves = [],
  transfers = [],
  bankAccounts = [],
  onUpdateReserve,
  onAddTransfer,
  onBackToLanding,
}) => {
  const [selectedReserveId, setSelectedReserveId] = useState<string>('RES-001');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferType, setTransferType] = useState<'CONTRIBUTION' | 'DRAWDOWN'>('CONTRIBUTION');
  const [transferAmount, setTransferAmount] = useState<number>(1000);
  const [transferNotes, setTransferNotes] = useState<string>('Operational capital allocation');
  const [sourceAccountName, setSourceAccountName] = useState<string>('First Commercial Operating Account');

  const safeReserves = Array.isArray(reserves) ? reserves : [];
  const safeTransfers = Array.isArray(transfers) ? transfers : [];

  const selectedReserve = useMemo(() => {
    return safeReserves.find(r => r.id === selectedReserveId) || safeReserves[0] || null;
  }, [safeReserves, selectedReserveId]);

  const reserveTransfers = useMemo(() => {
    if (!selectedReserve) return [];
    return safeTransfers.filter(t => t.reserveId === selectedReserve?.id);
  }, [safeTransfers, selectedReserve]);

  const kpis = useMemo(() => {
    const totalTarget = safeReserves.reduce((sum, r) => sum + (r.targetAmount || 0), 0);
    const totalFunded = safeReserves.reduce((sum, r) => sum + (r.currentFundedBalance || 0), 0);
    const overallFundingRatio = totalTarget > 0 ? (totalFunded / totalTarget) * 100 : 0;
    const totalAllocPercent = safeReserves.reduce((sum, r) => sum + (r.allocationRulePercent || 0), 0);

    return {
      totalTarget,
      totalFunded,
      overallFundingRatio,
      totalAllocPercent,
    };
  }, [safeReserves]);

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReserve || transferAmount <= 0) return;

    let newFundedBalance = selectedReserve.currentFundedBalance || 0;
    if (transferType === 'CONTRIBUTION') {
      newFundedBalance += transferAmount;
    } else {
      newFundedBalance = Math.max(0, newFundedBalance - transferAmount);
    }

    const updatedReserve: BusinessReserve = {
      ...selectedReserve,
      currentFundedBalance: newFundedBalance,
      status: newFundedBalance >= (selectedReserve.targetAmount || 0) ? 'TARGET_MET' : 'ACTIVE',
      lastContributionDate: transferType === 'CONTRIBUTION' ? new Date().toISOString().split('T')[0] : selectedReserve.lastContributionDate,
      lastDrawdownDate: transferType === 'DRAWDOWN' ? new Date().toISOString().split('T')[0] : selectedReserve.lastDrawdownDate,
    };

    onUpdateReserve(updatedReserve);

    const newTransfer: ReserveTransferRecord = {
      id: `RTR-${Date.now()}`,
      reserveId: selectedReserve.id,
      reserveName: selectedReserve.name,
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      type: transferType,
      amount: transferAmount,
      fromAccountName: transferType === 'CONTRIBUTION' ? sourceAccountName : selectedReserve.name,
      toAccountName: transferType === 'CONTRIBUTION' ? selectedReserve.name : sourceAccountName,
      referenceNumber: `RES-TRF-${Math.floor(1000 + Math.random() * 9000)}`,
      authorizedByStaffName: currentStaff?.name || 'Administrator',
      notes: transferNotes,
    };

    onAddTransfer(newTransfer);
    setIsTransferModalOpen(false);
    setTransferAmount(500);
    setTransferNotes('');
  };

  const getReserveIcon = (category: string) => {
    switch (category) {
      case 'COGS_RESERVE':
        return <Layers className="w-5 h-5 text-indigo-400" />;
      case 'TAX_RESERVE':
        return <Receipt className="w-5 h-5 text-rose-400" />;
      case 'PAYROLL_RESERVE':
        return <Users className="w-5 h-5 text-emerald-400" />;
      case 'RENT_OPERATING_RESERVE':
        return <Building className="w-5 h-5 text-amber-400" />;
      default:
        return <PiggyBank className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBackToLanding}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Business Reserves & Escrow Capital</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Solvency Safeguard
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated revenue allocation buffers for COGS replenishment, VAT liability, staff payroll & facility rent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              setTransferType('CONTRIBUTION');
              setIsTransferModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Contribute to Reserve
          </Button>
        </div>
      </header>

      {/* KPI Overview Banner */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Escrow Funded</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            ${kpis.totalFunded.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across 5 protected business reserves</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Solvency Target Pool</span>
            <PiggyBank className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            ${kpis.totalTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Full 100% solvency requirement</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Funded Ratio</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {kpis.overallFundingRatio.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Weighted liquidity protection</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Daily Revenue Earmark</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300">
            {kpis.totalAllocPercent}% of Daily Sales
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Automatically routed at Shift / EOD</div>
        </div>
      </section>

      {/* Main Grid: Reserves Cards & Details */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Column: Reserve Cards (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-3 overflow-y-auto pr-1">
          {reserves.map((res) => {
            const isSelected = res.id === selectedReserveId;
            const pct = Math.min(100, (res.currentFundedBalance / res.targetAmount) * 100);

            return (
              <div
                key={res.id}
                onClick={() => setSelectedReserveId(res.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-purple-500 shadow-md ring-1 ring-purple-500/20'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      {getReserveIcon(res.category)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {res.name}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                          {res.allocationRulePercent}% EOD
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{res.description}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold font-mono text-white">
                      ${res.currentFundedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Target: ${res.targetAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Funded Progress</span>
                    <span className="font-mono text-purple-300 font-medium">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-purple-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Reserve Detail & Transfer Ledger (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4 overflow-hidden">
          {selectedReserve && (
            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    {getReserveIcon(selectedReserve.category)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{selectedReserve.name}</h2>
                    <span className="text-xs text-slate-400">
                      Priority: <strong className="text-purple-300 font-medium">{selectedReserve.priority}</strong> • Linked: {selectedReserve.linkedBankAccountName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setTransferType('CONTRIBUTION');
                      setIsTransferModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Fund
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTransferType('DRAWDOWN');
                      setIsTransferModalOpen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-7.5 px-3"
                  >
                    <Minus className="w-3.5 h-3.5 mr-1" />
                    Drawdown
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[10px]">Target Cap</span>
                  <span className="font-mono font-bold text-white">${selectedReserve.targetAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Auto EOD Allocation</span>
                  <span className="font-mono font-bold text-purple-300">{selectedReserve.allocationRulePercent}% Revenue</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Last Funded Date</span>
                  <span className="font-mono text-slate-300">{selectedReserve.lastContributionDate || 'None'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Transfers Audit Ledger */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Reserve Allocation & Drawdown History</h3>
                <p className="text-xs text-slate-400">Audit trail of automated and manual capital movements</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alert(`Printing reserve ledger for ${selectedReserve.name}...`)}
                className="text-xs text-purple-300 hover:text-white"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Statement
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Notes</th>
                    <th className="px-4 py-2.5">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {reserveTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500 font-sans">
                        No transactions on this reserve yet.
                      </td>
                    </tr>
                  ) : (
                    reserveTransfers.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 text-slate-300">{tx.dateTime}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            tx.type === 'CONTRIBUTION' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${
                          tx.type === 'CONTRIBUTION' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {tx.type === 'CONTRIBUTION' ? `+$${tx.amount.toFixed(2)}` : `-$${tx.amount.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2.5 font-sans text-slate-300 truncate max-w-xs">{tx.notes}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-400">{tx.authorizedByStaffName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL: EXECUTE TRANSFER (CONTRIBUTION / DRAWDOWN)
          ======================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {transferType === 'CONTRIBUTION' ? 'Fund Reserve Pool' : 'Authorize Reserve Drawdown'}
                </h3>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Reserve</label>
                <div className="p-2.5 bg-slate-950 rounded-lg text-white font-semibold">
                  {selectedReserve.name}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Transfer Amount ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {transferType === 'CONTRIBUTION' ? 'Funding Bank Account' : 'Drawdown Destination Account'}
                </label>
                <select
                  value={sourceAccountName}
                  onChange={(e) => setSourceAccountName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.name}>{a.name} (Bal: ${a.currentBalance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Justification & Notes</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Purchase order PO-2026-0801 supplier liquidation"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsTransferModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className={transferType === 'CONTRIBUTION' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'}
                >
                  Confirm Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
