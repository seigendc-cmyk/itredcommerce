import React, { useState } from 'react';
import { Percent, DollarSign, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { StaffMember } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';

export interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiscountPercent: number;
  subtotal: number;
  currentStaff: StaffMember;
  onApplyDiscount: (percent: number) => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  currentDiscountPercent,
  subtotal,
  currentStaff,
  onApplyDiscount,
}) => {
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>(currentDiscountPercent.toString());
  const [managerPin, setManagerPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const isManagerOrAdmin = currentStaff.role === 'STORE_MANAGER' || currentStaff.role === 'SYS_ADMIN';
  const val = parseFloat(discountValue) || 0;
  
  // Calculate effective percent
  const effectivePercent = discountType === 'percent' 
    ? val 
    : subtotal > 0 ? (val / subtotal) * 100 : 0;

  const requiresManagerOverride = !isManagerOrAdmin && effectivePercent > 5;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (val < 0) {
      setPinError('Discount cannot be negative.');
      return;
    }
    if (effectivePercent > 50) {
      setPinError('Maximum allowed discount cap is 50%.');
      return;
    }

    if (requiresManagerOverride) {
      // Validate Manager PIN (e.g. '1234' for Jonathan or '9999' for Admin)
      if (managerPin !== '1234' && managerPin !== '9999') {
        setPinError('Invalid Manager Authorization PIN. Override rejected.');
        return;
      }
    }

    onApplyDiscount(Math.min(50, Math.max(0, effectivePercent)));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cart Discount Authorization"
      subtitle={`Subtotal: $${subtotal.toFixed(2)} • Operator: ${currentStaff.name}`}
      maxWidth="sm"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="font-bold"
          >
            Apply Discount ({effectivePercent.toFixed(1)}%)
          </Button>
        </>
      }
    >
      <form onSubmit={handleApply} className="space-y-3 text-xs select-none">
        {pinError && (
          <Alert type="error" size="sm" onClose={() => setPinError(null)}>
            {pinError}
          </Alert>
        )}

        <div className="flex gap-1 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setDiscountType('percent')}
            className={`flex-1 py-1.5 px-3 border text-xs font-bold text-center cursor-pointer ${
              discountType === 'percent'
                ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setDiscountType('fixed')}
            className={`flex-1 py-1.5 px-3 border text-xs font-bold text-center cursor-pointer ${
              discountType === 'fixed'
                ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Fixed Amount ($)
          </button>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
            {discountType === 'percent' ? 'Discount Percentage (%)' : 'Fixed Discount Amount ($)'}
          </label>
          <input
            type="number"
            step={discountType === 'percent' ? '1' : '0.50'}
            min="0"
            max={discountType === 'percent' ? '50' : subtotal.toString()}
            value={discountValue}
            onChange={(e) => {
              setDiscountValue(e.target.value);
              setPinError(null);
            }}
            className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00]"
            autoFocus
          />
        </div>

        {/* Quick Percent Presets */}
        <div className="flex gap-1.5">
          {[0, 2.5, 5, 10, 15, 20].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setDiscountType('percent');
                setDiscountValue(preset.toString());
                setPinError(null);
              }}
              className="flex-1 py-1 bg-white border border-gray-200 text-[11px] font-mono hover:bg-orange-50 hover:border-orange-300 cursor-pointer"
            >
              {preset}%
            </button>
          ))}
        </div>

        {/* Manager Override Section if needed */}
        {requiresManagerOverride && (
          <div className="p-3 bg-amber-50 border border-amber-300 space-y-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Manager Override Required (&gt; 5.0%)</span>
            </div>
            <p className="text-[10px] text-amber-800 font-sans">
              Cashiers have standard authority up to 5.0%. Discounts exceeding 5.0% require a Store Manager or Administrator authorization PIN.
            </p>
            <input
              type="password"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              placeholder="Enter Manager PIN (Demo: 1234)"
              className="w-full p-1.5 bg-white border border-amber-400 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
              maxLength={6}
            />
          </div>
        )}
      </form>
    </Modal>
  );
};
