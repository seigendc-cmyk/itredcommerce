import React, { useState, useMemo } from 'react';
import { 
  Landmark, 
  ArrowLeft, 
  Search, 
  Plus, 
  DollarSign, 
  Wallet, 
  Building, 
  Smartphone, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  ShieldCheck, 
  Lock, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { 
  CashBankAccount, 
  CashBankTransaction, 
  StaffMember, 
  CashBankAccountType 
} from '../../../types';
import { Button } from '../../ui/Button';

export interface CashBankViewProps {
  currentStaff: StaffMember;
  accounts?: CashBankAccount[];
  transactions?: CashBankTransaction[];
  onAddAccount: (account: CashBankAccount) => void;
  onUpdateAccount: (account: CashBankAccount) => void;
  onAddTransaction: (transaction: CashBankTransaction) => void;
  onBackToLanding: () => void;
  onNavigateToCashManager?: () => void;
}

export const CashBankView: React.FC<CashBankViewProps> = ({
  currentStaff,
  accounts = [],
  transactions = [],
  onAddAccount,
  onUpdateAccount,
  onAddTransaction,
  onBackToLanding,
  onNavigateToCashManager,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ACC-CASH-TILL-01');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);

  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // New Account Form State
  const [newAccName, setNewAccName] = useState('');
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccType, setNewAccType] = useState<CashBankAccountType>('BANK_ACCOUNT');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccInstitution, setNewAccInstitution] = useState('');
  const [newAccOpeningBal, setNewAccOpeningBal] = useState<number>(0);
  const [newAccNotes, setNewAccNotes] = useState('');

  const selectedAccount = useMemo(() => {
    return safeAccounts.find(a => a.id === selectedAccountId) || safeAccounts[0] || null;
  }, [safeAccounts, selectedAccountId]);

  const accountTransactions = useMemo(() => {
    return safeTransactions.filter(tx => tx.accountId === selectedAccount?.id || tx.counterAccountId === selectedAccount?.id);
  }, [safeTransactions, selectedAccount]);

  // Overall Balances
  const totals = useMemo(() => {
    const totalCashInTills = safeAccounts
      .filter(a => a.accountType === 'CASH_TILL')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    
    const totalCashInSafes = safeAccounts
      .filter(a => a.accountType === 'CASH_SAFE')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const totalBankBalances = safeAccounts
      .filter(a => a.accountType === 'BANK_ACCOUNT')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const totalDigitalWallets = safeAccounts
      .filter(a => a.accountType === 'MOBILE_MONEY' || a.accountType === 'CARD_SETTLEMENT')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const grandLiquidTotal = safeAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    return {
      totalCashInTills,
      totalCashInSafes,
      totalBankBalances,
      totalDigitalWallets,
      grandLiquidTotal,
    };
  }, [safeAccounts]);

  const filteredAccounts = useMemo(() => {
    return safeAccounts.filter(a => {
      const matchSearch = 
        (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.institutionOrProvider || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchType = filterType === 'ALL' || a.accountType === filterType;

      return matchSearch && matchType;
    });
  }, [safeAccounts, searchTerm, filterType]);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const newAcc: CashBankAccount = {
      id: `ACC-${Date.now()}`,
      code: newAccCode || `ACC-${Math.floor(100 + Math.random() * 900)}`,
      name: newAccName,
      accountType: newAccType,
      accountNumber: newAccNumber || 'N/A',
      institutionOrProvider: newAccInstitution || 'Internal',
      currency: 'USD ($)',
      currentBalance: newAccOpeningBal,
      openingBalance: newAccOpeningBal,
      status: 'ACTIVE',
      isDefault: false,
      notes: newAccNotes,
      lastReconciledDate: new Date().toISOString().split('T')[0],
    };

    onAddAccount(newAcc);
    setSelectedAccountId(newAcc.id);
    setIsAddAccountModalOpen(false);
    setNewAccName('');
    setNewAccCode('');
    setNewAccNumber('');
    setNewAccInstitution('');
    setNewAccOpeningBal(0);
    setNewAccNotes('');
  };

  const getAccountIcon = (type: CashBankAccountType) => {
    switch (type) {
      case 'CASH_TILL':
        return <Wallet className="w-5 h-5 text-emerald-400" />;
      case 'CASH_SAFE':
        return <Lock className="w-5 h-5 text-amber-400" />;
      case 'BANK_ACCOUNT':
        return <Landmark className="w-5 h-5 text-indigo-400" />;
      case 'MOBILE_MONEY':
        return <Smartphone className="w-5 h-5 text-rose-400" />;
      case 'CARD_SETTLEMENT':
        return <CreditCard className="w-5 h-5 text-cyan-400" />;
      default:
        return <DollarSign className="w-5 h-5 text-slate-400" />;
    }
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
              <Landmark className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Cash & Bank Accounts</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Liquid Treasury
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cash till drawers, back-office vaults, bank checking accounts, mobile money wallets & card pools
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToCashManager && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToCashManager}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2 text-indigo-400" />
              Cash Manager & Payouts
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsAddAccountModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </header>

      {/* KPI Overview Banner */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>POS Drawer Floats</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            ${totals.totalCashInTills.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across active cashier registers</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Branch Safe / Vault</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            ${totals.totalCashInSafes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Drop safe reserves & skim pool</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Commercial Bank Checking</span>
            <Landmark className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            ${totals.totalBankBalances.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">First Commercial Operating</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Digital / Card Pools</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300">
            ${totals.totalDigitalWallets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Mobile Money & Card Gateway</div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-emerald-900/50 bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
            <span>Total Liquid Treasury</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            ${totals.grandLiquidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-1">Available company liquidity</div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Column: Account Selection List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="CASH_TILL">Tills</option>
              <option value="CASH_SAFE">Safe / Vault</option>
              <option value="BANK_ACCOUNT">Banks</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CARD_SETTLEMENT">Card Gateways</option>
            </select>
          </div>

          {/* Account Cards Container */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredAccounts.map((acc) => {
              const isSelected = acc.id === selectedAccountId;

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        {getAccountIcon(acc.accountType)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {acc.name}
                          {acc.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{acc.institutionOrProvider}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold font-mono text-white">
                        ${acc.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{acc.code}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-3 text-[11px] text-slate-400">
                    <span>Acct: <strong className="font-mono text-slate-300">{acc.accountNumber}</strong></span>
                    <span>Reconciled: {acc.lastReconciledDate || 'Today'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Account Details & Operational Ledger (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          {selectedAccount && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    {getAccountIcon(selectedAccount.accountType)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedAccount.name}
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300">
                        {selectedAccount.code}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedAccount.institutionOrProvider} • Number: {selectedAccount.accountNumber}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Available Balance</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    ${selectedAccount.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedAccount.notes && (
                <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  {selectedAccount.notes}
                </p>
              )}
            </div>
          )}

          {/* Account Activity Ledger */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Operational Activity & Movement Log</h3>
                <p className="text-xs text-slate-400">Chronological ledger of cash in/out, skim drops, courier banking and receipts</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alert(`Printing transaction log for ${selectedAccount.name}...`)}
                className="text-xs text-slate-300 hover:text-white"
              >
                <Printer className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Print Ledger
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance After</th>
                    <th className="px-4 py-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {accountTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                        No transactions recorded for this account in the current session.
                      </td>
                    </tr>
                  ) : (
                    accountTransactions.map((tx) => {
                      const isPositive = tx.amount > 0;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 text-slate-300">{tx.dateTime}</td>
                          <td className="px-4 py-2.5 font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              tx.movementType === 'FLOAT_IN' || tx.movementType === 'TRANSFER_IN' || tx.movementType === 'DEPOSIT'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {tx.movementType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-indigo-300">{tx.referenceNumber}</td>
                          <td className="px-4 py-2.5 font-sans text-slate-200 max-w-xs truncate">{tx.description}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isPositive ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-white">
                            ${tx.balanceAfter.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 font-sans text-slate-400">{tx.performedByStaffName}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL: ADD NEW CASH / BANK ACCOUNT
          ======================================================== */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Add Cash / Bank Account</h3>
              </div>
              <button 
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Back-office Petty Cash Safe or Stanbic Operating"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Code</label>
                  <input
                    type="text"
                    placeholder="e.g. BNK-02 or SAFE-02"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Type</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as CashBankAccountType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="BANK_ACCOUNT">Bank Checking Account</option>
                    <option value="CASH_TILL">POS Drawer Cash Float</option>
                    <option value="CASH_SAFE">Drop Safe / Main Vault</option>
                    <option value="MOBILE_MONEY">Mobile Money Till Wallet</option>
                    <option value="CARD_SETTLEMENT">Merchant Card Gateway</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account / IBAN / Till Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 1092-88210-99"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Institution / Hardware Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. First Commercial Bank"
                    value={newAccInstitution}
                    onChange={(e) => setNewAccInstitution(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Opening Cash / Bank Balance ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAccOpeningBal}
                  onChange={(e) => setNewAccOpeningBal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={newAccNotes}
                  onChange={(e) => setNewAccNotes(e.target.value)}
                  placeholder="Operational notes, branch location or security authorization rules..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddAccountModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
