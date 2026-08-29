import React, { useState } from 'react';
import { 
  Layers, 
  ArrowLeft, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  Eye, 
  Plus, 
  ShoppingCart,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { LayawayOrder, StaffMember, PaymentMethodType } from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';

export interface LayawayViewProps {
  layawayOrders: LayawayOrder[];
  currentStaff: StaffMember;
  onRecordPayment: (layawayId: string, amount: number, method: PaymentMethodType) => void;
  onConvertLayawayToSale: (layawayId: string) => void;
  onBackToLanding: () => void;
  onNavigateToPOS: () => void;
}

export const LayawayView: React.FC<LayawayViewProps> = ({
  layawayOrders,
  currentStaff,
  onRecordPayment,
  onConvertLayawayToSale,
  onBackToLanding,
  onNavigateToPOS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<LayawayOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const filteredOrders = layawayOrders.filter((order) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      order.id.toLowerCase().includes(q) ||
      order.customer.name.toLowerCase().includes(q) ||
      order.customer.accountNumber.toLowerCase().includes(q) ||
      order.cashier.name.toLowerCase().includes(q)
    );
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeLayaways = layawayOrders.filter((o) => o.status === 'ACTIVE');
  const totalReservedValue = activeLayaways.reduce((s, o) => s + o.totalAmount, 0);
  const totalBalanceDue = activeLayaways.reduce((s, o) => s + o.balanceRemaining, 0);

  const handleOpenPayment = (order: LayawayOrder) => {
    setSelectedOrder(order);
    setPaymentAmount(order.balanceRemaining.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedOrder) return;
    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      setActionAlert({ message: 'Please enter a valid payment amount greater than $0.00.', type: 'error' });
      return;
    }
    if (amt > selectedOrder.balanceRemaining) {
      setActionAlert({ message: `Payment ($${amt.toFixed(2)}) cannot exceed remaining balance ($${selectedOrder.balanceRemaining.toFixed(2)}).`, type: 'error' });
      return;
    }

    onRecordPayment(selectedOrder.id, amt, paymentMethod);
    setActionAlert({
      message: `Recorded payment of $${amt.toFixed(2)} for ${selectedOrder.customer.name} on layaway ${selectedOrder.id}.`,
      type: 'success',
    });
    setIsPaymentModalOpen(false);
    setSelectedOrder(null);
  };

  const handleConvertSale = (order: LayawayOrder) => {
    if (order.balanceRemaining > 0) {
      setActionAlert({
        message: `Cannot convert layaway: Outstanding balance of $${order.balanceRemaining.toFixed(2)} must be paid in full first.`,
        type: 'warning',
      });
      return;
    }

    onConvertLayawayToSale(order.id);
    setActionAlert({
      message: `Layaway ${order.id} finalized and converted into official Sales Invoice. Reserved items released to customer.`,
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
                <Layers className="w-4 h-4 text-orange-400" />
                Layaway & Progressive Installments
              </h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-mono">
                {activeLayaways.length} Active Reservations
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Reserved merchandise agreements with scheduled installment payments prior to collection.
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
            New Layaway at POS
          </Button>
        </div>
      </div>

      {actionAlert && (
        <Alert type={actionAlert.type} onClose={() => setActionAlert(null)} size="sm">
          {actionAlert.message}
        </Alert>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Active Layaways</div>
            <div className="text-xl font-black text-gray-900 font-mono">{activeLayaways.length} Agreements</div>
          </div>
          <Layers className="w-7 h-7 text-gray-400" />
        </div>

        <div className="p-3 bg-[#FAF8F5] border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Total Reserved Merchandise</div>
            <div className="text-xl font-black text-[#FF6B00] font-mono">${totalReservedValue.toFixed(2)}</div>
          </div>
          <DollarSign className="w-7 h-7 text-orange-500 opacity-80" />
        </div>

        <div className="p-3 bg-white border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Outstanding Installments Balance</div>
            <div className="text-xl font-black text-emerald-800 font-mono">${totalBalanceDue.toFixed(2)}</div>
          </div>
          <Clock className="w-7 h-7 text-emerald-600 opacity-80" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-300">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Layaway ID, customer name, account #..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-gray-500 mr-1 uppercase font-bold">Status:</span>
          {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
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
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Layaway Orders Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Layaway #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Customer Account</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-24">Reserved Qty</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Total</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Paid</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Balance</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-40">Progress</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Next Due</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-24">Status</th>
                <th className="py-2.5 px-3 text-right uppercase tracking-wider font-semibold w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-mono">
                    No layaway agreements found matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const percentPaid = Math.min(100, Math.round((order.amountPaid / order.totalAmount) * 100));
                  const isComplete = order.balanceRemaining === 0 || order.status === 'COMPLETED';

                  return (
                    <tr key={order.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                        {order.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{order.customer.name}</div>
                        <div className="text-[10px] font-mono text-gray-500">{order.customer.accountNumber}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-800">
                        {order.reservedItems.reduce((s, i) => s + i.quantity, 0)} Units
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                        ${order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                        ${order.amountPaid.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">
                        ${order.balanceRemaining.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span>{percentPaid}%</span>
                            <span>${order.amountPaid.toFixed(2)} / ${order.totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2">
                            <div
                              className={`h-2 ${percentPaid === 100 ? 'bg-emerald-600' : 'bg-[#FF6B00]'}`}
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-700 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {order.nextExpectedPaymentDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {order.status === 'ACTIVE' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[10px] uppercase">
                            Active
                          </span>
                        )}
                        {order.status === 'COMPLETED' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] uppercase">
                            Completed ✓
                          </span>
                        )}
                        {order.status === 'CANCELLED' && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[10px] uppercase">
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="p-1 px-2 text-[11px] font-mono border border-gray-300 hover:bg-gray-100 text-gray-700 cursor-pointer flex items-center gap-1"
                            title="View agreement details & ledger"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {order.status === 'ACTIVE' && order.balanceRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(order)}
                              className="p-1 px-2 text-[11px] font-mono font-bold bg-[#FF6B00] text-white hover:bg-[#E05E00] cursor-pointer flex items-center gap-1"
                              title="Tender progressive installment payment"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
                          )}

                          {order.status === 'ACTIVE' && order.balanceRemaining === 0 && (
                            <button
                              type="button"
                              onClick={() => handleConvertSale(order)}
                              className="p-1 px-2 text-[11px] font-mono font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer flex items-center gap-1"
                              title="Convert to Finalized Sale"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Release</span>
                            </button>
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

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedOrder(null);
          }}
          title={`Layaway Installment Payment: ${selectedOrder.id}`}
          subtitle={`Customer: ${selectedOrder.customer.name} • Remaining: $${selectedOrder.balanceRemaining.toFixed(2)}`}
          maxWidth="sm"
          headerColor="orange"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedOrder(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmPayment}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold"
              >
                Accept Payment (${parseFloat(paymentAmount) || 0})
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs select-none">
            <div className="p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Total:</span>
                <span className="font-bold text-gray-900">${selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already Paid:</span>
                <span className="font-bold text-emerald-700">${selectedOrder.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="font-bold text-gray-700">Remaining Balance:</span>
                <span className="font-black text-sm text-[#FF6B00]">${selectedOrder.balanceRemaining.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Installment Payment Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedOrder.balanceRemaining.toString()}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Payment Tender *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="DEBIT_CARD">Debit / Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Agreement & Payment History Ledger Modal */}
      {selectedOrder && !isPaymentModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          title={`Layaway Agreement Ledger: ${selectedOrder.id}`}
          subtitle={`Customer: ${selectedOrder.customer.name} (${selectedOrder.customer.accountNumber})`}
          maxWidth="md"
          headerColor="orange"
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3.5 text-xs select-none">
            {/* Agreement Summary */}
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs">
              <div>
                <span className="text-gray-500 block text-[10px]">Created Date:</span>
                <span className="font-bold">{selectedOrder.createdDate}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Expiry / Final Due:</span>
                <span className="font-bold">{selectedOrder.expiryDate}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Total Order Amount:</span>
                <span className="font-bold text-gray-900">${selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Remaining Balance:</span>
                <span className="font-black text-[#FF6B00]">${selectedOrder.balanceRemaining.toFixed(2)}</span>
              </div>
            </div>

            {/* Reserved Items */}
            <div>
              <div className="font-bold uppercase text-[11px] text-gray-700 mb-1">
                Reserved Merchandise (Quarantined Stock):
              </div>
              <div className="border border-gray-300 divide-y divide-gray-200">
                {selectedOrder.reservedItems.map((line, idx) => (
                  <div key={idx} className="p-2 flex justify-between items-center font-mono">
                    <div>
                      <div className="font-bold text-gray-900 font-sans">{line.item.name || line.item.description}</div>
                      <div className="text-[10px] text-gray-500">SKU: {line.item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div>{line.quantity} @ ${line.unitPrice.toFixed(2)}</div>
                      <div className="font-bold text-gray-900">${line.lineTotal.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment History Table */}
            <div>
              <div className="font-bold uppercase text-[11px] text-gray-700 mb-1">
                Installment Payment Ledger:
              </div>
              <div className="border border-gray-300 divide-y divide-gray-200">
                <div className="p-1.5 bg-gray-100 font-mono font-bold text-[10px] uppercase text-gray-600 flex justify-between">
                  <span>Date / Cashier</span>
                  <span>Method</span>
                  <span>Amount</span>
                </div>
                {selectedOrder.paymentHistory.map((p, idx) => (
                  <div key={idx} className="p-2 flex justify-between items-center font-mono text-xs">
                    <div>
                      <div className="font-bold text-gray-900">{p.date}</div>
                      <div className="text-[10px] text-gray-500">{p.cashierName} • {p.receiptNo}</div>
                    </div>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] uppercase font-bold border border-gray-300">
                      {p.method.replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold text-emerald-700 text-sm">
                      +${p.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
