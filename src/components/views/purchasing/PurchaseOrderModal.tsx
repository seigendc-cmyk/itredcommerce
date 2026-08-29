import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Warehouse as WarehouseIcon, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  Percent, 
  DollarSign,
  FileCheck
} from 'lucide-react';
import { PurchaseOrder, PurchaseMemo, Warehouse, InventoryItem, StaffMember, Supplier } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';

export interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePO: (po: PurchaseOrder) => void;
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  initialFromMemo?: PurchaseMemo | null;
  initialSupplier?: string;
  initialNotes?: string;
  mode?: 'BLANK' | 'FROM_MEMO' | 'REORDER_LOW_STOCK';
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onSavePO,
  warehouses = [],
  inventoryItems = [],
  currentStaff,
  initialFromMemo,
  initialSupplier,
  initialNotes,
  mode = 'BLANK',
}) => {
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState(initialSupplier || '');
  const [supplierCode, setSupplierCode] = useState('SUP-101');
  const [deliveryDueDate, setDeliveryDueDate] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState(warehouses?.[0]?.id || 'WH-01');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [notes, setNotes] = useState(initialNotes || '');
  const [taxRate, setTaxRate] = useState(15.0);
  
  // Line items
  const [items, setItems] = useState<Array<{
    sku: string;
    description: string;
    orderedQty: number;
    receivedQty: number;
    unitCost: number;
    totalCost: number;
  }>>([]);

  // Item selector state
  const [selectedSku, setSelectedSku] = useState('');
  const [orderQty, setOrderQty] = useState(50);
  const [unitCost, setUnitCost] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const generatedNo = `PO-2026-${String(Math.floor(800 + Math.random() * 200))}`;
      setPoNumber(generatedNo);
      
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDeliveryDueDate(futureDate);

      if (initialFromMemo) {
        setSupplierName(initialFromMemo.supplierName || 'Apex Industrial Bearings Ltd.');
        setDestWarehouseId(initialFromMemo.destinationWarehouseId || warehouses?.[0]?.id || 'WH-01');
        setNotes(`Converted from Purchase Memo ${initialFromMemo.memoNumber}.`);
        
        const mappedItems = initialFromMemo.items.map(i => {
          const matchedInv = inventoryItems.find(inv => inv.sku === i.sku);
          const cost = i.estimatedUnitCost || matchedInv?.unitCost || matchedInv?.cost || 10;
          return {
            sku: i.sku,
            description: i.description,
            orderedQty: i.requestedQty,
            receivedQty: 0,
            unitCost: cost,
            totalCost: cost * i.requestedQty,
          };
        });
        setItems(mappedItems);
      } else if (mode === 'REORDER_LOW_STOCK') {
        setSupplierName('Apex Industrial Bearings Ltd.');
        setNotes('Generated from Automated Warehouse Reorder Threshold Alerts.');
        // pick low stock items
        const lowStock = inventoryItems.filter(i => (i.stockOnHand || 0) <= (i.reorderLevel ?? i.reorderPoint ?? 0)).slice(0, 3);
        const mapped = lowStock.map(i => {
          const itemCost = i.unitCost ?? i.cost ?? 10;
          const targetQty = Math.max(20, (i.reorderLevel ?? i.reorderPoint ?? 10) * 2);
          return {
            sku: i.sku,
            description: i.name || i.description,
            orderedQty: targetQty,
            receivedQty: 0,
            unitCost: itemCost,
            totalCost: itemCost * targetQty,
          };
        });
        setItems(mapped);
      } else {
        setSupplierName('Apex Industrial Bearings Ltd.');
        setNotes('Commercial supplier purchase order.');
        setItems([]);
      }
    }
  }, [isOpen, initialFromMemo, mode, warehouses, inventoryItems]);

  const handleAddItem = () => {
    if (!selectedSku) return;
    const itm = inventoryItems.find(i => i.sku === selectedSku);
    if (!itm) return;

    const existingIndex = items.findIndex(i => i.sku === selectedSku);
    const itemCost = unitCost > 0 ? unitCost : (itm.unitCost ?? itm.cost ?? 0);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].orderedQty += orderQty;
      updated[existingIndex].totalCost = updated[existingIndex].orderedQty * updated[existingIndex].unitCost;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          sku: itm.sku,
          description: itm.name || itm.description,
          orderedQty: orderQty,
          receivedQty: 0,
          unitCost: itemCost,
          totalCost: itemCost * orderQty,
        }
      ]);
    }
    setSelectedSku('');
    setOrderQty(50);
    setUnitCost(0);
  };

  const handleRemoveItem = (sku: string) => {
    setItems(items.filter(i => i.sku !== sku));
  };

  const subtotal = items.reduce((acc, i) => acc + i.totalCost, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;
  const totalItemsCount = items.reduce((acc, i) => acc + i.orderedQty, 0);

  const handleSubmit = () => {
    if (items.length === 0) {
      alert('Please add at least one line item to this purchase order.');
      return;
    }

    const wh = warehouses?.find(w => w.id === destWarehouseId) || warehouses?.[0] || { id: 'WH-01', name: 'Main Warehouse' };

    const newPO: PurchaseOrder = {
      poNumber: poNumber,
      supplierName: supplierName || 'Industrial Wholesale Supplier',
      supplierCode: supplierCode,
      dateCreated: new Date().toISOString().split('T')[0],
      deliveryDueDate: deliveryDueDate,
      destinationWarehouseId: wh.id,
      destinationWarehouseName: wh.name,
      totalItems: totalItemsCount,
      subtotal: subtotal,
      taxRate: taxRate,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      currency: 'USD',
      status: 'Open',
      paymentTerms: paymentTerms,
      authorizedBy: currentStaff.name,
      notes: notes,
      originMemoNumber: initialFromMemo?.memoNumber,
      items: items,
    };

    onSavePO(newPO);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Issue Purchase Order [${poNumber || 'New PO'}]`}
      size="xl"
    >
      <div className="space-y-4 text-xs select-none">
        {/* Logistics Notice */}
        <div className="bg-[#FAF8F5] border border-amber-300 p-2.5 flex items-start gap-2 text-slate-700">
          <WarehouseIcon className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">Supplier Intake Logistics Rule:</span> In accordance with enterprise supply chain policy, external supplier freight enters through an approved warehouse hub before distribution to sales branches.
          </div>
        </div>

        {/* PO Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 border border-slate-300">
          <div>
            <label className="block text-slate-700 font-bold mb-1">PO Number</label>
            <Input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Supplier / Vendor</label>
            <select
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                setSupplierCode(e.target.value.includes('Apex') ? 'SUP-101' : e.target.value.includes('Titan') ? 'SUP-104' : 'SUP-109');
              }}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="Apex Industrial Bearings Ltd.">Apex Industrial Bearings Ltd. (SUP-101)</option>
              <option value="Titan Fasteners & Metallurgy Co.">Titan Fasteners & Metallurgy Co. (SUP-104)</option>
              <option value="Vanguard Industrial Fluids & Oils">Vanguard Industrial Fluids & Oils (SUP-109)</option>
              <option value="Kodiak Safety Products Corp.">Kodiak Safety Products Corp. (SUP-112)</option>
              <option value="Matrix Pneumatics & Tooling">Matrix Pneumatics & Tooling (SUP-118)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Destination Warehouse</label>
            <select
              value={destWarehouseId}
              onChange={(e) => setDestWarehouseId(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500 font-bold"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Delivery Due Date</label>
            <Input
              type="date"
              value={deliveryDueDate}
              onChange={(e) => setDeliveryDueDate(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="Net 30 Days">Net 30 Days</option>
              <option value="Net 15 Days">Net 15 Days</option>
              <option value="Net 45 Days">Net 45 Days</option>
              <option value="Prepaid COD">Prepaid COD</option>
              <option value="Sight Letter of Credit">Sight Letter of Credit</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">VAT / Tax Rate (%)</label>
            <Input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">Commercial Notes</label>
            <Input
              type="text"
              placeholder="Delivery instructions, dock specification..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Item Entry Strip */}
        <div className="border border-slate-300 p-3 bg-white space-y-2">
          <div className="font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
            <span>Add Purchase Order Line Items</span>
            <span className="text-[11px] text-slate-500 font-normal">Select SKU to populate default unit cost</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-6">
              <label className="block text-[11px] text-slate-600 font-mono mb-1">Item Catalog</label>
              <select
                value={selectedSku}
                onChange={(e) => {
                  setSelectedSku(e.target.value);
                  const itm = inventoryItems.find(i => i.sku === e.target.value);
                  if (itm) setUnitCost(itm.unitCost ?? itm.cost ?? 0);
                }}
                className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="">Choose item from catalog...</option>
                {inventoryItems.map(i => {
                  const itemCost = i.unitCost ?? i.cost ?? 0;
                  return (
                    <option key={i.sku} value={i.sku}>
                      [{i.sku}] {i.name} (Std Cost: ${itemCost.toFixed(2)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-600 font-mono mb-1">Order Qty</label>
              <input
                type="number"
                min="1"
                value={orderQty}
                onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-600 font-mono mb-1">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
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
                Add Line
              </Button>
            </div>
          </div>
        </div>

        {/* PO Line Items Table */}
        <div className="border border-slate-300 overflow-x-auto max-h-56">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Description</th>
                <th className="p-2 text-center">Ordered Qty</th>
                <th className="p-2 text-right">Unit Cost</th>
                <th className="p-2 text-right">Total ($)</th>
                <th className="p-2 text-center">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                    No line items on this Purchase Order yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50">
                    <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                    <td className="p-2 font-sans">{item.description}</td>
                    <td className="p-2 text-center font-bold">{item.orderedQty}</td>
                    <td className="p-2 text-right">${item.unitCost.toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">${item.totalCost.toFixed(2)}</td>
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

        {/* PO Financial Totals Breakdown */}
        <div className="bg-slate-900 text-white p-3 grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Subtotal Excl. Tax</div>
            <div className="text-sm font-bold">${subtotal.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">VAT ({taxRate}%)</div>
            <div className="text-sm font-bold text-amber-400">${taxAmount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Total Items Qty</div>
            <div className="text-sm font-bold">{totalItemsCount} units</div>
          </div>
          <div>
            <div className="text-[10px] text-orange-400 uppercase font-bold">Total Order Value</div>
            <div className="text-base font-black text-white">${totalAmount.toFixed(2)}</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="text-slate-500 font-mono text-[11px]">
            Authorized By: <span className="font-bold text-slate-800">{currentStaff.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              leftIcon={<FileCheck className="w-3.5 h-3.5" />}
            >
              Issue & Commit Purchase Order
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
