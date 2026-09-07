import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  X, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Calculator, 
  FileText, 
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  Eye,
  EyeOff,
  Smartphone,
  CreditCard,
  Building,
  UserCheck,
  HelpCircle,
  Clock
} from 'lucide-react';
import {
  StaffMember,
  Shift,
  SaleTransaction,
  HeldSale,
  CreditNote,
  CashUpMode,
  TenderReconciliationEntry,
  ActivityReasonCode,
  ExceptionSeverity
} from '../../../types';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { 
  CONTROLLED_VARIANCE_REASON_CODES, 
  computeShiftTenderMetrics, 
  calculateVarianceSeverity 
} from '../../../utils/shiftReconciliation';

export interface ShiftClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  currentStaff: StaffMember;
  transactions?: SaleTransaction[];
  heldSales?: HeldSale[];
  creditNotes?: CreditNote[];
  onConfirmCloseShift: (shiftId: string, closureData: {
    closingFloat: number;
    countedCash: number;
    cashVariance: number;
    closingNotes: string;
    requiresApproval: boolean;
    cashUpMode: CashUpMode;
    tenderReconciliation: TenderReconciliationEntry[];
    originalBlindCounts?: Record<string, number>;
    reasonCode?: ActivityReasonCode;
    severity?: ExceptionSeverity;
    managerApproved?: boolean;
    managerApprovedBy?: string;
  }) => void;
}

export const ShiftClosureModal: React.FC<ShiftClosureModalProps> = ({
  isOpen,
  onClose,
  shift,
  currentStaff,
  transactions = [],
  heldSales = [],
  creditNotes = [],
  onConfirmCloseShift,
}) => {
  if (!isOpen || !shift) return null;

  // Mode: Blind vs Standard
  const [cashUpMode, setCashUpMode] = useState<CashUpMode>(shift.cashUpMode || 'STANDARD');
  const [blindCountSubmitted, setBlindCountSubmitted] = useState<boolean>(false);
  const [originalBlindCounts, setOriginalBlindCounts] = useState<Record<string, number>>({});

  // Computed expected metrics from the transaction engine
  const computedMetrics = useMemo(() => {
    return computeShiftTenderMetrics(shift, transactions, heldSales, creditNotes);
  }, [shift, transactions, heldSales, creditNotes]);

  const [closingFloat, setClosingFloat] = useState<string>((shift.openingFloat || 0).toFixed(2));
  
  // Physical counts per tender
  const [countedCash, setCountedCash] = useState<string>(
    cashUpMode === 'BLIND' ? '' : (computedMetrics.expectedCash || 0).toFixed(2)
  );
  const [countedMobileMoney, setCountedMobileMoney] = useState<string>(
    cashUpMode === 'BLIND' ? '' : ((shift.totalMobileMoneySales || 0).toFixed(2))
  );
  const [countedCard, setCountedCard] = useState<string>(
    cashUpMode === 'BLIND' ? '' : ((shift.totalCardSales || 0).toFixed(2))
  );
  const [countedCredit, setCountedCredit] = useState<string>(
    cashUpMode === 'BLIND' ? '' : ((shift.totalCreditSales || 0).toFixed(2))
  );

  // Denomination calculator state
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [denoms, setDenoms] = useState<Record<string, number>>({
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
    '0.50': 0,
  });

  // Variance Reason & Governance
  const [selectedReasonCode, setSelectedReasonCode] = useState<ActivityReasonCode>('CASH_SHORTAGE');
  const [closingNotes, setClosingNotes] = useState<string>(shift.closingNotes || '');
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Manager Approval Simulation in Modal
  const isSupervisorOrManager = currentStaff.roleId === 'ROLE-01' || currentStaff.roleTitle?.toLowerCase().includes('manager') || currentStaff.roleTitle?.toLowerCase().includes('admin');
  const [managerApproved, setManagerApproved] = useState<boolean>(false);

  const updateDenom = (val: string, count: number) => {
    const next = { ...denoms, [val]: Math.max(0, count) };
    setDenoms(next);
    const sum = Object.entries(next).reduce((acc, [denomStr, qty]) => {
      return acc + (parseFloat(denomStr) * Number(qty));
    }, 0);
    setCountedCash(sum.toFixed(2));
  };

  const expectedCashTotal = computedMetrics.expectedCash;
  const countedCashNum = parseFloat(countedCash) || 0;
  const cashVariance = countedCashNum - expectedCashTotal;
  const hasCashVariance = Math.abs(cashVariance) > 0.01;

  // Tender variances
  const mobileMoneyExpected = computedMetrics.tenderReconciliation.find(t => t.tenderType === 'MOBILE_MONEY')?.expectedAmount || 0;
  const mobileMoneyCounted = parseFloat(countedMobileMoney) || 0;
  const mobileMoneyVariance = mobileMoneyCounted - mobileMoneyExpected;

  const cardExpected = computedMetrics.tenderReconciliation.find(t => t.tenderType === 'DEBIT_CARD')?.expectedAmount || 0;
  const cardCounted = parseFloat(countedCard) || 0;
  const cardVariance = cardCounted - cardExpected;

  const creditExpected = computedMetrics.tenderReconciliation.find(t => t.tenderType === 'CUSTOMER_CREDIT')?.expectedAmount || 0;
  const creditCounted = parseFloat(countedCredit) || 0;
  const creditVariance = creditCounted - creditExpected;

  const totalVariance = cashVariance + mobileMoneyVariance + cardVariance + creditVariance;
  const hasAnyDiscrepancy = Math.abs(totalVariance) > 0.01;
  const varianceSeverity = calculateVarianceSeverity(cashVariance);

  const isBlindHidden = cashUpMode === 'BLIND' && !blindCountSubmitted;

  const handleBlindSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countedCash.trim()) {
      setErrorMsg('Please enter your counted physical drawer cash before submitting blind count.');
      return;
    }
    setErrorMsg('');
    setOriginalBlindCounts({
      CASH: countedCashNum,
      MOBILE_MONEY: mobileMoneyCounted,
      DEBIT_CARD: cardCounted,
      CUSTOMER_CREDIT: creditCounted,
    });
    setBlindCountSubmitted(true);
  };

  const handleSubmitFinal = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isBlindHidden) {
      handleBlindSubmit(e);
      return;
    }

    if (hasAnyDiscrepancy) {
      if (!selectedReasonCode) {
        setErrorMsg('A variance was detected. You must select a controlled Discrepancy Reason Code.');
        return;
      }
      if (selectedReasonCode === 'OTHER' && (!closingNotes || closingNotes.trim().length < 10)) {
        setErrorMsg('When selecting "Other Operational Discrepancy", you must provide detailed explanatory notes (min 10 characters).');
        return;
      }
      if (!closingNotes.trim()) {
        setErrorMsg('A cash/tender discrepancy was detected. You must provide explanation notes for manager audit.');
        return;
      }
    }

    // Build structured tender reconciliation list
    const finalTenders: TenderReconciliationEntry[] = [
      {
        tenderType: 'CASH',
        tenderName: 'Cash in Drawer (Physical Currency)',
        expectedAmount: expectedCashTotal,
        countedOrConfirmedAmount: countedCashNum,
        variance: cashVariance,
        reasonCode: hasCashVariance ? selectedReasonCode : undefined,
        notes: closingNotes,
        isCash: true,
      },
      {
        tenderType: 'MOBILE_MONEY',
        tenderName: 'Mobile Money / EcoCash / Merchant Wallet',
        expectedAmount: mobileMoneyExpected,
        countedOrConfirmedAmount: mobileMoneyCounted,
        variance: mobileMoneyVariance,
        reasonCode: Math.abs(mobileMoneyVariance) > 0.01 ? selectedReasonCode : undefined,
        isCash: false,
      },
      {
        tenderType: 'DEBIT_CARD',
        tenderName: 'Card / POS Terminal Merchant Batch',
        expectedAmount: cardExpected,
        countedOrConfirmedAmount: cardCounted,
        variance: cardVariance,
        reasonCode: Math.abs(cardVariance) > 0.01 ? selectedReasonCode : undefined,
        isCash: false,
      },
      {
        tenderType: 'CUSTOMER_CREDIT',
        tenderName: 'Customer Account Credit Sales',
        expectedAmount: creditExpected,
        countedOrConfirmedAmount: creditCounted,
        variance: creditVariance,
        reasonCode: Math.abs(creditVariance) > 0.01 ? selectedReasonCode : undefined,
        isCash: false,
      },
    ];

    onConfirmCloseShift(shift.id, {
      closingFloat: parseFloat(closingFloat) || (shift.openingFloat || 0),
      countedCash: countedCashNum,
      cashVariance,
      closingNotes: closingNotes.trim(),
      requiresApproval: hasAnyDiscrepancy,
      cashUpMode,
      tenderReconciliation: finalTenders,
      originalBlindCounts: cashUpMode === 'BLIND' ? originalBlindCounts : undefined,
      reasonCode: hasAnyDiscrepancy ? selectedReasonCode : undefined,
      severity: hasAnyDiscrepancy ? varianceSeverity : undefined,
      managerApproved: isSupervisorOrManager && managerApproved,
      managerApprovedBy: (isSupervisorOrManager && managerApproved) ? currentStaff.name : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-[#FF6B00] flex items-center justify-center text-white font-bold text-sm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
                Shift Reconciliation & Closure
                <span className="text-[10px] bg-slate-700 px-2 py-0.5 font-mono text-orange-300">
                  {cashUpMode === 'BLIND' ? 'BLIND CASH-UP' : 'STANDARD CASH-UP'}
                </span>
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                Shift #{shift.shiftNumber} — {shift.terminalName} ({shift.branchName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Strip */}
        <div className="bg-gray-100 px-5 py-2 border-b border-gray-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Reconciliation Mode:</span>
            <div className="inline-flex border border-gray-300 bg-white">
              <button
                type="button"
                onClick={() => {
                  setCashUpMode('STANDARD');
                  setBlindCountSubmitted(false);
                  setCountedCash(expectedCashTotal.toFixed(2));
                  setCountedMobileMoney(mobileMoneyExpected.toFixed(2));
                  setCountedCard(cardExpected.toFixed(2));
                  setCountedCredit(creditExpected.toFixed(2));
                }}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${
                  cashUpMode === 'STANDARD' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  setCashUpMode('BLIND');
                  setBlindCountSubmitted(false);
                  setCountedCash('');
                  setCountedMobileMoney('');
                  setCountedCard('');
                  setCountedCredit('');
                }}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors flex items-center gap-1 ${
                  cashUpMode === 'BLIND' ? 'bg-[#FF6B00] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <EyeOff className="w-3 h-3" />
                Blind Cash-Up
              </button>
            </div>
          </div>
          <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">
            Cashier: <strong>{shift.cashierStaffName}</strong>
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <Alert type="error" message={errorMsg} />
          )}

          {/* Held Sales Warning if any */}
          {computedMetrics.heldSalesCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 p-2.5 flex items-center justify-between text-amber-900">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-[11px]">
                  <strong>{computedMetrics.heldSalesCount} Parked / Held Sale(s)</strong> ($
                  {computedMetrics.heldSalesTotalValue.toFixed(2)}) remain outstanding for this shift session.
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold bg-amber-200 px-2 py-0.5">
                Will be archived with Shift
              </span>
            </div>
          )}

          {/* Blind Mode Helper Banner */}
          {isBlindHidden && (
            <div className="bg-blue-50 border border-blue-200 p-3 text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs">
                <EyeOff className="w-4 h-4 text-blue-600" />
                Blind Reconciliation Protocol Active
              </div>
              <p className="text-[11px] text-blue-800">
                Expected system balances are intentionally obscured. Count physical cash in drawer and confirm non-cash tender settlement summaries, then submit your blind count to reveal variances.
              </p>
            </div>
          )}

          {/* Tender Breakdown Ledger Table */}
          <div className="bg-gray-50 border border-gray-300 overflow-hidden shadow-2xs">
            <div className="bg-gray-200/80 px-3 py-2 border-b border-gray-300 font-bold uppercase tracking-wider text-[11px] text-gray-700 flex items-center justify-between">
              <span>Tender Reconciliation Breakdown</span>
              <span className="font-mono text-[10px] text-gray-500">Trading Session #{shift.shiftNumber}</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-600 font-mono text-[10px] uppercase">
                  <th className="py-2 px-3">Tender Method</th>
                  <th className="py-2 px-3 text-right">Expected ($)</th>
                  <th className="py-2 px-3 text-right">Counted / Confirmed ($)</th>
                  {!isBlindHidden && <th className="py-2 px-3 text-right">Variance ($)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {/* 1. Cash */}
                <tr className="bg-white">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Physical Cash in Drawer
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">
                      Float (${(shift.openingFloat || 0).toFixed(2)}) + Cash Sales (${(computedMetrics.cashMovements.cashSales).toFixed(2)}) - Refunds (${(computedMetrics.cashMovements.cashRefunds).toFixed(2)})
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                    {isBlindHidden ? '••••••' : `$${expectedCashTotal.toFixed(2)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-right border border-gray-300 bg-amber-50/40 px-2 py-1 text-xs font-bold text-gray-900 focus:border-[#FF6B00] focus:outline-none"
                      required
                    />
                  </td>
                  {!isBlindHidden && (
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      Math.abs(cashVariance) < 0.01 ? 'text-emerald-600' : cashVariance < 0 ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {cashVariance >= 0 ? `+$${cashVariance.toFixed(2)}` : `-$${Math.abs(cashVariance).toFixed(2)}`}
                    </td>
                  )}
                </tr>

                {/* 2. Mobile Money */}
                <tr className="bg-white">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      Mobile Money / EcoCash
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">Merchant wallet batch settlement</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                    {isBlindHidden ? '••••••' : `$${mobileMoneyExpected.toFixed(2)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedMobileMoney}
                      onChange={(e) => setCountedMobileMoney(e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-right border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 focus:border-[#FF6B00] focus:outline-none"
                    />
                  </td>
                  {!isBlindHidden && (
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      Math.abs(mobileMoneyVariance) < 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {mobileMoneyVariance >= 0 ? `+$${mobileMoneyVariance.toFixed(2)}` : `-$${Math.abs(mobileMoneyVariance).toFixed(2)}`}
                    </td>
                  )}
                </tr>

                {/* 3. Card / EDC */}
                <tr className="bg-white">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                      Card / POS Terminal Batch
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">EDC terminal merchant report</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                    {isBlindHidden ? '••••••' : `$${cardExpected.toFixed(2)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCard}
                      onChange={(e) => setCountedCard(e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-right border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 focus:border-[#FF6B00] focus:outline-none"
                    />
                  </td>
                  {!isBlindHidden && (
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      Math.abs(cardVariance) < 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {cardVariance >= 0 ? `+$${cardVariance.toFixed(2)}` : `-$${Math.abs(cardVariance).toFixed(2)}`}
                    </td>
                  )}
                </tr>

                {/* 4. Customer Credit */}
                <tr className="bg-white">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-600" />
                      Customer Account Credit
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">Signed commercial credit sales invoices</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                    {isBlindHidden ? '••••••' : `$${creditExpected.toFixed(2)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCredit}
                      onChange={(e) => setCountedCredit(e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-right border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 focus:border-[#FF6B00] focus:outline-none"
                    />
                  </td>
                  {!isBlindHidden && (
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      Math.abs(creditVariance) < 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {creditVariance >= 0 ? `+$${creditVariance.toFixed(2)}` : `-$${Math.abs(creditVariance).toFixed(2)}`}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Denomination Calculator Accordion */}
          <div className="border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => setShowDenomCalc(!showDenomCalc)}
              className="w-full px-3 py-2 bg-gray-100 flex items-center justify-between text-left font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#FF6B00]" />
                <span>Cash Denomination Counter Assistant</span>
              </div>
              <span className="text-[11px] text-gray-500 font-normal">
                {showDenomCalc ? 'Hide' : 'Open Currency Breakdown'}
              </span>
            </button>

            {showDenomCalc && (
              <div className="p-3 bg-blue-50/40 border-t border-gray-300 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(denoms).map(([denomStr, count]) => (
                    <div key={denomStr} className="bg-white p-2 border border-blue-200 flex flex-col">
                      <span className="text-[10px] font-bold text-gray-600 font-mono">${denomStr} Notes / Coins:</span>
                      <input
                        type="number"
                        min="0"
                        value={count || ''}
                        onChange={(e) => updateDenom(denomStr, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full border border-gray-300 px-1 py-1 text-xs font-mono font-bold text-center mt-1 focus:border-[#FF6B00] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Blind Count Submit Step Button */}
          {isBlindHidden ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleBlindSubmit}
                className="w-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold py-2.5 text-xs uppercase tracking-wider"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Submit Blind Count & Reveal Variances
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmitFinal} className="space-y-4 pt-1">
              {/* Variance & Governance Status Banner */}
              <div className={`p-3.5 border flex items-center justify-between ${
                !hasAnyDiscrepancy
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : cashVariance < 0
                    ? 'bg-rose-50 border-rose-400 text-rose-900'
                    : 'bg-amber-50 border-amber-400 text-amber-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  {!hasAnyDiscrepancy ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-pulse" />
                  )}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {!hasAnyDiscrepancy 
                        ? 'Zero Net Variance — Balanced Till'
                        : cashVariance < 0 
                          ? `Cash Shortage Detected (${varianceSeverity} Severity)` 
                          : `Cash Overage Detected (${varianceSeverity} Severity)`}
                    </span>
                    <span className="text-[11px] font-mono">
                      {!hasAnyDiscrepancy 
                        ? 'Drawer & payment tenders perfectly reconcile with trading journal.'
                        : `Net discrepancy of ${totalVariance < 0 ? `-$${Math.abs(totalVariance).toFixed(2)}` : `+$${totalVariance.toFixed(2)}`}. Will generate an immutable Operational Exception.`}
                    </span>
                  </div>
                </div>
                <div className={`text-base font-mono font-black ${
                  !hasAnyDiscrepancy ? 'text-emerald-700' : cashVariance < 0 ? 'text-rose-700' : 'text-amber-700'
                }`}>
                  {totalVariance >= 0 ? `+$${totalVariance.toFixed(2)}` : `-$${Math.abs(totalVariance).toFixed(2)}`}
                </div>
              </div>

              {/* Controlled Reason Code & Notes if discrepancy */}
              {hasAnyDiscrepancy && (
                <div className="bg-gray-50 border border-gray-300 p-3.5 space-y-3">
                  <div className="text-[11px] font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#FF6B00]" />
                    Operational Exception Categorization
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Variance Reason Code <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={selectedReasonCode}
                      onChange={(e) => setSelectedReasonCode(e.target.value as ActivityReasonCode)}
                      className="w-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 focus:border-[#FF6B00] focus:outline-none"
                      required
                    >
                      {CONTROLLED_VARIANCE_REASON_CODES.map((rc) => (
                        <option key={rc.code} value={rc.code}>
                          {rc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                      Cashier Explanatory Remarks <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      rows={2}
                      placeholder="Explain root cause of difference for supervisor audit..."
                      className="w-full border border-rose-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 resize-none focus:border-rose-600 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Supervisor signoff option if manager is active */}
                  {isSupervisorOrManager && (
                    <div className="bg-amber-100/60 border border-amber-300 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-amber-700" />
                        <span className="text-xs text-amber-900 font-medium">
                          Supervisor Signoff: Authorize and sign off this shift variance immediately as {currentStaff.name} ({currentStaff.roleTitle})
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={managerApproved}
                        onChange={(e) => setManagerApproved(e.target.checked)}
                        className="w-4 h-4 text-[#FF6B00] focus:ring-[#FF6B00] rounded-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Retained Float Safe Drop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Float Retained in Till (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={closingFloat}
                    onChange={(e) => setClosingFloat(e.target.value)}
                    className="w-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-gray-900"
                  />
                </div>

                {!hasAnyDiscrepancy && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                      General Shift Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder="Normal trading closure notes..."
                      className="w-full border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
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
                  variant={hasAnyDiscrepancy ? 'danger' : 'primary'}
                  size="md"
                  className={`font-bold ${
                    hasAnyDiscrepancy 
                      ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                      : 'bg-[#FF6B00] hover:bg-[#E05E00] text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {hasAnyDiscrepancy ? 'Finalize with Exception & Record Audit' : 'Finalize & Close Shift'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
