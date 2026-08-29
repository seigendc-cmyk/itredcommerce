import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Monitor, 
  Truck, 
  Users, 
  DollarSign, 
  MapPin, 
  Phone, 
  Mail, 
  ShoppingBag,
  Layers,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { Branch, Terminal, StaffMember, InventoryItem } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface BranchListViewProps {
  branches: Branch[];
  terminals: Terminal[];
  inventoryItems: InventoryItem[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onSelectBranch: (branch: Branch) => void;
  onLaunchTransfer: (branchId: string) => void;
  onLaunchPOS: (branchId: string) => void;
  onCreateBranch: (branch: Branch) => void;
}

export const BranchListView: React.FC<BranchListViewProps> = ({
  branches,
  terminals,
  inventoryItems,
  currentStaff,
  onBackToLanding,
  onSelectBranch,
  onLaunchTransfer,
  onLaunchPOS,
  onCreateBranch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Form State
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newManager, setNewManager] = useState(currentStaff.name);
  const [newPhone, setNewPhone] = useState('+1 (555) 234-5678');
  const [newEmail, setNewEmail] = useState('branch@itred.com');
  const [newNotes, setNewNotes] = useState('');

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.managerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalTerminals = terminals.length;
  const totalBranchStockUnits = inventoryItems.reduce((acc, i) => acc + i.stockOnHand, 0);

  const handleSaveNewBranch = () => {
    if (!newCode || !newName) {
      alert('Please provide a branch code and name.');
      return;
    }

    const newBranch: Branch = {
      id: newCode.toUpperCase(),
      code: newCode.toUpperCase(),
      name: newName,
      address: newAddress || 'Commercial Retail District',
      managerName: newManager,
      contactPhone: newPhone,
      email: newEmail,
      status: 'ACTIVE',
      isDefault: branches.length === 0,
      notes: newNotes,
    };

    onCreateBranch(newBranch);
    setIsAddModalOpen(false);
    setNewCode('');
    setNewName('');
    setAlertNotice(`Branch ${newBranch.name} (${newBranch.code}) created successfully.`);
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
              <Building2 className="w-4 h-4 text-orange-400" />
              Store Branches & Retail Showrooms
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Commercial Sales Outlets, POS Cashier Lanes & Customer Storefronts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-orange-600 hover:bg-orange-700 border-orange-700 font-bold"
          >
            Register Store Branch
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
            <div className="text-[10px] font-mono uppercase text-slate-500">Retail Branches</div>
            <div className="text-lg font-bold text-slate-900">{branches.length} Outlets</div>
          </div>
          <Building2 className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500">Assigned POS Terminals</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{totalTerminals} Terminals</div>
          </div>
          <Monitor className="w-6 h-6 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-600">Active Sales Outlets</div>
            <div className="text-lg font-bold text-amber-600 font-mono">
              {branches.filter(b => b.status === 'ACTIVE').length} Online
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-amber-500" />
        </div>

        <div className="bg-white border border-slate-300 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-emerald-600">Location Rule Enforced</div>
            <div className="text-sm font-bold text-emerald-700">Vendor → WH → Branch</div>
          </div>
          <Truck className="w-6 h-6 text-emerald-500" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-300 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search branches by code, name, address, manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredBranches.length} of {branches.length} store branches
        </div>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBranches.map((branch) => {
          const branchTerminals = terminals.filter(t => t.branchId === branch.id);
          return (
            <div 
              key={branch.id}
              className="bg-white border border-slate-300 p-4 space-y-4 hover:border-orange-400 transition-all shadow-xs"
            >
              {/* Card Top */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">{branch.name}</h3>
                      {branch.isDefault && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-orange-100 text-orange-800 border border-orange-300 uppercase">
                          Default Branch
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>Code: {branch.code}</span>
                      <span>•</span>
                      <span>{branchTerminals.length} Assigned POS Lanes</span>
                    </div>
                  </div>
                </div>

                <StatusBadge status={branch.status} size="sm" />
              </div>

              {/* Location Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{branch.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Manager: <strong className="text-slate-800">{branch.managerName}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{branch.contactPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{branch.email}</span>
                </div>
              </div>

              {/* Terminal Badge Strip */}
              <div className="bg-slate-50 p-2 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-mono text-slate-700">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" />
                  <span>POS Terminals:</span>
                  {branchTerminals.length === 0 ? (
                    <span className="text-slate-400 italic">No terminals assigned</span>
                  ) : (
                    branchTerminals.map(t => (
                      <span key={t.id} className="px-1.5 py-0.2 bg-white border border-slate-300 font-bold text-[10px]">
                        {t.code}
                      </span>
                    ))
                  )}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold">POS Ready</span>
              </div>

              {/* Action Strip */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onLaunchPOS(branch.id)}
                    leftIcon={<ShoppingBag className="w-3 h-3 text-orange-600" />}
                    className="bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100 font-bold"
                  >
                    Open POS Lane
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onLaunchTransfer(branch.id)}
                    leftIcon={<Truck className="w-3 h-3 text-blue-600" />}
                  >
                    Stock Transfer
                  </Button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectBranch(branch)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Branch Workspace
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD BRANCH MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Store Branch"
        size="lg"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Branch Code *</label>
              <Input
                type="text"
                placeholder="e.g. BR-03"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="font-mono uppercase font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Branch Name *</label>
              <Input
                type="text"
                placeholder="e.g. Westside Automotive & Hardware"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Store Address</label>
            <Input
              type="text"
              placeholder="Commercial retail strip address..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Branch Manager</label>
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
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Store Notes</label>
            <Input
              type="text"
              placeholder="Store format, customer trade counter, opening hours..."
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
              onClick={handleSaveNewBranch}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Register Store Branch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
