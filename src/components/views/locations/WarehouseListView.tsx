import React, { useState } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  PackageCheck, 
  Truck, 
  ClipboardCheck, 
  Sliders, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Layers, 
  Boxes,
  TrendingUp,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Warehouse, InventoryItem, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface WarehouseListViewProps {
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onSelectWarehouse: (warehouse: Warehouse) => void;
  onLaunchReceiveStock: (warehouseId?: string) => void;
  onLaunchTransfer: (sourceWarehouseId?: string) => void;
  onCreateWarehouse: (warehouse: Warehouse) => void;
}

export const WarehouseListView: React.FC<WarehouseListViewProps> = ({
  warehouses,
  inventoryItems,
  currentStaff,
  onBackToLanding,
  onSelectWarehouse,
  onLaunchReceiveStock,
  onLaunchTransfer,
  onCreateWarehouse,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Form State
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newManager, setNewManager] = useState(currentStaff.name);
  const [newPhone, setNewPhone] = useState('+1 (555) 000-0000');
  const [newEmail, setNewEmail] = useState('warehouse@itred.com');
  const [newCapacity, setNewCapacity] = useState(3000);
  const [newNotes, setNewNotes] = useState('');

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.managerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCapacity = warehouses.reduce((acc, w) => acc + w.totalCapacitySqM, 0);
  const totalEnterpriseSKUs = inventoryItems.length;
  const totalStockUnits = inventoryItems.reduce((acc, i) => acc + (i.stockOnHand || 0), 0);
  const totalEnterpriseValuation = inventoryItems.reduce((acc, i) => acc + ((i.unitCost ?? i.cost ?? 0) * (i.stockOnHand || 0)), 0);

  const handleSaveNewWarehouse = () => {
    if (!newCode || !newName) {
      alert('Please enter a warehouse code and name.');
      return;
    }

    const newWh: Warehouse = {
      id: newCode.toUpperCase(),
      code: newCode.toUpperCase(),
      name: newName,
      address: newAddress || 'Industrial Park Logistics Strip',
      managerName: newManager,
      contactPhone: newPhone,
      email: newEmail,
      totalCapacitySqM: newCapacity,
      status: 'ACTIVE',
      isDefault: warehouses.length === 0,
      notes: newNotes,
    };

    onCreateWarehouse(newWh);
    setIsAddModalOpen(false);
    setNewCode('');
    setNewName('');
    setAlertNotice(`Warehouse ${newWh.name} (${newWh.code}) registered successfully.`);
    setTimeout(() => setAlertNotice(null), 3500);
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
              <WarehouseIcon className="w-4 h-4 text-orange-400" />
              Central Warehouses & Distribution Hubs
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Bulk Logistics Staging, Supplier Freight Inward & Branch Replenishment Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onLaunchReceiveStock()}
            leftIcon={<PackageCheck className="w-3.5 h-3.5 text-emerald-400" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold"
          >
            Receive Supplier Freight
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-orange-600 hover:bg-orange-700 border-orange-700 font-bold"
          >
            Add Warehouse Facility
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

      {/* Enterprise KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Active Storage Hubs</div>
            <div className="text-lg font-bold text-slate-900">{warehouses.length} Facilities</div>
          </div>
          <WarehouseIcon className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Total Storage Capacity</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{totalCapacity.toLocaleString()} m²</div>
          </div>
          <Boxes className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-600">Enterprise Stock on Hand</div>
            <div className="text-lg font-bold text-amber-600 font-mono">{totalStockUnits.toLocaleString()} units</div>
          </div>
          <Layers className="w-6 h-6 text-amber-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Total Inventory Valuation</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">${totalEnterpriseValuation.toFixed(2)}</div>
          </div>
          <TrendingUp className="w-6 h-6 text-emerald-500" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-300 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search warehouse by name, code, address, manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredWarehouses.length} of {warehouses.length} warehouse hubs
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredWarehouses.map((wh) => (
          <div 
            key={wh.id}
            className="bg-white border border-slate-300 p-4 space-y-4 hover:border-orange-400 transition-all shadow-xs"
          >
            {/* Card Top */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  <WarehouseIcon className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">{wh.name}</h3>
                    {wh.isDefault && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-orange-100 text-orange-800 border border-orange-300 uppercase">
                        Default Hub
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                    <span>Code: {wh.code}</span>
                    <span>•</span>
                    <span>Capacity: {wh.totalCapacitySqM.toLocaleString()} m²</span>
                  </div>
                </div>
              </div>

              <StatusBadge status={wh.status} size="sm" />
            </div>

            {/* Location Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{wh.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Manager: <strong className="text-slate-800">{wh.managerName}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono">{wh.contactPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{wh.email}</span>
              </div>
            </div>

            {wh.notes && (
              <div className="text-[11px] bg-[#FAF8F5] p-2 border border-amber-200 text-slate-600">
                {wh.notes}
              </div>
            )}

            {/* Operational Action Strip */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onLaunchReceiveStock(wh.id)}
                  leftIcon={<PackageCheck className="w-3 h-3 text-emerald-600" />}
                >
                  Receive Stock
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onLaunchTransfer(wh.id)}
                  leftIcon={<Truck className="w-3 h-3 text-blue-600" />}
                >
                  Transfer Out
                </Button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => onSelectWarehouse(wh)}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Open Warehouse Workspace
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ADD WAREHOUSE MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Warehouse / Distribution Facility"
        size="lg"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Facility Code *</label>
              <Input
                type="text"
                placeholder="e.g. WH-03"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="font-mono uppercase font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Facility Name *</label>
              <Input
                type="text"
                placeholder="e.g. Eastern Industrial Depot"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Physical Address</label>
            <Input
              type="text"
              placeholder="Full street address and logistics zone"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Warehouse Manager</label>
              <Input
                type="text"
                value={newManager}
                onChange={(e) => setNewManager(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Contact Phone</label>
              <Input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Floor Capacity (m²)</label>
              <Input
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(parseInt(e.target.value) || 1000)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Contact Email</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Facility Scope & Notes</label>
            <Input
              type="text"
              placeholder="e.g. Heavy spare parts staging, dangerous goods storage, pallet racking"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveNewWarehouse}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Register Warehouse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
