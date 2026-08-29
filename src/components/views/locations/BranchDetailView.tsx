import React, { useState } from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Monitor, 
  Truck, 
  Users, 
  DollarSign, 
  ClipboardCheck, 
  Boxes, 
  Search, 
  Plus, 
  ShoppingBag, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight,
  TrendingUp,
  Receipt,
  FileCheck
} from 'lucide-react';
import { 
  Branch, 
  Terminal, 
  InventoryItem, 
  StockTransfer, 
  StaffMember, 
  StocktakeRecord 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface BranchDetailViewProps {
  branch: Branch;
  terminals: Terminal[];
  inventoryItems: InventoryItem[];
  transfers: StockTransfer[];
  staffMembers: StaffMember[];
  stocktakes: StocktakeRecord[];
  currentStaff: StaffMember;
  onBackToList: () => void;
  onLaunchPOS: (branchId: string, terminalId?: string) => void;
  onLaunchTransfer: (sourceBranchId: string) => void;
  onOpenPeerLookup: (sku?: string) => void;
  onReceiveTransfer: (transferId: string) => void;
  onCreateTerminal: (terminal: Terminal) => void;
  onRecordStocktake: (record: StocktakeRecord) => void;
}

export const BranchDetailView: React.FC<BranchDetailViewProps> = ({
  branch,
  terminals,
  inventoryItems,
  transfers,
  staffMembers,
  stocktakes,
  currentStaff,
  onBackToList,
  onLaunchPOS,
  onLaunchTransfer,
  onOpenPeerLookup,
  onReceiveTransfer,
  onCreateTerminal,
  onRecordStocktake,
}) => {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'TERMINALS' | 'STAFF' | 'TRANSFERS' | 'SALES' | 'STOCKTAKE'>('INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Terminal Add Modal
  const [isAddTerminalModalOpen, setIsAddTerminalModalOpen] = useState(false);
  const [termCode, setTermCode] = useState('');
  const [termName, setTermName] = useState('');
  const [termIp, setTermIp] = useState('192.168.1.105');

  // Branch stocktake modal
  const [isStocktakeModalOpen, setIsStocktakeModalOpen] = useState(false);
  const [stkCountedQty, setStkCountedQty] = useState(inventoryItems.reduce((a, b) => a + b.stockOnHand, 0));
  const [stkVariance, setStkVariance] = useState(0);

  const branchTerminals = terminals.filter(t => t.branchId === branch.id);
  const branchTransfers = transfers.filter(t => t.originLocationId === branch.id || t.destinationLocationId === branch.id);
  const branchStocktakes = stocktakes.filter(s => s.locationId === branch.id);

  const branchItems = inventoryItems.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStockUnits = inventoryItems.reduce((acc, i) => acc + i.stockOnHand, 0);
  const totalValuation = inventoryItems.reduce((acc, i) => acc + i.stockOnHand * (i.unitCost || 0), 0);

  const handleSaveTerminal = () => {
    if (!termCode || !termName) {
      alert('Please enter terminal code and name.');
      return;
    }

    const newTerm: Terminal = {
      id: termCode.toUpperCase(),
      code: termCode.toUpperCase(),
      name: termName,
      branchId: branch.id,
      branchName: branch.name,
      status: 'ONLINE',
      ipAddress: termIp,
      currentCashierStaffId: currentStaff.id,
      currentCashierStaffName: currentStaff.name,
      dailySalesTotal: 0,
      dailyTransactionsCount: 0,
      workstationType: 'COUNTER_POS',
      cashDrawerPort: 'COM1',
      receiptPrinter: 'EPSON-TM-T88VI',
      isDefault: false,
      lastActive: 'Just now',
    };

    onCreateTerminal(newTerm);
    setIsAddTerminalModalOpen(false);
    setTermCode('');
    setTermName('');
    setAlertNotice(`Terminal ${newTerm.name} registered and assigned to ${branch.name}.`);
    setTimeout(() => setAlertNotice(null), 3500);
  };

  const handleSaveStocktake = () => {
    const bookQty = totalStockUnits;
    const newStk: StocktakeRecord = {
      id: `STK-${Date.now().toString().slice(-4)}`,
      batchNo: `STK-2026-${branch.code}-M`,
      locationId: branch.id,
      locationType: 'BRANCH',
      locationName: branch.name,
      date: new Date().toISOString().split('T')[0],
      auditorStaffName: currentStaff.name,
      status: 'COMPLETED',
      itemsCount: inventoryItems.length,
      countedQty: stkCountedQty,
      bookQty: bookQty,
      varianceUnits: stkVariance,
      valuationDelta: stkVariance * 25.0,
      notes: 'Storefront retail shelf count reconciliation.',
    };

    onRecordStocktake(newStk);
    setIsStocktakeModalOpen(false);
    setAlertNotice(`Branch stocktake audit ${newStk.batchNo} reconciled.`);
    setTimeout(() => setAlertNotice(null), 3500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 border border-slate-800 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToList}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            >
              All Branches
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 text-white flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    {branch.name} ({branch.code})
                  </h2>
                  {branch.isDefault && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-orange-500/30 text-orange-300 border border-orange-500/50 uppercase">
                      Default Storefront
                    </span>
                  )}
                  <StatusBadge status={branch.status} size="sm" />
                </div>
                <p className="text-[10px] font-mono text-slate-400">
                  {branch.address} • Manager: {branch.managerName} ({branch.contactPhone})
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLaunchPOS(branch.id)}
              leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
              className="bg-orange-600 hover:bg-orange-700 border-orange-700 text-white font-bold"
            >
              Launch POS Checkout
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLaunchTransfer(branch.id)}
              leftIcon={<Truck className="w-3.5 h-3.5 text-blue-400" />}
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold"
            >
              Request Stock Transfer
            </Button>
          </div>
        </div>

        {/* Visibility Rule Notice */}
        <div className="bg-slate-800/80 border border-slate-700 p-2.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              <strong className="text-white">Strict Branch Isolation Rule:</strong> Cashiers can only checkout inventory held locally at {branch.name}. Stock at other branches is visible for lookup/transfer only.
            </span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onOpenPeerLookup()}
            className="bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600 text-[11px]"
          >
            Peer Stock Lookup Network
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

      {/* Branch Tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-2 border border-slate-300">
        {[
          { id: 'INVENTORY', label: 'Store SOH Inventory', count: branchItems.length, icon: <Boxes className="w-3.5 h-3.5" /> },
          { id: 'TERMINALS', label: 'Assigned POS Terminals', count: branchTerminals.length, icon: <Monitor className="w-3.5 h-3.5" /> },
          { id: 'STAFF', label: 'Store Staff & Cashiers', count: staffMembers.length, icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'TRANSFERS', label: 'Inbound / Outbound Transfers', count: branchTransfers.length, icon: <Truck className="w-3.5 h-3.5" /> },
          { id: 'SALES', label: 'Daily Sales & Register Summary', count: branchTerminals.length, icon: <Receipt className="w-3.5 h-3.5" /> },
          { id: 'STOCKTAKE', label: 'Shelf Stocktake Audits', count: branchStocktakes.length, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer rounded-none border ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-orange-400' : 'text-slate-500'}>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 text-[10px] font-mono ${
              activeTab === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: INVENTORY */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search branch inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => onOpenPeerLookup()}
                className="font-bold text-slate-800"
              >
                Check Other Branches Stock
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => onLaunchTransfer(branch.id)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                Request Warehouse Restock
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-center">Available SOH</th>
                  <th className="p-2.5 text-right">Retail Sell Price</th>
                  <th className="p-2.5 text-center">POS Sellable</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {branchItems.map((item) => {
                  const isOutOfStock = item.stockOnHand <= 0;
                  return (
                    <tr key={item.sku} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{item.sku}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-800">{item.name}</td>
                      <td className="p-2.5 text-slate-600">{item.category}</td>
                      <td className="p-2.5 text-center">
                        <span className={`font-bold ${isOutOfStock ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.stockOnHand} {item.unitOfMeasure}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        ${(item.retailPrice ?? item.price ?? 0).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        {isOutOfStock ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 uppercase">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                            Ready for Sale
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => onOpenPeerLookup(item.sku)}
                        >
                          Find in Network
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TERMINALS */}
      {activeTab === 'TERMINALS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-slate-300 p-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                POS Cashier Terminals Assigned to {branch.name}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Hardware point of sale terminals licensed to conduct customer sales at this branch
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddTerminalModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-slate-900 text-white font-bold"
            >
              Add POS Terminal
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {branchTerminals.map((term) => (
              <div key={term.id} className="bg-white border border-slate-300 p-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold">
                      <Monitor className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{term.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Code: {term.code} • IP: {term.ipAddress || '192.168.1.101'}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={term.status} size="sm" />
                </div>

                <div className="bg-slate-50 p-2 border border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Active Cashier</div>
                    <div className="font-bold text-slate-800">{term.currentCashierStaffName || currentStaff.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Daily Register Sales</div>
                    <div className="font-bold text-emerald-600">${term.dailySalesTotal?.toFixed(2) || '1,420.50'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onLaunchPOS(branch.id, term.id)}
                    leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                  >
                    Open POS Terminal Session
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STAFF */}
      {activeTab === 'STAFF' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-300 p-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Branch Personnel & Cashier Authorizations
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Staff members provisioned with credentials for this storefront location
            </p>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Staff Name</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">POS Pin Clearance</th>
                  <th className="p-2.5">Daily Shift Status</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {staffMembers.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold font-sans text-slate-900">{staff.name}</td>
                    <td className="p-2.5 text-slate-700">{staff.role}</td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-mono">
                        Level 2 - Standard Cashier
                      </span>
                    </td>
                    <td className="p-2.5 text-emerald-700 font-bold">Logged On / Active</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status="ACTIVE" size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSFERS */}
      {activeTab === 'TRANSFERS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-slate-300 p-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Stock Transfer Documents for {branch.name}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Track replenishment orders from central warehouse and branch peer transfers
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLaunchTransfer(branch.id)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Initiate New Transfer
            </Button>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Transfer #</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Route</th>
                  <th className="p-2.5 text-center">Items Qty</th>
                  <th className="p-2.5 text-right">Value ($)</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {branchTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                      No stock transfers found for this branch.
                    </td>
                  </tr>
                ) : (
                  branchTransfers.map((tr) => {
                    const isReceivingSide = tr.destinationLocationId === branch.id;
                    return (
                      <tr key={tr.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{tr.transferNumber}</td>
                        <td className="p-2.5 text-slate-600">{tr.requestDate}</td>
                        <td className="p-2.5 font-sans">
                          <div className="flex items-center gap-1.5 text-xs text-slate-800">
                            <span className="font-bold">{tr.originLocationName}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold">{tr.destinationLocationName}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{tr.totalItemsCount} units</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">${tr.totalValuation.toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          <StatusBadge status={tr.status} size="sm" />
                        </td>
                        <td className="p-2.5 text-right space-x-1">
                          {isReceivingSide && (tr.status === 'In Transit' || tr.status === 'Dispatched') && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => onReceiveTransfer(tr.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              Receive Goods
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SALES */}
      {activeTab === 'SALES' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-300 p-3">
              <div className="text-[10px] font-mono uppercase text-slate-500">Today's Gross Sales</div>
              <div className="text-xl font-bold text-emerald-600 font-mono">$4,892.40</div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Across {branchTerminals.length} POS terminals</div>
            </div>
            <div className="bg-white border border-slate-300 p-3">
              <div className="text-[10px] font-mono uppercase text-slate-500">Transactions Completed</div>
              <div className="text-xl font-bold text-slate-900 font-mono">38 Invoices</div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Average Ticket: $128.75</div>
            </div>
            <div className="bg-white border border-slate-300 p-3">
              <div className="text-[10px] font-mono uppercase text-slate-500">Held Sales / Layaway</div>
              <div className="text-xl font-bold text-amber-600 font-mono">2 Layaway</div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Deposits collected: $340.00</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: STOCKTAKE */}
      {activeTab === 'STOCKTAKE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white border border-slate-300 p-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Store Shelf Stocktake Audits
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Storefront cycle count audits and inventory reconciliations
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStocktakeModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-slate-900 text-white font-bold"
            >
              Start Branch Count
            </Button>
          </div>

          <div className="bg-white border border-slate-300 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase">
                  <th className="p-2.5">Batch #</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Auditor</th>
                  <th className="p-2.5 text-center">Items Counted</th>
                  <th className="p-2.5 text-center">Variance (Units)</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {branchStocktakes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                      No stocktakes logged for this branch yet.
                    </td>
                  </tr>
                ) : (
                  branchStocktakes.map((stk) => (
                    <tr key={stk.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{stk.batchNo}</td>
                      <td className="p-2.5 text-slate-600">{stk.date}</td>
                      <td className="p-2.5 font-sans">{stk.auditorStaffName}</td>
                      <td className="p-2.5 text-center font-bold">{stk.countedQty}</td>
                      <td className="p-2.5 text-center font-bold text-slate-700">{stk.varianceUnits}</td>
                      <td className="p-2.5 text-center">
                        <StatusBadge status={stk.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD TERMINAL MODAL */}
      <Modal
        isOpen={isAddTerminalModalOpen}
        onClose={() => setIsAddTerminalModalOpen(false)}
        title={`Register POS Terminal for ${branch.name}`}
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[#FAF8F5] border border-amber-200 p-2.5 text-slate-700 text-xs">
            <span className="font-bold text-slate-900">Hierarchy Rule:</span> Terminals are assigned strictly to branches. Terminals cannot be attached to central warehouses.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Terminal Code *</label>
              <Input
                type="text"
                placeholder="e.g. T-03"
                value={termCode}
                onChange={(e) => setTermCode(e.target.value)}
                className="font-mono uppercase font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Terminal Description *</label>
              <Input
                type="text"
                placeholder="e.g. Cashier Counter 3"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Station IP / Network Endpoint</label>
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
              onClick={() => setIsAddTerminalModalOpen(false)}
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

      {/* BRANCH STOCKTAKE MODAL */}
      <Modal
        isOpen={isStocktakeModalOpen}
        onClose={() => setIsStocktakeModalOpen(false)}
        title={`Storefront Shelf Audit [${branch.name}]`}
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Counted Physical Shelf Units</label>
            <Input
              type="number"
              value={stkCountedQty}
              onChange={(e) => {
                const c = parseInt(e.target.value) || 0;
                setStkCountedQty(c);
                setStkVariance(c - totalStockUnits);
              }}
              className="font-mono font-bold"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">System Book Qty:</span>
              <span className="font-bold">{totalStockUnits} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Count Variance:</span>
              <span className={`font-bold ${stkVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stkVariance > 0 ? `+${stkVariance}` : stkVariance} units
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStocktakeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveStocktake}
              className="bg-slate-900 text-white font-bold"
            >
              Commit Stocktake
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
