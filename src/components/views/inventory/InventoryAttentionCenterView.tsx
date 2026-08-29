import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  PackageX, 
  TrendingDown, 
  DollarSign, 
  Layers, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  Truck, 
  ClipboardList, 
  Tag, 
  Building2,
  Info,
  Check
} from 'lucide-react';
import { 
  InventoryItem, 
  ReorderRecommendation, 
  StocktakeRiskSignal, 
  OperationalException, 
  StockTransfer, 
  GoodsReceiptNote, 
  StocktakeSession, 
  ApprovalRequest,
  StaffMember, 
  ActiveView 
} from '../../../types';
import { Button } from '../../ui/Button';

export interface InventoryAttentionCenterViewProps {
  currentStaff: StaffMember;
  inventoryItems: InventoryItem[];
  reorderRecommendations: ReorderRecommendation[];
  stocktakeRiskSignals: StocktakeRiskSignal[];
  exceptions: OperationalException[];
  transfers: StockTransfer[];
  stocktakes: StocktakeSession[];
  approvals: ApprovalRequest[];
  onBackToLanding: () => void;
  onNavigateToView: (view: ActiveView, params?: any) => void;
}

export const InventoryAttentionCenterView: React.FC<InventoryAttentionCenterViewProps> = ({
  currentStaff,
  inventoryItems,
  reorderRecommendations,
  stocktakeRiskSignals,
  exceptions,
  transfers,
  stocktakes,
  approvals,
  onBackToLanding,
  onNavigateToView,
}) => {
  // 1. Immediate Attention Elements
  const outOfStockItems = inventoryItems.filter((i) => i.isActive && i.stockOnHand <= 0);
  const missingPriceItems = inventoryItems.filter((i) => i.isActive && (!i.retailPrice || i.retailPrice <= 0));
  const transferDiscrepancies = exceptions.filter(
    (e) => (e.status === 'OPEN' || e.status === 'UNDER_REVIEW') && e.category === 'TRANSFER_DISCREPANCY'
  );
  const criticalStocktakeVariances = exceptions.filter(
    (e) => (e.status === 'OPEN' || e.status === 'UNDER_REVIEW') && e.category === 'STOCK_VARIANCE'
  );

  // 2. Requires Review Elements
  const lowStockItems = inventoryItems.filter(
    (i) => i.isActive && i.stockOnHand > 0 && i.stockOnHand <= (i.reorderLevel || 0)
  );
  const pendingReorderRecs = reorderRecommendations.filter((r) => r.status === 'NEW');
  const missingCostItems = inventoryItems.filter((i) => i.isActive && (!i.unitCost || i.unitCost <= 0));
  const pendingStockAdjustments = approvals.filter(
    (a) => a.status === 'PENDING' && a.category === 'STOCK_ADJUSTMENT'
  );
  const urgentRiskStocktakes = stocktakeRiskSignals.filter((s) => s.riskLevel === 'Urgent Count');

  // 3. Informational Elements
  const openStocktakes = stocktakes.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'COUNTING');
  const inTransitTransfers = transfers.filter((t) => t.status === 'DISPATCHED');

  const totalImmediateCount = outOfStockItems.length + missingPriceItems.length + transferDiscrepancies.length + criticalStocktakeVariances.length;
  const totalReviewCount = lowStockItems.length + pendingReorderRecs.length + missingCostItems.length + pendingStockAdjustments.length + urgentRiskStocktakes.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] text-[#1c1d22]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e4ea] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="p-1.5 hover:bg-[#f1f3f7] rounded-md">
            <ArrowLeft className="w-4 h-4 text-[#555a68]" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1c1d22]">Inventory Attention Center</h1>
              <span className="bg-[#fff3eb] text-[#e05e00] border border-[#fbd6b8] text-xs font-semibold px-2 py-0.5 rounded">
                Deterministic Triage
              </span>
            </div>
            <p className="text-xs text-[#6e7485] mt-0.5">
              Structured operational visibility categorized by immediate risks, pending reviews, and active workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onNavigateToView('COMMERCIAL_DATA_QUALITY')}
            className="text-xs font-medium"
          >
            Commercial Data Quality
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => onNavigateToView('REORDER_REVIEW')}
            className="bg-[#e05e00] hover:bg-[#c95400] text-white text-xs font-medium"
          >
            Reorder Review ({pendingReorderRecs.length})
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-6 overflow-auto space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Section 1: Immediate Attention */}
          <div className="bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-hidden">
            <div className="bg-[#fef2f2] px-5 py-3 border-b border-[#fca5a5] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#dc2626]" />
                <h2 className="text-xs font-bold text-[#991b1b] uppercase tracking-wider">
                  Immediate Attention Required ({totalImmediateCount})
                </h2>
              </div>
              <span className="text-[11px] text-[#991b1b] font-medium">Critical items blocking sales or ledger balance</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Out of Stock Card */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-[#fbfcfd] flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded bg-[#fef2f2] text-[#dc2626] flex items-center justify-center">
                        <PackageX className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1c1d22]">Out of Stock Items</div>
                        <div className="text-[11px] text-[#6e7485]">Sellable quantity is zero or depleted</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#dc2626] font-mono">{outOfStockItems.length}</span>
                  </div>
                  <div className="mt-3 text-xs text-[#555a68]">
                    {outOfStockItems.slice(0, 3).map((item) => (
                      <div key={item.sku} className="truncate text-[11px] py-0.5">
                        • <span className="font-semibold">{item.sku}</span>: {item.name || item.description}
                      </div>
                    ))}
                    {outOfStockItems.length > 3 && (
                      <div className="text-[11px] text-[#8c92a4] mt-0.5">+{outOfStockItems.length - 3} more items</div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Blocks POS line entry</span>
                  <button
                    onClick={() => onNavigateToView('ITEM_LIST')}
                    className="text-xs font-semibold text-[#dc2626] hover:underline flex items-center"
                  >
                    View Catalog <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Missing Selling Price Card */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-[#fbfcfd] flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded bg-[#fff7ed] text-[#ea580c] flex items-center justify-center">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1c1d22]">Missing Selling Price ($0.00)</div>
                        <div className="text-[11px] text-[#6e7485]">Retail price unconfigured</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#ea580c] font-mono">{missingPriceItems.length}</span>
                  </div>
                  <div className="mt-3 text-xs text-[#555a68]">
                    {missingPriceItems.slice(0, 3).map((item) => (
                      <div key={item.sku} className="truncate text-[11px] py-0.5">
                        • <span className="font-semibold">{item.sku}</span>: {item.name || item.description}
                      </div>
                    ))}
                    {missingPriceItems.length === 0 && (
                      <div className="text-[11px] text-[#059669] flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All active products have configured retail prices.
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Price-floor violation</span>
                  <button
                    onClick={() => onNavigateToView('COMMERCIAL_DATA_QUALITY')}
                    className="text-xs font-semibold text-[#ea580c] hover:underline flex items-center"
                  >
                    Fix in Quality Audit <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Transfer Discrepancies */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-[#fbfcfd] flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded bg-[#fef2f2] text-[#dc2626] flex items-center justify-center">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1c1d22]">Transfer Discrepancies</div>
                        <div className="text-[11px] text-[#6e7485]">Transit receiving qty mismatch</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#dc2626] font-mono">{transferDiscrepancies.length}</span>
                  </div>
                  <div className="mt-3 text-xs text-[#555a68]">
                    {transferDiscrepancies.slice(0, 2).map((exc) => (
                      <div key={exc.id} className="truncate text-[11px] py-0.5">
                        • {exc.title}
                      </div>
                    ))}
                    {transferDiscrepancies.length === 0 && (
                      <div className="text-[11px] text-[#059669] flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All branch transfers reconciled.
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Requires manager sign-off</span>
                  <button
                    onClick={() => onNavigateToView('EXCEPTION_LEDGER')}
                    className="text-xs font-semibold text-[#dc2626] hover:underline flex items-center"
                  >
                    Exception Ledger <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Critical Stocktake Variances */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-[#fbfcfd] flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded bg-[#fef2f2] text-[#dc2626] flex items-center justify-center">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1c1d22]">Stocktake Variances</div>
                        <div className="text-[11px] text-[#6e7485]">Physical count vs snapshot delta</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#dc2626] font-mono">{criticalStocktakeVariances.length}</span>
                  </div>
                  <div className="mt-3 text-xs text-[#555a68]">
                    {criticalStocktakeVariances.slice(0, 2).map((exc) => (
                      <div key={exc.id} className="truncate text-[11px] py-0.5">
                        • {exc.title}
                      </div>
                    ))}
                    {criticalStocktakeVariances.length === 0 && (
                      <div className="text-[11px] text-[#059669] flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> No outstanding material count variances.
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Stock ledger reconciliation</span>
                  <button
                    onClick={() => onNavigateToView('STOCKTAKE')}
                    className="text-xs font-semibold text-[#dc2626] hover:underline flex items-center"
                  >
                    Stocktake Sessions <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Requires Review */}
          <div className="bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-hidden">
            <div className="bg-[#fffaf6] px-5 py-3 border-b border-[#fbd6b8] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#e05e00]" />
                <h2 className="text-xs font-bold text-[#e05e00] uppercase tracking-wider">
                  Requires Review ({totalReviewCount})
                </h2>
              </div>
              <span className="text-[11px] text-[#6e7485]">Replenishment triggers and operational exceptions</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Reorder Recommendations */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-white flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-[#1c1d22]">Reorder Recommendations</div>
                    <span className="text-lg font-bold text-[#e05e00] font-mono">{pendingReorderRecs.length}</span>
                  </div>
                  <p className="text-[11px] text-[#6e7485] mt-1">
                    Calculated from lead time and sales velocity.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#e05e00] font-medium">Ready for Memo / PO</span>
                  <button
                    onClick={() => onNavigateToView('REORDER_REVIEW')}
                    className="text-xs font-semibold text-[#e05e00] hover:underline flex items-center"
                  >
                    Review <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Priority Stocktakes */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-white flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-[#1c1d22]">Risk-Weighted Stocktakes</div>
                    <span className="text-lg font-bold text-[#ea580c] font-mono">{urgentRiskStocktakes.length}</span>
                  </div>
                  <p className="text-[11px] text-[#6e7485] mt-1">
                    Urgent count items based on variance and value.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Score ≥ 6</span>
                  <button
                    onClick={() => onNavigateToView('STOCKTAKE_PRIORITIES')}
                    className="text-xs font-semibold text-[#ea580c] hover:underline flex items-center"
                  >
                    Priorities <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Missing Cost Basis */}
              <div className="border border-[#e1e4ea] rounded-lg p-4 bg-white flex flex-col justify-between hover:border-[#cbd0dc] transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-[#1c1d22]">Missing Cost Basis</div>
                    <span className="text-lg font-bold text-[#dc2626] font-mono">{missingCostItems.length}</span>
                  </div>
                  <p className="text-[11px] text-[#6e7485] mt-1">
                    Items with $0.00 cost price recorded.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f3f7] flex justify-between items-center">
                  <span className="text-[11px] text-[#6e7485]">Blocks margin logic</span>
                  <button
                    onClick={() => onNavigateToView('COMMERCIAL_DATA_QUALITY')}
                    className="text-xs font-semibold text-[#dc2626] hover:underline flex items-center"
                  >
                    Audit <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Informational / Active Workflows */}
          <div className="bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-hidden">
            <div className="bg-[#f8f9fa] px-5 py-3 border-b border-[#e1e4ea] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#555a68]" />
                <h2 className="text-xs font-bold text-[#555a68] uppercase tracking-wider">
                  Active Workflows & In-Flight Operations
                </h2>
              </div>
              <span className="text-[11px] text-[#6e7485]">Tracking active inventory cycles</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#e1e4ea] rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-[#1c1d22]">In-Progress Physical Stocktakes</div>
                  <div className="text-[11px] text-[#6e7485] mt-0.5">{openStocktakes.length} sessions actively recording counts</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onNavigateToView('STOCKTAKE')}
                  className="text-xs font-medium"
                >
                  View Stocktakes
                </Button>
              </div>

              <div className="border border-[#e1e4ea] rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-[#1c1d22]">In-Transit Inter-Branch Transfers</div>
                  <div className="text-[11px] text-[#6e7485] mt-0.5">{inTransitTransfers.length} shipments dispatched, awaiting delivery</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onNavigateToView('STOCK_TRANSFERS')}
                  className="text-xs font-medium"
                >
                  View Transfers
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
