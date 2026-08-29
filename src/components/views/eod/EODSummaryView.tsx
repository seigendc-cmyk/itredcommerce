import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  ArrowLeft, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Printer, 
  ShieldAlert, 
  Check, 
  X, 
  Lock, 
  Store, 
  Calendar, 
  FileText,
  CreditCard,
  Smartphone,
  RotateCcw,
  HandCoins,
  History,
  TrendingDown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  StaffMember, 
  Branch, 
  Terminal, 
  Shift, 
  HeldSale, 
  CreditNote, 
  EODReport, 
  EODReconciliationEntry,
  StockAdjustmentRecord,
  ApprovalRequest
} from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface EODSummaryViewProps {
  currentStaff: StaffMember;
  branches: Branch[];
  terminals: Terminal[];
  shifts: Shift[];
  heldSales: HeldSale[];
  creditNotes: CreditNote[];
  eodReports: EODReport[];
  stockAdjustments?: StockAdjustmentRecord[];
  onSaveEODReport: (report: EODReport) => void;
  onBackToLanding: () => void;
  onNavigateToShifts: () => void;
  onNavigateToApprovals: () => void;
}

export const EODSummaryView: React.FC<EODSummaryViewProps> = ({
  currentStaff,
  branches = [],
  terminals = [],
  shifts = [],
  heldSales = [],
  creditNotes = [],
  eodReports = [],
  stockAdjustments = [],
  onSaveEODReport,
  onBackToLanding,
  onNavigateToShifts,
  onNavigateToApprovals,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches?.[0]?.id || 'BR-01');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewTab, setViewTab] = useState<'ACTIVE_EOD' | 'PAST_REPORTS'>('ACTIVE_EOD');
  const [managerNotes, setManagerNotes] = useState<string>('');
  const [selectedPastReport, setSelectedPastReport] = useState<EODReport | null>(null);
  const [isApprovedByManager, setIsApprovedByManager] = useState<boolean>(false);

  const activeBranch = branches?.find((b) => b.id === selectedBranchId) || branches?.[0] || { id: 'BR-01', name: 'Downtown Branch', code: 'BR-01' };

  // Calculate live expected amounts from current shifts for the selected branch & date
  const relevantShifts = useMemo(() => {
    return (shifts || []).filter((s) => s.branchId === selectedBranchId);
  }, [shifts, selectedBranchId]);

  // Outstanding unresolved conditions
  const openTills = useMemo(() => {
    return (relevantShifts || []).filter((s) => s.status === 'OPEN' || s.status === 'REQUIRES_CLOSURE');
  }, [relevantShifts]);

  const unresolvedHeldSales = useMemo(() => {
    return (heldSales || []).filter((hs) => hs.status === 'HELD' || hs.status === 'PARKED');
  }, [heldSales]);

  const unapprovedRefunds = useMemo(() => {
    return (creditNotes || []).filter((cn) => cn.status === 'ISSUED');
  }, [creditNotes]);

  const pendingAdjustments = useMemo(() => {
    return stockAdjustments.filter((sa) => sa.status === 'PENDING_APPROVAL');
  }, [stockAdjustments]);

  // Aggregate expected amounts across all terminal shifts
  const aggregateExpected = useMemo(() => {
    let cash = 0;
    let mobile = 0;
    let card = 0;
    let credit = 0;
    let layaway = 0;
    let refunds = 0;
    let payouts = 0;
    let grossSales = 0;

    relevantShifts.forEach((s) => {
      cash += s.expectedCash;
      mobile += s.totalMobileMoneySales;
      card += s.totalCardSales;
      credit += s.totalCreditSales;
      layaway += s.totalLayawayReceipts;
      refunds += s.totalRefunds;
      payouts += s.totalPayouts;
      grossSales += s.grossSales;
    });

    return { cash, mobile, card, credit, layaway, refunds, payouts, grossSales };
  }, [relevantShifts]);

  // Reconciliation table state (User counted amounts)
  const [countedEntries, setCountedEntries] = useState<Record<string, number>>({
    CASH: aggregateExpected.cash,
    MOBILE_MONEY: aggregateExpected.mobile,
    CARD_BANK: aggregateExpected.card,
    CREDIT_SALES: aggregateExpected.credit,
    LAYAWAYS: aggregateExpected.layaway,
    REFUNDS: aggregateExpected.refunds,
    PAYOUTS: aggregateExpected.payouts,
  });

  const [entryNotes, setEntryNotes] = useState<Record<string, string>>({
    CASH: 'Drawer currency counted and bagged for bank deposit.',
    MOBILE_MONEY: 'EcoCash & OneMoney merchant terminal statement reconciled.',
    CARD_BANK: 'Bank POS terminal settlement batch matched.',
    CREDIT_SALES: 'Commercial customer credit delivery notes signed.',
    LAYAWAYS: 'Layaway deposit vouchers verified.',
    REFUNDS: 'Approved refunds ledger matched.',
    PAYOUTS: 'Petty cash expense slips verified.',
  });

  const handleCountChange = (cat: string, val: number) => {
    setCountedEntries((prev) => ({ ...prev, [cat]: val }));
  };

  const handleNoteChange = (cat: string, val: string) => {
    setEntryNotes((prev) => ({ ...prev, [cat]: val }));
  };

  // Build full reconciliation list
  const reconciliationList: EODReconciliationEntry[] = useMemo(() => {
    return [
      {
        category: 'CASH',
        label: 'Cash Tender (Floats + Sales)',
        expectedAmount: aggregateExpected.cash,
        countedAmount: countedEntries['CASH'] ?? aggregateExpected.cash,
        variance: (countedEntries['CASH'] ?? aggregateExpected.cash) - aggregateExpected.cash,
        notes: entryNotes['CASH'],
      },
      {
        category: 'MOBILE_MONEY',
        label: 'Mobile Money (EcoCash / OneMoney)',
        expectedAmount: aggregateExpected.mobile,
        countedAmount: countedEntries['MOBILE_MONEY'] ?? aggregateExpected.mobile,
        variance: (countedEntries['MOBILE_MONEY'] ?? aggregateExpected.mobile) - aggregateExpected.mobile,
        notes: entryNotes['MOBILE_MONEY'],
      },
      {
        category: 'CARD_BANK',
        label: 'Bank Debit & Credit Cards',
        expectedAmount: aggregateExpected.card,
        countedAmount: countedEntries['CARD_BANK'] ?? aggregateExpected.card,
        variance: (countedEntries['CARD_BANK'] ?? aggregateExpected.card) - aggregateExpected.card,
        notes: entryNotes['CARD_BANK'],
      },
      {
        category: 'CREDIT_SALES',
        label: 'Commercial Customer Credit Sales',
        expectedAmount: aggregateExpected.credit,
        countedAmount: countedEntries['CREDIT_SALES'] ?? aggregateExpected.credit,
        variance: (countedEntries['CREDIT_SALES'] ?? aggregateExpected.credit) - aggregateExpected.credit,
        notes: entryNotes['CREDIT_SALES'],
      },
      {
        category: 'LAYAWAYS',
        label: 'Layaway Installment Receipts',
        expectedAmount: aggregateExpected.layaway,
        countedAmount: countedEntries['LAYAWAYS'] ?? aggregateExpected.layaway,
        variance: (countedEntries['LAYAWAYS'] ?? aggregateExpected.layaway) - aggregateExpected.layaway,
        notes: entryNotes['LAYAWAYS'],
      },
      {
        category: 'REFUNDS',
        label: 'Sales Returns & Refunds Paid Out',
        expectedAmount: aggregateExpected.refunds,
        countedAmount: countedEntries['REFUNDS'] ?? aggregateExpected.refunds,
        variance: (countedEntries['REFUNDS'] ?? aggregateExpected.refunds) - aggregateExpected.refunds,
        notes: entryNotes['REFUNDS'],
      },
      {
        category: 'PAYOUTS',
        label: 'Petty Cash Disbursements / Payouts',
        expectedAmount: aggregateExpected.payouts,
        countedAmount: countedEntries['PAYOUTS'] ?? aggregateExpected.payouts,
        variance: (countedEntries['PAYOUTS'] ?? aggregateExpected.payouts) - aggregateExpected.payouts,
        notes: entryNotes['PAYOUTS'],
      },
    ];
  }, [aggregateExpected, countedEntries, entryNotes]);

  const totalVariance = reconciliationList.reduce((acc, r) => acc + r.variance, 0);
  const hasVariance = Math.abs(totalVariance) > 0.01;
  const isManager = currentStaff.role === 'STORE_MANAGER' || currentStaff.role === 'SYS_ADMIN';

  // Unresolved conditions flags count
  const unresolvedConditionsCount = 
    openTills.length + 
    unresolvedHeldSales.length + 
    (hasVariance ? 1 : 0) +
    pendingAdjustments.length;

  const handleFinalizeEOD = () => {
    const newReport: EODReport = {
      id: `EOD-${Date.now()}`,
      reportNumber: `EOD-${selectedDate.replace(/-/g, '')}-${activeBranch.code || 'BR01'}`,
      date: selectedDate,
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      terminalId: 'ALL_CONSOLIDATED',
      terminalName: 'Consolidated Branch Terminals',
      generatedByStaffId: currentStaff.id,
      generatedByStaffName: currentStaff.name,
      status: hasVariance ? 'DISCREPANCY_FLAGGED' : isApprovedByManager ? 'APPROVED' : 'SUBMITTED',
      reconciliation: reconciliationList,
      totalSales: aggregateExpected.grossSales,
      totalCashExpected: aggregateExpected.cash,
      totalCashCounted: countedEntries['CASH'] || aggregateExpected.cash,
      totalVariance: totalVariance,
      unresolvedHeldSalesCount: unresolvedHeldSales.length,
      unresolvedHeldSalesValue: unresolvedHeldSales.reduce((acc, h) => acc + h.grandTotal, 0),
      unapprovedRefundsCount: unapprovedRefunds.length,
      unapprovedRefundsValue: unapprovedRefunds.reduce((acc, r) => acc + r.totalRefundAmount, 0),
      openTillsCount: openTills.length,
      pendingStockAdjustmentsCount: pendingAdjustments.length,
      managerApprovedBy: isApprovedByManager ? currentStaff.name : undefined,
      managerApprovalDate: isApprovedByManager ? new Date().toISOString().replace('T', ' ').substring(0, 16) : undefined,
      managerNotes: managerNotes.trim() || undefined,
      createdDateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    onSaveEODReport(newReport);
    setSelectedPastReport(newReport);
    setViewTab('PAST_REPORTS');
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
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
              <FileSpreadsheet className="w-5 h-5 text-[#FF6B00]" />
              End of Day (EOD) Reconciliation
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Branch sales closing, multi-tender balancing, and manager sign-off audit
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
            <Lock className="w-3.5 h-3.5 mr-1 text-gray-600" />
            Shift Controls
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToApprovals}
            className="text-xs font-bold uppercase"
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Approvals Area
          </Button>
        </div>
      </div>

      {/* Branch & Date Filter Strip */}
      <div className="bg-white p-3 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex border border-gray-300">
            <button
              type="button"
              onClick={() => setViewTab('ACTIVE_EOD')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                viewTab === 'ACTIVE_EOD'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Current Reconciliation
            </button>
            <button
              type="button"
              onClick={() => setViewTab('PAST_REPORTS')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                viewTab === 'PAST_REPORTS'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Archived EOD Reports ({eodReports.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-gray-500 hidden sm:inline" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 bg-white px-2 py-1 text-xs font-mono font-medium text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
          />
        </div>
      </div>

      {viewTab === 'ACTIVE_EOD' ? (
        <div className="space-y-4">
          {/* PROMINENT UNRESOLVED CONDITIONS ALERT BANNER */}
          {unresolvedConditionsCount > 0 && (
            <div className="bg-amber-50 border-2 border-amber-500 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-950 font-bold uppercase tracking-wider text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                  <span>Unresolved Operational Conditions ({unresolvedConditionsCount})</span>
                </div>
                <span className="bg-amber-500 text-white text-[10px] font-bold font-mono px-2 py-0.5 uppercase">
                  Review Required Before Day Close
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
                {/* Condition: Open Tills */}
                <div className={`p-2.5 border ${
                  openTills.length > 0 ? 'bg-rose-50/80 border-rose-300 text-rose-900' : 'bg-white border-gray-200 text-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] uppercase tracking-tight flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      Open Tills / Registers
                    </span>
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-rose-200 text-rose-950 text-[11px]">
                      {openTills.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {openTills.length > 0 ? 'Registers must be closed before final Z-Report.' : 'All registers balanced & closed.'}
                  </p>
                </div>

                {/* Condition: Held Sales Outstanding */}
                <div className={`p-2.5 border ${
                  unresolvedHeldSales.length > 0 ? 'bg-amber-100/60 border-amber-300 text-amber-950' : 'bg-white border-gray-200 text-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] uppercase tracking-tight flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Held Sales Outstanding
                    </span>
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-amber-200 text-amber-950 text-[11px]">
                      {unresolvedHeldSales.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {unresolvedHeldSales.length > 0 
                      ? `$${unresolvedHeldSales.reduce((acc, h) => acc + h.grandTotal, 0).toFixed(2)} in parked customer carts.` 
                      : 'Zero parked sales.'}
                  </p>
                </div>

                {/* Condition: Cash Variance */}
                <div className={`p-2.5 border ${
                  hasVariance ? 'bg-rose-50/80 border-rose-300 text-rose-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] uppercase tracking-tight flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      Tender Variance
                    </span>
                    <span className={`font-mono font-bold px-1.5 py-0.5 text-[11px] ${
                      hasVariance ? 'bg-rose-200 text-rose-950' : 'bg-emerald-200 text-emerald-950'
                    }`}>
                      {totalVariance === 0 ? '$0.00' : `${totalVariance < 0 ? '-' : '+'}$${Math.abs(totalVariance).toFixed(2)}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {hasVariance ? 'Counted tenders do not match expected system totals.' : 'All payment categories balanced.'}
                  </p>
                </div>

                {/* Condition: Unapproved Adjustments / Refunds */}
                <div className={`p-2.5 border ${
                  pendingAdjustments.length > 0 ? 'bg-amber-100/60 border-amber-300 text-amber-950' : 'bg-white border-gray-200 text-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] uppercase tracking-tight flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                      Pending Adjustments
                    </span>
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-purple-200 text-purple-950 text-[11px]">
                      {pendingAdjustments.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {pendingAdjustments.length > 0 ? 'Inventory write-offs awaiting manager approval.' : 'Inventory movements clean.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reconciliation Table */}
          <div className="bg-white border border-gray-200 shadow-2xs overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Payment Method & Tender Balancing Grid
                </h3>
                <p className="text-[11px] text-gray-300 font-mono">
                  Reconciling trading day {selectedDate} for {activeBranch.name}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-gray-400 block font-mono">Gross Day Sales</span>
                <span className="text-sm font-bold text-white font-mono">${aggregateExpected.grossSales.toFixed(2)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Tender / Payment Category</th>
                    <th className="py-2.5 px-3 text-right">Expected System Total</th>
                    <th className="py-2.5 px-3 text-right">Physical Counted Amount</th>
                    <th className="py-2.5 px-3 text-right">Discrepancy / Variance</th>
                    <th className="py-2.5 px-3">Reconciliation Notes & Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reconciliationList.map((entry) => {
                    const isDiff = Math.abs(entry.variance) > 0.01;
                    return (
                      <tr key={entry.category} className={isDiff ? 'bg-rose-50/40' : 'hover:bg-gray-50'}>
                        <td className="py-3 px-3">
                          <div className="font-bold text-gray-900">{entry.label}</div>
                          <span className="text-[10px] font-mono text-gray-500 uppercase">{entry.category}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-gray-900 text-xs">
                          ${entry.expectedAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-gray-500 font-mono">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={countedEntries[entry.category] !== undefined ? countedEntries[entry.category] : entry.expectedAmount}
                              onChange={(e) => handleCountChange(entry.category, parseFloat(e.target.value) || 0)}
                              className="w-28 text-right font-mono font-bold border border-gray-300 px-2 py-1 text-xs focus:border-[#FF6B00] focus:outline-hidden"
                            />
                          </div>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold text-xs ${
                          isDiff 
                            ? entry.variance < 0 ? 'text-rose-600' : 'text-amber-600' 
                            : 'text-emerald-700'
                        }`}>
                          {entry.variance === 0 ? '$0.00' : `${entry.variance < 0 ? '-' : '+'}$${Math.abs(entry.variance).toFixed(2)}`}
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={entryNotes[entry.category] || ''}
                            onChange={(e) => handleNoteChange(entry.category, e.target.value)}
                            placeholder="Verification note..."
                            className="w-full text-xs border border-gray-300 px-2 py-1 text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-mono font-bold text-xs">
                  <tr>
                    <td className="py-3 px-3 uppercase text-gray-800">Total Net Reconciliation:</td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      ${reconciliationList.reduce((acc, r) => acc + r.expectedAmount, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      ${reconciliationList.reduce((acc, r) => acc + r.countedAmount, 0).toFixed(2)}
                    </td>
                    <td className={`py-3 px-3 text-right font-black ${hasVariance ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {totalVariance === 0 ? '$0.00' : `${totalVariance < 0 ? '-' : '+'}$${Math.abs(totalVariance).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-3 text-[11px] font-sans font-normal text-gray-600">
                      {hasVariance ? '⚠️ Net variance requires supervisor signature.' : '✅ 100% Balanced.'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Manager Sign-Off & Approval Section */}
          <div className="bg-white border border-gray-200 p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Store Manager Approval & Sign-Off
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    Mandatory operational sign-off for day closure and vault deposit
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase font-mono ${
                isManager ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
              }`}>
                Current Role: {currentStaff.role}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Manager Sign-off Notes / Discrepancy Approvals
                </label>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows={3}
                  placeholder="Enter remarks regarding variances, safe drops, or shift exceptions..."
                  className="w-full border border-gray-300 p-2.5 text-xs text-gray-900 focus:border-[#FF6B00] focus:outline-hidden resize-none"
                />
              </div>

              <div className="bg-gray-50 p-3.5 border border-gray-300 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase text-gray-800 mb-1">
                    Sign-Off Verification Check:
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isApprovedByManager}
                      onChange={(e) => setIsApprovedByManager(e.target.checked)}
                      className="mt-0.5 rounded-none border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00]"
                    />
                    <span className="text-[11px] text-gray-700 leading-snug">
                      I hereby verify and certify that all cash drawers, electronic batches, and credit transactions 
                      for <strong>{activeBranch.name}</strong> on <strong>{selectedDate}</strong> have been audited and reconciled.
                    </span>
                  </label>
                </div>

                <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between pt-2 border-t border-gray-200">
                  <span>Auditor: {currentStaff.name} ({currentStaff.code})</span>
                  <span>Branch: {activeBranch.code}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 font-mono">
                {openTills.length > 0 && (
                  <span className="text-rose-600 font-bold">
                    ⚠️ {openTills.length} open shift till(s) remain unclosed.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print EOD Worksheet
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleFinalizeEOD}
                  className="w-full sm:w-auto bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Finalize & Archive EOD Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Past Archived EOD Reports */
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Report Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Generated By</th>
                    <th className="py-2.5 px-3 text-right">Total Sales</th>
                    <th className="py-2.5 px-3 text-right">Cash Expected</th>
                    <th className="py-2.5 px-3 text-right">Counted Cash</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Summary Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                  {eodReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-bold text-gray-900">{rep.reportNumber}</td>
                      <td className="py-2.5 px-3 text-gray-700">{rep.date}</td>
                      <td className="py-2.5 px-3 font-sans text-gray-900">{rep.branchName}</td>
                      <td className="py-2.5 px-3 font-sans text-gray-800">{rep.generatedByStaffName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">${rep.totalSales.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">${rep.totalCashExpected.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">${rep.totalCashCounted.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${rep.totalVariance < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                        {rep.totalVariance === 0 ? '$0.00' : `${rep.totalVariance < 0 ? '-' : '+'}$${Math.abs(rep.totalVariance).toFixed(2)}`}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                          rep.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : rep.status === 'DISCREPANCY_FLAGGED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-400'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {rep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPastReport(rep)}
                          className="text-[#FF6B00] hover:text-[#E05E00] font-sans font-bold underline text-xs cursor-pointer"
                        >
                          View Summary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Past Report Summary Modal */}
          {selectedPastReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-lg p-6 space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
                <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 font-sans">
                  <h3 className="font-bold text-base uppercase tracking-wider text-gray-900">
                    BRANCH END OF DAY (Z-REPORT) SUMMARY
                  </h3>
                  <p className="text-xs text-gray-600 font-bold">{selectedPastReport.branchName}</p>
                  <p className="text-[11px] text-gray-500 font-mono">
                    Report #{selectedPastReport.reportNumber} • Date: {selectedPastReport.date}
                  </p>
                </div>

                <div className="space-y-1 text-[11px] bg-gray-50 p-2.5 border border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Auditor:</span>
                    <span className="font-bold text-gray-900">{selectedPastReport.generatedByStaffName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Generated Time:</span>
                    <span className="text-gray-900">{selectedPastReport.createdDateTime}</span>
                  </div>
                  {selectedPastReport.managerApprovedBy && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Approved By:</span>
                      <span>{selectedPastReport.managerApprovedBy} ({selectedPastReport.managerApprovalDate})</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1 text-[11px]">
                  <div className="font-bold text-gray-800 uppercase mb-1">Reconciled Tenders:</div>
                  {selectedPastReport.reconciliation.map((rec) => (
                    <div key={rec.category} className="flex justify-between">
                      <span className="text-gray-700">{rec.label}:</span>
                      <span className="font-bold text-gray-900">${rec.countedAmount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-300 text-xs">
                    <span>Total Sales Reconciled:</span>
                    <span>${selectedPastReport.totalSales.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-gray-100 p-2.5 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Total Expected Cash:</span>
                    <span>${selectedPastReport.totalCashExpected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total Counted Cash:</span>
                    <span>${selectedPastReport.totalCashCounted.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${
                    selectedPastReport.totalVariance < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    <span>Net Discrepancy:</span>
                    <span>{selectedPastReport.totalVariance === 0 ? '$0.00' : `${selectedPastReport.totalVariance < 0 ? '-' : '+'}$${Math.abs(selectedPastReport.totalVariance).toFixed(2)}`}</span>
                  </div>
                </div>

                {selectedPastReport.managerNotes && (
                  <div className="p-2 border border-gray-200 bg-amber-50/50 text-[11px] italic">
                    <strong>Manager Notes:</strong> "{selectedPastReport.managerNotes}"
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 font-sans">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedPastReport(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => window.print()}
                    className="bg-gray-800 hover:bg-black text-white"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Summary
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
