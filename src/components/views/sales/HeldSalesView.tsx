import React, { useState } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Search, 
  DollarSign, 
  Lock, 
  Eye, 
  FileText, 
  ShoppingCart,
  Building,
  User,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { HeldSale, StaffMember, PaymentMethodType } from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface HeldSalesViewProps {
  heldSales: HeldSale[];
  currentStaff: StaffMember;
  onSettleHeldSale: (heldSaleId: string, method: PaymentMethodType, reference?: string) => void;
  onConvertToCreditSale: (heldSaleId: string) => void;
  onBackToLanding: () => void;
  onNavigateToPOS: () => void;
}

export const HeldSalesView: React.FC<HeldSalesViewProps> = ({
  heldSales,
  currentStaff,
  onSettleHeldSale,
  onConvertToCreditSale,
  onBackToLanding,
  onNavigateToPOS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUTSTANDING' | 'SETTLED' | 'CONVERTED_CREDIT'>('ALL');
  const [selectedSale, setSelectedSale] = useState<HeldSale | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleMethod, setSettleMethod] = useState<PaymentMethodType>('CASH');
  const [settleRef, setSettleRef] = useState('');
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const isManagerOrAdmin = currentStaff.role === 'STORE_MANAGER' || currentStaff.role === 'SYS_ADMIN';

  // Filtered Held Sales
  const filteredSales = heldSales.filter((hs) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      hs.saleNumber.toLowerCase().includes(q) ||
      hs.customer.name.toLowerCase().includes(q) ||
      hs.customer.accountNumber.toLowerCase().includes(q) ||
      hs.cashier.name.toLowerCase().includes(q) ||
      (hs.notes && hs.notes.toLowerCase().includes(q))
    );

    const matchesStatus = statusFilter === 'ALL' || hs.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const outstandingCount = heldSales.filter((hs) => hs.status === 'OUTSTANDING').length;
  const outstandingTotal = heldSales
    .filter((hs) => hs.status === 'OUTSTANDING')
    .reduce((sum, hs) => sum + hs.grandTotal, 0);

  const handleConfirmSettle = () => {
    if (!selectedSale) return;
    onSettleHeldSale(selectedSale.id, settleMethod, settleRef.trim() || undefined);
    setActionAlert({
      message: `Held Sale ${selectedSale.saleNumber} settled with ${settleMethod.replace(/_/g, ' ')}. Receipt recorded in Daily Sales Journal.`,
      type: 'success',
    });
    setIsSettleModalOpen(false);
    setSelectedSale(null);
    setSettleRef('');
  };

  const handleConvertCredit = (hs: HeldSale) => {
    if (!isManagerOrAdmin) {
      setActionAlert({
        message: 'Permission Denied: Only a Store Manager or Administrator can authorize converting a Held Sale to a Credit Sale.',
        type: 'error',
      });
      return;
    }

    if (!hs.customer.isCreditApproved || hs.customer.status !== 'APPROVED') {
      setActionAlert({
        message: `Credit Conversion Blocked: Customer "${hs.customer.name}" does not have an approved commercial credit account.`,
        type: 'error',
      });
      return;
    }

    if (hs.grandTotal > hs.customer.availableCredit) {
      setActionAlert({
        message: `Credit Limit Exceeded: Held Sale amount ($${hs.grandTotal.toFixed(2)}) exceeds customer available credit ($${hs.customer.availableCredit.toFixed(2)}).`,
        type: 'error',
      });
      return;
    }

    onConvertToCreditSale(hs.id);
    setActionAlert({
      message: `Held Sale ${hs.saleNumber} successfully converted to Credit Sale and billed to ${hs.customer.name} (ACC: ${hs.customer.accountNumber}).`,
      type: 'success',
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Bar */}
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
                <Clock className="w-4 h-4 text-amber-400" />
                Held Sales (Operational Requisitions)
              </h2>
              {outstandingCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 border border-amber-500 font-mono text-[11px] font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {outstandingCount} Held Sales Outstanding
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Goods physically taken by verified contractors/clients under same-day expected settlement agreement.
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
            Open POS Register
          </Button>
        </div>
      </div>

      {actionAlert && (
        <Alert type={actionAlert.type} onClose={() => setActionAlert(null)} size="sm">
          {actionAlert.message}
        </Alert>
      )}

      {/* Operational Attention Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-amber-50 border border-amber-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-amber-800 font-bold">Outstanding Held Sales</div>
            <div className="text-xl font-black text-amber-950 font-mono">{outstandingCount} Orders</div>
          </div>
          <AlertTriangle className="w-7 h-7 text-amber-600 opacity-80" />
        </div>

        <div className="p-3 bg-[#FAF8F5] border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-600 font-bold">Total Outstanding Held Value</div>
            <div className="text-xl font-black text-[#FF6B00] font-mono">${outstandingTotal.toFixed(2)}</div>
          </div>
          <DollarSign className="w-7 h-7 text-orange-500 opacity-80" />
        </div>

        <div className="p-3 bg-slate-900 text-white border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">EOD Requisite Status</div>
            <div className="text-xs font-bold text-amber-400">
              {outstandingCount === 0 ? 'All Cleared for EOD ✓' : 'Must Reconcile Before EOD'}
            </div>
          </div>
          <ShieldCheck className="w-7 h-7 text-slate-500" />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-300">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by sale #, customer, cashier, notes..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-gray-500 mr-1 uppercase font-bold">Status:</span>
          {(['ALL', 'OUTSTANDING', 'SETTLED', 'CONVERTED_CREDIT'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#FF6B00] text-white border-[#E05E00] font-bold'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Held Sales Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Sale #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-28">Time Issued</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Customer / Account</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Cashier</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-36">Expected Settle</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Operational Reason</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Total</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-28">Status</th>
                <th className="py-2.5 px-3 text-right uppercase tracking-wider font-semibold w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    No held sales found matching the active filter.
                  </td>
                </tr>
              ) : (
                filteredSales.map((hs) => {
                  const isOutstanding = hs.status === 'OUTSTANDING';
                  return (
                    <tr
                      key={hs.id}
                      className={`transition-colors ${
                        isOutstanding ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                        {hs.saleNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                        {hs.dateTime}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{hs.customer.name}</div>
                        <div className="text-[10px] font-mono text-gray-500">
                          {hs.customer.accountNumber} • {hs.customer.phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 font-mono text-[11px]">
                        {hs.cashier.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-900 text-[11px]">
                        {hs.expectedSettlementTime}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-[11px] max-w-xs truncate" title={hs.notes}>
                        {hs.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                        ${hs.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {hs.status === 'OUTSTANDING' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] uppercase">
                            Outstanding
                          </span>
                        )}
                        {hs.status === 'SETTLED' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] uppercase">
                            Settled ✓
                          </span>
                        )}
                        {hs.status === 'CONVERTED_CREDIT' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[10px] uppercase">
                            Billed to Credit
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSale(hs)}
                            className="p-1 px-2 text-[11px] font-mono border border-gray-300 hover:bg-gray-100 text-gray-700 cursor-pointer flex items-center gap-1"
                            title="View order lines"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {isOutstanding && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSale(hs);
                                  setIsSettleModalOpen(true);
                                }}
                                className="p-1 px-2 text-[11px] font-mono font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer flex items-center gap-1"
                                title="Settle with cash / card payment"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Settle</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleConvertCredit(hs)}
                                className="p-1 px-2 text-[11px] font-mono border border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100 cursor-pointer flex items-center gap-1"
                                title="Convert to approved Credit Sale (Manager)"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Credit</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Modal */}
      {isSettleModalOpen && selectedSale && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsSettleModalOpen(false);
            setSelectedSale(null);
          }}
          title={`Settle Held Sale: ${selectedSale.saleNumber}`}
          subtitle={`Customer: ${selectedSale.customer.name} • Total Payable: $${selectedSale.grandTotal.toFixed(2)}`}
          maxWidth="sm"
          headerColor="orange"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSettleModalOpen(false);
                  setSelectedSale(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmSettle}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold"
              >
                Confirm Settlement ($ {selectedSale.grandTotal.toFixed(2)})
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs select-none">
            <div className="p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Issued On:</span>
                <span className="font-bold text-gray-900">{selectedSale.dateTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Time:</span>
                <span className="font-bold text-amber-900">{selectedSale.expectedSettlementTime}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="font-bold text-gray-700">Amount Due:</span>
                <span className="font-black text-sm text-[#FF6B00]">${selectedSale.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Settlement Payment Tender:
              </label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as PaymentMethodType)}
                className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="CASH">Cash Tender</option>
                <option value="MOBILE_MONEY">Mobile Money (EcoCash / M-Pesa)</option>
                <option value="DEBIT_CARD">Debit / Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer (EFT)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Reference / Receipt Details (Optional):
              </label>
              <input
                type="text"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                placeholder="e.g. EcoCash TX # / Cash Drawer Ref"
                className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Order Details Modal */}
      {selectedSale && !isSettleModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSale(null)}
          title={`Held Sale Details: ${selectedSale.saleNumber}`}
          subtitle={`Customer: ${selectedSale.customer.name} • ${selectedSale.dateTime}`}
          maxWidth="md"
          headerColor="orange"
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedSale(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 text-xs select-none">
            <div className="p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold text-gray-900">{selectedSale.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Settlement Time:</span>
                <span className="font-bold text-amber-900">{selectedSale.expectedSettlementTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cashier:</span>
                <span className="font-bold text-gray-900">{selectedSale.cashier.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reconciliation Notes:</span>
                <span className="text-gray-800">{selectedSale.notes || 'None'}</span>
              </div>
            </div>

            <div className="border border-gray-300 divide-y divide-gray-200">
              <div className="p-2 bg-gray-100 font-mono font-bold text-[10px] uppercase text-gray-600 flex justify-between">
                <span>Item / Description</span>
                <div className="flex gap-6">
                  <span>Qty x Price</span>
                  <span>Total</span>
                </div>
              </div>
              {selectedSale.items.map((line, idx) => (
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
              <span className="font-bold uppercase tracking-wider text-xs">Grand Total:</span>
              <span className="font-black text-base text-[#FF6B00]">${selectedSale.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
