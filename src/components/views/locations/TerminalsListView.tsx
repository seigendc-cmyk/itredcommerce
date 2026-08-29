import React, { useState } from 'react';
import { 
  Monitor, 
  Plus, 
  Search, 
  ArrowLeft, 
  Building2, 
  ShoppingBag, 
  ShieldCheck, 
  CheckCircle2, 
  DollarSign, 
  User,
  AlertTriangle 
} from 'lucide-react';
import { Terminal, Branch, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface TerminalsListViewProps {
  terminals: Terminal[];
  branches: Branch[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onLaunchPOS: (branchId: string, terminalId: string) => void;
  onCreateTerminal: (terminal: Terminal) => void;
}

export const TerminalsListView: React.FC<TerminalsListViewProps> = ({
  terminals = [],
  branches = [],
  currentStaff,
  onBackToLanding,
  onLaunchPOS,
  onCreateTerminal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Form State
  const [termCode, setTermCode] = useState('');
  const [termName, setTermName] = useState('');
  const [branchId, setBranchId] = useState(branches?.[0]?.id || 'BR-01');
  const [termIp, setTermIp] = useState('192.168.1.110');

  const filteredTerminals = (terminals || []).filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.ipAddress && t.ipAddress.includes(searchTerm))
  );

  const handleSaveTerminal = () => {
    if (!termCode || !termName) {
      alert('Please provide terminal code and name.');
      return;
    }

    const br = branches?.find(b => b.id === branchId) || branches?.[0] || { id: 'BR-01', name: 'Main Branch' };
    const newTerm: Terminal = {
      id: termCode.toUpperCase(),
      code: termCode.toUpperCase(),
      name: termName,
      branchId: br.id,
      branchName: br.name,
      workstationType: 'COUNTER_POS',
      cashDrawerPort: 'COM1',
      receiptPrinter: 'EPSON-TM-T88VI',
      status: 'ACTIVE',
      isDefault: false,
      lastActive: 'Just now',
      ipAddress: termIp,
      currentCashierStaffId: currentStaff.id,
      currentCashierStaffName: currentStaff.name,
      dailySalesTotal: 0,
      dailyTransactionsCount: 0,
    };

    onCreateTerminal(newTerm);
    setIsAddModalOpen(false);
    setTermCode('');
    setTermName('');
    setAlertNotice(`Terminal ${newTerm.name} registered and assigned to ${br.name}.`);
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
              <Monitor className="w-4 h-4 text-orange-400" />
              POS Terminals & Cashier Checkout Lanes
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Hardware Point of Sale Lanes Assigned to Retail Branches
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
            Register POS Terminal
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

      {/* Structural Rule Banner */}
      <div className="bg-[#FAF8F5] border border-amber-300 p-3 flex items-start justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wide">
              Location Hierarchy Rule: Terminals Attached Strictly to Branches
            </div>
            <div className="text-slate-600 mt-0.5">
              Terminals cannot be attached to central warehouses. Each terminal belongs to a specific retail branch and operates on that branch's physical stock.
            </div>
          </div>
        </div>
        <StatusBadge status="Branch Level Enforced" size="sm" />
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-300 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search terminal code, description, assigned branch, IP address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          {filteredTerminals.length} Terminals Online
        </div>
      </div>

      {/* Terminals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredTerminals.map((term) => (
          <div 
            key={term.id}
            className="bg-white border border-slate-300 p-4 space-y-3 hover:border-orange-400 transition-all shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Monitor className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{term.name}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    Code: {term.code} • IP: {term.ipAddress || '192.168.1.101'}
                  </div>
                </div>
              </div>
              <StatusBadge status={term.status} size="sm" />
            </div>

            <div className="bg-slate-50 p-2.5 border border-slate-200 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500">Assigned Branch:</span>
                <span className="font-bold font-sans flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  {term.branchName}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500">Active Cashier:</span>
                <span className="font-bold font-sans">{term.currentCashierStaffName || currentStaff.name}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 border-t border-slate-200 pt-1">
                <span className="text-slate-500">Today's Sales:</span>
                <span className="font-bold text-emerald-600">${term.dailySalesTotal?.toFixed(2) || '1,420.50'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-mono">
                {term.dailyTransactionsCount || 14} invoices
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onLaunchPOS(term.branchId, term.id)}
                leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                Launch Register
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* REGISTER TERMINAL MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New POS Cashier Terminal"
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Terminal Code *</label>
              <Input
                type="text"
                placeholder="e.g. T-04"
                value={termCode}
                onChange={(e) => setTermCode(e.target.value)}
                className="font-mono uppercase font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Terminal Name / Counter *</label>
              <Input
                type="text"
                placeholder="e.g. Cashier Lane 4 - Trade"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Assign to Store Branch *</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full border border-slate-300 bg-white p-2 font-mono text-xs focus:outline-none focus:border-orange-500 font-bold"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Station IP / Local Network Endpoint</label>
            <Input
              type="text"
              value={termIp}
              onChange={(e) => setTermIp(e.target.value)}
              className="font-mono"
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
              onClick={handleSaveTerminal}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Register Terminal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
