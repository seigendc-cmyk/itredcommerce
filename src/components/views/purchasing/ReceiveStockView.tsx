import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, 
  ArrowLeft, 
  Search, 
  Warehouse as WarehouseIcon, 
  Building2, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Printer, 
  Plus, 
  Trash2,
  Barcode,
  Layers,
  FileText,
  Clock
} from 'lucide-react';
import { 
  PurchaseOrder, 
  Warehouse, 
  InventoryItem, 
  StaffMember, 
  InventoryMovement 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { Modal } from '../../ui/Modal';

export interface ReceiveStockViewProps {
  purchaseOrders: PurchaseOrder[];
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  initialPoNumber?: string;
  onBackToLanding: () => void;
  onConfirmReceiving: (
    poNumber: string | null,
    warehouseId: string,
    receivedLines: Array<{
      sku: string;
      itemName: string;
      qtyReceiving: number;
      unitCost: number;
      batchNumber?: string;
      serialNumber?: string;
      expiryDate?: string;
      binLocation?: string;
    }>,
    receivingNotes: string
  ) => void;
}

export interface ReceivingLineState {
  sku: string;
  itemName: string;
  orderedQty: number;
  priorReceivedQty: number;
  remainingQty: number;
  qtyReceiving: number;
  unitCost: number;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
  binLocation: string;
}

export const ReceiveStockView: React.FC<ReceiveStockViewProps> = ({
  purchaseOrders = [],
  warehouses = [],
  inventoryItems = [],
  currentStaff,
  initialPoNumber,
  onBackToLanding,
  onConfirmReceiving,
}) => {
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>(initialPoNumber || '');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(warehouses?.[0]?.id || 'WH-01');
  const [supplierName, setSupplierName] = useState<string>('Apex Industrial Bearings Ltd.');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState<string>('DN-98421');
  const [carrierName, setCarrierName] = useState<string>('Freight Express Logistics');
  const [receivingNotes, setReceivingNotes] = useState<string>('Standard quality and count inspection verified at warehouse dock.');
  const [lines, setLines] = useState<ReceivingLineState[]>([]);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [lastGRN, setLastGRN] = useState<{ grnNumber: string; date: string; warehouseName: string; totalItems: number; totalValue: number } | null>(null);

  // Ad-hoc line add state
  const [adHocSku, setAdHocSku] = useState('');
  const [adHocQty, setAdHocQty] = useState(10);
  const [adHocCost, setAdHocCost] = useState(0);
  const [adHocBatch, setAdHocBatch] = useState('');
  const [adHocSerial, setAdHocSerial] = useState('');
  const [adHocExpiry, setAdHocExpiry] = useState('');
  const [adHocBin, setAdHocBin] = useState('Bay A-01');

  // Load PO items when PO changes
  useEffect(() => {
    if (selectedPoNumber) {
      const foundPO = purchaseOrders.find(p => p.poNumber === selectedPoNumber);
      if (foundPO) {
        setSupplierName(foundPO.supplierName);
        if (foundPO.destinationWarehouseId) {
          setTargetWarehouseId(foundPO.destinationWarehouseId);
        }

        const mappedLines: ReceivingLineState[] = foundPO.items.map(item => {
          const inv = inventoryItems.find(i => i.sku === item.sku);
          const remaining = Math.max(0, item.orderedQty - item.receivedQty);
          return {
            sku: item.sku,
            itemName: item.description,
            orderedQty: item.orderedQty,
            priorReceivedQty: item.receivedQty,
            remainingQty: remaining,
            qtyReceiving: remaining, // default to remaining
            unitCost: item.unitCost,
            batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            serialNumber: '',
            expiryDate: '',
            binLocation: inv?.location || 'Bay A-01',
          };
        });
        setLines(mappedLines);
      }
    }
  }, [selectedPoNumber, purchaseOrders, inventoryItems]);

  const handleUpdateLineQty = (index: number, newQty: number) => {
    const updated = [...lines];
    updated[index].qtyReceiving = Math.max(0, newQty);
    setLines(updated);
  };

  const handleUpdateLineField = (index: number, field: keyof ReceivingLineState, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;
    setLines(updated);
  };

  const handleAddAdHocLine = () => {
    if (!adHocSku) return;
    const itm = inventoryItems.find(i => i.sku === adHocSku);
    if (!itm) return;

    const newLine: ReceivingLineState = {
      sku: itm.sku,
      itemName: itm.name || itm.description,
      orderedQty: adHocQty,
      priorReceivedQty: 0,
      remainingQty: adHocQty,
      qtyReceiving: adHocQty,
      unitCost: adHocCost || itm.unitCost || itm.cost || 0,
      batchNumber: adHocBatch || `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      serialNumber: adHocSerial,
      expiryDate: adHocExpiry,
      binLocation: adHocBin || itm.location || 'Bay A-01',
    };

    setLines([...lines, newLine]);
    setIsAdHocModalOpen(false);
    setAdHocSku('');
    setAdHocQty(10);
    setAdHocCost(0);
    setAdHocBatch('');
    setAdHocSerial('');
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const totalReceivingUnits = lines.reduce((acc, l) => acc + (l.qtyReceiving || 0), 0);
  const totalReceivingValue = lines.reduce((acc, l) => acc + (l.qtyReceiving || 0) * l.unitCost, 0);

  const handleCommitReceiving = () => {
    if (lines.length === 0) {
      setAlertNotice('No stock line items present to receive.');
      return;
    }

    if (totalReceivingUnits === 0) {
      setAlertNotice('Please specify receiving quantities greater than 0.');
      return;
    }

    const wh = warehouses?.find(w => w.id === targetWarehouseId) || warehouses?.[0] || { id: 'WH-01', name: 'Main Warehouse' };
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;

    onConfirmReceiving(
      selectedPoNumber || null,
      targetWarehouseId,
      lines.map(l => ({
        sku: l.sku,
        itemName: l.itemName,
        qtyReceiving: l.qtyReceiving,
        unitCost: l.unitCost,
        batchNumber: l.batchNumber,
        serialNumber: l.serialNumber,
        expiryDate: l.expiryDate,
        binLocation: l.binLocation,
      })),
      `${receivingNotes} (DN: ${deliveryNoteNumber}, Carrier: ${carrierName})`
    );

    setLastGRN({
      grnNumber: grnNumber,
      date: new Date().toLocaleString(),
      warehouseName: wh.name,
      totalItems: totalReceivingUnits,
      totalValue: totalReceivingValue,
    });

    setAlertNotice(`Stock intake confirmed! Goods Received Note ${grnNumber} generated for ${wh.name}.`);
    setLines([]);
    setSelectedPoNumber('');
  };

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
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              Goods Inward & Supplier Stock Intake (Warehouse Dock)
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Receive Vendor Freight directly into Central Warehouse Storage Hubs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdHocModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Add Non-PO / Ad-Hoc Item
          </Button>
        </div>
      </div>

      {alertNotice && (
        <Alert
          type="info"
          message={alertNotice}
          onClose={() => setAlertNotice(null)}
        />
      )}

      {/* Mandatory Supplier Intake Flow Banner */}
      <div className="bg-[#FAF8F5] border border-amber-300 p-3 flex items-start justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-start gap-2.5">
          <WarehouseIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wide">
              Supply Chain Inward Rule: Supplier → Warehouse → Branch
            </div>
            <div className="text-slate-600 mt-0.5">
              All supplier shipments are received directly into warehouse facilities. Branches do not receive direct supplier shipments; branch stock is replenished strictly via internal stock transfers.
            </div>
          </div>
        </div>
        <StatusBadge status="Warehouse Inward Enforced" size="sm" />
      </div>

      {/* Receiving Manifest Config Header */}
      <div className="bg-white border border-slate-300 p-4 space-y-4">
        <div className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
          <span>Inbound Freight Manifest & Destination</span>
          <span className="font-mono text-slate-500 font-normal">Receiving Officer: {currentStaff.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Reference PO */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Purchase Order (Optional)</label>
            <select
              value={selectedPoNumber}
              onChange={(e) => setSelectedPoNumber(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="">-- Manual / Direct Supplier Intake --</option>
              {purchaseOrders.filter(p => p.status === 'Open' || p.status === 'Part Received').map(p => (
                <option key={p.poNumber} value={p.poNumber}>
                  {p.poNumber} - {p.supplierName} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse (Strictly Warehouse) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Destination Warehouse <span className="text-orange-600">*</span>
            </label>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500 font-bold text-slate-900"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Name */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Supplier / Vendor Name</label>
            <Input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>

          {/* Supplier Delivery Note # */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Supplier Delivery Note / Waybill</label>
            <Input
              type="text"
              value={deliveryNoteNumber}
              onChange={(e) => setDeliveryNoteNumber(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Carrier Name */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Freight Carrier / Vehicle</label>
            <Input
              type="text"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
            />
          </div>

          {/* Inspection Notes */}
          <div className="md:col-span-3">
            <label className="block text-slate-700 font-bold mb-1">Receiving Dock Inspection Notes</label>
            <Input
              type="text"
              value={receivingNotes}
              onChange={(e) => setReceivingNotes(e.target.value)}
              placeholder="Visual inspection condition, pallet seals, temperature logs..."
            />
          </div>
        </div>
      </div>

      {/* Stock Line Items Intake Matrix */}
      <div className="bg-white border border-slate-300 overflow-x-auto">
        <div className="p-3 bg-slate-100 border-b border-slate-300 font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
          <span>Items Receiving Matrix</span>
          <span className="text-[11px] font-mono text-slate-500 font-normal">
            Adjust quantities and lot / serial tracking data before confirming
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 font-mono text-slate-700 uppercase text-[11px]">
              <th className="p-2.5">SKU</th>
              <th className="p-2.5">Item Description</th>
              <th className="p-2.5 text-center">Ordered</th>
              <th className="p-2.5 text-center">Prior Recv</th>
              <th className="p-2.5 text-center bg-amber-50">Qty Receiving</th>
              <th className="p-2.5 text-right">Unit Cost</th>
              <th className="p-2.5">Batch / Lot #</th>
              <th className="p-2.5">Serial / Expiry</th>
              <th className="p-2.5">Bin Location</th>
              <th className="p-2.5 text-right">Line Total</th>
              <th className="p-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                  No line items loaded. Select a Purchase Order above or click "+ Add Non-PO / Ad-Hoc Item".
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr key={`${line.sku}-${idx}`} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-900">{line.sku}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-800 min-w-[180px]">
                    {line.itemName}
                  </td>
                  <td className="p-2.5 text-center text-slate-600">{line.orderedQty}</td>
                  <td className="p-2.5 text-center text-slate-600">{line.priorReceivedQty}</td>
                  <td className="p-2.5 text-center bg-amber-50/70">
                    <input
                      type="number"
                      min="0"
                      value={line.qtyReceiving}
                      onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value) || 0)}
                      className="w-16 border border-amber-300 bg-white p-1 text-center font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </td>
                  <td className="p-2.5 text-right">${line.unitCost.toFixed(2)}</td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={line.batchNumber}
                      onChange={(e) => handleUpdateLineField(idx, 'batchNumber', e.target.value)}
                      placeholder="Batch #"
                      className="w-24 border border-slate-300 bg-white p-1 text-[11px]"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={line.serialNumber || line.expiryDate}
                      onChange={(e) => handleUpdateLineField(idx, 'serialNumber', e.target.value)}
                      placeholder="Serial / Expiry"
                      className="w-24 border border-slate-300 bg-white p-1 text-[11px]"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={line.binLocation}
                      onChange={(e) => handleUpdateLineField(idx, 'binLocation', e.target.value)}
                      placeholder="Bin Loc"
                      className="w-20 border border-slate-300 bg-white p-1 text-[11px]"
                    />
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    ${(line.qtyReceiving * line.unitCost).toFixed(2)}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
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

      {/* Summary Footer Strip */}
      <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-4 font-mono">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Total Items to Ingest</div>
            <div className="text-lg font-bold text-white">{totalReceivingUnits} units</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Destination Warehouse</div>
            <div className="text-sm font-bold text-amber-400">
              {warehouses.find(w => w.id === targetWarehouseId)?.name || 'Central Warehouse'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Gross Inventory Valuation</div>
            <div className="text-lg font-black text-emerald-400">${totalReceivingValue.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines([])}
            className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
          >
            Clear Form
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleCommitReceiving}
            disabled={totalReceivingUnits === 0}
            className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white font-bold px-6"
            leftIcon={<PackageCheck className="w-4 h-4" />}
          >
            Confirm Stock Intake & Update Warehouse SOH
          </Button>
        </div>
      </div>

      {/* AD-HOC ITEM MODAL */}
      <Modal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        title="Add Ad-Hoc / Non-PO Inventory Intake"
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Catalog Item</label>
            <select
              value={adHocSku}
              onChange={(e) => {
                setAdHocSku(e.target.value);
                const itm = inventoryItems.find(i => i.sku === e.target.value);
                if (itm) {
                  setAdHocCost(itm.unitCost ?? itm.cost ?? 0);
                  setAdHocBin(itm.location || 'Bay A-01');
                }
              }}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="">Select Item from Master...</option>
              {inventoryItems.map(i => {
                const itemCost = i.unitCost ?? i.cost ?? 0;
                return (
                  <option key={i.sku} value={i.sku}>
                    [{i.sku}] {i.name} (Current Cost: ${itemCost.toFixed(2)})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Receiving Qty</label>
              <Input
                type="number"
                min="1"
                value={adHocQty}
                onChange={(e) => setAdHocQty(parseInt(e.target.value) || 1)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Unit Cost ($)</label>
              <Input
                type="number"
                step="0.01"
                value={adHocCost}
                onChange={(e) => setAdHocCost(parseFloat(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Batch / Lot #</label>
              <Input
                type="text"
                value={adHocBatch}
                onChange={(e) => setAdHocBatch(e.target.value)}
                placeholder="BAT-2026-XXXX"
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Warehouse Bin Location</label>
              <Input
                type="text"
                value={adHocBin}
                onChange={(e) => setAdHocBin(e.target.value)}
                placeholder="Bay A-01"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdHocModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddAdHocLine}
              disabled={!adHocSku}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Add to Intake List
            </Button>
          </div>
        </div>
      </Modal>

      {/* LAST GRN PRINT RECEIPT MODAL */}
      {lastGRN && (
        <Modal
          isOpen={!!lastGRN}
          onClose={() => setLastGRN(null)}
          title={`Goods Received Note: ${lastGRN.grnNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-50 border border-slate-300 space-y-2">
              <div className="flex justify-between border-b border-slate-300 pb-2">
                <span className="font-bold text-slate-900">GRN DOCUMENT #</span>
                <span className="font-bold text-orange-600">{lastGRN.grnNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Intake Timestamp:</span>
                <span>{lastGRN.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination Hub:</span>
                <span className="font-bold text-slate-900">{lastGRN.warehouseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Units Ingested:</span>
                <span className="font-bold">{lastGRN.totalItems} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Valuation Added:</span>
                <span className="font-bold text-emerald-600">${lastGRN.totalValue.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Goods Received Note (GRN)
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setLastGRN(null)}
                className="bg-slate-900 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
