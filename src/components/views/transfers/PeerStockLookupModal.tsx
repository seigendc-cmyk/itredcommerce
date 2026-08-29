import React, { useState } from 'react';
import { 
  Search, 
  Layers, 
  Building2, 
  Warehouse as WarehouseIcon, 
  Truck, 
  Phone, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  Globe
} from 'lucide-react';
import { 
  InventoryItem, 
  Branch, 
  Warehouse, 
  ConnectedShopConfig 
} from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';

export interface PeerStockLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
  branches: Branch[];
  warehouses: Warehouse[];
  connectedShops: ConnectedShopConfig[];
  initialSku?: string;
  onRequestTransfer: (originLocationId: string, originName: string, sku: string) => void;
}

export const PeerStockLookupModal: React.FC<PeerStockLookupModalProps> = ({
  isOpen,
  onClose,
  inventoryItems = [],
  branches = [],
  warehouses = [],
  connectedShops = [],
  initialSku,
  onRequestTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSku || '');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(
    (inventoryItems || []).find(i => i.sku === initialSku) || inventoryItems?.[0] || null
  );

  const filteredItems = (inventoryItems || []).filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.barcode && i.barcode.includes(searchTerm)) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Synthesize network stock distribution for selected item
  const networkDistribution = [
    ...(warehouses || []).map(w => ({
      id: w.id,
      name: w.name,
      type: 'WAREHOUSE' as const,
      code: w.code,
      availableSOH: selectedItem ? (selectedItem.sku === 'BRG-6204-2RS' ? 450 : selectedItem.sku === 'FST-M10-ZNC' ? 1200 : 180) : 0,
      reserved: 20,
      phone: w.contactPhone,
      manager: w.managerName,
      isLocal: true,
      networkTag: 'Central Logistics Hub',
    })),
    ...(branches || []).map((b, idx) => ({
      id: b.id,
      name: b.name,
      type: 'BRANCH' as const,
      code: b.code,
      availableSOH: selectedItem ? (idx === 0 ? selectedItem.stockOnHand : Math.max(0, 18 - idx * 5)) : 0,
      reserved: 2,
      phone: b.contactPhone,
      manager: b.managerName,
      isLocal: true,
      networkTag: 'Internal Retail Outlet',
    })),
    ...(connectedShops || []).map(cs => ({
      id: cs.id,
      name: cs.branchName,
      type: 'BRANCH' as const,
      code: cs.branchCode,
      availableSOH: 34,
      reserved: 0,
      phone: '+1 (555) 987-6543',
      manager: 'External Partner Lead',
      isLocal: false,
      networkTag: `Peer Node (${cs.ipDomain})`,
    }))
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Peer Stock Lookup Network (Multi-Branch SOH)"
      size="xl"
    >
      <div className="space-y-4 text-xs select-none">
        {/* Compliance Notice */}
        <div className="bg-[#FAF8F5] border border-amber-300 p-2.5 flex items-start justify-between gap-2 text-slate-700">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900">Branch Isolation Policy:</span> Stock balances across partner branches and central hubs are view-only. You cannot ring up or checkout another branch's inventory directly at this register; request a formal stock transfer or refer the customer.
            </div>
          </div>
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase shrink-0">
            View-Only Mode
          </span>
        </div>

        {/* Item Selector & Search */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 border border-slate-300">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Search Product / SKU / Barcode</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Type name, SKU or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-orange-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Select Catalog Item</label>
            <select
              value={selectedItem?.sku || ''}
              onChange={(e) => {
                const itm = inventoryItems.find(i => i.sku === e.target.value);
                if (itm) setSelectedItem(itm);
              }}
              className="w-full border border-slate-300 bg-white p-1.5 font-mono text-xs focus:outline-none focus:border-orange-500"
            >
              {filteredItems.map(i => (
                <option key={i.sku} value={i.sku}>
                  [{i.sku}] {i.name} (Local SOH: {i.stockOnHand})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Item Hero Strip */}
        {selectedItem && (
          <div className="bg-slate-900 text-white p-3 flex flex-wrap items-center justify-between gap-3 font-mono">
            <div>
              <div className="text-[10px] text-orange-400 uppercase font-bold">Selected Catalog Item</div>
              <div className="text-sm font-bold text-white font-sans">{selectedItem.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                SKU: {selectedItem.sku} • Category: {selectedItem.category} • Barcode: {selectedItem.barcode || 'N/A'}
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Retail Price</div>
                <div className="text-sm font-bold text-white">${(selectedItem.retailPrice ?? selectedItem.price ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Total Network SOH</div>
                <div className="text-base font-bold text-emerald-400">
                  {networkDistribution.reduce((a, b) => a + b.availableSOH, 0)} units
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Distribution Table */}
        <div className="border border-slate-300 overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-300 font-mono text-slate-700 uppercase text-[11px]">
              <tr>
                <th className="p-2.5">Location / Network Node</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5 text-center">Available SOH</th>
                <th className="p-2.5 text-center">Allocated / Reserved</th>
                <th className="p-2.5">Manager & Phone</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {networkDistribution.map((node) => {
                const hasStock = node.availableSOH > 0;
                return (
                  <tr key={node.id} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        {node.type === 'WAREHOUSE' ? (
                          <WarehouseIcon className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        ) : !node.isLocal ? (
                          <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 font-sans">{node.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{node.networkTag}</div>
                    </td>
                    <td className="p-2.5 text-slate-700">
                      <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-300 text-[10px] font-bold">
                        {node.type}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`font-bold ${hasStock ? 'text-emerald-700 text-sm' : 'text-slate-400'}`}>
                        {node.availableSOH} units
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-slate-500">
                      {node.reserved} units
                    </td>
                    <td className="p-2.5 font-sans text-slate-700 text-[11px]">
                      <div>{node.manager}</div>
                      <div className="font-mono text-slate-500">{node.phone}</div>
                    </td>
                    <td className="p-2.5 text-right space-x-1">
                      {hasStock && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => {
                            if (selectedItem) {
                              onRequestTransfer(node.id, node.name, selectedItem.sku);
                              onClose();
                            }
                          }}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                          leftIcon={<Truck className="w-3 h-3" />}
                        >
                          Request Transfer
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Close Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 font-mono">
            Peer Stock Network Protocol v2.4 • Sync Status: <span className="text-emerald-600 font-bold">Online</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close Lookup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
