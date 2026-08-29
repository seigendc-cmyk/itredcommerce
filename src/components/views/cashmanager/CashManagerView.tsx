import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  ArrowLeft, 
  Plus, 
  Minus, 
  ArrowRightLeft, 
  Building2, 
  ShieldAlert, 
  ShieldCheck, 
  Receipt, 
  DollarSign, 
  FileText, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Printer, 
  Wallet, 
  Landmark, 
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { 
  CashMovementRecord, 
  CashMovementCategory, 
  CashBankAccount, 
  StaffMember, 
  CashBankTransaction,
  ApprovalRequest
} from '../../../types';
import { isManager } from '../../../utils/roles';
import { Button } from '../../ui/Button';

export interface CashManagerViewProps {
  currentStaff: StaffMember;
  bankAccounts: CashBankAccount[];
  cashMovements: CashMovementRecord[];
  onAddMovement: (movement: CashMovementRecord) => void;
  onUpdateAccountBalance: (accountId: string, newBalance: number) => void;
  onAddTransaction: (transaction: CashBankTransaction) => void;
  onCreateApprovalRequest: (request: Partial<ApprovalRequest>) => void;
  onBackToLanding: () => void;
  onNavigateToAccounts?: () => void;
}

export const CashManagerView: React.FC<CashManagerViewProps> = ({
  currentStaff,
  bankAccounts = [],
  cashMovements = [],
  onAddMovement,
  onUpdateAccountBalance,
  onAddTransaction,
  onCreateApprovalRequest,
  onBackToLanding,
  onNavigateToAccounts,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'HISTORY' | 'RECONCILIATION'>('ACTIONS');
  const [selectedAction, setSelectedAction] = useState<CashMovementCategory>('PAYOUT');

  // Action Form State
  const [sourceAccountId, setSourceAccountId] = useState<string>('ACC-CASH-TILL-01');
  const [destAccountId, setDestAccountId] = useState<string>('ACC-CASH-SAFE-01');
  const [amount, setAmount] = useState<number>(50);
  const [reasonCategory, setReasonCategory] = useState<string>('Courier / Transport Fee');
  const [description, setDescription] = useState<string>('');
  const [receiptSlipNumber, setReceiptSlipNumber] = useState<string>(`VOUCH-${Math.floor(1000 + Math.random() * 9000)}`);
  const [bagSealNumber, setBagSealNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Till Reconciliation Form State
  const [reconcileAccountId, setReconcileAccountId] = useState<string>('ACC-CASH-TILL-01');
  const [countedCash, setCountedCash] = useState<number>(615.00);
  const [reconcileNotes, setReconcileNotes] = useState<string>('Mid-day drawer physical cash count verified.');
  const [reconciliationSuccess, setReconciliationSuccess] = useState<any | null>(null);

  // Success Slip State
  const [movementSuccessSlip, setMovementSuccessSlip] = useState<any | null>(null);

  const isManagement = isManager(currentStaff);

  const reconcileTargetAccount = useMemo(() => {
    return (bankAccounts || []).find(a => a.id === reconcileAccountId) || bankAccounts?.[0] || null;
  }, [bankAccounts, reconcileAccountId]);

  const variance = useMemo(() => {
    return countedCash - (reconcileTargetAccount?.currentBalance || 0);
  }, [countedCash, reconcileTargetAccount]);

  // Overall KPIs
  const movementStats = useMemo(() => {
    const todayPayouts = cashMovements
      .filter(m => m.category === 'PAYOUT')
      .reduce((sum, m) => sum + m.amount, 0);

    const todaySkims = cashMovements
      .filter(m => m.category === 'TILL_TRANSFER' || m.category === 'SAFE_TRANSFER')
      .reduce((sum, m) => sum + m.amount, 0);

    const todayBanking = cashMovements
      .filter(m => m.category === 'BANKING')
      .reduce((sum, m) => sum + m.amount, 0);

    const totalMovementsCount = cashMovements.length;

    return {
      todayPayouts,
      todaySkims,
      todayBanking,
      totalMovementsCount,
    };
  }, [cashMovements]);

  // Handle Form Submission for Cash In/Out/Transfer/Banking
  const handleSubmitMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const srcAcc = bankAccounts.find(a => a.id === sourceAccountId);
    const destAcc = bankAccounts.find(a => a.id === destAccountId);

    const requiresManagerApproval = 
      (selectedAction === 'PAYOUT' && amount > 100 && !isManagement) ||
      (selectedAction === 'BANKING' && !isManagement) ||
      (selectedAction === 'CASH_IN' && amount > 500 && !isManagement);

    if (requiresManagerApproval) {
      // Queue approval request
      onCreateApprovalRequest({
        type: 'PRICE_OVERRIDE',
        title: `Cash Movement Approval: ${selectedAction} ($${amount.toFixed(2)})`,
        description: `Staff ${currentStaff.name} initiated ${selectedAction} of $${amount.toFixed(2)}: ${description || reasonCategory}.`,
        amount: amount,
        referenceId: receiptSlipNumber,
        referenceType: 'CASH_MOVEMENT',
        locationName: 'Main Downtown Branch',
        requestedByStaffId: currentStaff.id,
        requestedByStaffName: currentStaff.name,
        requestedByRole: currentStaff.role,
        requestedDateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        reason: description || reasonCategory,
        priority: amount > 500 ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
        meta: {
          actionType: selectedAction,
          sourceAccountId,
          destAccountId,
          amount,
        }
      });

      alert(`Manager Sign-off Notice: Cash disbursements over $100 or bank transits require Store Manager authorization. An approval request has been generated for Manager review.`);
      return;
    }

    // Execute Balances Update
    if (selectedAction === 'PAYOUT' && srcAcc) {
      const newBal = srcAcc.currentBalance - amount;
      onUpdateAccountBalance(srcAcc.id, newBal);
      onAddTransaction({
        id: `CBTX-${Date.now()}`,
        accountId: srcAcc.id,
        accountName: srcAcc.name,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        movementType: 'PAYOUT',
        amount: -amount,
        balanceAfter: newBal,
        referenceNumber: receiptSlipNumber,
        description: `${reasonCategory}: ${description}`,
        performedByStaffId: currentStaff.id,
        performedByStaffName: currentStaff.name,
        status: 'POSTED',
      });
    } else if (selectedAction === 'CASH_IN' && destAcc) {
      const newBal = destAcc.currentBalance + amount;
      onUpdateAccountBalance(destAcc.id, newBal);
      onAddTransaction({
        id: `CBTX-${Date.now()}`,
        accountId: destAcc.id,
        accountName: destAcc.name,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        movementType: 'FLOAT_IN',
        amount: amount,
        balanceAfter: newBal,
        referenceNumber: receiptSlipNumber,
        description: `${reasonCategory}: ${description}`,
        performedByStaffId: currentStaff.id,
        performedByStaffName: currentStaff.name,
        status: 'POSTED',
      });
    } else if ((selectedAction === 'TILL_TRANSFER' || selectedAction === 'SAFE_TRANSFER') && srcAcc && destAcc) {
      const srcBal = srcAcc.currentBalance - amount;
      const destBal = destAcc.currentBalance + amount;
      onUpdateAccountBalance(srcAcc.id, srcBal);
      onUpdateAccountBalance(destAcc.id, destBal);

      onAddTransaction({
        id: `CBTX-${Date.now()}-A`,
        accountId: srcAcc.id,
        accountName: srcAcc.name,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        movementType: 'TRANSFER_OUT',
        amount: -amount,
        balanceAfter: srcBal,
        counterAccountId: destAcc.id,
        counterAccountName: destAcc.name,
        referenceNumber: receiptSlipNumber,
        description: `Skim Drop / Transfer to ${destAcc.name}`,
        performedByStaffId: currentStaff.id,
        performedByStaffName: currentStaff.name,
        status: 'POSTED',
      });

      onAddTransaction({
        id: `CBTX-${Date.now()}-B`,
        accountId: destAcc.id,
        accountName: destAcc.name,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        movementType: 'TRANSFER_IN',
        amount: amount,
        balanceAfter: destBal,
        counterAccountId: srcAcc.id,
        counterAccountName: srcAcc.name,
        referenceNumber: receiptSlipNumber,
        description: `Skim Transfer received from ${srcAcc.name}`,
        performedByStaffId: currentStaff.id,
        performedByStaffName: currentStaff.name,
        status: 'POSTED',
      });
    } else if (selectedAction === 'BANKING' && srcAcc && destAcc) {
      const srcBal = srcAcc.currentBalance - amount;
      const destBal = destAcc.currentBalance + amount;
      onUpdateAccountBalance(srcAcc.id, srcBal);
      onUpdateAccountBalance(destAcc.id, destBal);

      onAddTransaction({
        id: `CBTX-${Date.now()}-BNK`,
        accountId: srcAcc.id,
        accountName: srcAcc.name,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        movementType: 'BANKING',
        amount: -amount,
        balanceAfter: srcBal,
        counterAccountId: destAcc.id,
        counterAccountName: destAcc.name,
        referenceNumber: receiptSlipNumber,
        description: `Armored Courier Banking Transit to ${destAcc.name} (Seal: ${bagSealNumber || 'STD-SEAL'})`,
        performedByStaffId: currentStaff.id,
        performedByStaffName: currentStaff.name,
        status: 'POSTED',
      });
    }

    const newMov: CashMovementRecord = {
      id: `CMOV-${Date.now()}`,
      movementNumber: `MOV-${Date.now().toString().slice(-6)}`,
      category: selectedAction,
      sourceAccountId: srcAcc?.id,
      sourceAccountName: srcAcc?.name,
      destinationAccountId: destAcc?.id,
      destinationAccountName: destAcc?.name,
      amount,
      reasonCategory,
      description: description || reasonCategory,
      receiptSlipNumber,
      bagSealNumber: bagSealNumber || undefined,
      requestedByStaffId: currentStaff.id,
      requestedByStaffName: currentStaff.name,
      isSensitive: selectedAction === 'BANKING' || amount > 500,
      requiresApproval: false,
      approvalStatus: 'APPROVED',
      approvedByStaffName: isManagement ? currentStaff.name : 'Store Manager',
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    onAddMovement(newMov);

    setMovementSuccessSlip({
      movementNumber: newMov.movementNumber,
      category: selectedAction,
      amount,
      fromAccount: srcAcc?.name || 'External',
      toAccount: destAcc?.name || 'Cash Out Payout',
      receiptSlipNumber,
      staffName: currentStaff.name,
      date: newMov.dateTime,
    });

    setDescription('');
    setReceiptSlipNumber(`VOUCH-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  // Handle Till Reconciliation
  const handlePerformReconciliation = () => {
    const updatedAcc: CashBankAccount = {
      ...reconcileTargetAccount,
      currentBalance: countedCash,
      lastReconciledDate: new Date().toISOString().split('T')[0],
    };

    onUpdateAccountBalance(reconcileTargetAccount.id, countedCash);

    setReconciliationSuccess({
      accountName: reconcileTargetAccount.name,
      expected: reconcileTargetAccount.currentBalance,
      counted: countedCash,
      variance,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      staffName: currentStaff.name,
      notes: reconcileNotes,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
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
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Cash Manager & Operational Treasury</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Cash In / Out & Vault Drops
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Petty cash disbursements, till skim transfers, safe drops, armored transit banking & till reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToAccounts && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToAccounts}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
            >
              <Landmark className="w-4 h-4 mr-2 text-indigo-400" />
              View Account Balances
            </Button>
          )}
        </div>
      </header>

      {/* KPI Overview Banner */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Petty Cash Payouts Today</span>
            <Minus className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            ${movementStats.todayPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Direct cashier expense vouchers</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Till Skim Drops to Safe</span>
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            ${movementStats.todaySkims.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Excess float vault transfers</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Armored Bank Deposits</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            ${movementStats.todayBanking.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Transit deposits in transit</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Audit & Authorization</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-sm font-semibold text-white mt-1 flex items-center gap-1">
            {isManagement ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Full Manager Sign-Off
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Cashier Tier (&lt;$100)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Dual-sign off active on banking</div>
        </div>
      </section>

      {/* Tabs */}
      <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('ACTIONS')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ACTIONS'
              ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Initiate Cash Movement
        </button>

        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'RECONCILIATION'
              ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Till & Safe Reconciliation
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'HISTORY'
              ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Movement Audit Trail ({cashMovements.length})
        </button>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================
            TAB 1: INITIATE CASH MOVEMENT
            ======================================================== */}
        {activeTab === 'ACTIONS' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Category Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAction('PAYOUT');
                  setReasonCategory('Courier / Transport Fee');
                }}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  selectedAction === 'PAYOUT'
                    ? 'bg-rose-950/30 border-rose-500 text-rose-300 ring-1 ring-rose-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Minus className="w-6 h-6 mb-2 text-rose-400" />
                <span className="font-bold text-sm text-white">Cash Out / Payout</span>
                <span className="text-[11px] text-slate-500 mt-1">Petty cash, transport, utility</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAction('CASH_IN');
                  setReasonCategory('Morning Float Issue');
                }}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  selectedAction === 'CASH_IN'
                    ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Plus className="w-6 h-6 mb-2 text-emerald-400" />
                <span className="font-bold text-sm text-white">Cash In / Float</span>
                <span className="text-[11px] text-slate-500 mt-1">Float additions, cash top-up</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAction('TILL_TRANSFER');
                  setReasonCategory('Excess Cash Skim Drop');
                }}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  selectedAction === 'TILL_TRANSFER'
                    ? 'bg-amber-950/30 border-amber-500 text-amber-300 ring-1 ring-amber-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-6 h-6 mb-2 text-amber-400" />
                <span className="font-bold text-sm text-white">Till / Safe Drop</span>
                <span className="text-[11px] text-slate-500 mt-1">Skim excess cash into vault</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAction('BANKING');
                  setReasonCategory('Weekly Commercial Bank Transit');
                }}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  selectedAction === 'BANKING'
                    ? 'bg-indigo-950/30 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-6 h-6 mb-2 text-indigo-400" />
                <span className="font-bold text-sm text-white">Armored Banking</span>
                <span className="text-[11px] text-slate-500 mt-1">Safe to commercial bank transit</span>
              </button>
            </div>

            {/* Form Box */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {selectedAction === 'PAYOUT' && 'Record Petty Cash Payout (Disbursement)'}
                  {selectedAction === 'CASH_IN' && 'Record Cash In / Extra Float Injection'}
                  {selectedAction === 'TILL_TRANSFER' && 'Till to Main Vault Skim Transfer'}
                  {selectedAction === 'BANKING' && 'Commercial Bank Cash Deposit Dispatch'}
                </h3>
                <span className="text-xs text-slate-400">
                  Staff Operator: <strong className="text-white">{currentStaff.name}</strong> ({currentStaff.role})
                </span>
              </div>

              <form onSubmit={handleSubmitMovement} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(selectedAction === 'PAYOUT' || selectedAction === 'TILL_TRANSFER' || selectedAction === 'BANKING') && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Source Cash Account *</label>
                      <select
                        value={sourceAccountId}
                        onChange={(e) => setSourceAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                      >
                        {bankAccounts
                          .filter(a => selectedAction === 'BANKING' ? a.accountType === 'CASH_SAFE' : true)
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (Bal: ${a.currentBalance.toFixed(2)})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {(selectedAction === 'CASH_IN' || selectedAction === 'TILL_TRANSFER' || selectedAction === 'BANKING') && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Destination Cash / Bank Account *</label>
                      <select
                        value={destAccountId}
                        onChange={(e) => setDestAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                      >
                        {bankAccounts
                          .filter(a => {
                            if (selectedAction === 'BANKING') return a.accountType === 'BANK_ACCOUNT';
                            if (selectedAction === 'TILL_TRANSFER') return a.accountType === 'CASH_SAFE';
                            return true;
                          })
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (Bal: ${a.currentBalance.toFixed(2)})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Movement Amount ($) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Reason Classification</label>
                    <select
                      value={reasonCategory}
                      onChange={(e) => setReasonCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    >
                      {selectedAction === 'PAYOUT' && (
                        <>
                          <option value="Courier / Transport Fee">Courier / Transport Fee</option>
                          <option value="Emergency Workshop Supplies">Emergency Workshop Supplies</option>
                          <option value="Store Cleaning & Consumables">Store Cleaning & Consumables</option>
                          <option value="Staff Refreshment & Meal Allowance">Staff Refreshment & Meal Allowance</option>
                          <option value="Generator Fuel / Power Backup">Generator Fuel / Power Backup</option>
                          <option value="Customer Return Cash Settlement">Customer Return Cash Settlement</option>
                        </>
                      )}
                      {selectedAction === 'CASH_IN' && (
                        <>
                          <option value="Morning Float Issue">Morning Float Issue</option>
                          <option value="Mid-day Change Fund Replenishment">Mid-day Change Fund Replenishment</option>
                          <option value="Owner Capital Injection">Owner Capital Injection</option>
                          <option value="Cash Over Recovery">Cash Over Recovery</option>
                        </>
                      )}
                      {selectedAction === 'TILL_TRANSFER' && (
                        <>
                          <option value="Excess Cash Skim Drop">Excess Cash Skim Drop</option>
                          <option value="Shift End Drawer Sweep">Shift End Drawer Sweep</option>
                          <option value="High Value Safety Transfer">High Value Safety Transfer</option>
                        </>
                      )}
                      {selectedAction === 'BANKING' && (
                        <>
                          <option value="Weekly Commercial Bank Transit">Weekly Commercial Bank Transit</option>
                          <option value="Daily Vault Sweep">Daily Vault Sweep</option>
                          <option value="Special High-Value Deposit">Special High-Value Deposit</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Receipt / Voucher / Slip Number</label>
                    <input
                      type="text"
                      required
                      value={receiptSlipNumber}
                      onChange={(e) => setReceiptSlipNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>

                  {selectedAction === 'BANKING' && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Armored Transit Bag Seal #</label>
                      <input
                        type="text"
                        placeholder="e.g. SEAL-BAG-882910"
                        value={bagSealNumber}
                        onChange={(e) => setBagSealNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Detailed Description & Justification</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide specific notes or payee details for the permanent audit trail..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    {amount > 100 && !isManagement ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Payout &gt;$100 requires manager sign-off
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready for immediate ledger execution
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Authorize & Post Movement
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: RECONCILIATION
            ======================================================== */}
        {activeTab === 'RECONCILIATION' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Cash Drawer & Safe Count Reconciliation</h3>
                  <p className="text-xs text-slate-400">Compare physical counted cash against system expected balance</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCountedCash(reconcileTargetAccount.currentBalance)}
                  className="text-xs text-indigo-300 hover:text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Auto-fill Expected
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Select Drawer / Safe to Reconcile</label>
                  <select
                    value={reconcileAccountId}
                    onChange={(e) => {
                      setReconcileAccountId(e.target.value);
                      const a = bankAccounts.find(x => x.id === e.target.value);
                      if (a) setCountedCash(a.currentBalance);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    {bankAccounts
                      .filter(a => a.accountType === 'CASH_TILL' || a.accountType === 'CASH_SAFE')
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Physical Counted Cash ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedCash}
                    onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* Variance Visualizer */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-slate-500 text-[11px] block">System Expected</span>
                  <span className="text-base font-bold font-mono text-white">
                    ${reconcileTargetAccount.currentBalance.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Physical Counted</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    ${countedCash.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Variance</span>
                  <span className={`text-base font-bold font-mono ${
                    variance === 0 ? 'text-emerald-400' : variance > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {variance === 0 ? '$0.00 (Balanced)' : variance > 0 ? `+$${variance.toFixed(2)} (Over)` : `-$${Math.abs(variance).toFixed(2)} (Short)`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium text-xs mb-1">Reconciliation Notes & Attestation</label>
                <textarea
                  rows={2}
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  onClick={handlePerformReconciliation}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Sign Off & Confirm Reconciliation
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: AUDIT TRAIL
            ======================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Cash Treasury Movement Log</h3>
                <p className="text-xs text-slate-400">Official log of all internal float issuances, petty payouts, transfers and deposits</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alert('Printing Official Cash Movement Audit Log...')}
                className="text-xs text-slate-300 hover:text-white"
              >
                <Printer className="w-4 h-4 mr-1.5 text-emerald-400" />
                Print Log
              </Button>
            </div>

            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-4 py-3.5">Movement #</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">From</th>
                  <th className="px-4 py-3.5">To</th>
                  <th className="px-4 py-3.5 text-right">Amount</th>
                  <th className="px-4 py-3.5">Reason / Slip</th>
                  <th className="px-4 py-3.5">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {cashMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-300">{mov.dateTime}</td>
                    <td className="px-4 py-3 text-indigo-300">{mov.movementNumber}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        mov.category === 'PAYOUT' ? 'bg-rose-500/20 text-rose-300' :
                        mov.category === 'CASH_IN' ? 'bg-emerald-500/20 text-emerald-300' :
                        mov.category === 'TILL_TRANSFER' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-indigo-500/20 text-indigo-300'
                      }`}>
                        {mov.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{mov.sourceAccountName || 'External'}</td>
                    <td className="px-4 py-3 font-sans text-slate-300">{mov.destinationAccountName || 'Expense Payout'}</td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      ${mov.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-200">
                      <div className="truncate max-w-xs">{mov.description}</div>
                      {mov.receiptSlipNumber && (
                        <div className="text-[10px] text-slate-500 font-mono">Slip: {mov.receiptSlipNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400">{mov.requestedByStaffName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: MOVEMENT SUCCESSFUL VOUCHER
          ======================================================== */}
      {movementSuccessSlip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-700/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Movement Posted Successfully</h3>
              <p className="text-xs text-slate-400">Official Cash Disbursement / Transfer Slip</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Movement #:</span>
                <span className="text-white font-bold">{movementSuccessSlip.movementNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Category:</span>
                <span className="text-emerald-300 font-sans">{movementSuccessSlip.category}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="text-white font-bold text-sm">
                  ${movementSuccessSlip.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>From Account:</span>
                <span className="text-slate-300 font-sans">{movementSuccessSlip.fromAccount}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>To Account:</span>
                <span className="text-slate-300 font-sans">{movementSuccessSlip.toAccount}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-500 text-right">
                Authorized by: {movementSuccessSlip.staffName} on {movementSuccessSlip.date}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => alert(`Printing cash voucher ${movementSuccessSlip.movementNumber}...`)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Voucher
              </Button>

              <Button
                onClick={() => setMovementSuccessSlip(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RECONCILIATION SUCCESS CONFIRMATION
          ======================================================== */}
      {reconciliationSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-700/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Reconciliation Signed Off</h3>
              <p className="text-xs text-slate-400">Drawer & Vault Audit Certificate</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Account:</span>
                <span className="text-white font-sans font-bold">{reconciliationSuccess.accountName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Physical Counted:</span>
                <span className="text-emerald-400 font-bold">${reconciliationSuccess.counted.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Variance:</span>
                <span className={reconciliationSuccess.variance === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  ${reconciliationSuccess.variance.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 text-right pt-2 border-t border-slate-800">
                Signed by: {reconciliationSuccess.staffName} on {reconciliationSuccess.date}
              </div>
            </div>

            <Button
              onClick={() => setReconciliationSuccess(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
