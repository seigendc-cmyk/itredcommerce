import React, { useState } from 'react';
import { ShoppingCart, PauseCircle, CheckCircle2 } from 'lucide-react';
import { Customer, StaffMember, CartLineItem } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface ParkCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  cartItems: CartLineItem[];
  grandTotal: number;
  onConfirmParkCart: (note: string) => void;
}

export const ParkCartModal: React.FC<ParkCartModalProps> = ({
  isOpen,
  onClose,
  customer,
  cartItems,
  grandTotal,
  onConfirmParkCart,
}) => {
  const [note, setNote] = useState<string>('Customer fetching cash from vehicle');

  const presetNotes = [
    'Customer fetching cash from vehicle',
    'Customer checking part compatibility on phone',
    'Customer fetching additional items from shelves',
    'Customer verifying vehicle registration details',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmParkCart(note.trim() || 'Parked Cart');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hold Receipt / Park Unfinished Cart"
      subtitle="Temporarily park cart to serve next customer in queue"
      maxWidth="sm"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back to Active Cart
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            leftIcon={<PauseCircle className="w-4 h-4" />}
            className="font-bold"
          >
            Park Cart ({cartItems.length} items)
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs select-none">
        <div className="p-2.5 bg-gray-50 border border-gray-300 font-mono text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer:</span>
            <span className="font-bold text-gray-900">{customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cart Total:</span>
            <span className="font-bold text-gray-900">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            Park Reason / Quick Note:
          </label>
          <div className="space-y-1 mb-2">
            {presetNotes.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setNote(preset)}
                className={`w-full text-left p-1.5 border text-[11px] transition-colors cursor-pointer ${
                  note === preset
                    ? 'bg-orange-50 border-[#FF6B00] text-gray-900 font-bold'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Custom reason..."
            className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
      </form>
    </Modal>
  );
};
