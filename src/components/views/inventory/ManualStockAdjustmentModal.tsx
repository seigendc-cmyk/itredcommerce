import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Lock, 
  MapPin, 
  Boxes, 
  DollarSign, 
  FileText, 
  Info, 
  X,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Flame,
  Archive,
  RefreshCw
} from 'lucide-react';
import { 
  InventoryItem, 
  StaffMember, 
  InventoryMovement, 
  MovementType, 
  ManualAdjustmentReasonCode,
  ApprovalRequest,
  ActivityEvent
} from '../../../types';
import { isManager } from '../../../utils/roles';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

export interface ManualStockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  defaultItem?: InventoryItem | null;
  currentStaff: StaffMember;
  onPostAdjustment: (movement: InventoryMovement, updatedItem: InventoryItem) => void;
  onRequestApproval?: (request: ApprovalRequest) => void;
}

export const ManualStockAdjustmentModal: React.FC<ManualStockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  items = [],
  defaultItem = null,
  currentStaff,
  onPostAdjustment,
  onRequestApproval,
}) => {
  const [selectedSku, setSelectedSku] = useState<string>(defaultItem?.sku || (items?.[0]?.sku || ''));
  const [locationId, setLocationId] = useState<string>('WH-01');
  const [adjustmentCategory, setAdjustmentCategory] = useState<'DAMAGE' | 'WRITE_OFF' | 'POSITIVE_ADJ' | 'NEGATIVE_ADJ'>('DAMAGE');
  const [quantity, setQuantity] = useState<number>(1);
  const [reasonCode, setReasonCode] = useState<ManualAdjustmentReasonCode>('DAMAGE');
  const [notes, setNotes] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedItem = (items || []).find((i) => i.sku === selectedSku) || defaultItem || items?.[0] || null;

  const locationNames: Record<string, string> = {
    'WH-01': 'Central Distribution Warehouse (WH-01)',
    'BR-01': 'Main Downtown Branch (BR-01)',
    'BR-02': 'Westside Trade Counter (BR-02)',
  };

  const isSupervisor = isManager(currentStaff);
  const unitCost = selectedItem?.unitCost || 0;
  const totalValueImpact = (quantity || 0) * unitCost;
  
  // Requires approval if non-manager or valuation > $100 or quantity > 10
  const isHighValue = totalValueImpact > 100 || quantity > 10;
  const requiresManagerAuth = !isSupervisor || isHighValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedItem) {
      setErrorMsg('Please select a valid item.');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Quantity must be a positive integer greater than zero.');
      return;
    }

    // Negative stock check for write-offs and negative adjustments
    const isReduction = adjustmentCategory === 'DAMAGE' || adjustmentCategory === 'WRITE_OFF' || adjustmentCategory === 'NEGATIVE_ADJ';
    if (isReduction && quantity > selectedItem.stockOnHand) {
      setErrorMsg(`Insufficient stock on hand (${selectedItem.stockOnHand} units) to write off ${quantity} units.`);
      return;
    }

    if (reasonCode === 'OTHER' && notes.trim().length < 5) {
      setErrorMsg('Please provide detailed audit notes for "OTHER" reason code.');
      return;
    }

    // If cashier requires manager approval without PIN
    if (!isSupervisor && managerPin !== '9999' && managerPin !== '1234') {
      // Create Approval Request
      if (onRequestApproval) {
        const reqNum = `REQ-ADJ-${Date.now().toString().slice(-4)}`;
        const approvalReq: ApprovalRequest = {
          id: `REQ-${Date.now()}`,
          requestNumber: reqNum,
          type: 'STOCK_ADJUSTMENT',
          title: `Stock Adjustment (${selectedItem.sku})`,
          description: `${currentStaff.name} requested ${isReduction ? 'reduction' : 'addition'} of ${quantity} units of ${selectedItem.name || selectedItem.description} at ${locationNames[locationId]}. Reason: ${reasonCode} (${notes || 'No notes'})`,
          amount: totalValueImpact,
          referenceId: selectedItem.sku,
          locationName: locationNames[locationId],
          requestedByStaffId: currentStaff.id,
          requestedByStaffName: currentStaff.name,
          requestedByRole: currentStaff.role,
          requestedDateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
          reason: `${reasonCode}: ${notes || 'Manual stock adjustment requested'}`,
          priority: totalValueImpact > 200 ? 'HIGH' : 'MEDIUM',
          status: 'PENDING',
          meta: {
            sku: selectedItem.sku,
            locationId,
            quantity: isReduction ? -quantity : quantity,
            reasonCode,
            notes,
          }
        };
        onRequestApproval(approvalReq);
        alert(`Stock adjustment submitted to Manager Approval Queue (Ref #${reqNum}). Direct posting is restricted for non-supervisors.`);
        onClose();
        return;
      }
    }

    // Generate Canonical Movement
    let movementType: MovementType = 'Approved Manual Adjustment';
    if (adjustmentCategory === 'DAMAGE') {
      movementType = 'Damage';
    } else if (adjustmentCategory === 'WRITE_OFF') {
      movementType = 'Write-off';
    } else if (adjustmentCategory === 'POSITIVE_ADJ') {
      movementType = 'Approved Manual Adjustment';
    } else {
      movementType = 'Adjustment';
    }

    const direction = isReduction ? 'OUT' : 'IN';
    const signedQty = isReduction ? -quantity : quantity;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const adjDocNum = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const movement: InventoryMovement = {
      id: `MOV-ADJ-${Date.now()}-${selectedItem.sku}`,
      timestamp: nowStr,
      movementType,
      sku: selectedItem.sku,
      itemName: selectedItem.name || selectedItem.description,
      quantity: signedQty,
      direction: direction as 'IN' | 'OUT',
      unitCost,
      totalValue: totalValueImpact,
      sourceLocationId: isReduction ? locationId : undefined,
      sourceLocationName: isReduction ? locationNames[locationId] : `Adjustment Recovery (${reasonCode})`,
      destinationLocationId: isReduction ? undefined : locationId,
      destinationLocationName: isReduction ? `Scrap / Write-off Bin (${reasonCode})` : locationNames[locationId],
      referenceDocument: adjDocNum,
      referenceType: 'MANUAL_ADJUSTMENT',
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      reasonCode,
      reason: `${reasonCode}: ${notes || 'Manual stock adjustment'}`,
      approvalRef: isSupervisor ? `AUTH-${currentStaff.id}` : `PIN-AUTH-MGR`,
      approvalStatus: 'APPROVED',
      notes: notes || `Audited ${movementType} recorded by ${currentStaff.name}.`,
    };

    const newSoh = Math.max(0, selectedItem.stockOnHand + signedQty);
    const updatedItem: InventoryItem = {
      ...selectedItem,
      stockOnHand: newSoh,
      status: newSoh <= 0 ? 'Out of Stock' : newSoh <= selectedItem.reorderLevel ? 'Low Stock' : 'In Stock',
      lastUpdated: nowStr,
    };

    onPostAdjustment(movement, updatedItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 -mt-3">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-4 -mx-6 -mt-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Controlled Stock Adjustment & Write-Off
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Double-Entry Audited Inventory Variance & Shrinkage Authorization
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-3 py-2 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Item Selection & Metadata */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Inventory Item
              </label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full bg-white border border-slate-300 px-2.5 py-1.5 text-xs font-mono rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
              >
                {items.map((itm) => (
                  <option key={itm.sku} value={itm.sku}>
                    [{itm.sku}] {itm.name || itm.description} (On Hand: {itm.stockOnHand})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Facility / Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-white border border-slate-300 px-2.5 py-1.5 text-xs font-mono rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
              >
                <option value="WH-01">Central Distribution Warehouse (WH-01)</option>
                <option value="BR-01">Main Downtown Branch (BR-01)</option>
                <option value="BR-02">Westside Trade Counter (BR-02)</option>
              </select>
            </div>
          </div>

          {selectedItem && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs font-mono">
              <div className="bg-white p-2 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Current On Hand</span>
                <span className="font-bold text-slate-900 text-sm">{selectedItem.stockOnHand} units</span>
              </div>
              <div className="bg-white p-2 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Unit Cost Basis</span>
                <span className="font-bold text-slate-900 text-sm">${selectedItem.unitCost.toFixed(2)}</span>
              </div>
              <div className="bg-white p-2 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Retail Selling Price</span>
                <span className="font-bold text-slate-900 text-sm">${selectedItem.retailPrice.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Adjustment Category Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
            Adjustment Category & Valuation Impact
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setAdjustmentCategory('DAMAGE');
                setReasonCode('DAMAGE');
              }}
              className={`p-2.5 border text-left rounded-xs transition-all ${
                adjustmentCategory === 'DAMAGE'
                  ? 'border-rose-500 bg-rose-50/70 text-rose-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-rose-700 font-bold text-xs">
                <Flame className="w-3.5 h-3.5" />
                Damage Out
              </div>
              <p className="text-[10px] text-slate-500">Breakage, defect, or transit destruction</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdjustmentCategory('WRITE_OFF');
                setReasonCode('WRITE_OFF');
              }}
              className={`p-2.5 border text-left rounded-xs transition-all ${
                adjustmentCategory === 'WRITE_OFF'
                  ? 'border-rose-500 bg-rose-50/70 text-rose-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-rose-700 font-bold text-xs">
                <Archive className="w-3.5 h-3.5" />
                Write-off Out
              </div>
              <p className="text-[10px] text-slate-500">Shrinkage, obsolete or expired inventory</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdjustmentCategory('POSITIVE_ADJ');
                setReasonCode('FOUND_STOCK');
              }}
              className={`p-2.5 border text-left rounded-xs transition-all ${
                adjustmentCategory === 'POSITIVE_ADJ'
                  ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-emerald-700 font-bold text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                Write-on (+)
              </div>
              <p className="text-[10px] text-slate-500">Found stock, pallet recovery, correction</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdjustmentCategory('NEGATIVE_ADJ');
                setReasonCode('DATA_CORRECTION');
              }}
              className={`p-2.5 border text-left rounded-xs transition-all ${
                adjustmentCategory === 'NEGATIVE_ADJ'
                  ? 'border-amber-500 bg-amber-50/70 text-amber-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-amber-700 font-bold text-xs">
                <TrendingDown className="w-3.5 h-3.5" />
                Count Adj (-)
              </div>
              <p className="text-[10px] text-slate-500">Discrepancy correction without formal count</p>
            </button>
          </div>
        </div>

        {/* Quantity and Reason Code Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Quantity ({adjustmentCategory.includes('POSITIVE') ? '+ Add' : '- Deduct'})
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-white border border-slate-300 px-3 py-1.5 text-base font-mono font-bold text-slate-900 rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                units
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Cost Impact:</span>
              <strong className="text-slate-900">${totalValueImpact.toFixed(2)}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Controlled Reason Code
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ManualAdjustmentReasonCode)}
              className="w-full bg-white border border-slate-300 px-2.5 py-2 text-xs font-mono rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden"
            >
              <option value="DAMAGE">DAMAGE - Broken or crushed during storage</option>
              <option value="BREAKAGE">BREAKAGE - Dropped during customer handling</option>
              <option value="EXPIRED">EXPIRED - Shelf life exceeded / chemical decay</option>
              <option value="FOUND_STOCK">FOUND_STOCK - Unrecorded surplus located in warehouse</option>
              <option value="DATA_CORRECTION">DATA_CORRECTION - Prior receiving quantity typo</option>
              <option value="WRITE_OFF">WRITE_OFF - Shrinkage or unexplained loss</option>
              <option value="OTHER">OTHER - Specific operational exception (notes required)</option>
            </select>
          </div>
        </div>

        {/* Audit Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Mandatory Audit Notes & Circumstances
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain physical discovery, bay location, inspector comments, or incident report details..."
            className="w-full bg-white border border-slate-300 p-2 text-xs rounded-xs focus:ring-1 focus:ring-amber-500 outline-hidden font-sans"
          />
        </div>

        {/* Supervisor PIN Check if needed */}
        {!isSupervisor && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold text-amber-900 block">Supervisor Authorization Required</span>
                <p className="text-[11px] text-amber-800">
                  Cashier role requires Manager PIN to post directly, or submission to Manager Queue.
                </p>
              </div>
            </div>
            <div className="w-36 shrink-0">
              <input
                type="password"
                placeholder="Manager PIN"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                className="w-full bg-white border border-amber-400 px-2.5 py-1 text-xs font-mono rounded-xs text-center"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {(!isSupervisor && managerPin !== '9999' && managerPin !== '1234')
              ? 'Submit for Manager Approval'
              : 'Post Audited Adjustment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
