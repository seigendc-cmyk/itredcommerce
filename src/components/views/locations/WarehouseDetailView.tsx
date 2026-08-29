import React, { useState } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  ArrowLeft, 
  PackageCheck, 
  Truck, 
  ClipboardCheck, 
  Sliders, 
  History, 
  Boxes, 
  Search, 
  Plus, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign,
  TrendingDown,
  Clock
} from 'lucide-react';
import { 
  Warehouse, 
  InventoryItem, 
  InventoryMovement, 
  StocktakeRecord, 
  StockAdjustmentRecord, 
  StaffMember 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface WarehouseDetailViewProps {
  warehouse: Warehouse;
  inventoryItems: InventoryItem[];
  movements: InventoryMovement[];
  stocktakes: StocktakeRecord[];
  adjustments: StockAdjustmentRecord[];
  currentStaff: StaffMember;
  onBackToList: () => void;
  onLaunchReceiveStock: (warehouseId: string) => void;
  onLaunchTransfer: (sourceWarehouseId: string) => void;
  onRecordAdjustment: (record: StockAdjustmentRecord) => void;
  onRecordStocktake: (record: StocktakeRecord) => void;
}

export const WarehouseDetailView: React.FC<WarehouseDetailViewProps> = ({
  warehouse,
  inventoryItems,
  movements,
  stocktakes,
  adjustments,
  currentStaff,
  onBackToList,
  onLaunchReceiveStock,
  onLaunchTransfer,
  onRecordAdjustment,
  onRecordStocktake,
}) => {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'STOCKTAKE' | 'ADJUSTMENTS' | 'HISTORY'>('INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Adjustment Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjSku, setAdjSku] = useState('');
  const [adjType, setAdjType] = useState<'WRITE_OFF_DAMAGE' | 'WRITE_OFF_SHRINKAGE' | 'MANUAL_WRITE_ON' | 'CORRECTION'>('WRITE_OFF_DAMAGE');
  const [adjQtyDelta, setAdjQtyDelta] = useState(-1);
  const [adjReason, setAdjReason] = useState('');

  // Stocktake Modal State
  const [isStocktakeModalOpen, setIsStocktakeModalOpen] = useState(false);
  const [stkItemsCount, setStkItemsCount] = useState(inventoryItems.length);
  const [stkCountedQty, setStkCountedQty] = useState(inventoryItems.reduce((a, b) => a + b.stockOnHand, 0));
  const [stkVarianceUnits, setStkVarianceUnits] = useState(0);
  const [stkNotes, setStkNotes] = useState('Scheduled periodic cycle count audit.');

  // Warehouse-filtered items and movements
  const warehouseItems = inventoryItems.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.location && i.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const warehouseMovements = movements.filter(m => 
    m.sourceLocationName?.includes(warehouse.name) ||
    m.sourceLocationName?.includes(warehouse.code) ||
    m.destinationLocationName?.includes(warehouse.name) ||
    m.destinationLocationName?.includes(warehouse.code)
  );

  const warehouseAdjustments = adjustments.filter(a => a.locationId === warehouse.id);
  const warehouseStocktakes = stocktakes.filter(s => s.locationId === warehouse.id);

  const totalStockUnits = inventoryItems.reduce((acc, i) => acc + (i.stockOnHand || 0), 0);
  const totalValuation = inventoryItems.reduce((acc, i) => acc + (i.stockOnHand || 0) * (i.unitCost ?? i.cost ?? 0), 0);

  const handleSaveAdjustment = () => {
    if (!adjSku || !adjReason) {
      alert('Please select an item and provide an audit adjustment reason.');
      return;
    }
    const itm = inventoryItems.find(i => i.sku === adjSku);
    if (!itm) return;

    const itemUnitCost = itm.unitCost ?? itm.cost ?? 0;
    const newAdj: StockAdjustmentRecord = {
      id: `ADJ-${Date.now().toString().slice(-4)}`,
      adjustmentNumber: `ADJ-2026-${String(warehouseAdjustments.length + 1).padStart(3, '0')}`,
      locationId: warehouse.id,
      locationType: 'WAREHOUSE',
      locationName: warehouse.name,
      sku: itm.sku,
      itemName: itm.name || itm.description,
      adjustmentType: adjType,
      quantityDelta: adjQtyDelta,
      unitCost: itemUnitCost,
      totalDeltaValue: adjQtyDelta * itemUnitCost,
      staffName: currentStaff.name,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      reason: adjReason,
    };

    onRecordAdjustment(newAdj);
    setIsAdjModalOpen(false);
    setAdjSku('');
    setAdjReason('');
    setAlertNotice(`Stock adjustment ${newAdj.adjustmentNumber} posted successfully.`);
    setTimeout(() => setAlertNotice(null), 3500);
  };

  const handleSaveStocktake = () => {
    const bookQty = inventoryItems.reduce((a, b) => a + b.stockOnHand, 0);
    const deltaVal = stkVarianceUnits * 20.0; // average unit cost approximation

    const newStk: StocktakeRecord = {
      id: `STK-${Date.now().toString().slice(-4)}`,
      batchNo: `STK-2026-${warehouse.code}-Q3`,
      locationId: warehouse.id,
      locationType: 'WAREHOUSE',
      locationName: warehouse.name,
      date: new Date().toISOString().split('T')[0],
      auditorStaffName: currentStaff.name,
      status: 'COMPLETED',
      itemsCount: stkItemsCount,
      countedQty: stkCountedQty,
      bookQty: bookQty,
      varianceUnits: stkVarianceUnits,
      valuationDelta: deltaVal,
      notes: stkNotes,
    };

    onRecordStocktake(newStk);
    setIsStocktakeModalOpen(false);
    setAlertNotice(`Stocktake audit ${newStk.batchNo} recorded and reconciled.`);
    setTimeout(() => setAlertNotice(null), 3500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 border border-slate-800 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToList}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            >
              All Warehouses
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 text-white flex items-center justify-center font-bold">
                <WarehouseIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    {warehouse.name} ({warehouse.code})
                  </h2>
                  {warehouse.isDefault && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-orange-500/30 text-orange-300 border border-orange-500/50 uppercase">
                      Primary Distribution Hub
                    </span>
                  )}
                  <StatusBadge status={warehouse.status} size="sm" />
                </div>
                <p className="text-[10px] font-mono text-slate-400">
                  {warehouse.address} • Manager: {warehouse.managerName} ({warehouse.contactPhone})
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLaunchReceiveStock(warehouse.id)}
              leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white font-bold"
            >
              Receive Freight
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLaunchTransfer(warehouse.id)}
              leftIcon={<Truck className="w-3.5 h-3.5" />}
              className="bg-orange-600 hover:bg-orange-700 border-orange-700 text-white font-bold"
            >
              Dispatch Transfer
            </Button>
          </div>
        </div>

        {/* Operational Scope Notice */}
        <div className="bg-slate-800/80 border border-slate-700 p-2.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              <strong className="text-white">Warehouse Rules Enforced:</strong> Terminals & POS Cashier Carts are restricted to retail/commercial branches. Direct customer checkout is not conducted in warehouse hubs.
            </span>
          </div>
          <div className="text-right font-mono text-[11px]">
            Capacity: <span className="text-white font-bold">{warehouse.totalCapacitySqM} m²</span> • Valuation: <span className="text-emerald-400 font-bold">${totalValuation.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {alertNotice && (
        <Alert
          type="info"
          message={alertNotice}
          onClose={() => setAlertNotice(null)}
        />
      )}

      {/* Warehouse Tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-2 border border-slate-300">
        {[
          { id: 'INVENTORY', label: 'Warehouse SOH Inventory', count: warehouseItems.length, icon: <Boxes className="w-3.5 h-3.5" /> },
          { id: 'STOCKTAKE', label: 'Stocktake & Physical Audits', count: warehouseStocktakes.length, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
          { id: 'ADJUSTMENTS', label: 'Stock Adjustments (Write-offs / Ons)', count: warehouseAdjustments.length, icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'HISTORY', label: 'Warehouse Movement Journal', count: warehouseMovements.length, icon: <History className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer rounded-none border ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-orange-400' : 'text-slate-500'}>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 text-[10px] font-mono ${
              activeTab === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: INVENTORY */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by SKU, description, bin location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsAdjModalOpen(true)}
                leftIcon={<Sliders className="w-3 h-3 text-amber-600" />}
              >
                Log Stock Adjustment
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsStocktakeModalOpen(true)}
                leftIcon={<ClipboardCheck className="w-3 h-3 text-blue-600" />}
              >
                Perform Stocktake
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Bin Location</th>
                  <th className="p-2.5 text-center">Stock on Hand</th>
                  <th className="p-2.5 text-right">Unit Cost</th>
                  <th className="p-2.5 text-right">Total Valuation</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {warehouseItems.map((item) => {
                  const itemUnitCost = item.unitCost ?? item.cost ?? 0;
                  const lineVal = (item.stockOnHand || 0) * itemUnitCost;
                  const isLow = (item.stockOnHand || 0) <= (item.reorderLevel ?? item.reorderPoint ?? 0);
                  return (
                    <tr key={item.sku} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-800">{item.name}</td>
                      <td className="p-2.5 text-slate-600">{item.category}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 text-[10px]">
                          {item.location || 'Bay A-01'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.stockOnHand} {item.unitOfMeasure}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">${itemUnitCost.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">${lineVal.toFixed(2)}</td>
                      <td className="p-2.5 text-center">
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => onLaunchTransfer(warehouse.id)}
                        >
                          Transfer to Branch
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STOCKTAKE */}
      {activeTab === 'STOCKTAKE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-slate-300 p-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Physical Inventory Audits for {warehouse.name}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Verify physical counts against book stock balances and record variance adjustments
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStocktakeModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-slate-900 text-white font-bold"
            >
              Start New Stocktake Cycle
            </Button>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Batch #</th>
                  <th className="p-2.5">Audit Date</th>
                  <th className="p-2.5">Lead Auditor</th>
                  <th className="p-2.5 text-center">Items Audited</th>
                  <th className="p-2.5 text-center">Counted Qty</th>
                  <th className="p-2.5 text-center">Book Qty</th>
                  <th className="p-2.5 text-center">Variance (Units)</th>
                  <th className="p-2.5 text-right">Valuation Impact</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {warehouseStocktakes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                      No stocktakes logged for this warehouse facility.
                    </td>
                  </tr>
                ) : (
                  warehouseStocktakes.map((stk) => (
                    <tr key={stk.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{stk.batchNo}</td>
                      <td className="p-2.5 text-slate-600">{stk.date}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-800">{stk.auditorStaffName}</td>
                      <td className="p-2.5 text-center">{stk.itemsCount} SKUs</td>
                      <td className="p-2.5 text-center font-bold text-slate-900">{stk.countedQty}</td>
                      <td className="p-2.5 text-center text-slate-600">{stk.bookQty}</td>
                      <td className="p-2.5 text-center">
                        <span className={`font-bold ${
                          stk.varianceUnits > 0 ? 'text-emerald-600' :
                          stk.varianceUnits < 0 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {stk.varianceUnits > 0 ? `+${stk.varianceUnits}` : stk.varianceUnits}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold">
                        ${stk.valuationDelta.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <StatusBadge status={stk.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADJUSTMENTS */}
      {activeTab === 'ADJUSTMENTS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-slate-300 p-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Stock Adjustments & Write-Off Log
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Damage write-offs, shrinkage adjustments, and manual warehouse stock corrections
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAdjModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              Post Stock Adjustment
            </Button>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Adjustment #</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5 text-center">Qty Delta</th>
                  <th className="p-2.5 text-right">Unit Cost</th>
                  <th className="p-2.5 text-right">Value Delta</th>
                  <th className="p-2.5">Operator</th>
                  <th className="p-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {warehouseAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                      No stock adjustments on file for this warehouse.
                    </td>
                  </tr>
                ) : (
                  warehouseAdjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{adj.adjustmentNumber}</td>
                      <td className="p-2.5 text-slate-600">{adj.date}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{adj.sku}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{adj.itemName}</div>
                      </td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 border border-slate-300 text-slate-800 uppercase">
                          {adj.adjustmentType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        <span className={adj.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {adj.quantityDelta > 0 ? `+${adj.quantityDelta}` : adj.quantityDelta}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">${adj.unitCost.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold">
                        <span className={adj.totalDeltaValue < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          ${adj.totalDeltaValue.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans">{adj.staffName}</td>
                      <td className="p-2.5 text-slate-600 font-sans">{adj.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MOVEMENT HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-300 p-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Warehouse Movement Audit Journal
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Complete audit trail of freight inward, transfer dispatch, and inventory corrections
            </p>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Movement Type</th>
                  <th className="p-2.5">SKU & Item</th>
                  <th className="p-2.5 text-center">Quantity</th>
                  <th className="p-2.5 text-right">Value ($)</th>
                  <th className="p-2.5">Source / Destination</th>
                  <th className="p-2.5">Reference Doc</th>
                  <th className="p-2.5">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {warehouseMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                      No movement history records logged for this facility.
                    </td>
                  </tr>
                ) : (
                  warehouseMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-600">{mov.timestamp}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border ${
                          mov.movementType === 'Supplier Receipt' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          mov.movementType === 'Transfer Out' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          mov.movementType === 'Transfer In' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          'bg-purple-100 text-purple-800 border-purple-300'
                        }`}>
                          {mov.movementType}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{mov.sku}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{mov.itemName}</div>
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        <span className={mov.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold">
                        ${mov.totalValue.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-slate-700 font-sans text-[11px]">
                        <div>From: {mov.sourceLocationName || '—'}</div>
                        <div>To: {mov.destinationLocationName || '—'}</div>
                      </td>
                      <td className="p-2.5 font-bold text-slate-800">{mov.referenceDocument}</td>
                      <td className="p-2.5 font-sans">{mov.staffName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title={`Log Warehouse Stock Adjustment [${warehouse.name}]`}
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Item to Adjust *</label>
            <select
              value={adjSku}
              onChange={(e) => setAdjSku(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="">Select Item from Product Master...</option>
              {inventoryItems.map(i => (
                <option key={i.sku} value={i.sku}>
                  [{i.sku}] {i.name} (Current SOH: {i.stockOnHand})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Adjustment Type</label>
              <select
                value={adjType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setAdjType(val);
                  if (val.includes('WRITE_OFF')) {
                    setAdjQtyDelta(-1);
                  } else {
                    setAdjQtyDelta(1);
                  }
                }}
                className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="WRITE_OFF_DAMAGE">Write-Off: Damaged Goods (-)</option>
                <option value="WRITE_OFF_SHRINKAGE">Write-Off: Shrinkage / Theft (-)</option>
                <option value="MANUAL_WRITE_ON">Write-On: Found Stock (+)</option>
                <option value="CORRECTION">Manual Balance Correction</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Quantity Delta (Units) *</label>
              <Input
                type="number"
                value={adjQtyDelta}
                onChange={(e) => setAdjQtyDelta(parseInt(e.target.value) || 0)}
                className="font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Audit Reason & Manager Authorization *</label>
            <Input
              type="text"
              placeholder="e.g. Pallet forklift puncture during rack staging"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAdjustment}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              Commit Adjustment
            </Button>
          </div>
        </div>
      </Modal>

      {/* STOCKTAKE MODAL */}
      <Modal
        isOpen={isStocktakeModalOpen}
        onClose={() => setIsStocktakeModalOpen(false)}
        title={`Initiate Physical Stocktake Audit [${warehouse.name}]`}
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Items Counted (SKUs)</label>
              <Input
                type="number"
                value={stkItemsCount}
                onChange={(e) => setStkItemsCount(parseInt(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Physical Counted Qty</label>
              <Input
                type="number"
                value={stkCountedQty}
                onChange={(e) => {
                  const cnt = parseInt(e.target.value) || 0;
                  setStkCountedQty(cnt);
                  setStkVarianceUnits(cnt - totalStockUnits);
                }}
                className="font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Audit Notes & Cycle Area</label>
            <Input
              type="text"
              value={stkNotes}
              onChange={(e) => setStkNotes(e.target.value)}
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Current System Book SOH:</span>
              <span className="font-bold">{totalStockUnits} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Calculated Count Variance:</span>
              <span className={`font-bold ${stkVarianceUnits < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stkVarianceUnits > 0 ? `+${stkVarianceUnits}` : stkVarianceUnits} units
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStocktakeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveStocktake}
              className="bg-slate-900 text-white font-bold"
            >
              Reconcile & Finalize Audit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
