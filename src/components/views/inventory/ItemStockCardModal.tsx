import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Filter, 
  Calendar, 
  MapPin, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Tag, 
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  DollarSign,
  PackageCheck
} from 'lucide-react';
import { InventoryItem, InventoryMovement, StaffMember } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';

export interface ItemStockCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  movements: InventoryMovement[];
  currentStaff: StaffMember;
  onOpenAdjustment?: (item: InventoryItem) => void;
}

export const ItemStockCardModal: React.FC<ItemStockCardModalProps> = ({
  isOpen,
  onClose,
  item,
  movements,
  currentStaff,
  onOpenAdjustment,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [movementFilter, setMovementFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [inspectedMovement, setInspectedMovement] = useState<InventoryMovement | null>(null);

  // Filter movements for this specific item
  const itemMovements = useMemo(() => {
    if (!item) return [];
    
    // Sort chronologically ascending to calculate running balance
    const filtered = movements
      .filter((m) => m.sku === item.sku)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return filtered;
  }, [item, movements]);

  // Calculate Running Balance Chronologically
  const enrichedMovements = useMemo(() => {
    let runningBalance = 0;
    
    return itemMovements.map((mov) => {
      // If movement is specific to a location or global
      const qty = mov.quantity;
      runningBalance += qty;
      
      return {
        ...mov,
        runningBalanceAfter: runningBalance,
      };
    });
  }, [itemMovements]);

  // Apply UI Filters to the enriched ledger
  const displayedMovements = useMemo(() => {
    let result = [...enrichedMovements];

    if (selectedLocation !== 'ALL') {
      result = result.filter(
        (m) =>
          m.sourceLocationId === selectedLocation ||
          m.destinationLocationId === selectedLocation ||
          (m.sourceLocationName && m.sourceLocationName.toLowerCase().includes(selectedLocation.toLowerCase())) ||
          (m.destinationLocationName && m.destinationLocationName.toLowerCase().includes(selectedLocation.toLowerCase()))
      );
    }

    if (movementFilter === 'INBOUND') {
      result = result.filter((m) => m.quantity > 0);
    } else if (movementFilter === 'OUTBOUND') {
      result = result.filter((m) => m.quantity < 0);
    } else if (movementFilter === 'STOCKTAKE') {
      result = result.filter((m) => m.movementType.toLowerCase().includes('stocktake'));
    } else if (movementFilter === 'TRANSFERS') {
      result = result.filter((m) => m.movementType.toLowerCase().includes('transfer'));
    } else if (movementFilter === 'ADJUSTMENTS') {
      result = result.filter((m) => 
        m.movementType.toLowerCase().includes('adjustment') || 
        m.movementType.toLowerCase().includes('damage') || 
        m.movementType.toLowerCase().includes('write-off')
      );
    }

    // Sort descending for display (most recent first)
    return result.reverse();
  }, [enrichedMovements, selectedLocation, movementFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalAdjustments = 0;

    itemMovements.forEach((m) => {
      if (m.movementType.toLowerCase().includes('stocktake') || m.movementType.toLowerCase().includes('adjustment')) {
        totalAdjustments += m.quantity;
      } else if (m.quantity > 0) {
        totalIn += m.quantity;
      } else {
        totalOut += Math.abs(m.quantity);
      }
    });

    const calculatedBalance = enrichedMovements.length > 0 
      ? enrichedMovements[enrichedMovements.length - 1].runningBalanceAfter 
      : (item?.stockOnHand || 0);

    return {
      totalIn,
      totalOut,
      totalAdjustments,
      calculatedBalance,
      valuation: calculatedBalance * (item?.unitCost || 0),
    };
  }, [itemMovements, enrichedMovements, item]);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Reference', 'Source', 'Destination', 'Qty Delta', 'Running Balance', 'Unit Cost', 'Value Impact', 'Staff', 'Notes'];
    const rows = displayedMovements.map((m) => [
      m.timestamp,
      m.movementType,
      m.referenceDocument,
      m.sourceLocationName || '-',
      m.destinationLocationName || '-',
      m.quantity,
      m.runningBalanceAfter,
      (m.unitCost || item.unitCost).toFixed(2),
      (m.totalValue || Math.abs(m.quantity * (m.unitCost || item.unitCost))).toFixed(2),
      m.staffName,
      `"${(m.notes || m.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Card_${item.sku}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="2xl"
    >
      <div className="space-y-4 -mt-3">
        {/* Header Ribbon */}
        <div className="bg-slate-900 text-white p-4 -mx-6 -mt-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xs shrink-0 shadow-xs">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-0.5 text-amber-400 border border-slate-700">
                  {item.sku}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  BARCODE: {item.barcode || 'N/A'}
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  | {item.department || item.category || 'General'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight mt-0.5">
                {item.name || item.description}
              </h2>
              <p className="text-xs text-slate-400">
                Audited Perpetual Stock Movement Ledger & Physical Reconstructed Balance Card
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-center">
            {onOpenAdjustment && (
              <Button
                variant="outline"
                size="sm"
                className="bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold"
                onClick={() => {
                  onClose();
                  onOpenAdjustment(item);
                }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                Adjust Stock
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-xs"
              onClick={handleExportCSV}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-xs"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Master Stock Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Ledger Balance
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">
                {metrics.calculatedBalance}
              </span>
              <span className="text-xs font-bold text-slate-600">units</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Reconstructed from ledger
            </span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Total Inbound (+)
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-800">
                +{metrics.totalIn}
              </span>
              <span className="text-xs font-bold text-emerald-700">units</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-mono mt-0.5 block">
              Receipts & Transfers In
            </span>
          </div>

          <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Total Outbound (-)
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-blue-800">
                -{metrics.totalOut}
              </span>
              <span className="text-xs font-bold text-blue-700">units</span>
            </div>
            <span className="text-[10px] text-blue-600 font-mono mt-0.5 block">
              POS Sales & Dispatches
            </span>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Net Adjustments
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-amber-900">
                {metrics.totalAdjustments > 0 ? `+${metrics.totalAdjustments}` : metrics.totalAdjustments}
              </span>
              <span className="text-xs font-bold text-amber-800">units</span>
            </div>
            <span className="text-[10px] text-amber-700 font-mono mt-0.5 block">
              Stocktake & Write-offs
            </span>
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-xs col-span-2 sm:col-span-1 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Holding Value
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-amber-400">
                ${metrics.valuation.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              Basis: ${item.unitCost.toFixed(2)} / unit
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-100 p-2.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-700">Location:</span>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-white border border-slate-300 px-2 py-1 text-xs font-mono rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
              >
                <option value="ALL">All Network Facilities</option>
                <option value="WH-01">WH-01 (Central Warehouse)</option>
                <option value="BR-01">BR-01 (Downtown Branch)</option>
                <option value="BR-02">BR-02 (Westside Trade Counter)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-700">Flow:</span>
              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value)}
                className="bg-white border border-slate-300 px-2 py-1 text-xs font-mono rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
              >
                <option value="ALL">All Activity Types</option>
                <option value="INBOUND">Inbound Only (+)</option>
                <option value="OUTBOUND">Outbound Only (-)</option>
                <option value="STOCKTAKE">Stocktake Variances</option>
                <option value="TRANSFERS">Inter-Branch Transfers</option>
                <option value="ADJUSTMENTS">Manual Adjustments & Damages</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Showing <strong className="text-slate-900">{displayedMovements.length}</strong> audited movement ledger entries
          </div>
        </div>

        {/* Chronological Movement Ledger Table */}
        <div className="border border-slate-200 overflow-x-auto max-h-[380px] overflow-y-auto bg-white">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Movement Type</th>
                <th className="py-2.5 px-3">Document Ref</th>
                <th className="py-2.5 px-3">Source &rarr; Destination</th>
                <th className="py-2.5 px-3 text-right">Quantity Delta</th>
                <th className="py-2.5 px-3 text-right bg-slate-200/50">Running Stock</th>
                <th className="py-2.5 px-3 text-right">Valuation Impact</th>
                <th className="py-2.5 px-3">Operator / Authorizer</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {displayedMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No inventory movement records match the selected filters.
                  </td>
                </tr>
              ) : (
                displayedMovements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  const isZero = mov.quantity === 0;

                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                      onClick={() => setInspectedMovement(mov)}
                    >
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {mov.timestamp}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase ${
                          mov.movementType.toLowerCase().includes('receipt') || mov.movementType.toLowerCase().includes('return in')
                            ? 'bg-emerald-100 text-emerald-800'
                            : mov.movementType.toLowerCase().includes('sale')
                            ? 'bg-blue-100 text-blue-800'
                            : mov.movementType.toLowerCase().includes('stocktake')
                            ? 'bg-purple-100 text-purple-800'
                            : mov.movementType.toLowerCase().includes('damage') || mov.movementType.toLowerCase().includes('write-off')
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {mov.movementType}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {mov.referenceDocument || mov.referenceId || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-sans text-xs whitespace-nowrap">
                        <span className="truncate max-w-[140px] inline-block align-middle" title={mov.sourceLocationName}>
                          {mov.sourceLocationName || 'Warehouse / Facility'}
                        </span>
                        <span className="text-slate-400 mx-1">&rarr;</span>
                        <span className="truncate max-w-[140px] inline-block align-middle font-medium text-slate-800" title={mov.destinationLocationName}>
                          {mov.destinationLocationName || 'Branch / Customer'}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                        isPositive ? 'text-emerald-700' : isZero ? 'text-slate-500' : 'text-rose-700'
                      }`}>
                        {isPositive ? `+${mov.quantity}` : mov.quantity}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-50/80 whitespace-nowrap">
                        {mov.runningBalanceAfter}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                        ${(Math.abs(mov.quantity) * (mov.unitCost || item.unitCost)).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-sans text-xs whitespace-nowrap">
                        {mov.staffName}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 px-1.5 text-slate-500 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedMovement(mov);
                          }}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Movement Detail Inspection Modal Drawer */}
        {inspectedMovement && (
          <div className="bg-slate-50 border border-slate-300 p-3.5 rounded-xs space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900 uppercase font-mono">
                  Movement Audit Voucher: {inspectedMovement.id}
                </span>
              </div>
              <button
                onClick={() => setInspectedMovement(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Recorded Timestamp</span>
                <span className="font-bold text-slate-800">{inspectedMovement.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Reference Document</span>
                <span className="font-bold text-slate-800">{inspectedMovement.referenceDocument}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Authorized Staff</span>
                <span className="font-bold text-slate-800">{inspectedMovement.staffName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Unit Cost / Valuation</span>
                <span className="font-bold text-slate-800">
                  ${(inspectedMovement.unitCost || item.unitCost).toFixed(2)} / ${(inspectedMovement.totalValue || Math.abs(inspectedMovement.quantity * (inspectedMovement.unitCost || item.unitCost))).toFixed(2)}
                </span>
              </div>
            </div>

            {(inspectedMovement.notes || inspectedMovement.reason || inspectedMovement.approvalRef) && (
              <div className="bg-white p-2.5 border border-slate-200 text-slate-700 font-sans text-xs">
                <span className="font-bold text-slate-900 block mb-0.5">Audit Reason & Notes:</span>
                <p className="text-slate-600">{inspectedMovement.notes || inspectedMovement.reason || 'Standard operational transaction.'}</p>
                {inspectedMovement.approvalRef && (
                  <span className="inline-block mt-1 font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 border border-amber-200">
                    Authorization Code: {inspectedMovement.approvalRef}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            Stock card adheres to Double-Entry Inventory Ledger & GAAP Asset Standards
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="px-5 font-bold"
          >
            Close Card
          </Button>
        </div>
      </div>
    </Modal>
  );
};
