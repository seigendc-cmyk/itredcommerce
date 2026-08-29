import React, { useState } from 'react';
import { 
  AlertTriangle, 
  DollarSign, 
  Tag, 
  PackageX, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Lock,
  FileSpreadsheet,
  Layers,
  UserCheck,
  ArrowUpRight
} from 'lucide-react';
import { 
  InventoryItem, 
  Shift, 
  ApprovalRequest, 
  HeldSale, 
  EODReport, 
  StocktakeSession,
  OperationalException
} from '../../../types';

export type AttentionIssueType = 
  | 'ALL' 
  | 'NO_SELLING_PRICE' 
  | 'NO_COST' 
  | 'BELOW_REORDER' 
  | 'OUT_OF_STOCK' 
  | 'INACTIVE';

export interface AttentionRequiredCardProps {
  items?: InventoryItem[];
  activeIssue?: AttentionIssueType;
  onSelectIssue?: (issue: AttentionIssueType) => void;
  
  // Optional Systemic Data (When used on Landing / Dashboard)
  shifts?: Shift[];
  approvals?: ApprovalRequest[];
  heldSales?: HeldSale[];
  eodReports?: EODReport[];
  stocktakeSessions?: StocktakeSession[];
  exceptions?: OperationalException[];
  
  // Navigation Callbacks
  onNavigateToShifts?: () => void;
  onNavigateToEOD?: () => void;
  onNavigateToApprovals?: () => void;
  onNavigateToStocktake?: () => void;
  onNavigateToHeldSales?: () => void;
  onNavigateToCatalog?: (filter?: AttentionIssueType) => void;
  onNavigateToExceptions?: () => void;
  onNavigateToReorderReview?: () => void;
  onNavigateToStocktakePriorities?: () => void;
  onNavigateToDataQuality?: () => void;
  onNavigateToReadiness?: () => void;
  onNavigateToAttentionCenter?: () => void;
  
  className?: string;
  isDashboardView?: boolean;
}

export const AttentionRequiredCard: React.FC<AttentionRequiredCardProps> = ({
  items = [],
  activeIssue = 'ALL',
  onSelectIssue,
  shifts = [],
  approvals = [],
  heldSales = [],
  eodReports = [],
  stocktakeSessions = [],
  exceptions = [],
  onNavigateToShifts,
  onNavigateToEOD,
  onNavigateToApprovals,
  onNavigateToStocktake,
  onNavigateToHeldSales,
  onNavigateToCatalog,
  onNavigateToExceptions,
  onNavigateToReorderReview,
  onNavigateToStocktakePriorities,
  onNavigateToDataQuality,
  onNavigateToReadiness,
  onNavigateToAttentionCenter,
  className = '',
  isDashboardView = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. Catalog Metric counts
  const noSellingPriceCount = items.filter((item) => item.isActive && (!item.retailPrice || item.retailPrice <= 0)).length;
  const noCostCount = items.filter((item) => item.isActive && (!item.unitCost || item.unitCost <= 0)).length;
  const belowReorderCount = items.filter((item) => item.isActive && item.stockOnHand > 0 && item.stockOnHand <= item.reorderLevel).length;
  const outOfStockCount = items.filter((item) => item.isActive && item.stockOnHand <= 0).length;

  // 2. Operational Systemic metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const openPreviousShiftCount = shifts.filter((s) => 
    s.status === 'REQUIRES_CLOSURE' || 
    (s.status === 'OPEN' && s.openingDate < todayStr)
  ).length;

  const openExceptionsCount = exceptions.filter((e) => e.status === 'OPEN' || e.status === 'UNDER_REVIEW').length;

  const heldSalesOutstandingCount = heldSales.filter((h) => h.status === 'HELD' || h.status === 'PARKED').length;
  
  const pendingCustomerApprovalsCount = approvals.filter((a) => a.status === 'PENDING' && (a.type === 'CUSTOMER_APPROVAL' || a.type === 'CREDIT_LIMIT_OVERRIDE')).length;
  
  const unapprovedStockAdjustmentsCount = approvals.filter((a) => a.status === 'PENDING' && a.type === 'STOCK_ADJUSTMENT').length;
  
  const stocktakeVarianceCount = approvals.filter((a) => a.status === 'PENDING' && a.type === 'STOCKTAKE_VARIANCE').length + 
    stocktakeSessions.filter((s) => s.status === 'VARIANCE_REVIEW').length;
  
  const eodVarianceCount = approvals.filter((a) => a.status === 'PENDING' && a.type === 'CASH_VARIANCE').length +
    eodReports.filter((e) => e.status === 'DISCREPANCY_FLAGGED').length;

  const totalCatalogIssues = noSellingPriceCount + noCostCount + belowReorderCount + outOfStockCount;
  const totalOperationalIssues = 
    openPreviousShiftCount + 
    openExceptionsCount +
    heldSalesOutstandingCount + 
    pendingCustomerApprovalsCount + 
    unapprovedStockAdjustmentsCount + 
    stocktakeVarianceCount + 
    eodVarianceCount;

  const totalIssuesCount = totalCatalogIssues + (isDashboardView ? totalOperationalIssues : 0);

  if (totalIssuesCount === 0) {
    return (
      <div className={`bg-emerald-50 border border-emerald-300 p-3.5 flex items-center justify-between shadow-2xs ${className}`}>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
              System & Catalog Health: 100% Compliant
            </span>
            <p className="text-[11px] text-emerald-800 font-mono">
              All shifts balanced, inventory prices & costs recorded, zero stockouts, and no pending approval bottlenecks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-2 border-amber-400 shadow-2xs select-none ${className}`}>
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-amber-500 text-white px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-amber-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Attention Required
          </span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white font-mono text-[11px] font-bold">
            {totalIssuesCount} Active Condition{totalIssuesCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-amber-100 hidden sm:inline">
            Click metric card to inspect or resolve
          </span>
          <button 
            type="button"
            className="p-0.5 hover:bg-amber-700/50 rounded-none text-white focus:outline-hidden"
            aria-label="Toggle card expansion"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3.5 bg-amber-50/40 space-y-3">
          {/* Critical Operational Issues Alert (If previous shift is open or high priority variance) */}
          {openPreviousShiftCount > 0 && (
            <div className="bg-rose-50 border border-rose-300 p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                <span>
                  <strong>Previous Shift Requires Closure:</strong> {openPreviousShiftCount} terminal(s) left open from prior trading day.
                </span>
              </div>
              {onNavigateToShifts && (
                <button
                  type="button"
                  onClick={onNavigateToShifts}
                  className="px-2 py-1 bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Resolve Till <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Grid of Issues Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {/* 1. Missing Selling Price */}
            <button
              type="button"
              onClick={() => {
                if (onSelectIssue) onSelectIssue(activeIssue === 'NO_SELLING_PRICE' ? 'ALL' : 'NO_SELLING_PRICE');
                if (onNavigateToCatalog) onNavigateToCatalog('NO_SELLING_PRICE');
              }}
              className={`p-2.5 text-left border transition-all cursor-pointer ${
                activeIssue === 'NO_SELLING_PRICE'
                  ? 'bg-amber-100 border-[#FF6B00] ring-1 ring-[#FF6B00]'
                  : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Items Without Price
                </span>
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                  noSellingPriceCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                }`}>
                  {noSellingPriceCount}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 leading-tight">
                {noSellingPriceCount > 0 ? 'Blocked from POS checkout.' : 'All items priced.'}
              </div>
            </button>

            {/* 2. Missing Unit Cost */}
            <button
              type="button"
              onClick={() => {
                if (onSelectIssue) onSelectIssue(activeIssue === 'NO_COST' ? 'ALL' : 'NO_COST');
                if (onNavigateToCatalog) onNavigateToCatalog('NO_COST');
              }}
              className={`p-2.5 text-left border transition-all cursor-pointer ${
                activeIssue === 'NO_COST'
                  ? 'bg-amber-100 border-[#FF6B00] ring-1 ring-[#FF6B00]'
                  : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  Items Without Cost
                </span>
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                  noCostCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                }`}>
                  {noCostCount}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 leading-tight">
                {noCostCount > 0 ? 'Inventory valuation skewed.' : 'All costs recorded.'}
              </div>
            </button>

            {/* 3. Low Stock / Below Reorder */}
            <button
              type="button"
              onClick={() => {
                if (onSelectIssue) onSelectIssue(activeIssue === 'BELOW_REORDER' ? 'ALL' : 'BELOW_REORDER');
                if (onNavigateToCatalog) onNavigateToCatalog('BELOW_REORDER');
              }}
              className={`p-2.5 text-left border transition-all cursor-pointer ${
                activeIssue === 'BELOW_REORDER'
                  ? 'bg-amber-100 border-[#FF6B00] ring-1 ring-[#FF6B00]'
                  : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                  Low Stock
                </span>
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                  belowReorderCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                }`}>
                  {belowReorderCount}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 leading-tight">
                {belowReorderCount > 0 ? 'Replenishment PO recommended.' : 'Stock healthy.'}
              </div>
            </button>

            {/* 4. Held Sales Outstanding */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToHeldSales && onNavigateToHeldSales()}
                className="p-2.5 text-left border bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Held Sales Outstanding
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    heldSalesOutstandingCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {heldSalesOutstandingCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {heldSalesOutstandingCount > 0 ? 'Parked customer sales tickets.' : 'Zero parked sales.'}
                </div>
              </button>
            )}

            {/* 5. Open Previous Shift */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToShifts && onNavigateToShifts()}
                className={`p-2.5 text-left border transition-all cursor-pointer ${
                  openPreviousShiftCount > 0 ? 'bg-rose-50 border-rose-300 hover:bg-rose-100' : 'bg-white border-amber-200 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    Open Previous Shift
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    openPreviousShiftCount > 0 ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {openPreviousShiftCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {openPreviousShiftCount > 0 ? 'Requires immediate closure.' : 'Registers closed.'}
                </div>
              </button>
            )}

            {/* 6. EOD Variance */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToEOD && onNavigateToEOD()}
                className="p-2.5 text-left border bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    EOD Variance
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    eodVarianceCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {eodVarianceCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {eodVarianceCount > 0 ? 'Tender discrepancy flagged.' : 'Reconciliations balanced.'}
                </div>
              </button>
            )}

            {/* 7. Unapproved Stock Adjustment */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToApprovals && onNavigateToApprovals()}
                className="p-2.5 text-left border bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                    Unapproved Adjustments
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    unapprovedStockAdjustmentsCount > 0 ? 'bg-purple-200 text-purple-950' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {unapprovedStockAdjustmentsCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {unapprovedStockAdjustmentsCount > 0 ? 'Write-off awaiting sign-off.' : 'Adjustments clean.'}
                </div>
              </button>
            )}

            {/* 8. Pending Customer Approval */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToApprovals && onNavigateToApprovals()}
                className="p-2.5 text-left border bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Customer Approvals
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    pendingCustomerApprovalsCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {pendingCustomerApprovalsCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {pendingCustomerApprovalsCount > 0 ? 'Credit accounts & limit overrides.' : 'Zero pending.'}
                </div>
              </button>
            )}

            {/* 9. Stocktake Variance */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToStocktake && onNavigateToStocktake()}
                className="p-2.5 text-left border bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    Stocktake Variance
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    stocktakeVarianceCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {stocktakeVarianceCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {stocktakeVarianceCount > 0 ? 'Cycle count audit deltas.' : 'Count sessions aligned.'}
                </div>
              </button>
            )}

            {/* 10. Operational Exceptions */}
            {isDashboardView && (
              <button
                type="button"
                onClick={() => onNavigateToExceptions && onNavigateToExceptions()}
                className={`p-2.5 text-left border transition-all cursor-pointer ${
                  openExceptionsCount > 0
                    ? 'bg-rose-50 border-rose-300 hover:bg-rose-100'
                    : 'bg-white border-amber-200 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Exception Ledger
                  </span>
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
                    openExceptionsCount > 0 ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {openExceptionsCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">
                  {openExceptionsCount > 0 ? 'Discrepancies needing sign-off.' : 'No open exceptions.'}
                </div>
              </button>
            )}
          </div>

          {/* Deterministic Inventory Intelligence & Operational Readiness Quick Shortcuts */}
          {isDashboardView && (
            <div className="pt-2.5 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-950">
                  Deterministic Intelligence:
                </span>
                {onNavigateToAttentionCenter && (
                  <button
                    type="button"
                    onClick={onNavigateToAttentionCenter}
                    className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100/50 text-[#1c1d22] font-semibold text-[11px] rounded cursor-pointer"
                  >
                    Attention Center
                  </button>
                )}
                {onNavigateToReorderReview && (
                  <button
                    type="button"
                    onClick={onNavigateToReorderReview}
                    className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100/50 text-[#e05e00] font-semibold text-[11px] rounded cursor-pointer"
                  >
                    Reorder Review
                  </button>
                )}
                {onNavigateToStocktakePriorities && (
                  <button
                    type="button"
                    onClick={onNavigateToStocktakePriorities}
                    className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100/50 text-[#2563eb] font-semibold text-[11px] rounded cursor-pointer"
                  >
                    Stocktake Priorities
                  </button>
                )}
                {onNavigateToDataQuality && (
                  <button
                    type="button"
                    onClick={onNavigateToDataQuality}
                    className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100/50 text-[#059669] font-semibold text-[11px] rounded cursor-pointer"
                  >
                    Commercial Data Quality
                  </button>
                )}
              </div>

              {onNavigateToReadiness && (
                <button
                  type="button"
                  onClick={onNavigateToReadiness}
                  className="px-2.5 py-1 bg-[#1c1d22] text-white hover:bg-black font-semibold text-[11px] rounded flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  Operational Readiness Panel
                </button>
              )}
            </div>
          )}

          {/* Issue filter bar when in catalog mode */}
          {!isDashboardView && activeIssue !== 'ALL' && onSelectIssue && (
            <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-xs">
              <span className="text-amber-950 font-medium">
                Filtering catalog by: <strong className="uppercase font-bold text-gray-900">{activeIssue.replace(/_/g, ' ')}</strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectIssue('ALL')}
                className="text-[#FF6B00] hover:text-[#E05E00] font-bold underline cursor-pointer text-[11px]"
              >
                Clear Filter (Show All Items)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
