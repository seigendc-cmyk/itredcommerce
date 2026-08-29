import React, { useState } from 'react';
import { 
  Truck, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Warehouse as WarehouseIcon, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { 
  StockTransfer, 
  Warehouse, 
  Branch, 
  InventoryItem, 
  StaffMember, 
  StockTransferItem 
} from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';

export interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTransfer: (transfer: StockTransfer) => void;
  warehouses: Warehouse[];
  branches: Branch[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  preselectedOriginId?: string;
  preselectedSku?: string;
}

export const NewTransferModal: React.FC<NewTransferModalProps> = ({
  isOpen,
  onClose,
  onSaveTransfer,
  warehouses = [],
  branches = [],
  inventoryItems = [],
  currentStaff,
  preselectedOriginId,
  preselectedSku,
}) => {
  const [transferType, setTransferType] = useState<'WH_TO_BRANCH' | 'BRANCH_TO_BRANCH' | 'BRANCH_TO_WH'>('WH_TO_BRANCH');
  const [originId, setOriginId] = useState(preselectedOriginId || warehouses?.[0]?.id || 'WH-01');
  const [destinationId, setDestinationId] = useState(branches?.[0]?.id || 'BR-01');
  const [carrier, setCarrier] = useState('Company Internal Van');
  const [trackingNotes, setTrackingNotes] = useState('Stock replenishment transfer');
  const [items, setItems] = useState<StockTransferItem[]>([]);

  // Item selector
  const [selectedSku, setSelectedSku] = useState(preselectedSku || '');
  const [qty, setQty] = useState(10);

  const allOrigins = transferType === 'WH_TO_BRANCH' 
    ? (warehouses || []).map(w => ({ id: w.id, name: `${w.name} (Warehouse)`, type: 'WAREHOUSE' as const }))
    : (branches || []).map(b => ({ id: b.id, name: `${b.name} (Branch)`, type: 'BRANCH' as const }));

  const allDestinations = transferType === 'BRANCH_TO_WH'
    ? (warehouses || []).map(w => ({ id: w.id, name: `${w.name} (Warehouse)`, type: 'WAREHOUSE' as const }))
    : (branches || []).map(b => ({ id: b.id, name: `${b.name} (Branch)`, type: 'BRANCH' as const }));

  const handleAddItem = () => {
    if (!selectedSku) return;
    const itm = (inventoryItems || []).find(i => i.sku === selectedSku);
    if (!itm) return;

    if (items.some(i => i.sku === selectedSku)) {
      setItems(items.map(i => i.sku === selectedSku ? { ...i, requestedQty: i.requestedQty + qty } : i));
    } else {
      setItems([
        ...items,
        {
          sku: itm.sku,
          description: itm.name,
          requestedQty: qty,
          approvedQty: qty,
          dispatchedQty: 0,
          receivedQty: 0,
          unitCost: itm.unitCost ?? itm.cost ?? 0,
        }
      ]);
    }
    setSelectedSku('');
    setQty(10);
  };

  const handleRemoveItem = (sku: string) => {
    setItems(items.filter(i => i.sku !== sku));
  };

  const totalItemsCount = items.reduce((acc, i) => acc + i.requestedQty, 0);
  const totalValuation = items.reduce((acc, i) => acc + i.requestedQty * i.unitCost, 0);

  const handleSubmit = (status: 'Draft' | 'Requested' | 'Approved' | 'Dispatched') => {
    if (items.length === 0) {
      alert('Please add at least one line item to this stock transfer.');
      return;
    }

    if (originId === destinationId) {
      alert('Origin and Destination cannot be the same location.');
      return;
    }

    const originObj = allOrigins.find(o => o.id === originId) || allOrigins[0] || { id: originId, name: 'Origin Location', type: 'BRANCH' as const };
    const destObj = allDestinations.find(d => d.id === destinationId) || allDestinations[0] || { id: destinationId, name: 'Destination Location', type: 'BRANCH' as const };
    const transferNo = `TRF-2026-${Date.now().toString().slice(-4)}`;

    const newTransfer: StockTransfer = {
      id: transferNo,
      transferNumber: transferNo,
      originLocationId: originObj.id,
      originLocationType: originObj.type,
      originLocationName: originObj.name,
      destinationLocationId: destObj.id,
      destinationLocationType: destObj.type,
      destinationLocationName: destObj.name,
      requestDate: new Date().toISOString().split('T')[0],
      dispatchedDate: status === 'Dispatched' ? new Date().toISOString().split('T')[0] : undefined,
      requestedByStaffName: currentStaff?.name || 'Operator',
      status: status,
      carrierVehicle: carrier,
      notes: trackingNotes,
      totalItemsCount: totalItemsCount,
      totalValuation: totalValuation,
      items: items.map(i => ({
        ...i,
        dispatchedQty: status === 'Dispatched' ? i.requestedQty : 0,
      })),
    };

    onSaveTransfer(newTransfer);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Stock Transfer Request / Waybill"
      size="xl"
    >
      <div className="space-y-4 text-xs select-none">
        {/* Logistics Notice */}
        <div className="bg-[#FAF8F5] border border-amber-300 p-2.5 flex items-start gap-2 text-slate-700">
          <Truck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">Document Workflow Mandate:</span> Stock transfers require explicit dispatch and receiving confirmation. SOH balances are not instantly altered across locations without digital transit verification.
          </div>
        </div>

        {/* Transfer Route Selector */}
        <div className="bg-slate-50 p-3 border border-slate-300 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Transfer Route Type</label>
            <select
              value={transferType}
              onChange={(e) => {
                const val = e.target.value as any;
                setTransferType(val);
                if (val === 'WH_TO_BRANCH') {
                  setOriginId(warehouses?.[0]?.id || 'WH-01');
                  setDestinationId(branches?.[0]?.id || 'BR-01');
                } else if (val === 'BRANCH_TO_BRANCH') {
                  setOriginId(branches?.[0]?.id || 'BR-01');
                  setDestinationId(branches?.[1]?.id || branches?.[0]?.id || 'BR-02');
                } else {
                  setOriginId(branches?.[0]?.id || 'BR-01');
                  setDestinationId(warehouses?.[0]?.id || 'WH-01');
                }
              }}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500 font-bold"
            >
              <option value="WH_TO_BRANCH">Warehouse → Branch (Replenishment)</option>
              <option value="BRANCH_TO_BRANCH">Branch → Branch (Peer Rebalancing)</option>
              <option value="BRANCH_TO_WH">Branch → Warehouse (Return / Surpluses)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Origin / Source Location</label>
            <select
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              {allOrigins.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Destination Location</label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              {allDestinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Carrier / Logistics Vehicle</label>
            <Input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">Transfer Purpose & Notes</label>
            <Input
              type="text"
              placeholder="e.g. Urgent customer order fulfillment, weekly stock rebalance"
              value={trackingNotes}
              onChange={(e) => setTrackingNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Item Add Strip */}
        <div className="border border-slate-300 p-3 bg-white space-y-2">
          <div className="font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
            <span>Select Items to Transfer</span>
            <span className="text-[11px] text-slate-500 font-normal">Select SKU from catalog</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-8">
              <label className="block text-[11px] text-slate-600 font-mono mb-1">Catalog Item</label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="">Select Item from Product Master...</option>
                {inventoryItems.map(i => {
                  const itemCost = i.unitCost ?? i.cost ?? 0;
                  return (
                    <option key={i.sku} value={i.sku}>
                      [{i.sku}] {i.name} (SOH: {i.stockOnHand}, Cost: ${itemCost.toFixed(2)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-600 font-mono mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddItem}
                disabled={!selectedSku}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {/* Transfer Items Table */}
        <div className="border border-slate-300 overflow-x-auto max-h-48">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Description</th>
                <th className="p-2 text-center">Transfer Qty</th>
                <th className="p-2 text-right">Unit Cost</th>
                <th className="p-2 text-right">Total ($)</th>
                <th className="p-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                    No items selected for transfer.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50">
                    <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                    <td className="p-2 font-sans">{item.description}</td>
                    <td className="p-2 text-center font-bold">{item.requestedQty}</td>
                    <td className="p-2 text-right">${item.unitCost.toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">${(item.requestedQty * item.unitCost).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.sku)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Valuation Banner */}
        <div className="bg-slate-900 text-white p-3 flex justify-between items-center font-mono">
          <div className="text-slate-400 text-xs">
            Transfer Load: <span className="text-white font-bold">{totalItemsCount} units</span> across {items.length} SKUs
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[10px] uppercase mr-2">Transfer Valuation:</span>
            <span className="text-sm font-bold text-emerald-400">${totalValuation.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit('Draft')}
              className="bg-slate-100 font-bold"
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit('Requested')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Submit Transfer Request
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit('Dispatched')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              leftIcon={<Truck className="w-3.5 h-3.5" />}
            >
              Dispatch Goods Immediately
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
