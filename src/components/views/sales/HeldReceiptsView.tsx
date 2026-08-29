import React, { useState } from 'react';
import { 
  PauseCircle, 
  ArrowRight, 
  Trash2, 
  Eye, 
  Search, 
  ArrowLeft, 
  Clock, 
  User, 
  ShoppingCart,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { HeldReceipt, StaffMember, CartLineItem } from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface HeldReceiptsViewProps {
  heldReceipts: HeldReceipt[];
  currentStaff: StaffMember;
  onResumeReceipt: (receipt: HeldReceipt) => void;
  onCancelReceipt: (receiptId: string) => void;
  onBackToLanding: () => void;
  onNavigateToPOS: () => void;
}

export const HeldReceiptsView: React.FC<HeldReceiptsViewProps> = ({
  heldReceipts,
  currentStaff,
  onResumeReceipt,
  onCancelReceipt,
  onBackToLanding,
  onNavigateToPOS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<HeldReceipt | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const filtered = heldReceipts.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.customer.name.toLowerCase().includes(q) ||
      r.customer.accountNumber.toLowerCase().includes(q) ||
      r.cashier.name.toLowerCase().includes(q) ||
      (r.note && r.note.toLowerCase().includes(q))
    );
  });

  const handleResume = (receipt: HeldReceipt) => {
    onResumeReceipt(receipt);
  };

  const handleDiscard = (receiptId: string) => {
    onCancelReceipt(receiptId);
    if (selectedReceipt?.id === receiptId) {
      setSelectedReceipt(null);
    }
    setAlert({ message: `Parked cart ${receiptId} cancelled and items released back to catalog.`, type: 'info' });
    setTimeout(() => setAlert(null), 3000);
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-orange-400" />
                Held Receipts (Parked Carts)
              </h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-mono">
                {heldReceipts.length} Active Parked
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Temporary unfinished cart sessions held to prevent customer queuing delays. Distinct from commercial Held Sales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToPOS}
            leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
          >
            Open Active POS Register
          </Button>
        </div>
      </div>

      {alert && (
        <Alert type={alert.type} onClose={() => setAlert(null)} size="sm">
          {alert.message}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 border border-slate-300">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Park ID, customer name, cashier, or note..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
          />
        </div>

        <div className="text-xs font-mono text-gray-500">
          Showing {filtered.length} of {heldReceipts.length} held receipts
        </div>
      </div>

      {/* Held Receipts Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-28">Park ID</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-36">Parked Time</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Customer Account</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-36">Cashier</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Park Reason / Note</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-24">Items</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-28">Total</th>
                <th className="py-2.5 px-3 text-right uppercase tracking-wider font-semibold w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <PauseCircle className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    No held receipts currently parked in memory.
                  </td>
                </tr>
              ) : (
                filtered.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                      {receipt.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {receipt.parkedAt}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      <div>{receipt.customer.name}</div>
                      <div className="text-[10px] font-mono text-gray-500">{receipt.customer.accountNumber}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 font-mono text-[11px]">
                      {receipt.cashier.name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 italic text-[11px]">
                      {receipt.note || 'No note attached'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-800">
                      {receipt.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#FF6B00]">
                      ${receipt.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(receipt)}
                          className="p-1 px-2 text-[11px] font-mono border border-gray-300 hover:bg-gray-100 text-gray-700 cursor-pointer flex items-center gap-1"
                          title="Inspect cart items"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResume(receipt)}
                          className="p-1 px-2 text-[11px] font-mono font-bold bg-[#FF6B00] text-white hover:bg-[#E05E00] cursor-pointer flex items-center gap-1"
                          title="Resume this cart at the register"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Resume</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDiscard(receipt.id)}
                          className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Discard parked cart"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Items Detail Modal */}
      {selectedReceipt && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
          title={`Parked Cart Details: ${selectedReceipt.id}`}
          subtitle={`Customer: ${selectedReceipt.customer.name} • Parked: ${selectedReceipt.parkedAt}`}
          maxWidth="md"
          headerColor="orange"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDiscard(selectedReceipt.id)}
                className="text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                Discard Cart
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleResume(selectedReceipt)}
                leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="font-bold"
              >
                Resume Cart at Register
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs select-none">
            <div className="p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Park Reason:</span>
                <span className="font-bold text-gray-900">{selectedReceipt.note || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cashier:</span>
                <span className="font-bold text-gray-900">{selectedReceipt.cashier.name}</span>
              </div>
            </div>

            <div className="border border-gray-300 divide-y divide-gray-200">
              <div className="p-2 bg-gray-100 font-mono font-bold text-[10px] uppercase text-gray-600 flex justify-between">
                <span>Item / SKU</span>
                <div className="flex gap-6">
                  <span>Qty x Price</span>
                  <span>Total</span>
                </div>
              </div>
              {selectedReceipt.items.map((line, idx) => (
                <div key={idx} className="p-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900">{line.item.name || line.item.description}</div>
                    <div className="text-[10px] font-mono text-gray-500">SKU: {line.item.sku}</div>
                  </div>
                  <div className="flex items-center gap-6 font-mono">
                    <span className="text-gray-600">{line.quantity} x ${line.unitPrice.toFixed(2)}</span>
                    <span className="font-bold text-gray-900">${line.lineTotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-slate-900 text-white font-mono flex justify-between items-center">
              <span className="font-bold uppercase tracking-wider text-xs">Total Parked Amount:</span>
              <span className="font-black text-base text-[#FF6B00]">${selectedReceipt.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
