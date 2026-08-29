import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Plus, 
  ArrowLeft, 
  Search, 
  Filter, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Barcode as BarcodeIcon, 
  Check, 
  X, 
  Warehouse, 
  Store, 
  FileSpreadsheet, 
  Clock, 
  History, 
  ArrowRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { 
  StaffMember, 
  Warehouse as WarehouseType, 
  Branch, 
  InventoryItem, 
  StocktakeSession, 
  StocktakeCountItem,
  InventoryMovement,
  StockAdjustmentRecord,
  StocktakeVarianceReasonCode
} from '../../../types';
import { isManager as checkIsManager } from '../../../utils/roles';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { StartStocktakeModal } from './StartStocktakeModal';
import { StocktakeAuditSlipModal } from './StocktakeAuditSlipModal';
import { ItemStockCardModal } from '../inventory/ItemStockCardModal';

export interface StocktakeViewProps {
  currentStaff: StaffMember;
  warehouses: WarehouseType[];
  branches: Branch[];
  inventoryItems: InventoryItem[];
  stocktakeSessions: StocktakeSession[];
  inventoryMovements?: InventoryMovement[];
  onSaveSession: (session: StocktakeSession) => void;
  onPostAdjustments: (session: StocktakeSession, movements: InventoryMovement[]) => void;
  onBackToLanding: () => void;
  onNavigateToApprovals: () => void;
  onNavigateToPriorities?: () => void;
}

export const StocktakeView: React.FC<StocktakeViewProps> = ({
  currentStaff,
  warehouses = [],
  branches = [],
  inventoryItems = [],
  stocktakeSessions = [],
  inventoryMovements = [],
  onSaveSession,
  onPostAdjustments,
  onBackToLanding,
  onNavigateToApprovals,
  onNavigateToPriorities,
}) => {
  const [sessions, setSessions] = useState<StocktakeSession[]>(stocktakeSessions || []);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(stocktakeSessions?.[0]?.id || null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isAuditSlipOpen, setIsAuditSlipOpen] = useState(false);
  const [stockCardItem, setStockCardItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Scanner quick count state
  const [scanInput, setScanInput] = useState('');
  const [scanQty, setScanQty] = useState('1');
  const [scanMsg, setScanMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approval notes state
  const [approvalNotes, setApprovalNotes] = useState('');

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const isManager = checkIsManager(currentStaff);
  const isCreator = activeSession?.createdByStaffId === currentStaff.id;
  const canApprove = isManager && (!isCreator || currentStaff.role === 'SYS_ADMIN');

  // Handle reason code update for variance review
  const handleUpdateItemReasonCode = (sku: string, reasonCode: StocktakeVarianceReasonCode) => {
    if (!activeSession) return;
    const updatedItems = activeSession.items.map((item) => {
      if (item.sku === sku) {
        return {
          ...item,
          reasonCode,
        };
      }
      return item;
    });

    const updatedSession: StocktakeSession = {
      ...activeSession,
      items: updatedItems,
    };
    setSessions((prev) => prev.map((s) => s.id === updatedSession.id ? updatedSession : s));
    onSaveSession(updatedSession);
  };

  // Handle count quantity update for an item
  const handleUpdateItemCount = (sku: string, countedQty: number | null, notes?: string) => {
    if (!activeSession) return;

    const updatedItems = activeSession.items.map((item) => {
      if (item.sku === sku) {
        const varianceQty = countedQty !== null ? countedQty - item.bookQty : 0;
        const varianceValuation = varianceQty * item.unitCost;
        let defaultReason = item.reasonCode;
        if (!defaultReason && varianceQty < 0) defaultReason = 'STOCK_SHORTAGE';
        if (!defaultReason && varianceQty > 0) defaultReason = 'STOCK_OVERAGE';

        return {
          ...item,
          countedQty,
          varianceQty,
          varianceValuation,
          reasonCode: defaultReason,
          notes: notes !== undefined ? notes : item.notes,
          lastCountedTimestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          countedByStaffName: currentStaff.name,
        };
      }
      return item;
    });

    const totalCounted = updatedItems.filter((i) => i.countedQty !== null).length;
    const totalVarianceUnits = updatedItems.reduce((acc, i) => acc + (i.countedQty !== null ? i.varianceQty : 0), 0);
    const totalVarianceVal = updatedItems.reduce((acc, i) => acc + (i.countedQty !== null ? i.varianceValuation : 0), 0);
    const hasDiscrepancy = updatedItems.some((i) => i.countedQty !== null && i.varianceQty !== 0);

    const updatedSession: StocktakeSession = {
      ...activeSession,
      items: updatedItems,
      totalCountedUnits: totalCounted,
      totalVarianceUnits,
      totalVarianceValuation: totalVarianceVal,
      approvalRequired: hasDiscrepancy,
    };

    setSessions((prev) => prev.map((s) => s.id === updatedSession.id ? updatedSession : s));
    onSaveSession(updatedSession);
  };

  // Quick Barcode Scanning Count Handler
  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    setScanMsg(null);
    if (!activeSession || !scanInput.trim()) return;

    const query = scanInput.trim().toLowerCase();
    const item = activeSession.items.find(
      (i) => i.barcode.toLowerCase() === query || i.sku.toLowerCase() === query
    );

    if (!item) {
      setScanMsg({ type: 'error', text: `No item matching barcode / SKU "${scanInput}" found in this session sheet.` });
      return;
    }

    const qtyToAdd = parseInt(scanQty) || 1;
    const newCount = (item.countedQty || 0) + qtyToAdd;
    handleUpdateItemCount(item.sku, newCount);

    setScanMsg({ type: 'success', text: `Counted +${qtyToAdd} for "${item.name}". Total Counted: ${newCount} (Expected: ${item.bookQty}).` });
    setScanInput('');
    setScanQty('1');
  };

  // Move Session to Variance Review
  const handleMoveToVarianceReview = () => {
    if (!activeSession) return;
    const hasUncounted = activeSession.items.some((i) => i.countedQty === null);
    if (hasUncounted) {
      if (!window.confirm('Some items remain uncounted. Uncounted items will be treated with zero count. Proceed to Variance Review?')) {
        return;
      }
    }

    const updated: StocktakeSession = {
      ...activeSession,
      status: 'VARIANCE_REVIEW',
    };
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    onSaveSession(updated);
  };

  // Manager Approval of Stocktake Variances
  const handleApproveSession = () => {
    if (!activeSession) return;
    const updated: StocktakeSession = {
      ...activeSession,
      status: 'APPROVED',
      approvedByStaffName: currentStaff.name,
      approvedDateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      approvalNotes: approvalNotes.trim() || 'Stocktake variances reviewed and approved for ledger adjustment.',
    };
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    onSaveSession(updated);
  };

  // Post Adjustments to Real Inventory
  const handlePostAdjustments = () => {
    if (!activeSession) return;

    const movements: InventoryMovement[] = [];
    activeSession.items.forEach((item) => {
      if (item.countedQty !== null && item.varianceQty !== 0) {
        const isOut = item.varianceQty < 0;
        movements.push({
          id: `MOV-STK-${Date.now()}-${item.sku}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          movementType: 'Stocktake Adjustment',
          sku: item.sku,
          itemName: item.name,
          quantity: item.varianceQty,
          direction: isOut ? 'OUT' : 'IN',
          unitCost: item.unitCost,
          totalValue: Math.abs(item.varianceValuation),
          sourceLocationId: isOut ? activeSession.locationId : undefined,
          sourceLocationName: isOut ? activeSession.locationName : `Stock Surplus (${item.reasonCode || 'STOCK_OVERAGE'})`,
          destinationLocationId: isOut ? undefined : activeSession.locationId,
          destinationLocationName: isOut ? `Shrinkage / Adjustment (${item.reasonCode || 'STOCK_SHORTAGE'})` : activeSession.locationName,
          referenceDocument: activeSession.sessionNumber,
          referenceType: 'STOCKTAKE',
          reasonCode: item.reasonCode || (isOut ? 'STOCK_SHORTAGE' : 'STOCK_OVERAGE'),
          reason: `Stocktake ${activeSession.sessionNumber} count: counted ${item.countedQty} vs expected ${item.bookQty}`,
          approvalStatus: 'APPROVED',
          approvalRef: activeSession.approvedByStaffName || currentStaff.name,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          notes: item.notes || `Stocktake ${activeSession.sessionNumber} delta adjustment. Counted ${item.countedQty} vs Book ${item.bookQty}.`,
        });
      }
    });

    const updated: StocktakeSession = {
      ...activeSession,
      status: 'POSTED',
      completedDateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    onSaveSession(updated);
    onPostAdjustments(updated, movements);
  };

  // Close Stocktake Session
  const handleCloseSession = () => {
    if (!activeSession) return;
    const updated: StocktakeSession = {
      ...activeSession,
      status: 'CLOSED',
    };
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    onSaveSession(updated);
  };

  const filteredItems = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.items.filter((item) => {
      if (searchTerm) {
        const match = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (item.binLocation && item.binLocation.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!match) return false;
      }
      if (statusFilter === 'UNCOUNTED' && item.countedQty !== null) return false;
      if (statusFilter === 'VARIANCE_ONLY' && (item.countedQty === null || item.varianceQty === 0)) return false;
      if (statusFilter === 'MATCHED' && (item.countedQty === null || item.varianceQty !== 0)) return false;
      return true;
    });
  }, [activeSession, searchTerm, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Top Bar */}
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
              <Boxes className="w-5 h-5 text-[#FF6B00]" />
              Stocktake & Physical Inventory Audits
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Cycle counting, blind audits, variance reconciliation, and ledger posting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToPriorities && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNavigateToPriorities}
              className="text-xs font-bold uppercase border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-700" />
              Risk Priorities
            </Button>
          )}
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
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsStartModalOpen(true)}
            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold uppercase"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Stocktake Session
          </Button>
        </div>
      </div>

      {/* Session Selector Strip */}
      <div className="bg-white p-3 border border-gray-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Select Session:</span>
          {sessions.map((sess) => (
            <button
              key={sess.id}
              type="button"
              onClick={() => setActiveSessionId(sess.id)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all border ${
                activeSessionId === sess.id
                  ? 'bg-gray-800 text-white border-gray-800 shadow-xs'
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span>{sess.sessionNumber}</span>
                <span className={`text-[9px] font-mono px-1 py-0.2 ${
                  sess.status === 'APPROVED' || sess.status === 'POSTED'
                    ? 'bg-emerald-500 text-white'
                    : sess.status === 'VARIANCE_REVIEW'
                      ? 'bg-amber-500 text-white'
                      : 'bg-blue-500 text-white'
                }`}>
                  {sess.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        {activeSession && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-500 flex items-center gap-1">
              {activeSession.locationType === 'WAREHOUSE' ? <Warehouse className="w-3.5 h-3.5 text-blue-600" /> : <Store className="w-3.5 h-3.5 text-[#FF6B00]" />}
              {activeSession.locationName}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-700">Created: {activeSession.createdDateTime}</span>
          </div>
        )}
      </div>

      {activeSession ? (
        <div className="space-y-4">
          {/* Active Session Status & Workflow Bar */}
          <div className="bg-white border-2 border-gray-300 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 uppercase">
                    {activeSession.title}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-gray-200 text-gray-800">
                    {activeSession.sessionNumber}
                  </span>
                  {activeSession.isBlindCount && (
                    <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Blind Count Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Auditor: {activeSession.createdByStaffName} • Location: {activeSession.locationName}
                </p>
              </div>

              {/* Workflow Stepper Action Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeSession.status === 'COUNTING' && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleMoveToVarianceReview}
                    className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
                  >
                    Proceed to Variance Review
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                )}

                {activeSession.status === 'VARIANCE_REVIEW' && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const updated: StocktakeSession = { ...activeSession, status: 'COUNTING' };
                        setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                        onSaveSession(updated);
                      }}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Resume Counting
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleApproveSession}
                      disabled={!isManager}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      title={!isManager ? 'Requires Store Manager or Admin role' : 'Sign-off and approve variances'}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {isManager ? 'Approve Variances' : 'Manager Approval Required'}
                    </Button>
                  </div>
                )}

                {activeSession.status === 'APPROVED' && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handlePostAdjustments}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Post Approved Adjustments to Ledger
                  </Button>
                )}

                {activeSession.status === 'POSTED' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCloseSession}
                    className="text-xs font-bold"
                  >
                    Close & Finalize Session
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAuditSlipOpen(true)}
                  className="bg-slate-900 text-amber-400 hover:bg-slate-800 text-xs font-bold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Audit Slip / Certificate
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Sheet
                </Button>
              </div>
            </div>

            {/* Metrics Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200 text-xs font-mono">
              <div className="bg-gray-50 p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Catalog Items</span>
                <span className="font-bold text-gray-900">{activeSession.items?.length || 0} Lines</span>
              </div>
              <div className="bg-gray-50 p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Count Progress</span>
                <span className="font-bold text-blue-700">
                  {(activeSession.items || []).filter((i) => i.countedQty !== null).length} / {activeSession.items?.length || 0} Counted
                </span>
              </div>
              <div className="bg-gray-50 p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Net Unit Variance</span>
                <span className={`font-bold ${activeSession.totalVarianceUnits < 0 ? 'text-rose-600' : activeSession.totalVarianceUnits > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {activeSession.totalVarianceUnits === 0 ? '0 Units' : `${activeSession.totalVarianceUnits > 0 ? '+' : ''}${activeSession.totalVarianceUnits} Units`}
                </span>
              </div>
              <div className="bg-gray-50 p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Net Valuation Delta</span>
                <span className={`font-bold ${activeSession.totalVarianceValuation < 0 ? 'text-rose-600' : activeSession.totalVarianceValuation > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {activeSession.totalVarianceValuation === 0 ? '$0.00' : `${activeSession.totalVarianceValuation > 0 ? '+' : '-'}$${Math.abs(activeSession.totalVarianceValuation).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Barcode Scanner Input (during COUNTING phase) */}
          {activeSession.status === 'COUNTING' && (
            <div className="bg-blue-50 border border-blue-200 p-3 shadow-2xs">
              <form onSubmit={handleQuickScan} className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-900 shrink-0">
                  <BarcodeIcon className="w-4 h-4 text-blue-700" />
                  Quick Scan Counter:
                </div>
                <div className="flex items-center gap-2 flex-1 w-full">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan barcode or enter SKU (e.g. 600980012301 or ITM-MS-101)..."
                    className="w-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-mono focus:border-[#FF6B00] focus:outline-hidden"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={scanQty}
                      onChange={(e) => setScanQty(e.target.value)}
                      className="w-16 border border-blue-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0"
                  >
                    + Count
                  </Button>
                </div>
              </form>

              {scanMsg && (
                <div className={`mt-2 text-xs font-mono px-2 py-1 ${
                  scanMsg.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}>
                  {scanMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 focus:border-[#FF6B00] focus:outline-hidden"
              >
                <option value="ALL">Show All Lines ({activeSession.items?.length || 0})</option>
                <option value="UNCOUNTED">Uncounted Items</option>
                <option value="VARIANCE_ONLY">Variances / Discrepancies Only</option>
                <option value="MATCHED">Matched Zero-Variance Lines</option>
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search item, SKU, barcode, bin..."
                className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 focus:border-[#FF6B00] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Inventory Count Table */}
          <div className="bg-white border border-gray-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">SKU / Barcode</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Bin Location</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    {!activeSession.isBlindCount && (
                      <th className="py-2.5 px-3 text-right bg-gray-200/60">Book Qty (Expected)</th>
                    )}
                    <th className="py-2.5 px-3 text-right bg-blue-50">Physical Counted Qty</th>
                    {activeSession.status !== 'COUNTING' && (
                      <>
                        <th className="py-2.5 px-3 text-right">Variance Qty</th>
                        <th className="py-2.5 px-3 text-right">Valuation Delta</th>
                        <th className="py-2.5 px-3">Reason Code</th>
                      </>
                    )}
                    <th className="py-2.5 px-3">Counter Notes & Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                  {filteredItems.map((item) => {
                    const isCounted = item.countedQty !== null;
                    const hasVar = isCounted && item.varianceQty !== 0;
                    const matchedItem = inventoryItems.find((i) => i.sku === item.sku);

                    return (
                      <tr 
                        key={item.sku} 
                        className={`transition-colors ${
                          hasVar ? 'bg-amber-50/40' : isCounted ? 'hover:bg-gray-50' : 'bg-gray-50/20'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (matchedItem) setStockCardItem(matchedItem);
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 group text-left"
                            title="Inspect Item Stock Card History"
                          >
                            <span>{item.sku}</span>
                            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">📊</span>
                          </button>
                          <span className="text-[10px] text-gray-500">{item.barcode}</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-gray-900">{item.name}</div>
                          <span className="text-[10px] text-gray-500 uppercase">{item.category}</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 text-[10px] font-mono">
                            {item.binLocation || 'Bay A-01'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-700">
                          ${item.unitCost.toFixed(2)}
                        </td>

                        {!activeSession.isBlindCount && (
                          <td className="py-2.5 px-3 text-right font-bold text-gray-800 bg-gray-100/60">
                            {item.bookQty}
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-right bg-blue-50/40">
                          {activeSession.status === 'COUNTING' ? (
                            <input
                              type="number"
                              min="0"
                              value={item.countedQty !== null ? item.countedQty : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value) || 0;
                                handleUpdateItemCount(item.sku, val);
                              }}
                              placeholder="—"
                              className="w-20 text-right font-mono font-bold border border-gray-300 bg-white px-2 py-1 text-xs focus:border-[#FF6B00] focus:outline-hidden"
                            />
                          ) : (
                            <span className="font-bold text-gray-900 text-xs">
                              {item.countedQty !== null ? item.countedQty : 'Uncounted'}
                            </span>
                          )}
                        </td>

                        {activeSession.status !== 'COUNTING' && (
                          <>
                            <td className={`py-2.5 px-3 text-right font-bold text-xs ${
                              item.varianceQty < 0 ? 'text-rose-600' : item.varianceQty > 0 ? 'text-amber-600' : 'text-emerald-700'
                            }`}>
                              {item.countedQty === null ? '—' : item.varianceQty === 0 ? '0' : `${item.varianceQty > 0 ? '+' : ''}${item.varianceQty}`}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold text-xs ${
                              item.varianceValuation < 0 ? 'text-rose-600' : item.varianceValuation > 0 ? 'text-amber-600' : 'text-emerald-700'
                            }`}>
                              {item.countedQty === null ? '—' : item.varianceValuation === 0 ? '$0.00' : `${item.varianceValuation > 0 ? '+' : '-'}$${Math.abs(item.varianceValuation).toFixed(2)}`}
                            </td>
                            <td className="py-2.5 px-3">
                              {hasVar ? (
                                activeSession.status === 'VARIANCE_REVIEW' ? (
                                  <select
                                    value={item.reasonCode || (item.varianceQty < 0 ? 'STOCK_SHORTAGE' : 'STOCK_OVERAGE')}
                                    onChange={(e) => handleUpdateItemReasonCode(item.sku, e.target.value as StocktakeVarianceReasonCode)}
                                    className="border border-amber-400 bg-white px-2 py-1 text-[10px] font-mono text-gray-900 focus:border-[#FF6B00] focus:outline-hidden"
                                  >
                                    <option value="STOCK_SHORTAGE">STOCK_SHORTAGE</option>
                                    <option value="STOCK_OVERAGE">STOCK_OVERAGE</option>
                                    <option value="COUNT_ERROR">COUNT_ERROR</option>
                                    <option value="DAMAGE_NOT_RECORDED">DAMAGE_NOT_RECORDED</option>
                                    <option value="BREAKAGE">BREAKAGE</option>
                                    <option value="SUPPLIER_VARIANCE">SUPPLIER_VARIANCE</option>
                                    <option value="TRANSFER_VARIANCE">TRANSFER_VARIANCE</option>
                                    <option value="RETURN_NOT_RECORDED">RETURN_NOT_RECORDED</option>
                                    <option value="UNEXPLAINED_SHORTAGE">UNEXPLAINED_SHORTAGE</option>
                                    <option value="WRONG_LOCATION">WRONG_LOCATION</option>
                                    <option value="DATA_CORRECTION">DATA_CORRECTION</option>
                                    <option value="OTHER">OTHER</option>
                                  </select>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-mono font-bold">
                                    {item.reasonCode || (item.varianceQty < 0 ? 'STOCK_SHORTAGE' : 'STOCK_OVERAGE')}
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-400 text-[10px]">—</span>
                              )}
                            </td>
                          </>
                        )}

                        <td className="py-2.5 px-3 font-sans">
                          {activeSession.status === 'COUNTING' ? (
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateItemCount(item.sku, item.countedQty, e.target.value)}
                              placeholder="Remarks (e.g. damaged box)..."
                              className="w-full text-xs border border-gray-300 px-2 py-1 focus:border-[#FF6B00] focus:outline-hidden"
                            />
                          ) : (
                            <span className="text-gray-600 text-xs italic">
                              {item.notes || (item.countedByStaffName ? `Counted by ${item.countedByStaffName}` : '—')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center border border-gray-200 shadow-2xs space-y-3">
          <Boxes className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-sm font-bold uppercase text-gray-700">No Stocktake Session Selected</h3>
          <p className="text-xs text-gray-500 font-mono">Create a new count session or select an existing audit session above.</p>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsStartModalOpen(true)}
            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold uppercase text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Start New Stocktake
          </Button>
        </div>
      )}

      {/* Start Modal */}
      <StartStocktakeModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        currentStaff={currentStaff}
        warehouses={warehouses}
        branches={branches}
        inventoryItems={inventoryItems}
        onCreateSession={(newSess) => {
          setSessions((prev) => [newSess, ...prev]);
          setActiveSessionId(newSess.id);
          setIsStartModalOpen(false);
          onSaveSession(newSess);
        }}
      />

      {/* Audit Slip Modal */}
      <StocktakeAuditSlipModal
        isOpen={isAuditSlipOpen}
        onClose={() => setIsAuditSlipOpen(false)}
        session={activeSession}
        currentStaff={currentStaff}
      />

      {/* Item Stock Card Modal */}
      {stockCardItem && (
        <ItemStockCardModal
          isOpen={!!stockCardItem}
          onClose={() => setStockCardItem(null)}
          item={stockCardItem}
          movements={inventoryMovements}
          currentStaff={currentStaff}
        />
      )}
    </div>
  );
};
