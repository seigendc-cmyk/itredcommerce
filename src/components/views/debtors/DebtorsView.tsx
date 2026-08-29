import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Filter, 
  CreditCard, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Lock, 
  Plus, 
  Printer, 
  Receipt, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Building, 
  Phone, 
  Mail, 
  Percent, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Ban, 
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { 
  Customer, 
  DebtorTransaction, 
  StaffMember, 
  PaymentMethodType, 
  CreditStatus, 
  DebtorAccountStatus,
  ApprovalRequest 
} from '../../../types';
import { isManager } from '../../../utils/roles';
import { Button } from '../../ui/Button';

export interface DebtorsViewProps {
  currentStaff: StaffMember;
  customers?: Customer[];
  debtorTransactions?: DebtorTransaction[];
  onUpdateCustomer: (customer: Customer) => void;
  onAddDebtorTransaction: (transaction: DebtorTransaction) => void;
  onCreateApprovalRequest: (request: Partial<ApprovalRequest>) => void;
  onBackToLanding: () => void;
  onNavigateToPOS?: () => void;
}

export const DebtorsView: React.FC<DebtorsViewProps> = ({
  currentStaff,
  customers = [],
  debtorTransactions = [],
  onUpdateCustomer,
  onAddDebtorTransaction,
  onCreateApprovalRequest,
  onBackToLanding,
  onNavigateToPOS,
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'ACCOUNT_DETAIL' | 'APPROVAL' | 'PAYMENT' | 'AGING'>('LIST');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('CUST-1001');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCreditStatus, setFilterCreditStatus] = useState<string>('ALL');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState<boolean>(false);

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeTransactions = Array.isArray(debtorTransactions) ? debtorTransactions : [];

  // Modals / Action States
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [isCreditApprovalModalOpen, setIsCreditApprovalModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState<any | null>(null);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustCompany, setNewCustCompany] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustTaxNo, setNewCustTaxNo] = useState('');

  // Payment Form State
  const [paymentCustomerId, setPaymentCustomerId] = useState<string>('CUST-1001');
  const [paymentAmount, setPaymentAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>(`PAY-REC-${Math.floor(10000 + Math.random() * 90000)}`);
  const [paymentNotes, setPaymentNotes] = useState<string>('Customer account settlement payment');

  // Credit Edit Form State (Management Only)
  const [editCreditLimit, setEditCreditLimit] = useState<number>(5000);
  const [editPaymentTerms, setEditPaymentTerms] = useState<string>('Net 30 Days');
  const [editCreditStatus, setEditCreditStatus] = useState<CreditStatus>('ACTIVE');
  const [exceptionalOverrideReason, setExceptionalOverrideReason] = useState<string>('');

  const isManagement = isManager(currentStaff);

  const selectedCustomer = useMemo(() => {
    return safeCustomers.find(c => c.id === selectedCustomerId) || safeCustomers[1] || safeCustomers[0] || null;
  }, [safeCustomers, selectedCustomerId]);

  const customerTransactions = useMemo(() => {
    return safeTransactions.filter(tx => tx.customerId === selectedCustomer?.id);
  }, [safeTransactions, selectedCustomer]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalReceivables = safeCustomers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
    const totalCreditLimit = safeCustomers.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const totalOverdue = safeCustomers.reduce((sum, c) => sum + (c.overdueAmount || 0), 0);
    const activeDebtorsCount = safeCustomers.filter(c => (c.currentBalance || 0) > 0).length;
    const overdueCount = safeCustomers.filter(c => (c.overdueAmount || 0) > 0).length;
    const utilizationRate = totalCreditLimit > 0 ? (totalReceivables / totalCreditLimit) * 100 : 0;

    return {
      totalReceivables,
      totalCreditLimit,
      totalOverdue,
      activeDebtorsCount,
      overdueCount,
      utilizationRate,
    };
  }, [safeCustomers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return safeCustomers.filter(c => {
      const matchSearch = 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.accountNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm);
      
      const matchCredit = filterCreditStatus === 'ALL' || c.creditStatus === filterCreditStatus;
      const matchOverdue = !filterOverdueOnly || ((c.overdueAmount || 0) > 0);

      return matchSearch && matchCredit && matchOverdue;
    });
  }, [safeCustomers, searchTerm, filterCreditStatus, filterOverdueOnly]);

  // Aging Analysis Calculations
  const agingData = useMemo(() => {
    return safeCustomers
      .filter(c => (c.currentBalance || 0) > 0)
      .map(c => {
        const bal = c.currentBalance || 0;
        const overdue = c.overdueAmount || 0;
        const current0To30 = Math.max(0, bal - overdue);
        const days31To60 = overdue > 0 ? overdue * 0.6 : 0;
        const days61To90 = overdue > 0 ? overdue * 0.3 : 0;
        const days90Plus = overdue > 0 ? overdue * 0.1 : 0;

        return {
          customer: c,
          current0To30,
          days31To60,
          days61To90,
          days90Plus,
          total: bal,
        };
      });
  }, [customers]);

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

  // Handle Quick Create Customer (Allowed for Cashier)
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newAccNo = `ACC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCust: Customer = {
      id: `CUST-${Date.now()}`,
      accountNumber: newAccNo,
      name: newCustName,
      companyName: newCustCompany || undefined,
      phone: newCustPhone || 'N/A',
      email: newCustEmail || undefined,
      address: newCustAddress || undefined,
      taxNumber: newCustTaxNo || undefined,
      status: 'PENDING_APPROVAL',
      creditStatus: 'UNDER_REVIEW',
      debtorStatus: 'GOOD_STANDING',
      isCreditApproved: false,
      creditLimit: 0,
      currentBalance: 0,
      availableCredit: 0,
      paymentTerms: 'Due upon Receipt',
      paymentTermsDays: 0,
      createdDate: new Date().toISOString().split('T')[0],
      createdByStaffId: currentStaff.id,
      notes: `Registered by ${currentStaff.name} (${currentStaff.role}). Credit approval pending manager sign-off.`,
    };

    onUpdateCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    setIsNewCustomerModalOpen(false);
    setNewCustName('');
    setNewCustCompany('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustTaxNo('');
  };

  // Handle Management Credit Setup / Changes
  const handleSaveCreditSetup = () => {
    if (!isManagement) {
      // Create approval request for manager
      onCreateApprovalRequest({
        type: 'PRICE_OVERRIDE',
        title: `Credit Facility Request for ${selectedCustomer.name}`,
        description: `Cashier ${currentStaff.name} requested Credit Limit: $${editCreditLimit.toFixed(2)}, Terms: ${editPaymentTerms}.`,
        amount: editCreditLimit,
        referenceId: selectedCustomer.accountNumber,
        referenceType: 'CUSTOMER_CREDIT',
        locationName: 'Front Office',
        requestedByStaffId: currentStaff.id,
        requestedByStaffName: currentStaff.name,
        requestedByRole: currentStaff.role,
        requestedDateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        reason: exceptionalOverrideReason || 'New commercial credit request by cashier.',
        priority: editCreditLimit > 5000 ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
        meta: {
          customerId: selectedCustomer.id,
          proposedLimit: editCreditLimit,
          proposedTerms: editPaymentTerms,
        }
      });
      alert(`Permission Notice: Only Store Managers can authorize credit. An approval request has been queued for Manager review.`);
      setIsCreditApprovalModalOpen(false);
      return;
    }

    const updated: Customer = {
      ...selectedCustomer,
      creditLimit: editCreditLimit,
      availableCredit: Math.max(0, editCreditLimit - selectedCustomer.currentBalance),
      paymentTerms: editPaymentTerms,
      creditStatus: editCreditStatus,
      isCreditApproved: editCreditStatus === 'ACTIVE' && editCreditLimit > 0,
      approvedByManagerId: currentStaff.id,
      creditApprovedDate: new Date().toISOString().split('T')[0],
      exceptionalCreditOverrideNotes: exceptionalOverrideReason || undefined,
    };

    onUpdateCustomer(updated);
    setIsCreditApprovalModalOpen(false);
  };

  // Handle Recording Customer Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === paymentCustomerId);
    if (!cust || paymentAmount <= 0) return;

    const newBalance = Math.max(0, cust.currentBalance - paymentAmount);
    const newAvailable = Math.max(0, cust.creditLimit - newBalance);
    const newOverdue = Math.max(0, (cust.overdueAmount || 0) - paymentAmount);

    const updatedCustomer: Customer = {
      ...cust,
      currentBalance: newBalance,
      availableCredit: newAvailable,
      overdueAmount: newOverdue,
      lastPaymentDate: new Date().toISOString().split('T')[0],
      lastPaymentAmount: paymentAmount,
      lastPaymentRef: paymentRef,
      debtorStatus: newOverdue > 0 ? 'OVERDUE' : 'GOOD_STANDING',
    };

    onUpdateCustomer(updatedCustomer);

    const newTx: DebtorTransaction = {
      id: `DTX-${Date.now()}`,
      customerId: cust.id,
      customerName: cust.name,
      accountNumber: cust.accountNumber,
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      transactionType: 'PAYMENT',
      referenceNumber: paymentRef,
      description: paymentNotes || 'Customer Account Settlement Receipt',
      debit: 0,
      credit: paymentAmount,
      runningBalance: newBalance,
      status: 'PAID',
      paymentMethod: paymentMethod,
      cashierOrStaffName: currentStaff.name,
    };

    onAddDebtorTransaction(newTx);

    setPaymentSuccessReceipt({
      receiptNumber: paymentRef,
      customerName: cust.name,
      accountNumber: cust.accountNumber,
      company: cust.companyName,
      amount: paymentAmount,
      method: paymentMethod,
      balanceBefore: cust.currentBalance,
      balanceAfter: newBalance,
      date: newTx.dateTime,
      receivedBy: currentStaff.name,
    });

    setIsPaymentModalOpen(false);
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
              <Users className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Debtors & Customer Credit Hub</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Accounts Receivable
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer credit ledger, aging buckets, receipt disbursements & managerial governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsNewCustomerModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
          >
            <Plus className="w-4 h-4 mr-2 text-indigo-400" />
            New Customer
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setPaymentCustomerId(selectedCustomerId);
              setIsPaymentModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </header>

      {/* KPI Overview Banner */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Receivables</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white">
            ${kpis.totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {kpis.activeDebtorsCount} active balances
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Credit Extended</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-300">
            ${kpis.totalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Approved limits pooled
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Overdue Balances</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-xl font-bold ${kpis.totalOverdue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            ${kpis.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-500/80 mt-1">
            {kpis.overdueCount} accounts requiring follow-up
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Credit Utilization</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-300">
            {kpis.utilizationRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ratio of drawn vs authorized limit
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Managerial Controls</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-sm font-semibold text-white flex items-center gap-1.5 mt-1">
            {isManagement ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Full Authority
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Cashier Mode
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isManagement ? 'Authorized to approve credit' : 'Credit overrides require manager'}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('LIST')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'LIST'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Debtor List
        </button>

        <button
          onClick={() => setActiveTab('ACCOUNT_DETAIL')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ACCOUNT_DETAIL'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Debtor Account & Ledger
        </button>

        <button
          onClick={() => setActiveTab('AGING')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'AGING'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Aging Analysis
        </button>

        <button
          onClick={() => setActiveTab('APPROVAL')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'APPROVAL'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Credit Governance & Limits
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================
            TAB 1: DEBTOR LIST
            ======================================================== */}
        {activeTab === 'LIST' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/70 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search debtor by name, account number, company or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={filterCreditStatus}
                  onChange={(e) => setFilterCreditStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Credit Statuses</option>
                  <option value="ACTIVE">Active Credit</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="BLOCKED">Blocked</option>
                </select>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterOverdueOnly}
                    onChange={(e) => setFilterOverdueOnly(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Overdue Only</span>
                </label>
              </div>

              <div className="text-xs text-slate-400">
                Showing <strong className="text-white">{filteredCustomers.length}</strong> debtor accounts
              </div>
            </div>

            {/* Customers Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Customer / Company</th>
                    <th className="px-4 py-3.5">Account #</th>
                    <th className="px-4 py-3.5">Credit Status</th>
                    <th className="px-4 py-3.5 text-right">Credit Limit</th>
                    <th className="px-4 py-3.5 text-right">Current Balance</th>
                    <th className="px-4 py-3.5 text-right">Available Credit</th>
                    <th className="px-4 py-3.5">Terms</th>
                    <th className="px-4 py-3.5 text-right">Overdue</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.map((cust) => {
                    const isSelected = cust.id === selectedCustomerId;
                    const hasOverdue = (cust.overdueAmount || 0) > 0;

                    return (
                      <tr 
                        key={cust.id} 
                        className={`hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 font-medium text-white">
                          <div className="font-semibold text-slate-100">{cust.name}</div>
                          {cust.companyName && (
                            <div className="text-xs text-slate-400">{cust.companyName}</div>
                          )}
                          <div className="text-[11px] text-slate-500">{cust.phone}</div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-xs text-indigo-300">
                          {cust.accountNumber}
                        </td>

                        <td className="px-4 py-3.5">
                          {cust.creditStatus === 'ACTIVE' && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Active Credit
                            </span>
                          )}
                          {cust.creditStatus === 'UNDER_REVIEW' && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Under Review
                            </span>
                          )}
                          {cust.creditStatus === 'SUSPENDED' && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Suspended
                            </span>
                          )}
                          {(!cust.creditStatus || cust.creditStatus === 'BLOCKED') && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Cash / COD
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-200">
                          ${cust.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-white">
                          <span className={cust.currentBalance > 0 ? 'text-amber-400' : 'text-slate-400'}>
                            ${cust.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono text-emerald-400">
                          ${cust.availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {cust.paymentTerms || 'Due on Receipt'}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-medium">
                          {hasOverdue ? (
                            <span className="text-rose-400 font-bold">
                              ${cust.overdueAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-500">$0.00</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setActiveTab('ACCOUNT_DETAIL');
                              }}
                              className="text-xs text-indigo-300 hover:text-white hover:bg-indigo-900/40 px-2 py-1 h-auto"
                            >
                              Statement
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentCustomerId(cust.id);
                                setPaymentAmount(cust.currentBalance > 0 ? cust.currentBalance : 100);
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-xs text-emerald-300 hover:text-white hover:bg-emerald-900/40 px-2 py-1 h-auto"
                            >
                              Pay
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setEditCreditLimit(cust.creditLimit);
                                setEditPaymentTerms(cust.paymentTerms || 'Net 30 Days');
                                setEditCreditStatus(cust.creditStatus || 'ACTIVE');
                                setIsCreditApprovalModalOpen(true);
                              }}
                              className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-1 h-auto"
                            >
                              Credit
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
            TAB 2: DEBTOR ACCOUNT & TRANSACTION LEDGER
            ======================================================== */}
        {activeTab === 'ACCOUNT_DETAIL' && (
          <div className="space-y-6">
            {/* Account Profile Header Card */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm flex flex-col md:flex-row justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {selectedCustomer.name}
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {selectedCustomer.accountNumber}
                      </span>
                    </h2>
                    <p className="text-sm text-slate-400">
                      {selectedCustomer.companyName || 'Individual Commercial Trader'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
                  <div>
                    <span className="text-slate-500 block">Phone</span>
                    <span className="text-slate-200 font-medium">{selectedCustomer.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="text-slate-200 font-medium">{selectedCustomer.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tax / VAT Number</span>
                    <span className="text-slate-200 font-mono font-medium">{selectedCustomer.taxNumber || 'Unregistered'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Terms</span>
                    <span className="text-indigo-300 font-medium">{selectedCustomer.paymentTerms || 'Due on Receipt'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Purchase</span>
                    <span className="text-slate-200">
                      {selectedCustomer.lastPurchaseDate || 'None'} {selectedCustomer.lastPurchaseAmount ? `($${selectedCustomer.lastPurchaseAmount})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Payment</span>
                    <span className="text-emerald-400 font-medium">
                      {selectedCustomer.lastPaymentDate || 'None'} {selectedCustomer.lastPaymentAmount ? `($${selectedCustomer.lastPaymentAmount})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balances & Credit Metrics Card */}
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800/80 min-w-[280px] flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Current Outstanding Balance
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-400">
                    ${selectedCustomer.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  {selectedCustomer.overdueAmount && selectedCustomer.overdueAmount > 0 ? (
                    <div className="text-xs text-rose-400 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Overdue: ${(selectedCustomer.overdueAmount || 0).toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Account in Good Standing
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3 mt-4 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit Limit:</span>
                    <span className="text-white font-mono font-medium">${(selectedCustomer.creditLimit || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Available Credit:</span>
                    <span className="text-emerald-400 font-mono font-medium">${(selectedCustomer.availableCredit || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPaymentCustomerId(selectedCustomer.id);
                      setPaymentAmount(selectedCustomer.currentBalance > 0 ? selectedCustomer.currentBalance : 100);
                      setIsPaymentModalOpen(true);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                  >
                    <Receipt className="w-3.5 h-3.5 mr-1" />
                    Record Payment
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditCreditLimit(selectedCustomer.creditLimit);
                      setEditPaymentTerms(selectedCustomer.paymentTerms || 'Net 30 Days');
                      setEditCreditStatus(selectedCustomer.creditStatus || 'ACTIVE');
                      setIsCreditApprovalModalOpen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-8"
                  >
                    Manage Terms
                  </Button>
                </div>
              </div>
            </div>

            {/* Transaction Ledger Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Transaction Statement Ledger</h3>
                  <p className="text-xs text-slate-400">Chronological history of invoices, payments, credit notes and adjustments</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => alert(`Printing official Debtor Statement for ${selectedCustomer.name}...`)}
                    className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
                  >
                    <Printer className="w-4 h-4 mr-1.5 text-indigo-400" />
                    Print Statement
                  </Button>
                </div>
              </div>

              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Reference #</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5 text-right">Debit (Invoice)</th>
                    <th className="px-4 py-3.5 text-right">Credit (Payment)</th>
                    <th className="px-4 py-3.5 text-right">Running Balance</th>
                    <th className="px-4 py-3.5">Due Date</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {customerTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                        No transactions recorded on this debtor account yet.
                      </td>
                    </tr>
                  ) : (
                    customerTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-300">{tx.dateTime}</td>
                        <td className="px-4 py-3 font-sans">
                          {tx.transactionType === 'INVOICE' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Invoice
                            </span>
                          )}
                          {tx.transactionType === 'PAYMENT' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Payment
                            </span>
                          )}
                          {tx.transactionType === 'CREDIT_NOTE' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Credit Note
                            </span>
                          )}
                          {tx.transactionType === 'OPENING_BALANCE' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
                              Opening Bal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-indigo-300 font-semibold">{tx.referenceNumber}</td>
                        <td className="px-4 py-3 font-sans text-slate-200 max-w-xs truncate">{tx.description}</td>
                        <td className="px-4 py-3 text-right text-rose-400 font-medium">
                          {tx.debit > 0 ? `$${tx.debit.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                          {tx.credit > 0 ? `$${tx.credit.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          ${tx.runningBalance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{tx.dueDate || '—'}</td>
                        <td className="px-4 py-3 text-center font-sans">
                          {tx.status === 'PAID' && (
                            <span className="text-emerald-400 font-medium">Settled</span>
                          )}
                          {tx.status === 'UNPAID' && (
                            <span className="text-amber-400 font-medium">Current</span>
                          )}
                          {tx.status === 'OVERDUE' && (
                            <span className="text-rose-400 font-bold">Overdue</span>
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
            TAB 3: AGING ANALYSIS
            ======================================================== */}
        {activeTab === 'AGING' && (
          <div className="space-y-6">
            {/* Visual Aging Spectrum Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Current (0–30 Days)</span>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  ${agingTotals.current0To30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {agingTotals.grandTotal > 0 ? ((agingTotals.current0To30 / agingTotals.grandTotal) * 100).toFixed(0) : 0}% of total receivables
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">31–60 Days</span>
                <div className="text-xl font-bold font-mono text-amber-400">
                  ${agingTotals.days31To60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-amber-500/80 mt-1">Payment reminder due</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">61–90 Days</span>
                <div className="text-xl font-bold font-mono text-orange-400">
                  ${agingTotals.days61To90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-orange-500/80 mt-1">Formal notice required</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">90+ Days (Arrears)</span>
                <div className="text-xl font-bold font-mono text-rose-400">
                  ${agingTotals.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-rose-500/80 mt-1">Credit suspended</div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-indigo-900/50 bg-indigo-950/20">
                <span className="text-xs text-indigo-300 block mb-1">Total Outstanding Debt</span>
                <div className="text-xl font-bold font-mono text-white">
                  ${agingTotals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-indigo-300/80 mt-1">Accounts Receivable pool</div>
              </div>
            </div>

            {/* Aging Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Debtor Aging Matrix</h3>
                  <p className="text-xs text-slate-400">Aging schedule broken down by customer account and default risk</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert('Generating Aging Matrix PDF Statement...')}
                  className="text-xs text-indigo-300 hover:text-white"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Export Aging Report
                </Button>
              </div>

              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Account #</th>
                    <th className="px-4 py-3.5 text-right">0–30 Days (Current)</th>
                    <th className="px-4 py-3.5 text-right">31–60 Days</th>
                    <th className="px-4 py-3.5 text-right">61–90 Days</th>
                    <th className="px-4 py-3.5 text-right">90+ Days</th>
                    <th className="px-4 py-3.5 text-right">Total Due</th>
                    <th className="px-4 py-3.5 text-center">Collection Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {agingData.map(({ customer, current0To30, days31To60, days61To90, days90Plus, total }) => (
                    <tr key={customer.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-sans font-medium text-white">
                        {customer.name}
                        {customer.companyName && <span className="block text-[11px] text-slate-400">{customer.companyName}</span>}
                      </td>
                      <td className="px-4 py-3 text-indigo-300">{customer.accountNumber}</td>
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
                          onClick={() => alert(`Sent statement & payment reminder link to ${customer.phone} / ${customer.email || 'account contact'}.`)}
                          className="text-xs text-indigo-300 hover:text-white px-2 py-1 h-auto"
                        >
                          Send Reminder
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: CREDIT GOVERNANCE & APPROVALS
            ======================================================== */}
        {activeTab === 'APPROVAL' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Permission Banner */}
            <div className={`p-5 rounded-xl border flex items-start gap-4 ${
              isManagement 
                ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200' 
                : 'bg-amber-950/20 border-amber-800/50 text-amber-200'
            }`}>
              <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-white">
                  {isManagement ? 'Authorized Management Credit Governance Panel' : 'Cashier Access Notice: Management Approval Required'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {isManagement 
                    ? 'You have executive authorization to enable credit lines, modify payment terms, suspend delinquent debtor accounts, and approve exceptional credit overrides.'
                    : 'Cashiers may register new customer profiles and record incoming settlements. Adjusting credit limits, enabling credit terms, or overriding credit thresholds requires Store Manager sign-off.'}
                </p>
              </div>
            </div>

            {/* Quick Credit Setup Selector */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
                Manage Debtor Account Terms & Limits
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Debtor Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const c = customers.find(x => x.id === e.target.value);
                      if (c) {
                        setEditCreditLimit(c.creditLimit);
                        setEditPaymentTerms(c.paymentTerms || 'Net 30 Days');
                        setEditCreditStatus(c.creditStatus || 'ACTIVE');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.accountNumber}) — Bal: ${(c.currentBalance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credit Facility Status
                  </label>
                  <select
                    value={editCreditStatus}
                    onChange={(e) => setEditCreditStatus(e.target.value as CreditStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">Active (Credit Line Enabled)</option>
                    <option value="UNDER_REVIEW">Under Review (Pending Documentation)</option>
                    <option value="SUSPENDED">Suspended (Stop Supplies / Delinquent)</option>
                    <option value="BLOCKED">Blocked (Cash / COD Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Authorized Credit Limit ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={editPaymentTerms}
                    onChange={(e) => setEditPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Net 7 Days">Net 7 Days</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 60 Days">Net 60 Days</option>
                    <option value="Due upon Receipt">Due upon Receipt</option>
                    <option value="COD / Cash Only">COD / Cash Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Manager Authorization Notes / Exceptional Credit Justification
                </label>
                <textarea
                  rows={3}
                  value={exceptionalOverrideReason}
                  onChange={(e) => setExceptionalOverrideReason(e.target.value)}
                  placeholder="Record justification, security guarantee, or reason for exceptional credit line extension..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  onClick={handleSaveCreditSetup}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {isManagement ? 'Apply & Sign Off Credit Terms' : 'Submit for Manager Approval'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: NEW CUSTOMER REGISTRATION (Cashier Allowed)
          ======================================================== */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Register New Customer</h3>
              </div>
              <button 
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer / Trading Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering or John Doe"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Company / Entity Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Heavy Industries (Pvt) Ltd"
                  value={newCustCompany}
                  onChange={(e) => setNewCustCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="accounts@client.com"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Delivery / Workshop Address</label>
                <input
                  type="text"
                  placeholder="Street, City, Industrial Park Bay"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Tax / VAT Identification Number</label>
                <input
                  type="text"
                  placeholder="e.g. VAT-9920194"
                  value={newCustTaxNo}
                  onChange={(e) => setNewCustTaxNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">Note on Credit Facility:</span>
                New customers default to Cash/Due on Receipt. Manager approval is required to activate credit lines.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Save Customer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RECORD CUSTOMER PAYMENT
          ======================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Record Customer Payment</h3>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Debtor Customer</label>
                <select
                  value={paymentCustomerId}
                  onChange={(e) => {
                    setPaymentCustomerId(e.target.value);
                    const c = customers.find(x => x.id === e.target.value);
                    if (c && c.currentBalance > 0) setPaymentAmount(c.currentBalance);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Outstanding: ${(c.currentBalance || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Amount ($) *</label>
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
                  <label className="block text-slate-300 font-medium mb-1">Payment Tender</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="CASH">Cash Till Tender</option>
                    <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money (M-Pesa / MTN)</option>
                    <option value="DEBIT_CARD">Debit / Credit Card</option>
                    <option value="OTHER">Cheque / Promissory Note</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Receipt / Voucher Reference</label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Invoice Allocation</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Auto-allocate to oldest unpaid invoices"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Post Payment & Issue Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: PAYMENT SUCCESSFUL PRINTABLE RECEIPT
          ======================================================== */}
      {paymentSuccessReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-700/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Payment Received Successfully</h3>
              <p className="text-xs text-slate-400">Official Debtor Settlement Receipt</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Receipt Number:</span>
                <span className="text-white font-bold">{paymentSuccessReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Customer:</span>
                <span className="text-white font-sans">{paymentSuccessReceipt.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Account Number:</span>
                <span className="text-indigo-300">{paymentSuccessReceipt.accountNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ${paymentSuccessReceipt.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tender Method:</span>
                <span className="text-slate-200">{paymentSuccessReceipt.method}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between">
                <span className="text-slate-400">Remaining Balance:</span>
                <span className="text-amber-400 font-bold">
                  ${paymentSuccessReceipt.balanceAfter.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                Received by: {paymentSuccessReceipt.receivedBy} on {paymentSuccessReceipt.date}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => alert(`Printing thermal receipt ${paymentSuccessReceipt.receiptNumber}...`)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>

              <Button
                onClick={() => setPaymentSuccessReceipt(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREDIT SETUP / EDIT MODAL
          ======================================================== */}
      {isCreditApprovalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Credit Terms & Limits</h3>
              </div>
              <button 
                onClick={() => setIsCreditApprovalModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer</label>
                <div className="p-2.5 bg-slate-950 rounded-lg text-white font-semibold">
                  {selectedCustomer.name} ({selectedCustomer.accountNumber})
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Credit Limit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Terms</label>
                <select
                  value={editPaymentTerms}
                  onChange={(e) => setEditPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  <option value="Net 7 Days">Net 7 Days</option>
                  <option value="Net 15 Days">Net 15 Days</option>
                  <option value="Net 30 Days">Net 30 Days</option>
                  <option value="Net 60 Days">Net 60 Days</option>
                  <option value="Due upon Receipt">Due upon Receipt</option>
                  <option value="COD / Cash Only">COD / Cash Only</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Credit Status</label>
                <select
                  value={editCreditStatus}
                  onChange={(e) => setEditCreditStatus(e.target.value as CreditStatus)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  <option value="ACTIVE">Active (Credit Allowed)</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="SUSPENDED">Suspended (Arrears)</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reason / Manager Sign-off Notes</label>
                <textarea
                  rows={2}
                  value={exceptionalOverrideReason}
                  onChange={(e) => setExceptionalOverrideReason(e.target.value)}
                  placeholder="Required for audit logging and approvals..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="ghost"
                  onClick={() => setIsCreditApprovalModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveCreditSetup}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {isManagement ? 'Save Credit Terms' : 'Request Manager Approval'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
