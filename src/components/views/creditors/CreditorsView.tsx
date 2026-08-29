import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Filter, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  CreditCard, 
  Calendar, 
  Receipt, 
  Printer, 
  Building2, 
  Phone, 
  Mail, 
  Plus, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  Lock,
  Wallet
} from 'lucide-react';
import { 
  Supplier, 
  CreditorTransaction, 
  StaffMember, 
  CashBankAccount 
} from '../../../types';
import { Button } from '../../ui/Button';

export interface CreditorsViewProps {
  currentStaff: StaffMember;
  suppliers?: Supplier[];
  creditorTransactions?: CreditorTransaction[];
  bankAccounts?: CashBankAccount[];
  onUpdateSupplier: (supplier: Supplier) => void;
  onAddCreditorTransaction: (transaction: CreditorTransaction) => void;
  onBackToLanding: () => void;
}

export const CreditorsView: React.FC<CreditorsViewProps> = ({
  currentStaff,
  suppliers = [],
  creditorTransactions = [],
  bankAccounts = [],
  onUpdateSupplier,
  onAddCreditorTransaction,
  onBackToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'ACCOUNT_DETAIL' | 'AGING' | 'PAYMENT_RECORD'>('LIST');
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string>('SUP-101');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState<boolean>(false);

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeTransactions = Array.isArray(creditorTransactions) ? creditorTransactions : [];

  // Modals & Action Forms
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState<boolean>(false);
  const [paymentSupplierCode, setPaymentSupplierCode] = useState<string>('SUP-101');
  const [paymentAmount, setPaymentAmount] = useState<number>(2000);
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState<string>('ACC-BANK-OPERATING');
  const [paymentVoucherRef, setPaymentVoucherRef] = useState<string>(`VOUCH-${Math.floor(10000 + Math.random() * 90000)}`);
  const [paymentNotes, setPaymentNotes] = useState<string>('Purchase invoice settlement disbursement');
  const [paymentSuccessSlip, setPaymentSuccessSlip] = useState<any | null>(null);

  const selectedSupplier = useMemo(() => {
    return safeSuppliers.find(s => s.code === selectedSupplierCode) || safeSuppliers[0] || null;
  }, [safeSuppliers, selectedSupplierCode]);

  const supplierTransactions = useMemo(() => {
    return safeTransactions.filter(tx => tx.supplierCode === selectedSupplier?.code);
  }, [safeTransactions, selectedSupplier]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalPayables = safeSuppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
    const totalDue = safeSuppliers.reduce((sum, s) => sum + (s.dueAmount || 0), 0);
    const totalOverdue = safeSuppliers.reduce((sum, s) => sum + (s.overdueAmount || 0), 0);
    const totalSuppliersCount = safeSuppliers.length;
    const activePayablesCount = safeSuppliers.filter(s => (s.currentBalance || 0) > 0).length;

    return {
      totalPayables,
      totalDue,
      totalOverdue,
      totalSuppliersCount,
      activePayablesCount,
    };
  }, [safeSuppliers]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return safeSuppliers.filter(s => {
      const matchSearch = 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchOverdue = !filterOverdueOnly || ((s.overdueAmount || 0) > 0);

      return matchSearch && matchOverdue;
    });
  }, [safeSuppliers, searchTerm, filterOverdueOnly]);

  // Aging Analysis
  const agingData = useMemo(() => {
    return safeSuppliers
      .filter(s => (s.currentBalance || 0) > 0)
      .map(s => {
        const bal = s.currentBalance || 0;
        const overdue = s.overdueAmount || 0;
        const current0To30 = Math.max(0, bal - overdue);
        const days31To60 = overdue > 0 ? overdue * 0.7 : 0;
        const days61To90 = overdue > 0 ? overdue * 0.2 : 0;
        const days90Plus = overdue > 0 ? overdue * 0.1 : 0;

        return {
          supplier: s,
          current0To30,
          days31To60,
          days61To90,
          days90Plus,
          total: bal,
        };
      });
  }, [suppliers]);

  const agingTotals = useMemo(() => {
    return agingData.reduce((acc, row) => {
      acc.current0To30 += row.current0To30;
      acc.days31To60 += row.days31To60;
      acc.days61To90 += row.days61To90;
      acc.days90Plus += row.days90Plus;
      acc.grandTotal += row.total;
      return acc;
    }, { current0To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, grandTotal: 0 });
  }, [agingData]);

  // Handle Recording Supplier Payment
  const handleRecordSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.code === paymentSupplierCode);
    const sourceAcc = (bankAccounts || []).find(a => a.id === paymentSourceAccountId) || bankAccounts?.[0] || { id: 'ACC-01', accountName: 'Primary Operating Account' };
    if (!sup || paymentAmount <= 0) return;

    const newBalance = Math.max(0, (sup.currentBalance || 0) - paymentAmount);
    const newDue = Math.max(0, (sup.dueAmount || 0) - paymentAmount);
    const newOverdue = Math.max(0, (sup.overdueAmount || 0) - paymentAmount);

    const updatedSupplier: Supplier = {
      ...sup,
      currentBalance: newBalance,
      dueAmount: newDue,
      overdueAmount: newOverdue,
      lastPaymentDate: new Date().toISOString().split('T')[0],
      lastPaymentAmount: paymentAmount,
      lastPaymentRef: paymentVoucherRef,
      status: newBalance === 0 ? 'ACTIVE' : sup.status,
    };

    onUpdateSupplier(updatedSupplier);

    const newTx: CreditorTransaction = {
      id: `CTX-${Date.now()}`,
      supplierCode: sup.code,
      supplierName: sup.name,
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      transactionType: 'PAYMENT_MADE',
      referenceNumber: paymentVoucherRef,
      description: paymentNotes || 'Disbursement for purchase invoices',
      invoiceAmount: 0,
      paymentAmount: paymentAmount,
      runningBalance: newBalance,
      status: 'PAID',
      paymentMethod: sourceAcc.name,
      authorizedByStaffName: currentStaff.name,
    };

    onAddCreditorTransaction(newTx);

    setPaymentSuccessSlip({
      voucherNumber: paymentVoucherRef,
      supplierName: sup.name,
      supplierCode: sup.code,
      amount: paymentAmount,
      sourceAccount: sourceAcc.name,
      remainingBalance: newBalance,
      date: newTx.dateTime,
      authorizedBy: currentStaff.name,
    });

    setIsRecordPaymentModalOpen(false);
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
              <Truck className="w-5 h-5 text-sky-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Creditors & Supplier Payables</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Accounts Payable
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Trade supplier liability ledger, payment vouchers, disbursement staging & payables aging
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              setPaymentSupplierCode(selectedSupplierCode);
              setPaymentAmount(selectedSupplier?.currentBalance || 1000);
              setIsRecordPaymentModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Record Supplier Payment
          </Button>
        </div>
      </header>

      {/* KPI Overview Banner */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Payables Due</span>
            <DollarSign className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white">
            ${kpis.totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {kpis.activePayablesCount} active supplier balances
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Due Next 14 Days</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-300">
            ${kpis.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Upcoming scheduled maturities
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Overdue Liabilities</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-xl font-bold ${kpis.totalOverdue > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            ${kpis.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-rose-500/80 mt-1">
            Liabilities past agreed supplier terms
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Payment Safeguards</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-emerald-300 mt-1">
            Dual-Sign Off Protected
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Disbursements matched to purchase orders
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('LIST')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'LIST'
              ? 'border-sky-500 text-sky-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Creditor Supplier Directory
        </button>

        <button
          onClick={() => setActiveTab('ACCOUNT_DETAIL')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ACCOUNT_DETAIL'
              ? 'border-sky-500 text-sky-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Supplier Account & Payables Ledger
        </button>

        <button
          onClick={() => setActiveTab('AGING')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'AGING'
              ? 'border-sky-500 text-sky-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Payables Aging Analysis
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================
            TAB 1: CREDITOR DIRECTORY LIST
            ======================================================== */}
        {activeTab === 'LIST' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/70 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search supplier by name, code, contact person..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterOverdueOnly}
                    onChange={(e) => setFilterOverdueOnly(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-sky-600 focus:ring-0"
                  />
                  <span>Overdue Only</span>
                </label>
              </div>

              <div className="text-xs text-slate-400">
                Showing <strong className="text-white">{filteredSuppliers.length}</strong> commercial suppliers
              </div>
            </div>

            {/* Suppliers Payables Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Supplier / Company</th>
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5">Payment Terms</th>
                    <th className="px-4 py-3.5 text-right">Current Balance</th>
                    <th className="px-4 py-3.5 text-right">Due Amount</th>
                    <th className="px-4 py-3.5 text-right">Overdue</th>
                    <th className="px-4 py-3.5">Last Purchase</th>
                    <th className="px-4 py-3.5">Last Payment</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSuppliers.map((sup) => {
                    const hasOverdue = (sup.overdueAmount || 0) > 0;

                    return (
                      <tr key={sup.code} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-white">
                          <div className="font-semibold text-slate-100">{sup.name}</div>
                          <div className="text-xs text-slate-400">{sup.contactPerson} • {sup.phone}</div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-xs text-sky-300 font-semibold">
                          {sup.code}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {sup.paymentTerms || 'Net 30 Days'}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-white">
                          <span className={(sup.currentBalance || 0) > 0 ? 'text-amber-400' : 'text-slate-400'}>
                            ${(sup.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono text-blue-300 font-medium">
                          ${(sup.dueAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-medium">
                          {hasOverdue ? (
                            <span className="text-rose-400 font-bold">
                              ${sup.overdueAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-500">$0.00</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {sup.lastPurchaseDate ? (
                            <div>
                              <span>{sup.lastPurchaseDate}</span>
                              {sup.lastPurchaseAmount !== undefined && (
                                <span className="block text-[11px] text-slate-400 font-mono">
                                  ${(sup.lastPurchaseAmount || 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {sup.lastPaymentDate ? (
                            <div>
                              <span className="text-emerald-400 font-medium">{sup.lastPaymentDate}</span>
                              {sup.lastPaymentAmount !== undefined && (
                                <span className="block text-[11px] text-emerald-400/80 font-mono">
                                  ${(sup.lastPaymentAmount || 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          {hasOverdue ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Overdue
                            </span>
                          ) : (sup.currentBalance || 0) > 0 ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Balance Due
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Settled
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSupplierCode(sup.code);
                                setActiveTab('ACCOUNT_DETAIL');
                              }}
                              className="text-xs text-sky-300 hover:text-white hover:bg-sky-900/40 px-2 py-1 h-auto"
                            >
                              Ledger
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentSupplierCode(sup.code);
                                setPaymentAmount(sup.currentBalance || 500);
                                setIsRecordPaymentModalOpen(true);
                              }}
                              className="text-xs text-emerald-300 hover:text-white hover:bg-emerald-900/40 px-2 py-1 h-auto"
                            >
                              Disburse
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: SUPPLIER ACCOUNT & PAYABLES LEDGER
            ======================================================== */}
        {activeTab === 'ACCOUNT_DETAIL' && (
          <div className="space-y-6">
            {/* Supplier Profile Card */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm flex flex-col md:flex-row justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-sky-900/40 border border-sky-700/50 flex items-center justify-center text-sky-400">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {selectedSupplier.name}
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {selectedSupplier.code}
                      </span>
                    </h2>
                    <p className="text-sm text-slate-400">
                      Primary Contact: {selectedSupplier.contactPerson} ({selectedSupplier.phone})
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="text-slate-200 font-medium">{selectedSupplier.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Address</span>
                    <span className="text-slate-200 font-medium">{selectedSupplier.address || 'Industrial Hub'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Terms</span>
                    <span className="text-sky-300 font-medium">{selectedSupplier.paymentTerms || 'Net 30 Days'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lead Time</span>
                    <span className="text-slate-200 font-medium">{selectedSupplier.leadTimeDays || 3} Days</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Purchase</span>
                    <span className="text-slate-200">
                      {selectedSupplier.lastPurchaseDate || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Settlement</span>
                    <span className="text-emerald-400 font-medium">
                      {selectedSupplier.lastPaymentDate || 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balances Card */}
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800/80 min-w-[280px] flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Current Trade Payables Balance
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-400">
                    ${(selectedSupplier.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  {selectedSupplier.overdueAmount && selectedSupplier.overdueAmount > 0 ? (
                    <div className="text-xs text-rose-400 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Overdue: ${(selectedSupplier.overdueAmount || 0).toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Normal Maturity Terms
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3 mt-4 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Due within 14 Days:</span>
                    <span className="text-blue-300 font-mono font-medium">
                      ${(selectedSupplier.dueAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setPaymentSupplierCode(selectedSupplier.code);
                    setPaymentAmount(selectedSupplier.currentBalance || 500);
                    setIsRecordPaymentModalOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 mt-4"
                >
                  <Receipt className="w-3.5 h-3.5 mr-1" />
                  Record Supplier Disbursement
                </Button>
              </div>
            </div>

            {/* Supplier Ledger Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Purchase & Disbursement Ledger</h3>
                  <p className="text-xs text-slate-400">Chronological history of purchase invoices, debit adjustments, and bank disbursements</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert(`Printing supplier statement for ${selectedSupplier.name}...`)}
                  className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
                >
                  <Printer className="w-4 h-4 mr-1.5 text-sky-400" />
                  Print Statement
                </Button>
              </div>

              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Reference #</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5 text-right">Invoice (Debit Liability)</th>
                    <th className="px-4 py-3.5 text-right">Payment Made</th>
                    <th className="px-4 py-3.5 text-right">Running Balance</th>
                    <th className="px-4 py-3.5">Due Date</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {supplierTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                        No transactions recorded for this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    supplierTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-300">{tx.dateTime}</td>
                        <td className="px-4 py-3 font-sans">
                          {tx.transactionType === 'PURCHASE_INVOICE' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Purchase Invoice
                            </span>
                          )}
                          {tx.transactionType === 'PAYMENT_MADE' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Payment Made
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sky-300 font-semibold">{tx.referenceNumber}</td>
                        <td className="px-4 py-3 font-sans text-slate-200 max-w-xs truncate">{tx.description}</td>
                        <td className="px-4 py-3 text-right text-amber-400 font-medium">
                          {tx.invoiceAmount > 0 ? `$${tx.invoiceAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                          {tx.paymentAmount > 0 ? `$${tx.paymentAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          ${tx.runningBalance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{tx.dueDate || '—'}</td>
                        <td className="px-4 py-3 text-center font-sans">
                          {tx.status === 'PAID' && (
                            <span className="text-emerald-400 font-medium">Settled</span>
                          )}
                          {tx.status === 'PARTIAL' && (
                            <span className="text-blue-400 font-medium">Partial</span>
                          )}
                          {tx.status === 'OVERDUE' && (
                            <span className="text-rose-400 font-bold">Overdue</span>
                          )}
                          {tx.status === 'PENDING' && (
                            <span className="text-amber-400 font-medium">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: PAYABLES AGING ANALYSIS
            ======================================================== */}
        {activeTab === 'AGING' && (
          <div className="space-y-6">
            {/* Visual Payables Spectrum */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">0–30 Days (Current)</span>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  ${agingTotals.current0To30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Within standard credit terms</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">31–60 Days</span>
                <div className="text-xl font-bold font-mono text-amber-400">
                  ${agingTotals.days31To60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-amber-500/80 mt-1">Due for weekly disbursement</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">61–90 Days</span>
                <div className="text-xl font-bold font-mono text-orange-400">
                  ${agingTotals.days61To90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-orange-500/80 mt-1">Supplier reminder received</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">90+ Days (Critical)</span>
                <div className="text-xl font-bold font-mono text-rose-400">
                  ${agingTotals.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-rose-500/80 mt-1">Supply freeze risk</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-sky-900/50 bg-sky-950/20">
                <span className="text-xs text-sky-300 block mb-1">Total Payables Pool</span>
                <div className="text-xl font-bold font-mono text-white">
                  ${agingTotals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-sky-300/80 mt-1">Commercial AP balance</div>
              </div>
            </div>

            {/* Aging Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Accounts Payable Aging Matrix</h3>
                  <p className="text-xs text-slate-400">Supplier maturity schedule and payment prioritization queue</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert('Exporting Payables Aging PDF Report...')}
                  className="text-xs text-sky-300 hover:text-white"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Export Report
                </Button>
              </div>

              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Supplier</th>
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5 text-right">0–30 Days (Current)</th>
                    <th className="px-4 py-3.5 text-right">31–60 Days</th>
                    <th className="px-4 py-3.5 text-right">61–90 Days</th>
                    <th className="px-4 py-3.5 text-right">90+ Days</th>
                    <th className="px-4 py-3.5 text-right">Total Payable</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {agingData.map(({ supplier, current0To30, days31To60, days61To90, days90Plus, total }) => (
                    <tr key={supplier.code} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-sans font-medium text-white">
                        {supplier.name}
                      </td>
                      <td className="px-4 py-3 text-sky-300">{supplier.code}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        ${current0To30.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400">
                        {days31To60 > 0 ? `$${days31To60.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-400">
                        {days61To90 > 0 ? `$${days61To90.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400 font-bold">
                        {days90Plus > 0 ? `$${days90Plus.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        ${total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center font-sans">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPaymentSupplierCode(supplier.code);
                            setPaymentAmount(total);
                            setIsRecordPaymentModalOpen(true);
                          }}
                          className="text-xs text-emerald-300 hover:text-white px-2 py-1 h-auto"
                        >
                          Disburse
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: RECORD SUPPLIER PAYMENT / DISBURSEMENT
          ======================================================== */}
      {isRecordPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Record Supplier Payment Disbursement</h3>
              </div>
              <button 
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Payee Supplier</label>
                <select
                  value={paymentSupplierCode}
                  onChange={(e) => {
                    setPaymentSupplierCode(e.target.value);
                    const s = suppliers.find(x => x.code === e.target.value);
                    if (s && (s.currentBalance || 0) > 0) setPaymentAmount(s.currentBalance || 0);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {suppliers.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code}) — Balance Due: ${(s.currentBalance || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Disbursement Amount ($) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Disbursement Account / Source</label>
                  <select
                    value={paymentSourceAccountId}
                    onChange={(e) => setPaymentSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Bal: ${(a.currentBalance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Voucher / Wire Reference</label>
                <input
                  type="text"
                  required
                  value={paymentVoucherRef}
                  onChange={(e) => setPaymentVoucherRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Description / Purchase Order Allocation</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Settle Purchase Order PINV-2026-0801"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Authorize & Post Disbursement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: PAYMENT SUCCESSFUL PRINTABLE VOUCHER
          ======================================================== */}
      {paymentSuccessSlip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-700/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Disbursement Authorized</h3>
              <p className="text-xs text-slate-400">Supplier Payment Remittance Voucher</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Voucher Number:</span>
                <span className="text-white font-bold">{paymentSuccessSlip.voucherNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payee Supplier:</span>
                <span className="text-white font-sans">{paymentSuccessSlip.supplierName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Supplier Code:</span>
                <span className="text-sky-300">{paymentSuccessSlip.supplierCode}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Disbursed:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ${paymentSuccessSlip.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Source Account:</span>
                <span className="text-slate-200">{paymentSuccessSlip.sourceAccount}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between">
                <span className="text-slate-400">Remaining Supplier Balance:</span>
                <span className="text-amber-400 font-bold">
                  ${paymentSuccessSlip.remainingBalance.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                Authorized by: {paymentSuccessSlip.authorizedBy} on {paymentSuccessSlip.date}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => alert(`Printing Remittance Advice Voucher ${paymentSuccessSlip.voucherNumber}...`)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Voucher
              </Button>

              <Button
                onClick={() => setPaymentSuccessSlip(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
