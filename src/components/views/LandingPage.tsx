import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Banknote, 
  CreditCard, 
  FileText, 
  Users, 
  History, 
  Receipt, 
  PauseCircle, 
  Clock, 
  CheckSquare, 
  Truck, 
  ClipboardList, 
  PackagePlus, 
  Boxes, 
  FileCheck2, 
  Building2, 
  Settings, 
  ShieldCheck, 
  Key, 
  Award, 
  Building, 
  Warehouse, 
  Monitor, 
  Globe2, 
  Percent, 
  ReceiptText, 
  Printer, 
  Sliders, 
  HardDrive,
  Landmark,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Lock,
  FileSpreadsheet,
  Layers,
  ShieldAlert,
  KeyRound,
  DownloadCloud,
  Cpu,
  Coins,
  RotateCcw,
  Database
} from 'lucide-react';
import { 
  ActiveView, 
  POStatus,
  Shift,
  ApprovalRequest,
  HeldSale,
  EODReport,
  StocktakeSession,
  InventoryItem,
  BIRuleAlert,
  OperationalException
} from '../../types';
import { CTATile } from '../ui/CTATile';
import { Button } from '../ui/Button';
import { AttentionRequiredCard } from './inventory/AttentionRequiredCard';
import { BrainCircuit, BarChart3, Cloud } from 'lucide-react';

export interface LandingPageProps {
  onNavigate: (view: ActiveView, params?: any) => void;
  shifts?: Shift[];
  approvals?: ApprovalRequest[];
  heldSales?: HeldSale[];
  eodReports?: EODReport[];
  stocktakeSessions?: StocktakeSession[];
  inventoryItems?: InventoryItem[];
  biAlerts?: BIRuleAlert[];
  exceptions?: OperationalException[];
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigate,
  shifts = [],
  approvals = [],
  heldSales = [],
  eodReports = [],
  stocktakeSessions = [],
  inventoryItems = [],
  biAlerts = [],
  exceptions = []
}) => {
  const [activePOFilter, setActivePOFilter] = useState<POStatus>('All');

  const poFilters: POStatus[] = ['All', 'Open', 'Part Received', 'Completed', 'Rejected', 'Cancelled'];

  const safeApprovals = Array.isArray(approvals) ? approvals : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeBiAlerts = Array.isArray(biAlerts) ? biAlerts : [];
  const safeExceptions = Array.isArray(exceptions) ? exceptions : [];

  const pendingApprovalsCount = safeApprovals.filter((a) => a && a.status === 'PENDING').length;
  const activeShiftsCount = safeShifts.filter((s) => s && s.status === 'OPEN').length;
  const activeBiAlertsCount = safeBiAlerts.filter((a) => a && (a.status === 'NEW' || a.status === 'REVIEWED')).length;
  const openExceptionsCount = safeExceptions.filter((e) => e && (e.status === 'OPEN' || e.status === 'UNDER_REVIEW')).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-5 select-none">
      {/* Top Station Overview Strip */}
      <div className="bg-white border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FF6B00] text-white flex items-center justify-center shadow-xs">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
              Commercial Operations Center
            </h2>
            <p className="text-xs text-gray-500 font-mono">
              Register #POS-D01 • Shifts: {activeShiftsCount} Open • Approvals: {pendingApprovalsCount} • Exceptions: {openExceptionsCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('EXCEPTION_LEDGER')}
            leftIcon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
          >
            Exceptions ({openExceptionsCount})
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('BI_ACTIVITY')}
            leftIcon={<BrainCircuit className="w-4 h-4 text-orange-600" />}
          >
            BI Activity ({activeBiAlertsCount})
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('REPORTS_CENTER')}
            leftIcon={<BarChart3 className="w-4 h-4 text-blue-600" />}
            shortcutBadge="Ctrl+R"
          >
            Reports Center
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('SHIFT_MANAGEMENT')}
            leftIcon={<Lock className="w-4 h-4 text-gray-700" />}
          >
            Shift Controls
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('APPROVALS')}
            leftIcon={<ShieldAlert className="w-4 h-4 text-amber-600" />}
          >
            Approvals ({pendingApprovalsCount})
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('SALES_CASH')}
            leftIcon={<Banknote className="w-4 h-4" />}
            shortcutBadge="F1"
            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
          >
            New Cash Sale
          </Button>
        </div>
      </div>

      {/* ATTENTION REQUIRED EXPANDED CARD (Phase 5 Systemic & Inventory Health) */}
      <AttentionRequiredCard
        isDashboardView={true}
        items={inventoryItems}
        shifts={shifts}
        approvals={approvals}
        heldSales={heldSales}
        eodReports={eodReports}
        stocktakeSessions={stocktakeSessions}
        exceptions={exceptions}
        onNavigateToShifts={() => onNavigate('SHIFT_MANAGEMENT')}
        onNavigateToEOD={() => onNavigate('EOD_REPORT')}
        onNavigateToApprovals={() => onNavigate('APPROVALS')}
        onNavigateToStocktake={() => onNavigate('STOCKTAKE')}
        onNavigateToHeldSales={() => onNavigate('HELD_SALES')}
        onNavigateToCatalog={() => onNavigate('ITEM_LIST')}
        onNavigateToExceptions={() => onNavigate('EXCEPTION_LEDGER')}
      />

      {/* 3 Primary Visual Function Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* CARD 1: SALES & REGISTERS */}
        <section className="bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FF6B00] text-white shadow-2xs">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase text-gray-900">Sales & Registers</h3>
                  <p className="text-[10px] text-gray-500 font-mono">Point of Sale & Shift Operations</p>
                </div>
              </div>
              <span className="text-[10px] bg-orange-100 text-[#FF6B00] px-2 py-0.5 font-bold border border-orange-200 font-mono uppercase">
                ACTIVE
              </span>
            </div>

            {/* Restrained POS graphic visual treatment */}
            <div className="p-3 bg-orange-50/50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-700 font-mono">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                <span>Today's Shift: <strong>18 Transactions</strong></span>
              </div>
              <span className="font-bold text-gray-900">$2,480.50 Tendered</span>
            </div>

            {/* Grid of Sales CTAs */}
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <CTATile
                id="cta-cash-sale"
                title="Cash Sale"
                description="Standard register cash checkout"
                icon={<Banknote className="w-4 h-4" />}
                shortcut="F1"
                variant="primary"
                onClick={() => onNavigate('SALES_CASH')}
              />
              <CTATile
                id="cta-credit-sale"
                title="Credit Sale"
                description="Commercial account charge"
                icon={<CreditCard className="w-4 h-4" />}
                shortcut="F2"
                onClick={() => onNavigate('SALES_CREDIT')}
              />
              <CTATile
                id="cta-shift-mgmt"
                title="Shift Controls"
                description="Open till & cash float balance"
                icon={<Lock className="w-4 h-4" />}
                onClick={() => onNavigate('SHIFT_MANAGEMENT')}
              />
              <CTATile
                id="cta-credit-note"
                title="Credit Note"
                description="Issue refund or return note"
                icon={<FileText className="w-4 h-4" />}
                shortcut="F7"
                onClick={() => onNavigate('SALES_RETURN')}
              />
              <CTATile
                id="cta-customers"
                title="Customers"
                description="Directory & credit balances"
                icon={<Users className="w-4 h-4" />}
                onClick={() => onNavigate('CUSTOMERS')}
              />
              <CTATile
                id="cta-sales-history"
                title="Sales History"
                description="Daily journal & receipts"
                icon={<History className="w-4 h-4" />}
                onClick={() => onNavigate('SALES_HISTORY')}
              />
              <CTATile
                id="cta-held-receipts"
                title="Held Receipts"
                description="Recall parked sales receipts"
                icon={<Receipt className="w-4 h-4" />}
                badge="2 Parked"
                onClick={() => onNavigate('HELD_RECEIPTS')}
              />
              <CTATile
                id="cta-held-sale"
                title="Held Sale"
                description="Park active cart temporarily"
                icon={<PauseCircle className="w-4 h-4" />}
                shortcut="F3"
                onClick={() => onNavigate('HELD_SALES')}
              />
              <CTATile
                id="cta-layaway"
                title="Layaway"
                description="Installment sales orders"
                icon={<Clock className="w-4 h-4" />}
                shortcut="F8"
                onClick={() => onNavigate('LAYAWAY')}
              />
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <CTATile
                  id="cta-reports-center"
                  title="Reports Center"
                  description="10 commercial report groups"
                  icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
                  shortcut="Ctrl+R"
                  onClick={() => onNavigate('REPORTS_CENTER')}
                />
                <CTATile
                  id="cta-bi-activity"
                  title="BI Activity"
                  description="Rule alerts & recommendations"
                  icon={<BrainCircuit className="w-4 h-4 text-orange-600" />}
                  badge={activeBiAlertsCount > 0 ? `${activeBiAlertsCount}` : undefined}
                  onClick={() => onNavigate('BI_ACTIVITY')}
                />
              </div>
              <div className="sm:col-span-2">
                <CTATile
                  id="cta-eod"
                  title="EOD (End of Day)"
                  description="Multi-tender balancing & Z-report sign-off"
                  icon={<CheckSquare className="w-4 h-4" />}
                  shortcut="F12"
                  variant="highlight"
                  onClick={() => onNavigate('EOD_REPORT')}
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F9F8F5] border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-mono">Drawer #1 Float: $250.00</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('SALES_CASH')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
              className="text-[#FF6B00] hover:text-orange-600 font-bold"
            >
              Open Register
            </Button>
          </div>
        </section>

        {/* CARD 2: PURCHASING, LOGISTICS & STOCKTAKE */}
        <section className="bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gray-800 text-white shadow-2xs">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase text-gray-900">Purchasing & Logistics</h3>
                  <p className="text-[10px] text-gray-500 font-mono">Procurement, Transfers & Audits</p>
                </div>
              </div>
              <span className="text-[10px] font-bold border border-gray-300 px-2 py-0.5 font-mono text-gray-700 bg-white uppercase">
                5 ACTIVE POs
              </span>
            </div>

            {/* PO List Filters Bar */}
            <div className="p-2.5 bg-[#F9F8F5] border-b border-gray-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5 flex items-center justify-between">
                <span>Purchase Order Quick Filters:</span>
                <span className="font-mono text-[#FF6B00] cursor-pointer hover:underline" onClick={() => onNavigate('PO_LIST')}>
                  Open PO Manager →
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {poFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setActivePOFilter(filter);
                      onNavigate('PO_LIST', { statusFilter: filter });
                    }}
                    className={`px-2 py-1 text-[11px] font-mono font-medium transition-colors cursor-pointer border ${
                      activePOFilter === filter
                        ? 'bg-[#FF6B00] text-white border-[#FF6B00] font-bold'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-[#FF6B00]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Purchasing & Stocktake CTAs */}
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <CTATile
                id="cta-stocktake"
                title="Stocktake Audit"
                description="Blind counts & variance adjustments"
                icon={<Layers className="w-4 h-4" />}
                variant="primary"
                onClick={() => onNavigate('STOCKTAKE')}
              />
              <CTATile
                id="cta-reorder-review"
                title="Reorder Review"
                description="Deterministic replenishment calculations"
                icon={<TrendingUp className="w-4 h-4 text-orange-600" />}
                badge="Rule Engine"
                variant="highlight"
                onClick={() => onNavigate('REORDER_REVIEW')}
              />
              <CTATile
                id="cta-stocktake-priorities"
                title="Stocktake Priorities"
                description="Risk-weighted count scheduling"
                icon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
                onClick={() => onNavigate('STOCKTAKE_PRIORITIES')}
              />
              <CTATile
                id="cta-data-quality"
                title="Data Quality Audit"
                description="Cost, price & reorder governance"
                icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
                onClick={() => onNavigate('COMMERCIAL_DATA_QUALITY')}
              />
              <CTATile
                id="cta-attention-center"
                title="Attention Center"
                description="Immediate & review triage"
                icon={<Clock className="w-4 h-4 text-blue-600" />}
                onClick={() => onNavigate('INVENTORY_ATTENTION')}
              />
              <CTATile
                id="cta-purchase-order"
                title="Purchase Order"
                description="Draft and issue vendor PO"
                icon={<ClipboardList className="w-4 h-4" />}
                shortcut="Ctrl+P"
                onClick={() => onNavigate('PURCHASE_ORDER')}
              />
              <CTATile
                id="cta-receive-stock"
                title="Receive Stock"
                description="Inspect & accept incoming goods"
                icon={<PackagePlus className="w-4 h-4" />}
                shortcut="Ctrl+R"
                onClick={() => onNavigate('RECEIVE_STOCK')}
              />
              <CTATile
                id="cta-transfers"
                title="Stock Transfers"
                description="Inter-branch & warehouse transit"
                icon={<Truck className="w-4 h-4" />}
                onClick={() => onNavigate('STOCK_TRANSFERS')}
              />
              <CTATile
                id="cta-purchase-memo"
                title="Purchase Memo"
                description="Internal procurement requisition"
                icon={<FileCheck2 className="w-4 h-4" />}
                onClick={() => onNavigate('PURCHASE_MEMO')}
              />
              <CTATile
                id="cta-item-list"
                title="Item List"
                description="Catalog stock & reorder levels"
                icon={<Boxes className="w-4 h-4" />}
                onClick={() => onNavigate('ITEM_LIST')}
              />
              <CTATile
                id="cta-po-list"
                title="PO List"
                description="Review all procurement orders"
                icon={<ClipboardList className="w-4 h-4" />}
                badge="5 Orders"
                onClick={() => onNavigate('PO_LIST')}
              />
              <CTATile
                id="cta-movements"
                title="Movement History"
                description="Auditable stock transactions log"
                icon={<History className="w-4 h-4 text-orange-600" />}
                onClick={() => onNavigate('INVENTORY_MOVEMENTS')}
              />
              <CTATile
                id="cta-suppliers"
                title="Suppliers"
                description="Vendor directory & terms"
                icon={<Building2 className="w-4 h-4" />}
                onClick={() => onNavigate('SUPPLIERS')}
              />
            </div>
          </div>

          <div className="p-3 bg-[#F9F8F5] border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-mono">1 Delivery Due Today</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('STOCKTAKE')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
              className="text-gray-700 hover:text-[#FF6B00] font-bold"
            >
              Start Cycle Count
            </Button>
          </div>
        </section>

        {/* CARD 3: MANAGEMENT CONTROLS & SETTINGS */}
        <section className="bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gray-200 text-gray-700">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase text-gray-900">Governance & Settings</h3>
                  <p className="text-[10px] text-gray-500 font-mono">Approvals, Master Data & Configuration</p>
                </div>
              </div>
              <span className="text-[10px] font-bold border border-amber-300 px-2 py-0.5 font-mono text-amber-900 bg-amber-50 uppercase">
                {pendingApprovalsCount} PENDING
              </span>
            </div>

            {/* Prominent Approvals CTA */}
            <div className="p-3 bg-amber-50/70 border-b border-gray-200 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-950 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Approvals Area: <strong>{pendingApprovalsCount} Sensitive Requests</strong></span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('APPROVALS')}
                className="text-xs font-bold text-[#FF6B00] hover:underline uppercase cursor-pointer"
              >
                Review →
              </button>
            </div>

            {/* Dense Category CTAs for Governance & Settings */}
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-2 gap-1.5 max-h-[440px] overflow-y-auto">
              <CTATile
                id="cta-approvals"
                title="Approvals Area"
                icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
                badge={pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : undefined}
                variant="highlight"
                onClick={() => onNavigate('APPROVALS')}
              />
              <CTATile
                id="cta-shifts"
                title="Shifts & Tills"
                icon={<Lock className="w-3.5 h-3.5 text-blue-600" />}
                onClick={() => onNavigate('SHIFT_MANAGEMENT')}
              />
              <CTATile
                id="cta-debtors"
                title="Debtors Accounts"
                icon={<CreditCard className="w-3.5 h-3.5 text-emerald-700" />}
                shortcut="Ctrl+D"
                badge="AR"
                onClick={() => onNavigate('DEBTORS')}
              />
              <CTATile
                id="cta-creditors"
                title="Creditor Accounts"
                icon={<Building2 className="w-3.5 h-3.5 text-indigo-700" />}
                shortcut="Ctrl+Shift+C"
                badge="AP"
                onClick={() => onNavigate('CREDITORS')}
              />
              <CTATile
                id="cta-bank-cash"
                title="Cash & Bank"
                icon={<Landmark className="w-3.5 h-3.5 text-amber-700" />}
                onClick={() => onNavigate('CASH_BANK')}
              />
              <CTATile
                id="cta-cash-mgr"
                title="Cash Manager"
                icon={<Banknote className="w-3.5 h-3.5 text-orange-600" />}
                shortcut="F6"
                onClick={() => onNavigate('CASH_MANAGER')}
              />
              <CTATile
                id="cta-cashflow-projector"
                title="Cash Flow Projector"
                icon={<FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />}
                badge="Projections"
                onClick={() => onNavigate('CASHFLOW_PROJECTOR')}
              />
              <CTATile
                id="cta-reserves"
                title="Business Reserves"
                icon={<Layers className="w-3.5 h-3.5 text-emerald-600" />}
                onClick={() => onNavigate('RESERVES')}
              />
              <CTATile
                id="cta-exceptions"
                title="Exception Ledger"
                icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                badge={openExceptionsCount > 0 ? `${openExceptionsCount}` : undefined}
                variant="subtle"
                onClick={() => onNavigate('EXCEPTION_LEDGER')}
              />
              <CTATile
                id="cta-activity"
                title="Activity Stream"
                icon={<History className="w-3.5 h-3.5 text-purple-600" />}
                onClick={() => onNavigate('ACTIVITY_EVENTS')}
              />
              <CTATile
                id="cta-op-readiness"
                title="Operational Readiness"
                icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                badge="POS Health"
                variant="highlight"
                onClick={() => onNavigate('OPERATIONAL_READINESS')}
              />
              <CTATile
                id="cta-metric-dict"
                title="Metric Dictionary"
                icon={<BookOpen className="w-3.5 h-3.5 text-blue-600" />}
                onClick={() => onNavigate('METRIC_DICTIONARY')}
              />
              <CTATile
                id="cta-licensing"
                title="Licensing"
                icon={<KeyRound className="w-3.5 h-3.5 text-orange-600" />}
                badge="Pro"
                onClick={() => onNavigate('LICENSING')}
              />
              <CTATile
                id="cta-updates"
                title="Software Updates"
                icon={<DownloadCloud className="w-3.5 h-3.5 text-blue-600" />}
                onClick={() => onNavigate('UPDATES')}
              />
              <CTATile
                id="cta-devices"
                title="Devices"
                icon={<Printer className="w-3.5 h-3.5 text-slate-700" />}
                onClick={() => onNavigate('DEVICES')}
              />
              <CTATile
                id="cta-payments"
                title="Payment Config"
                icon={<Coins className="w-3.5 h-3.5 text-emerald-600" />}
                onClick={() => onNavigate('PAYMENT_METHODS')}
              />
              <CTATile
                id="cta-fiscalization"
                title="Fiscalization"
                icon={<Cpu className="w-3.5 h-3.5 text-red-600" />}
                badge="ETR"
                onClick={() => onNavigate('FISCALIZATION')}
              />
              <CTATile
                id="cta-tax"
                title="Tax & Fiscal"
                icon={<Percent className="w-3.5 h-3.5 text-blue-700" />}
                onClick={() => onNavigate('TAX_FISCAL')}
              />
              <CTATile
                id="cta-departments"
                title="Departments"
                icon={<Building className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('DEPARTMENTS')}
              />
              <CTATile
                id="cta-staff"
                title="Staff Roster"
                icon={<Users className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('STAFF_MANAGEMENT')}
              />
              <CTATile
                id="cta-roles"
                title="Roles & Rights"
                icon={<ShieldCheck className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('ROLES_RIGHTS')}
              />
              <CTATile
                id="cta-branches"
                title="Branches"
                icon={<Building2 className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('BRANCHES')}
              />
              <CTATile
                id="cta-warehouses"
                title="Warehouses"
                icon={<Warehouse className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('WAREHOUSES')}
              />
              <CTATile
                id="cta-terminals"
                title="Terminals"
                icon={<Monitor className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('TERMINALS')}
              />
              <CTATile
                id="cta-vendor-pref"
                title="Vendor Prefs"
                icon={<Sliders className="w-3.5 h-3.5" />}
                onClick={() => onNavigate('VENDOR_PREFERENCES')}
              />
              <CTATile
                id="cta-backup"
                title="Data Protection"
                icon={<HardDrive className="w-3.5 h-3.5 text-orange-600" />}
                badge="Safe v17"
                variant="highlight"
                onClick={() => onNavigate('DATA_PROTECTION')}
              />
              <CTATile
                id="cta-restore"
                title="Restore Data"
                icon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
                onClick={() => onNavigate('RESTORE_DATA')}
              />
              <CTATile
                id="cta-integrity"
                title="DB Integrity"
                icon={<Database className="w-3.5 h-3.5 text-stone-700" />}
                onClick={() => onNavigate('DATABASE_INTEGRITY')}
              />
            </div>
          </div>

          <div className="p-3 bg-[#F9F8F5] border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-mono">Governance: Dual Control Enforced</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('APPROVALS')}
              rightIcon={<ArrowRight className="w-3 h-3" />}
              className="text-gray-700 hover:text-[#FF6B00] font-bold"
            >
              Open Approvals
            </Button>
          </div>
        </section>
      </div>

      {/* Bottom Restrained Cloud Extension Bar */}
      <div className="bg-white border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>iTred Cloud Platform & Multi-Branch Extension</span>
              <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 uppercase border border-indigo-200">
                Optional Tier
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-sans mt-0.5">
              Autonomous Desktop POS with optional zero-downtime link for multi-branch head office, mobile reporting, and automated cloud backup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('ONLINE_UPGRADE')}
            leftIcon={<Cloud className="w-3.5 h-3.5 text-indigo-600" />}
            className="text-indigo-900 border-indigo-300 hover:bg-indigo-50"
          >
            Explore Online Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
};
