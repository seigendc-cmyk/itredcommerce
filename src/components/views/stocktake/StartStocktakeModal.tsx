import React, { useState } from 'react';
import { 
  Boxes, 
  Warehouse, 
  Store, 
  CheckCircle2, 
  X, 
  EyeOff, 
  Eye, 
  Filter, 
  ClipboardList 
} from 'lucide-react';
import { 
  StaffMember, 
  Warehouse as WarehouseType, 
  Branch, 
  InventoryItem, 
  StocktakeSession, 
  StocktakeCountItem 
} from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { INITIAL_DEPARTMENTS } from '../../../data/mockData';

export interface StartStocktakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffMember;
  warehouses: WarehouseType[];
  branches: Branch[];
  inventoryItems: InventoryItem[];
  onCreateSession: (session: StocktakeSession) => void;
}

export const StartStocktakeModal: React.FC<StartStocktakeModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  warehouses = [],
  branches = [],
  inventoryItems = [],
  onCreateSession,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState<string>('Cycle Count — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const [targetType, setTargetType] = useState<'WAREHOUSE' | 'BRANCH'>('BRANCH');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(branches?.[0]?.id || 'BR-01');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [isBlindCount, setIsBlindCount] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  const selectedLocation = targetType === 'WAREHOUSE' 
    ? warehouses?.find((w) => w.id === selectedLocationId) || warehouses?.[0] || { id: 'WH-01', name: 'Main Warehouse' }
    : branches?.find((b) => b.id === selectedLocationId) || branches?.[0] || { id: 'BR-01', name: 'Downtown Branch' };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter items belonging to department (or all)
    const filteredItems = (inventoryItems || []).filter((itm) => {
      if (!itm.isActive) return false;
      if (departmentFilter !== 'ALL' && itm.department !== departmentFilter) return false;
      return true;
    });

    const stockItems: StocktakeCountItem[] = filteredItems.map((itm) => ({
      sku: itm.sku,
      barcode: itm.barcode,
      name: itm.name,
      category: itm.department,
      binLocation: itm.binLocation || 'A-01',
      unitCost: itm.unitCost || 0,
      retailPrice: itm.retailPrice || 0,
      bookQty: itm.stockOnHand,
      expectedQtySnapshot: itm.stockOnHand,
      countedQty: null, // Uncounted initially
      varianceQty: 0,
      varianceValuation: 0,
    }));

    const sessionNum = `STK-${Date.now().toString().slice(-6)}`;
    const newSession: StocktakeSession = {
      id: `STK-${Date.now()}`,
      sessionNumber: sessionNum,
      title: title.trim() || `Physical Stocktake #${sessionNum}`,
      locationId: selectedLocation?.id || 'LOC-01',
      locationType: targetType,
      locationName: selectedLocation?.name || 'Main Location',
      departmentFilter: departmentFilter !== 'ALL' ? departmentFilter : undefined,
      isBlindCount,
      status: 'COUNTING',
      createdByStaffId: currentStaff.id,
      createdByStaffName: currentStaff.name,
      createdDateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      items: stockItems,
      totalExpectedUnits: stockItems.reduce((acc, i) => acc + i.bookQty, 0),
      totalCountedUnits: 0,
      totalVarianceUnits: 0,
      totalVarianceValuation: 0,
      approvalRequired: false,
      notes: notes.trim() || undefined,
    };

    onCreateSession(newSession);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FF6B00] flex items-center justify-center text-white font-bold text-sm">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                Initiate New Stocktake
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                Physical Inventory Count Session Setup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
              Stocktake Session Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Month-End Fast Moving Spares Audit..."
              className="w-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-[#FF6B00] focus:outline-hidden"
              required
            />
          </div>

          {/* Location Selection (Warehouse vs Branch) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
              Audit Location Type <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('BRANCH');
                  setSelectedLocationId(branches?.[0]?.id || '');
                }}
                className={`p-2.5 border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  targetType === 'BRANCH'
                    ? 'border-[#FF6B00] bg-amber-50/50 ring-1 ring-[#FF6B00]'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}
              >
                <Store className="w-4 h-4 text-[#FF6B00]" />
                <div>
                  <span className="font-bold text-xs block text-gray-900">Branch Retail Store</span>
                  <span className="text-[10px] text-gray-500">Sales floor registers & backroom</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType('WAREHOUSE');
                  setSelectedLocationId(warehouses?.[0]?.id || '');
                }}
                className={`p-2.5 border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  targetType === 'WAREHOUSE'
                    ? 'border-[#FF6B00] bg-amber-50/50 ring-1 ring-[#FF6B00]'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}
              >
                <Warehouse className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="font-bold text-xs block text-gray-900">Distribution Warehouse</span>
                  <span className="text-[10px] text-gray-500">Bulk racks & pallet staging bays</span>
                </div>
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Specific {targetType === 'WAREHOUSE' ? 'Warehouse' : 'Branch'} Facility:
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-[#FF6B00] focus:outline-hidden"
              >
                {targetType === 'WAREHOUSE'
                  ? warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code}) — {w.city}</option>
                    ))
                  : branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code}) — {b.city}</option>
                    ))}
              </select>
            </div>
          </div>

          {/* Department / Category Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
              Department Scope Filter
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-[#FF6B00] focus:outline-hidden"
            >
              <option value="ALL">Entire Catalog (All Departments)</option>
              {INITIAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Blind Count Toggle */}
          <div className="bg-gray-50 border border-gray-300 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isBlindCount}
                onChange={(e) => setIsBlindCount(e.target.checked)}
                className="mt-0.5 rounded-none border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00]"
              />
              <div>
                <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  Enforce Blind Count Mode
                </span>
                <p className="text-[11px] text-gray-500 leading-normal mt-0.5">
                  When enabled, expected system stock numbers are hidden from staff counters on the count sheet 
                  to prevent confirmation bias and ensure true physical counts.
                </p>
              </div>
            </label>
          </div>

          {/* Audit Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
              Audit Instructions / Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Count all open boxes and shelf display stock first..."
              className="w-full border border-gray-300 p-2 text-xs text-gray-900 resize-none focus:border-[#FF6B00] focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Generate Count Sheet & Begin Count
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
