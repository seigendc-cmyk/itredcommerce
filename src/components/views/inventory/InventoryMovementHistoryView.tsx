import React, { useState } from 'react';
import { 
  History, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Warehouse as WarehouseIcon, 
  Building2, 
  FileText, 
  Truck, 
  PackageCheck, 
  ShoppingBag, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw,
  Printer,
  ShieldCheck,
  DollarSign
} from 'lucide-react';
import { InventoryMovement, InventoryMovementType, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';

export interface InventoryMovementHistoryViewProps {
  movements: InventoryMovement[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
}

export const InventoryMovementHistoryView: React.FC<InventoryMovementHistoryViewProps> = ({
  movements,
  currentStaff,
  onBackToLanding,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const movementTypes: string[] = [
    'ALL',
    'Supplier Receipt',
    'Warehouse Transfer Out',
    'Branch Transfer In',
    'POS Sale',
    'Sale Return',
    'Supplier Return',
    'Stocktake Adjustment',
    'Damage',
    'Write-off',
    'Approved Manual Adjustment',
    'Transfer Out',
    'Transfer In',
  ];

  const filteredMovements = movements.filter(m => {
    const matchesSearch = 
      m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.referenceDocument.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.sourceLocationName && m.sourceLocationName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.destinationLocationName && m.destinationLocationName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.reason && m.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.approvalRef && m.approvalRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      m.staffName.toLowerCase().includes(searchTerm.toLowerCase());

    if (typeFilter === 'ALL') return matchesSearch;
    return matchesSearch && m.movementType === typeFilter;
  });

  const totalReceiptsVal = movements
    .filter(m => m.movementType === 'Supplier Receipt')
    .reduce((acc, m) => acc + m.totalValue, 0);

  const totalSalesVal = movements
    .filter(m => m.movementType === 'POS Sale')
    .reduce((acc, m) => acc + m.totalValue, 0);

  const totalTransfersUnits = movements
    .filter(m => m.movementType === 'Transfer Out' || m.movementType === 'Transfer In')
    .reduce((acc, m) => acc + Math.abs(m.quantity), 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Top Header */}
      <div className="bg-slate-900 text-white p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Landing
          </Button>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <History className="w-4 h-4 text-orange-400" />
              Inventory Movement History & Audit Trail
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Enterprise Stock Ingestion, Inter-Facility Transfers, Adjustments & POS Dispensation Journal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Print Movement Ledger
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Journal Entries</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{movements.length} Transactions</div>
          </div>
          <FileText className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Supplier Receipts Value</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">${totalReceiptsVal.toFixed(2)}</div>
          </div>
          <PackageCheck className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-blue-600">Transferred Units</div>
            <div className="text-lg font-bold text-blue-600 font-mono">{totalTransfersUnits} units</div>
          </div>
          <Truck className="w-6 h-6 text-blue-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Dispensed POS Sales</div>
            <div className="text-lg font-bold text-slate-900 font-mono">${totalSalesVal.toFixed(2)}</div>
          </div>
          <ShoppingBag className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search movement SKU, description, document #, staff, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {movementTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-xs font-mono font-medium transition-colors border whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Movement Ledger Table */}
      <div className="bg-white border border-slate-300 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase text-[11px]">
              <th className="p-2.5">Date & Time</th>
              <th className="p-2.5">Movement Type</th>
              <th className="p-2.5">SKU & Item Name</th>
              <th className="p-2.5 text-center">Quantity Delta</th>
              <th className="p-2.5 text-right">Unit Cost</th>
              <th className="p-2.5 text-right">Total Impact</th>
              <th className="p-2.5">Source Facility</th>
              <th className="p-2.5">Destination</th>
              <th className="p-2.5">Reference Document</th>
              <th className="p-2.5">Reason / Notes</th>
              <th className="p-2.5">Authorized Staff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                  No inventory movement records match your search criteria.
                </td>
              </tr>
            ) : (
              filteredMovements.map((mov) => {
                const isPositive = mov.quantity > 0;
                return (
                  <tr key={mov.id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-600 whitespace-nowrap">{mov.timestamp}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border whitespace-nowrap ${
                        mov.movementType === 'Supplier Receipt' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        mov.movementType === 'Transfer In' || mov.movementType === 'Branch Transfer In' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        mov.movementType === 'Transfer Out' || mov.movementType === 'Warehouse Transfer Out' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        mov.movementType === 'POS Sale' || mov.movementType === 'Sale' ? 'bg-slate-100 text-slate-800 border-slate-300' :
                        mov.movementType === 'Damage' || mov.movementType === 'Write-off' ? 'bg-red-100 text-red-800 border-red-300' :
                        'bg-purple-100 text-purple-800 border-purple-300'
                      }`}>
                        {mov.movementType}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{mov.sku}</div>
                      <div className="text-[10px] text-slate-500 font-sans">{mov.itemName}</div>
                    </td>
                    <td className="p-2.5 text-center font-bold text-sm">
                      <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                        {isPositive ? `+${mov.quantity}` : mov.quantity}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">${mov.unitCost.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">
                      ${mov.totalValue.toFixed(2)}
                    </td>
                    <td className="p-2.5 font-sans text-slate-700 text-[11px]">
                      {mov.sourceLocationName || 'External Supplier'}
                    </td>
                    <td className="p-2.5 font-sans text-slate-700 text-[11px]">
                      {mov.destinationLocationName || 'Customer Checkout'}
                    </td>
                    <td className="p-2.5 font-bold text-orange-600">{mov.referenceDocument}</td>
                    <td className="p-2.5 font-sans text-slate-600 text-[11px] max-w-[160px]">
                      {mov.reason || mov.notes || 'Routine business transaction'}
                      {mov.approvalRef && (
                        <div className="text-[10px] text-emerald-700 font-mono font-bold">
                          Appr: {mov.approvalRef}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 font-sans text-slate-800">{mov.staffName}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
