import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Warehouse as WarehouseIcon, 
  Building2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  FileText, 
  ShieldCheck,
  PackageCheck,
  Eye,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { 
  StockTransfer, 
  StockTransferStatus, 
  Warehouse, 
  Branch, 
  InventoryItem, 
  StaffMember,
  ConnectedShopConfig 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';
import { NewTransferModal } from './NewTransferModal';
import { PeerStockLookupModal } from './PeerStockLookupModal';

export interface StockTransfersViewProps {
  transfers?: StockTransfer[];
  warehouses?: Warehouse[];
  branches?: Branch[];
  inventoryItems?: InventoryItem[];
  connectedShops?: ConnectedShopConfig[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onCreateTransfer: (transfer: StockTransfer) => void;
  onApproveTransfer: (transferId: string) => void;
  onDispatchTransfer: (transferId: string) => void;
  onReceiveTransfer: (transferId: string) => void;
  onRejectTransfer: (transferId: string, reason: string) => void;
}

export const StockTransfersView: React.FC<StockTransfersViewProps> = ({
  transfers = [],
  warehouses = [],
  branches = [],
  inventoryItems = [],
  connectedShops = [],
  currentStaff,
  onBackToLanding,
  onCreateTransfer,
  onApproveTransfer,
  onDispatchTransfer,
  onReceiveTransfer,
  onRejectTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isPeerLookupOpen, setIsPeerLookupOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const safeTransfers = Array.isArray(transfers) ? transfers : [];

  const transferStatuses = ['ALL', 'Requested', 'Approved', 'Dispatched', 'In Transit', 'Received', 'Draft', 'Rejected', 'Cancelled'];

  const filteredTransfers = safeTransfers.filter(t => {
    const matchesSearch = 
      (t.transferNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.originLocationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.destinationLocationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.requestedByStaffName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.carrierVehicle && t.carrierVehicle.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  const totalInTransit = safeTransfers.filter(t => t.status === 'In Transit' || t.status === 'Dispatched').length;
  const totalPendingApproval = safeTransfers.filter(t => t.status === 'Requested').length;
  const totalReceived = safeTransfers.filter(t => t.status === 'Received').length;
  const totalTransitValuation = safeTransfers
    .filter(t => t.status === 'In Transit' || t.status === 'Dispatched')
    .reduce((acc, t) => acc + (t.totalValuation || 0), 0);

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
              Stock Transfers & Multi-Location Logistics
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Warehouse Hub Replenishment, Branch Peer Rebalancing & Transit Manifests
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPeerLookupOpen(true)}
            leftIcon={<Globe className="w-3.5 h-3.5 text-blue-400" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold"
          >
            Peer Stock Lookup
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-orange-600 hover:bg-orange-700 border-orange-700 font-bold"
          >
            Create Stock Transfer
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Waybills</div>
            <div className="text-lg font-bold text-slate-900">{transfers.length} Transfers</div>
          </div>
          <FileText className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-600">Pending Approval</div>
            <div className="text-lg font-bold text-amber-600 font-mono">{totalPendingApproval} Orders</div>
          </div>
          <Clock className="w-6 h-6 text-amber-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-blue-600">Currently in Transit</div>
            <div className="text-lg font-bold text-blue-600 font-mono">{totalInTransit} Shipments</div>
          </div>
          <Truck className="w-6 h-6 text-blue-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Transit Inventory Value</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">${totalTransitValuation.toFixed(2)}</div>
          </div>
          <PackageCheck className="w-6 h-6 text-emerald-500" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transfer #, origin, destination, carrier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {transferStatuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-mono font-medium transition-colors border whitespace-nowrap ${
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

      {/* Main Transfers Table */}
      <div className="bg-white border border-slate-300 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase text-[11px]">
              <th className="p-2.5">Transfer #</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Origin (Source)</th>
              <th className="p-2.5">Destination</th>
              <th className="p-2.5 text-center">Items (Units)</th>
              <th className="p-2.5 text-right">Transfer Valuation</th>
              <th className="p-2.5">Carrier / Vehicle</th>
              <th className="p-2.5 text-center">Status</th>
              <th className="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                  No stock transfers found matching criteria.
                </td>
              </tr>
            ) : (
              filteredTransfers.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-900">
                    <button
                      type="button"
                      onClick={() => setSelectedTransfer(tr)}
                      className="text-orange-600 hover:underline font-bold text-left"
                    >
                      {tr.transferNumber}
                    </button>
                  </td>
                  <td className="p-2.5 text-slate-600">{tr.requestDate}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-800">
                    {tr.originLocationName}
                  </td>
                  <td className="p-2.5 font-sans font-medium text-slate-800">
                    {tr.destinationLocationName}
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-900">
                    {tr.totalItemsCount} units
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    ${tr.totalValuation.toFixed(2)}
                  </td>
                  <td className="p-2.5 text-slate-600 font-sans text-[11px]">
                    {tr.carrierVehicle || 'Internal Transport'}
                  </td>
                  <td className="p-2.5 text-center">
                    <StatusBadge status={tr.status} size="sm" />
                  </td>
                  <td className="p-2.5 text-right space-x-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setSelectedTransfer(tr)}
                    >
                      View
                    </Button>

                    {tr.status === 'Requested' && (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onApproveTransfer(tr.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Approve
                      </Button>
                    )}

                    {tr.status === 'Approved' && (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onDispatchTransfer(tr.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        leftIcon={<Truck className="w-3 h-3" />}
                      >
                        Dispatch
                      </Button>
                    )}

                    {(tr.status === 'In Transit' || tr.status === 'Dispatched') && (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onReceiveTransfer(tr.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        leftIcon={<PackageCheck className="w-3 h-3" />}
                      >
                        Receive
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedTransfer && (
        <Modal
          isOpen={!!selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          title={`Stock Transfer Waybill: ${selectedTransfer.transferNumber}`}
          size="lg"
        >
          <div className="space-y-4 text-xs font-mono">
            {/* Header Strip */}
            <div className="bg-slate-50 border border-slate-300 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Status</div>
                <StatusBadge status={selectedTransfer.status} size="sm" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Request Date</div>
                <div className="font-bold text-slate-900">{selectedTransfer.requestDate}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Requested By</div>
                <div className="font-bold text-slate-900 font-sans">{selectedTransfer.requestedByStaffName}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Carrier / Vehicle</div>
                <div className="font-bold text-slate-900">{selectedTransfer.carrierVehicle}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-400 uppercase">Origin Facility</div>
                <div className="font-bold text-slate-900 font-sans">{selectedTransfer.originLocationName}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-slate-400 uppercase">Destination Facility</div>
                <div className="font-bold text-slate-900 font-sans">{selectedTransfer.destinationLocationName}</div>
              </div>
            </div>

            {selectedTransfer.notes && (
              <div className="p-2.5 bg-[#FAF8F5] border border-amber-200 text-slate-700">
                <span className="font-bold text-amber-900">Transfer Notes: </span>
                {selectedTransfer.notes}
              </div>
            )}

            {/* Line Items */}
            <div className="border border-slate-300 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-center">Requested</th>
                    <th className="p-2 text-center">Dispatched</th>
                    <th className="p-2 text-center">Received</th>
                    <th className="p-2 text-right">Unit Cost</th>
                    <th className="p-2 text-right">Total ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedTransfer.items.map((item) => (
                    <tr key={item.sku} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2 font-sans">{item.description}</td>
                      <td className="p-2 text-center">{item.requestedQty}</td>
                      <td className="p-2 text-center font-bold text-blue-600">{item.dispatchedQty}</td>
                      <td className="p-2 text-center font-bold text-emerald-600">{item.receivedQty}</td>
                      <td className="p-2 text-right">${item.unitCost.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">${(item.requestedQty * item.unitCost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Valuation */}
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
              <div className="text-slate-400 text-xs">
                Total Units in Transit: <span className="text-white font-bold">{selectedTransfer.totalItemsCount} units</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase mr-2">Total Consignment Value:</span>
                <span className="text-base font-bold text-emerald-400">${selectedTransfer.totalValuation.toFixed(2)}</span>
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
                Print Waybill Manifest
              </Button>

              <div className="flex items-center gap-2">
                {selectedTransfer.status === 'Requested' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onRejectTransfer(selectedTransfer.id, 'Capacity unavailable');
                        setSelectedTransfer(null);
                      }}
                      className="text-red-600 border-red-300"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onApproveTransfer(selectedTransfer.id);
                        setSelectedTransfer({ ...selectedTransfer, status: 'Approved' });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      Approve Transfer
                    </Button>
                  </>
                )}

                {selectedTransfer.status === 'Approved' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onDispatchTransfer(selectedTransfer.id);
                      setSelectedTransfer({ ...selectedTransfer, status: 'Dispatched' });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    leftIcon={<Truck className="w-3.5 h-3.5" />}
                  >
                    Dispatch Freight
                  </Button>
                )}

                {(selectedTransfer.status === 'In Transit' || selectedTransfer.status === 'Dispatched') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onReceiveTransfer(selectedTransfer.id);
                      setSelectedTransfer({ ...selectedTransfer, status: 'Received' });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                  >
                    Confirm Goods Received at Destination
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTransfer(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* NEW TRANSFER MODAL */}
      <NewTransferModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSaveTransfer={(newTr) => {
          onCreateTransfer(newTr);
          setAlertNotice(`Stock transfer ${newTr.transferNumber} created successfully.`);
          setTimeout(() => setAlertNotice(null), 3500);
        }}
        warehouses={warehouses}
        branches={branches}
        inventoryItems={inventoryItems}
        currentStaff={currentStaff}
      />

      {/* PEER STOCK LOOKUP MODAL */}
      <PeerStockLookupModal
        isOpen={isPeerLookupOpen}
        onClose={() => setIsPeerLookupOpen(false)}
        inventoryItems={inventoryItems}
        branches={branches}
        warehouses={warehouses}
        connectedShops={connectedShops}
        onRequestTransfer={(originId, originName, sku) => {
          setIsNewModalOpen(true);
        }}
      />
    </div>
  );
};
