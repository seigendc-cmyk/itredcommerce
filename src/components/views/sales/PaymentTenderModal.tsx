import React, { useState, useEffect, useId } from 'react';
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Building, 
  Receipt, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Lock,
  ArrowRight,
  Info,
  Loader2
} from 'lucide-react';
import { Customer, StaffMember, PaymentMethodType, SplitPaymentEntry, Shift, CartLineItem, InventoryItem } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { createCheckoutIdempotencyKey } from '../../../utils/saleTransactionEngine';

export interface PaymentTenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  customer: Customer;
  currentStaff: StaffMember;
  activeShift?: Shift | null;
  cartItems?: CartLineItem[];
  inventoryItems?: InventoryItem[];
  terminalId?: string;
  onCompleteSale: (payments: SplitPaymentEntry[], changeGiven: number, idempotencyKey: string) => Promise<boolean | void> | boolean | void;
}

export const PaymentTenderModal: React.FC<PaymentTenderModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  customer,
  currentStaff,
  activeShift,
  cartItems = [],
  inventoryItems = [],
  terminalId = 'POS-D01',
  onCompleteSale,
}) => {
  const [payments, setPayments] = useState<SplitPaymentEntry[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentMethodType>('CASH');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [referenceText, setReferenceText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sessionIdempotencyKey, setSessionIdempotencyKey] = useState<string>('');

  // Total paid calculation
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingDue = Math.max(0, grandTotal - totalPaid);
  const changeDue = Math.max(0, totalPaid - grandTotal);
  const isFullyCovered = totalPaid >= grandTotal;

  // Initialize tender amount and unique session idempotency key when modal opens
  useEffect(() => {
    if (isOpen) {
      setPayments([]);
      setInputAmount(grandTotal.toFixed(2));
      setReferenceText('');
      setErrorMessage(null);
      setActiveMethod('CASH');
      setIsSubmitting(false);
      setSessionIdempotencyKey(createCheckoutIdempotencyKey(terminalId, currentStaff.id));
    }
  }, [isOpen, grandTotal, terminalId, currentStaff.id]);

  // When payments change, update default input amount to remainingDue
  const handleAddPayment = () => {
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than $0.00.');
      return;
    }

    // CREDIT SALE VALIDATION RULES:
    if (activeMethod === 'CUSTOMER_CREDIT') {
      if (customer.id === 'CUST-WALKIN') {
        setErrorMessage('Credit sale cannot be applied to Walk In Customer. Please select an approved commercial customer account.');
        return;
      }

      if (customer.status === 'PENDING_APPROVAL') {
        setErrorMessage(`Customer "${customer.name}" is Pending Approval. Management must approve account before credit can be tendered.`);
        return;
      }

      if (customer.status === 'SUSPENDED') {
        setErrorMessage(`Customer account "${customer.name}" is Suspended due to credit policy violations.`);
        return;
      }

      if (!customer.isCreditApproved) {
        setErrorMessage(`Customer "${customer.name}" does not have credit facilities authorized by store management.`);
        return;
      }

      if (amount > customer.availableCredit) {
        setErrorMessage(
          `Credit Limit Exceeded: Requested credit amount ($${amount.toFixed(2)}) exceeds customer's available credit limit ($${customer.availableCredit.toFixed(2)}).`
        );
        return;
      }
    }

    const newPayment: SplitPaymentEntry = {
      method: activeMethod,
      amount,
      reference: referenceText.trim() || undefined,
    };

    const updated = [...payments, newPayment];
    setPayments(updated);
    setReferenceText('');
    setErrorMessage(null);

    const newRemaining = Math.max(0, grandTotal - updated.reduce((s, p) => s + p.amount, 0));
    setInputAmount(newRemaining > 0 ? newRemaining.toFixed(2) : '');
  };

  const handleRemovePayment = (index: number) => {
    const updated = payments.filter((_, i) => i !== index);
    setPayments(updated);
    const newRemaining = Math.max(0, grandTotal - updated.reduce((s, p) => s + p.amount, 0));
    setInputAmount(newRemaining.toFixed(2));
  };

  // Quick Cash Preset Helper
  const handlePresetCash = (amount: number) => {
    setActiveMethod('CASH');
    setInputAmount(amount.toFixed(2));
  };

  const handleFinalize = async () => {
    if (isSubmitting) return;

    // 1. Shift validation
    if (!activeShift || activeShift.status !== 'OPEN') {
      setErrorMessage('Active Shift Required: An open shift on this terminal is required before finalizing checkout.');
      return;
    }

    // 2. Stock on Hand pre-commit check
    if (inventoryItems.length > 0 && cartItems.length > 0) {
      for (const line of cartItems) {
        const live = inventoryItems.find((i) => i.sku === line.item.sku) || line.item;
        if (live.stockOnHand < line.quantity) {
          setErrorMessage(
            `Insufficient Stock: Item "${live.name || live.sku}" has only ${live.stockOnHand} units on hand, but ${line.quantity} units are in the cart.`
          );
          return;
        }
      }
    }

    // 3. Payment coverage check
    if (!isFullyCovered) {
      setErrorMessage(`Outstanding balance of $${remainingDue.toFixed(2)} remains unpaid.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onCompleteSale(payments, changeDue, sessionIdempotencyKey);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transaction failed. No changes were committed.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="POS Payment Tender & Split Settlement"
      subtitle={`Total Payable: $${grandTotal.toFixed(2)} • Customer: ${customer.name}`}
      maxWidth="lg"
      headerColor="orange"
      footer={
        <>
          <div className="flex items-center gap-2 mr-auto font-mono text-xs text-gray-700">
            <span>Change Due:</span>
            <span className={`font-black text-sm ${changeDue > 0 ? 'text-emerald-700 font-mono' : 'text-gray-400'}`}>
              ${changeDue.toFixed(2)}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel Tender
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleFinalize}
            disabled={!isFullyCovered || isSubmitting}
            leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            shortcutBadge="Enter"
            className="font-bold"
          >
            {isSubmitting ? 'Committing Atomic Transaction...' : 'Finalize & Issue Receipt'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {errorMessage && (
          <Alert type="error" size="sm" onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* Commercial Credit Status Callout for Active Customer */}
        {customer.id !== 'CUST-WALKIN' && (
          <div className={`p-2.5 border text-xs font-mono flex items-center justify-between ${
            customer.isCreditApproved && customer.status === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : customer.status === 'PENDING_APPROVAL'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div>
              <span className="font-bold uppercase tracking-wider block">
                {customer.name} ({customer.accountNumber})
              </span>
              <span className="text-[11px]">
                Status: <strong>{customer.status}</strong> {customer.companyName && `• ${customer.companyName}`}
              </span>
            </div>

            <div className="text-right">
              {customer.isCreditApproved ? (
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Available Credit</span>
                  <span className="font-black text-sm text-emerald-800">${customer.availableCredit.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-500 block">Limit: ${customer.creditLimit.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-[11px] font-bold text-rose-700">
                  {customer.status === 'PENDING_APPROVAL' ? 'Credit Pending Approval' : 'Credit Disabled'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Payment Methods Selection Grid */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1.5">
            Select Payment Method:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveMethod('CASH')}
              className={`p-2 border text-center font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                activeMethod === 'CASH'
                  ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMethod('MOBILE_MONEY')}
              className={`p-2 border text-center font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                activeMethod === 'MOBILE_MONEY'
                  ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Mobile Money</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMethod('DEBIT_CARD')}
              className={`p-2 border text-center font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                activeMethod === 'DEBIT_CARD'
                  ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Debit / Card</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMethod('BANK_TRANSFER')}
              className={`p-2 border text-center font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                activeMethod === 'BANK_TRANSFER'
                  ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Bank Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMethod('CUSTOMER_CREDIT')}
              className={`p-2 border text-center font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                activeMethod === 'CUSTOMER_CREDIT'
                  ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Customer Credit</span>
            </button>
          </div>
        </div>

        {/* Input Amount & Split Tender Entry Form */}
        <div className="p-3 bg-gray-50 border border-gray-300 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Amount for {activeMethod.replace(/_/g, ' ')} ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-base focus:border-[#FF6B00] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Reference / Auth Code (Optional)
              </label>
              <input
                type="text"
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder={
                  activeMethod === 'MOBILE_MONEY'
                    ? 'e.g. EcoCash Ref # / Phone'
                    : activeMethod === 'DEBIT_CARD'
                    ? 'e.g. POS Auth Code'
                    : activeMethod === 'BANK_TRANSFER'
                    ? 'e.g. EFT Reference #'
                    : 'Notes / PO #'
                }
                className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:border-[#FF6B00] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <Button
                variant="primary"
                size="md"
                onClick={handleAddPayment}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="w-full font-bold"
              >
                Add Payment
              </Button>
            </div>
          </div>

          {/* Quick Cash Presets (Visible when Cash selected) */}
          {activeMethod === 'CASH' && (
            <div className="pt-1.5 border-t border-gray-200 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-gray-500 uppercase font-bold">Quick Cash:</span>
              <button
                type="button"
                onClick={() => handlePresetCash(remainingDue)}
                className="px-2 py-0.5 bg-white border border-gray-300 text-xs font-mono font-bold text-[#FF6B00] hover:bg-orange-50 cursor-pointer"
              >
                Exact (${remainingDue.toFixed(2)})
              </button>
              {[20, 50, 100, 200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetCash(preset)}
                  className="px-2 py-0.5 bg-white border border-gray-300 text-xs font-mono font-medium hover:bg-gray-100 cursor-pointer"
                >
                  ${preset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Split Payments Ledger Table */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
              Applied Split Tenders ({payments.length})
            </span>
            <span className="font-mono text-xs">
              Remaining Unpaid: <strong className={remainingDue > 0 ? 'text-rose-600' : 'text-emerald-700'}>${remainingDue.toFixed(2)}</strong>
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-4 bg-white border border-dashed border-gray-300 text-center text-gray-400 font-mono text-xs">
              No payments added yet. Enter amount above and click "+ Add Payment".
            </div>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
              {payments.map((p, idx) => (
                <div key={idx} className="p-2 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 font-bold uppercase text-[10px]">
                      {p.method.replace(/_/g, ' ')}
                    </span>
                    {p.reference && <span className="text-gray-500 text-[11px]">Ref: {p.reference}</span>}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">${p.amount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(idx)}
                      className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                      title="Remove tender"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Split Summary Footer Card */}
        <div className="p-3 bg-[#FAF8F5] border border-gray-300 font-mono text-xs space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Total Payable Sale Amount:</span>
            <span className="font-bold text-gray-900">${grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Total Tendered / Paid:</span>
            <span className="font-bold text-emerald-700">${totalPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-200 font-bold">
            <span>Settlement Status:</span>
            <span className={isFullyCovered ? 'text-emerald-700' : 'text-rose-600'}>
              {isFullyCovered ? 'Fully Tendered ✓' : `Balance Remaining: $${remainingDue.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
