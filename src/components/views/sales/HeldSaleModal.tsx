import React, { useState } from 'react';
import { 
  Clock, 
  User, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Customer, StaffMember, CartLineItem } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';

export interface HeldSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  currentStaff: StaffMember;
  cartItems: CartLineItem[];
  grandTotal: number;
  subtotal: number;
  onConfirmHeldSale: (data: {
    expectedSettlementTime: string;
    notes: string;
  }) => void;
}

export const HeldSaleModal: React.FC<HeldSaleModalProps> = ({
  isOpen,
  onClose,
  customer,
  currentStaff,
  cartItems,
  grandTotal,
  subtotal,
  onConfirmHeldSale,
}) => {
  const [expectedTime, setExpectedTime] = useState<string>('Today 16:30');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedTime.trim()) {
      setError('Expected settlement time is mandatory for Held Sales.');
      return;
    }
    if (!notes.trim()) {
      setError('Please enter a brief note explaining reason or client contractor reference.');
      return;
    }

    onConfirmHeldSale({
      expectedSettlementTime: expectedTime.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Operational Held Sale"
      subtitle="Goods Released • Same-Day Expected Settlement Requisition"
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
            className="font-bold bg-amber-600 hover:bg-amber-700 border-amber-700"
          >
            Authorize Held Sale ($ {grandTotal.toFixed(2)})
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs select-none">
        <Alert type="warning" size="sm">
          <strong>Operational Policy:</strong> A Held Sale authorizes physical release of goods where the client settles following downstream payment. This must be reconciled before End-of-Day (EOD) closure.
        </Alert>

        {error && (
          <Alert type="error" size="sm" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Customer & Transaction Summary */}
        <div className="p-3 bg-[#FAF8F5] border border-gray-300 font-mono text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer Account:</span>
            <span className="font-bold text-gray-900">{customer.name} ({customer.accountNumber})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Authorizing Cashier:</span>
            <span className="font-bold text-gray-900">{currentStaff.name} ({currentStaff.code})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Items in Hand:</span>
            <span className="font-bold text-gray-900">{cartItems.reduce((acc, i) => acc + i.quantity, 0)} Units ({cartItems.length} Lines)</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-gray-200">
            <span className="font-bold text-gray-700">Total Held Amount:</span>
            <span className="font-black text-sm text-[#FF6B00]">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Expected Settlement Time */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            Expected Settlement Time (Same-Day) *
          </label>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {['Today 14:00', 'Today 16:30', 'Today 18:00 (EOD)'].map((timePreset) => (
              <button
                key={timePreset}
                type="button"
                onClick={() => setExpectedTime(timePreset)}
                className={`py-1.5 px-2 border text-xs font-mono font-medium text-center cursor-pointer ${
                  expectedTime === timePreset
                    ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {timePreset}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={expectedTime}
            onChange={(e) => setExpectedTime(e.target.value)}
            placeholder="e.g. Today 16:30 or Before 18:00 EOD"
            className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
            required
          />
        </div>

        {/* Operational Note / Vehicle / Client Details */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            Reconciliation Notes & Contractor Job Reference *
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Mechanic taking emergency radiator & oil for roadside fleet breakdown; driver returning with cash before 17:00."
            className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
            required
          />
        </div>
      </form>
    </Modal>
  );
};
