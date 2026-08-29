import React, { useState } from 'react';
import { Layers, Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { Customer, StaffMember, CartLineItem, PaymentMethodType } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';

export interface LayawayModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  currentStaff: StaffMember;
  cartItems: CartLineItem[];
  grandTotal: number;
  onConfirmLayaway: (data: {
    depositAmount: number;
    paymentMethod: PaymentMethodType;
    nextPaymentDate: string;
    notes?: string;
  }) => void;
}

export const LayawayModal: React.FC<LayawayModalProps> = ({
  isOpen,
  onClose,
  customer,
  currentStaff,
  cartItems,
  grandTotal,
  onConfirmLayaway,
}) => {
  // Recommended min deposit 20%
  const minDeposit = Math.round(grandTotal * 0.2 * 100) / 100;
  const [depositAmount, setDepositAmount] = useState<string>(minDeposit.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  
  // Default next payment in 14 days
  const defaultNextDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [nextPaymentDate, setNextPaymentDate] = useState<string>(defaultNextDate);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const depositNum = parseFloat(depositAmount) || 0;
  const balanceRemaining = Math.max(0, grandTotal - depositNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customer.id === 'CUST-WALKIN') {
      setError('Layaway requires an identified customer account. Please select or register the customer profile first.');
      return;
    }
    if (depositNum <= 0) {
      setError('An initial deposit payment is required to establish a layaway reservation.');
      return;
    }
    if (depositNum > grandTotal) {
      setError('Initial deposit cannot exceed total order value. Use regular Cash Sale instead.');
      return;
    }
    if (!nextPaymentDate) {
      setError('Please specify the next scheduled installment payment date.');
      return;
    }

    onConfirmLayaway({
      depositAmount: depositNum,
      paymentMethod,
      nextPaymentDate,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Layaway Reservation"
      subtitle="Progressive Installment Agreement & Inventory Reservation"
      maxWidth="md"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="font-bold"
          >
            Create Layaway & Accept Deposit (${depositNum.toFixed(2)})
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs select-none">
        <Alert type="info" size="sm">
          <strong>Layaway Policy:</strong> Reserved stock is quarantined from available shelf inventory. Customer completes payment progressively before physical collection.
        </Alert>

        {error && (
          <Alert type="error" size="sm" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Summary Card */}
        <div className="p-3 bg-[#FAF8F5] border border-gray-300 font-mono text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer:</span>
            <span className="font-bold text-gray-900">{customer.name} ({customer.accountNumber})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Items Reserved:</span>
            <span className="font-bold text-gray-900">{cartItems.reduce((s, i) => s + i.quantity, 0)} Units</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Layaway Order:</span>
            <span className="font-bold text-gray-900">${grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-gray-200">
            <span className="font-bold text-gray-700">Remaining Balance:</span>
            <span className="font-black text-sm text-[#FF6B00]">${balanceRemaining.toFixed(2)}</span>
          </div>
        </div>

        {/* Deposit Entry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
              Initial Deposit Amount ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="1.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00]"
              required
            />
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              Min recommended (20%): ${minDeposit.toFixed(2)}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
              Deposit Payment Tender *
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

        {/* Next Scheduled Payment Date */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            Next Scheduled Installment Date *
          </label>
          <input
            type="date"
            value={nextPaymentDate}
            onChange={(e) => setNextPaymentDate(e.target.value)}
            className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            Layaway Terms & Customer Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Special instructions or installment arrangement..."
            className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
      </form>
    </Modal>
  );
};
