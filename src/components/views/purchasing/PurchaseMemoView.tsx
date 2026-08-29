import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Building2, 
  Calendar, 
  User, 
  AlertTriangle, 
  Check, 
  Printer, 
  Trash2,
  Warehouse as WarehouseIcon,
  Tag,
  Clock
} from 'lucide-react';
import { PurchaseMemo, PurchaseMemoItem, Warehouse, InventoryItem, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface PurchaseMemoViewProps {
  memos: PurchaseMemo[];
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onCreateMemo: (memo: PurchaseMemo) => void;
  onApproveMemo: (memoId: string) => void;
  onRejectMemo: (memoId: string, reason: string) => void;
  onConvertToPO: (memo: PurchaseMemo) => void;
}

export const PurchaseMemoView: React.FC<PurchaseMemoViewProps> = ({
  memos = [],
  warehouses = [],
  inventoryItems = [],
  currentStaff,
  onBackToLanding,
  onCreateMemo,
  onApproveMemo,
  onRejectMemo,
  onConvertToPO,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedMemo, setSelectedMemo] = useState<PurchaseMemo | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Form State
  const [memoSupplier, setMemoSupplier] = useState('');
  const [memoDept, setMemoDept] = useState('Motor Spares');
  const [memoPriority, setMemoPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [destWarehouseId, setDestWarehouseId] = useState(warehouses?.[0]?.id || 'WH-01');
  const [memoNotes, setMemoNotes] = useState('');
  const [memoItems, setMemoItems] = useState<PurchaseMemoItem[]>([]);
  
  // Line item selector
  const [selectedSku, setSelectedSku] = useState('');
  const [itemQty, setItemQty] = useState(10);
  const [estimatedCost, setEstimatedCost] = useState(0);

  const filteredMemos = memos.filter(m => {
    const matchesSearch = 
      m.memoNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.supplierName && m.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      m.requestedByStaffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && m.status === statusFilter;
  });

  const handleAddItemToMemo = () => {
    if (!selectedSku) return;
    const itm = inventoryItems.find(i => i.sku === selectedSku);
    if (!itm) return;

    if (memoItems.some(i => i.sku === selectedSku)) {
      setMemoItems(memoItems.map(i => i.sku === selectedSku ? { ...i, requestedQty: i.requestedQty + itemQty } : i));
    } else {
      setMemoItems([
        ...memoItems,
        {
          sku: itm.sku,
          description: itm.name || itm.description,
          requestedQty: itemQty,
          estimatedUnitCost: estimatedCost || itm.unitCost || itm.cost || 0,
        }
      ]);
    }
    setSelectedSku('');
    setItemQty(10);
    setEstimatedCost(0);
  };

  const handleRemoveItem = (sku: string) => {
    setMemoItems(memoItems.filter(i => i.sku !== sku));
  };

  const handleSaveMemo = (status: 'Draft' | 'Submitted') => {
    if (memoItems.length === 0) {
      setAlertNotice('Please add at least one item requirement to this memo.');
      return;
    }

    const wh = (warehouses || []).find(w => w.id === destWarehouseId) || warehouses?.[0] || { id: 'WH-01', name: 'Main Store Floor' };
    const newMemoNumber = `MEMO-2026-${String(memos.length + 1).padStart(3, '0')}`;
    
    const newMemo: PurchaseMemo = {
      id: newMemoNumber,
      memoNumber: newMemoNumber,
      supplierName: memoSupplier || 'Unassigned / Open Sourcing',
      requestDate: new Date().toISOString().split('T')[0],
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requestedByStaffId: currentStaff.id,
      requestedByStaffName: currentStaff.name,
      department: memoDept,
      destinationWarehouseId: wh.id,
      destinationWarehouseName: wh.name,
      priority: memoPriority,
      status: status,
      items: memoItems,
      notes: memoNotes || 'Non-financial purchase requisition requirement.',
    };

    onCreateMemo(newMemo);
    setIsCreateModalOpen(false);
    setMemoItems([]);
    setMemoSupplier('');
    setMemoNotes('');
    setAlertNotice(`Purchase Memo ${newMemoNumber} created successfully.`);
    setTimeout(() => setAlertNotice(null), 4000);
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
              <FileText className="w-4 h-4 text-orange-400" />
              Purchase Memos (Procurement Intent)
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Non-Financial Internal Procurement Requests & Stock Requirement Authorizations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-orange-600 hover:bg-orange-700 border-orange-700 font-bold"
          >
            Create Purchase Memo
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

      {/* Filter and KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Requests</div>
            <div className="text-lg font-bold text-slate-900">{memos.length}</div>
          </div>
          <FileText className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-600">Pending Approval</div>
            <div className="text-lg font-bold text-amber-600 font-mono">
              {memos.filter(m => m.status === 'Submitted').length}
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Approved for PO</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">
              {memos.filter(m => m.status === 'Approved').length}
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-blue-600">Converted to PO</div>
            <div className="text-lg font-bold text-blue-600 font-mono">
              {memos.filter(m => m.status === 'Converted to PO').length}
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Memo #, Supplier, Staff, Department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-1">
          {['ALL', 'Submitted', 'Approved', 'Converted to PO', 'Draft', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-mono font-medium transition-colors border ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-300 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
              <th className="p-2.5">Memo Number</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Requested By</th>
              <th className="p-2.5">Destination Warehouse</th>
              <th className="p-2.5">Supplier / Dept</th>
              <th className="p-2.5 text-center">Items</th>
              <th className="p-2.5 text-center">Priority</th>
              <th className="p-2.5 text-center">Status</th>
              <th className="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {filteredMemos.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500 font-sans">
                  No Purchase Memos found matching criteria.
                </td>
              </tr>
            ) : (
              filteredMemos.map((memo) => (
                <tr key={memo.id} className="hover:bg-amber-50/50 transition-colors">
                  <td className="p-2.5 font-bold text-slate-900">
                    <button
                      type="button"
                      onClick={() => setSelectedMemo(memo)}
                      className="text-orange-600 hover:underline font-bold text-left"
                    >
                      {memo.memoNumber}
                    </button>
                  </td>
                  <td className="p-2.5 text-slate-600">{memo.requestDate}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-800">
                    {memo.requestedByStaffName}
                  </td>
                  <td className="p-2.5 text-slate-700">
                    <span className="flex items-center gap-1 font-sans">
                      <WarehouseIcon className="w-3 h-3 text-slate-400" />
                      {memo.destinationWarehouseName}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="font-sans font-medium text-slate-900">{memo.supplierName || 'Any Supplier'}</div>
                    <div className="text-[10px] text-slate-500">{memo.department}</div>
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-800">
                    {memo.items.length} items ({memo.items.reduce((acc, i) => acc + i.requestedQty, 0)} units)
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border ${
                      memo.priority === 'URGENT' ? 'bg-red-100 text-red-800 border-red-300' :
                      memo.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      memo.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                      'bg-slate-100 text-slate-700 border-slate-300'
                    }`}>
                      {memo.priority}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <StatusBadge status={memo.status} size="sm" />
                  </td>
                  <td className="p-2.5 text-right space-x-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setSelectedMemo(memo)}
                    >
                      View
                    </Button>
                    
                    {memo.status === 'Submitted' && (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onApproveMemo(memo.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white font-bold"
                      >
                        Approve
                      </Button>
                    )}

                    {memo.status === 'Approved' && (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onConvertToPO(memo)}
                        className="bg-orange-600 hover:bg-orange-700 border-orange-700 text-white font-bold"
                      >
                        Convert to PO
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE PURCHASE MEMO MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Purchase Memo (Non-Financial Intent)"
        size="xl"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-[#FAF8F5] border border-amber-200 p-3 text-slate-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900">Non-Financial Document:</span> A Purchase Memo records internal demand requirements. It does not commit company funds or generate account payables until authorized and converted into an official Purchase Order.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Supplier (Optional)</label>
              <Input
                type="text"
                placeholder="e.g. Apex Bearings or leave blank"
                value={memoSupplier}
                onChange={(e) => setMemoSupplier(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Department</label>
              <select
                value={memoDept}
                onChange={(e) => setMemoDept(e.target.value)}
                className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                {['Motor Spares', 'Hardware & Mechanical', 'Fasteners & Fixtures', 'Lubricants & Fluids', 'Safety Equipment', 'Electrical & Power'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Destination Warehouse</label>
              <select
                value={destWarehouseId}
                onChange={(e) => setDestWarehouseId(e.target.value)}
                className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Priority</label>
              <select
                value={memoPriority}
                onChange={(e) => setMemoPriority(e.target.value as any)}
                className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="LOW">Low - Routine Stock</option>
                <option value="MEDIUM">Medium - Normal Replenishment</option>
                <option value="HIGH">High - Customer Backlog</option>
                <option value="URGENT">Urgent - Machine / Operation Down</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">Justification & Notes</label>
              <Input
                type="text"
                placeholder="Reason for procurement request..."
                value={memoNotes}
                onChange={(e) => setMemoNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Item Add Strip */}
          <div className="border border-slate-300 p-3 bg-slate-50 space-y-2">
            <div className="font-bold uppercase tracking-wider text-slate-800">Add Requested Items</div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-6">
                <label className="block text-[11px] text-slate-600 font-mono mb-1">Catalog Item</label>
                <select
                  value={selectedSku}
                  onChange={(e) => {
                    setSelectedSku(e.target.value);
                    const itm = inventoryItems.find(i => i.sku === e.target.value);
                    if (itm) setEstimatedCost(itm.unitCost ?? itm.cost ?? 0);
                  }}
                  className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select Item from Product Master...</option>
                  {inventoryItems.map(i => {
                    const itemCost = i.unitCost ?? i.cost ?? 0;
                    return (
                      <option key={i.sku} value={i.sku}>
                        [{i.sku}] {i.name} (Cost: ${itemCost.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-600 font-mono mb-1">Req Qty</label>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-600 font-mono mb-1">Est Unit Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddItemToMemo}
                  disabled={!selectedSku}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Add Line
                </Button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-300 overflow-x-auto max-h-48">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Item Description</th>
                  <th className="p-2 text-center">Req Qty</th>
                  <th className="p-2 text-right">Est Cost</th>
                  <th className="p-2 text-right">Est Total</th>
                  <th className="p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {memoItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 font-sans">
                      No items added to this memo yet.
                    </td>
                  </tr>
                ) : (
                  memoItems.map((item) => (
                    <tr key={item.sku} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2 font-sans">{item.description}</td>
                      <td className="p-2 text-center font-bold">{item.requestedQty}</td>
                      <td className="p-2 text-right">${(item.estimatedUnitCost || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">
                        ${((item.estimatedUnitCost || 0) * item.requestedQty).toFixed(2)}
                      </td>
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

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-slate-600 font-mono text-xs">
              Total Estimated Requirement:{' '}
              <span className="font-bold text-slate-900">
                ${memoItems.reduce((acc, i) => acc + (i.estimatedUnitCost || 0) * i.requestedQty, 0).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveMemo('Draft')}
                className="bg-slate-100"
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveMemo('Submitted')}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                Submit for Approval
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* VIEW MEMO DETAIL MODAL */}
      {selectedMemo && (
        <Modal
          isOpen={!!selectedMemo}
          onClose={() => setSelectedMemo(null)}
          title={`Purchase Memo: ${selectedMemo.memoNumber}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-300 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Status</div>
                <StatusBadge status={selectedMemo.status} size="sm" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Priority</div>
                <div className="font-bold text-slate-800">{selectedMemo.priority}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Date Requested</div>
                <div className="font-bold text-slate-800">{selectedMemo.requestDate}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Requested By</div>
                <div className="font-bold text-slate-800">{selectedMemo.requestedByStaffName}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-500 uppercase">Destination Warehouse</div>
                <div className="font-bold text-slate-800 flex items-center gap-1 font-sans">
                  <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                  {selectedMemo.destinationWarehouseName}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-500 uppercase">Target Vendor / Sourcing</div>
                <div className="font-bold text-slate-800">{selectedMemo.supplierName || 'Open Vendor Quotation'}</div>
              </div>
            </div>

            {selectedMemo.notes && (
              <div className="p-2.5 bg-[#FAF8F5] border border-amber-200 text-slate-700">
                <span className="font-bold text-amber-900">Notes & Justification: </span>
                {selectedMemo.notes}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-300 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-center">Req Qty</th>
                    <th className="p-2 text-right">Est Unit Cost</th>
                    <th className="p-2 text-right">Est Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {selectedMemo.items.map((item) => (
                    <tr key={item.sku}>
                      <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2 font-sans">{item.description}</td>
                      <td className="p-2 text-center font-bold">{item.requestedQty}</td>
                      <td className="p-2 text-right">${(item.estimatedUnitCost || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">
                        ${((item.estimatedUnitCost || 0) * item.requestedQty).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Memo
              </Button>

              <div className="flex items-center gap-2">
                {selectedMemo.status === 'Submitted' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onRejectMemo(selectedMemo.id, 'Procurement quota exceeded');
                        setSelectedMemo(null);
                      }}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Reject Memo
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onApproveMemo(selectedMemo.id);
                        setSelectedMemo({ ...selectedMemo, status: 'Approved' });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      Approve Memo
                    </Button>
                  </>
                )}

                {selectedMemo.status === 'Approved' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onConvertToPO(selectedMemo);
                      setSelectedMemo(null);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Convert to Official Purchase Order
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMemo(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
