import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  FileText, 
  ArrowLeft, 
  ClipboardCheck, 
  PackageCheck, 
  Warehouse as WarehouseIcon,
  Building2, 
  Calendar, 
  Eye, 
  CheckCircle2, 
  Clock, 
  XCircle,
  FileCheck2,
  DollarSign,
  Printer,
  ShoppingBag
} from 'lucide-react';
import { PurchaseOrder, POStatus, StaffMember, Warehouse, InventoryItem, PurchaseMemo } from '../../../types';
import { Button } from '../../ui/Button';
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { Alert } from '../../ui/Alert';
import { INITIAL_PURCHASE_ORDERS, INITIAL_WAREHOUSES, INITIAL_INVENTORY_ITEMS } from '../../../data/mockData';

export interface PurchasingViewProps {
  initialStatusFilter?: POStatus;
  currentStaff: StaffMember;
  purchaseOrders?: PurchaseOrder[];
  warehouses?: Warehouse[];
  inventoryItems?: InventoryItem[];
  memoToConvert?: PurchaseMemo;
  onBackToLanding: () => void;
  onNavigateToMemos?: () => void;
  onNavigateToReceive?: (poNumber?: string) => void;
  onSavePO?: (po: PurchaseOrder) => void;
}

export const PurchasingView: React.FC<PurchasingViewProps> = ({
  initialStatusFilter = 'All',
  currentStaff,
  purchaseOrders = INITIAL_PURCHASE_ORDERS,
  warehouses = INITIAL_WAREHOUSES,
  inventoryItems = INITIAL_INVENTORY_ITEMS,
  memoToConvert,
  onBackToLanding,
  onNavigateToMemos,
  onNavigateToReceive,
  onSavePO,
}) => {
  const [activeFilter, setActiveFilter] = useState<POStatus>(initialStatusFilter);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(!!memoToConvert);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const poFilters: POStatus[] = ['All', 'Open', 'Part Received', 'Completed', 'Rejected', 'Cancelled'];

  const filteredOrders = purchaseOrders.filter((po) => {
    if (activeFilter === 'All') return true;
    return po.status === activeFilter;
  });

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'poNumber',
      header: 'PO Number',
      isMono: true,
      width: '130px',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedPO(row)}
          className="font-bold text-orange-600 hover:underline text-left"
        >
          {row.poNumber}
        </button>
      ),
    },
    {
      key: 'supplierName',
      header: 'Supplier / Vendor',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.supplierName}</div>
          <div className="text-[11px] text-slate-500 font-mono">Code: {row.supplierCode}</div>
        </div>
      ),
    },
    {
      key: 'destinationWarehouseName',
      header: 'Destination Hub',
      render: (row) => (
        <div className="flex items-center gap-1 text-slate-700 text-xs">
          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.destinationWarehouseName || 'Central Distribution (WH-01)'}</span>
        </div>
      ),
    },
    {
      key: 'dateCreated',
      header: 'Date Issued',
      isMono: true,
      width: '100px',
    },
    {
      key: 'deliveryDueDate',
      header: 'Delivery Due',
      isMono: true,
      width: '100px',
    },
    {
      key: 'totalItems',
      header: 'Items',
      align: 'center',
      isMono: true,
      width: '80px',
      render: (row) => (
        <span className="font-bold text-slate-800">{row.totalItems} units</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total ($)',
      align: 'right',
      isMono: true,
      width: '110px',
      render: (row) => (
        <span className="font-bold text-slate-900">${row.totalAmount.toFixed(2)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
  ];

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
              <Truck className="w-4 h-4 text-orange-400" />
              Purchase Orders & Procurement Registry
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Commercial Vendor Orders, SOH Inward Tracking & Supplier Commitments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToMemos && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToMemos}
              leftIcon={<FileCheck2 className="w-3.5 h-3.5 text-blue-400" />}
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold"
            >
              Purchase Memos
            </Button>
          )}

          {onNavigateToReceive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToReceive()}
              leftIcon={<PackageCheck className="w-3.5 h-3.5 text-emerald-400" />}
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold"
            >
              Goods Inward (Receive)
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-orange-600 hover:bg-orange-700 border-orange-700 font-bold"
          >
            New Purchase Order
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

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Purchase Orders</div>
            <div className="text-lg font-bold text-slate-900">{purchaseOrders.length}</div>
          </div>
          <ShoppingBag className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-600">Open For Receiving</div>
            <div className="text-lg font-bold text-amber-600 font-mono">
              {purchaseOrders.filter((p) => p.status === 'Open' || p.status === 'Part Received').length}
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Completed Orders</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">
              {purchaseOrders.filter((p) => p.status === 'Completed').length}
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Committed Spend</div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              ${purchaseOrders.reduce((acc, p) => acc + p.totalAmount, 0).toFixed(2)}
            </div>
          </div>
          <DollarSign className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-2 border border-slate-300">
        {poFilters.map((filter) => {
          const count = filter === 'All' 
            ? purchaseOrders.length 
            : purchaseOrders.filter((p) => p.status === filter).length;
          
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer rounded-none border ${
                activeFilter === filter
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span>{filter}</span>
              <span className={`px-1.5 py-0.2 text-[10px] font-mono ${
                activeFilter === filter ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-300">
        <DataTable
          data={filteredOrders}
          columns={columns}
          keyField="poNumber"
          onRowClick={(row) => setSelectedPO(row)}
          emptyTitle="No purchase orders found"
          emptyDescription="No purchase orders found matching the selected status filter."
        />
      </div>

      {/* Detail PO Modal */}
      {selectedPO && (
        <Modal
          isOpen={!!selectedPO}
          onClose={() => setSelectedPO(null)}
          title={`Purchase Order: ${selectedPO.poNumber}`}
          size="lg"
        >
          <div className="space-y-4 text-xs font-mono">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 border border-slate-200 text-slate-700">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Vendor</div>
                <div className="font-bold text-slate-900 font-sans">{selectedPO.supplierName}</div>
                <div className="text-[10px] text-slate-500 font-mono">{selectedPO.supplierCode}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Destination Hub</div>
                <div className="font-bold text-slate-900 font-sans flex items-center gap-1">
                  <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                  {selectedPO.destinationWarehouseName || 'Central Warehouse'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Issue Date</div>
                <div className="font-bold text-slate-900">{selectedPO.dateCreated}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Delivery Due</div>
                <div className="font-bold text-slate-900">{selectedPO.deliveryDueDate}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Payment Terms</div>
                <div className="font-bold text-slate-900">{selectedPO.paymentTerms}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Authorized By</div>
                <div className="font-bold text-slate-900">{selectedPO.authorizedBy}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-400 uppercase">Status</div>
                <div className="mt-0.5">
                  <StatusBadge status={selectedPO.status} size="sm" />
                </div>
              </div>
            </div>

            {selectedPO.notes && (
              <div className="p-2.5 bg-[#FAF8F5] border border-amber-200 text-slate-700">
                <span className="font-bold text-amber-900">Notes: </span>
                {selectedPO.notes}
              </div>
            )}

            {/* Line Items Table */}
            <div className="border border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-center">Ordered</th>
                    <th className="p-2 text-center">Received</th>
                    <th className="p-2 text-right">Unit Cost</th>
                    <th className="p-2 text-right">Total ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPO.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2 font-sans">{item.description}</td>
                      <td className="p-2 text-center">{item.orderedQty}</td>
                      <td className="p-2 text-center font-bold text-emerald-600">{item.receivedQty}</td>
                      <td className="p-2 text-right">${item.unitCost.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">${item.totalCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
              <div className="text-slate-400 text-xs">
                Total Ordered Items: <span className="text-white font-bold">{selectedPO.totalItems} units</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase">Gross Commitment</div>
                <div className="text-base font-bold text-white">${selectedPO.totalAmount.toFixed(2)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print PO Document
              </Button>

              <div className="flex items-center gap-2">
                {(selectedPO.status === 'Open' || selectedPO.status === 'Part Received') && onNavigateToReceive && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const poNum = selectedPO.poNumber;
                      setSelectedPO(null);
                      onNavigateToReceive(poNum);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                  >
                    Receive Stock into Warehouse
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPO(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE PO MODAL */}
      <PurchaseOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSavePO={(newPO) => {
          onSavePO?.(newPO);
          setAlertNotice(`Purchase Order ${newPO.poNumber} created successfully.`);
          setTimeout(() => setAlertNotice(null), 3500);
        }}
        warehouses={warehouses}
        inventoryItems={inventoryItems}
        currentStaff={currentStaff}
        initialSupplier={memoToConvert?.supplierName}
        initialNotes={memoToConvert ? `Converted from Memo ${memoToConvert.memoNumber}. ${memoToConvert.notes}` : undefined}
      />
    </div>
  );
};
