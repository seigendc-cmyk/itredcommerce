import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  DollarSign, 
  TrendingDown, 
  Lock, 
  Check, 
  X, 
  KeyRound, 
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  InventoryItem, 
  PriceFloorEvaluation, 
  StaffMember 
} from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';

export interface PriceFloorWarningModalProps {
  isOpen: boolean;
  item: InventoryItem;
  attemptedPrice: number;
  evaluation: PriceFloorEvaluation;
  currentStaff: StaffMember;
  onClose: () => void;
  onApproveOverride: (overridePrice: number, reason: string, supervisorName: string) => void;
  onRequestManagerApproval: (overridePrice: number, reason: string) => void;
}

export const PriceFloorWarningModal: React.FC<PriceFloorWarningModalProps> = ({
  isOpen,
  item,
  attemptedPrice,
  evaluation,
  currentStaff,
  onClose,
  onApproveOverride,
  onRequestManagerApproval,
}) => {
  const [supervisorPin, setSupervisorPin] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinInput, setShowPinInput] = useState(false);

  if (!isOpen) return null;

  const handleVerifySupervisorPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPin.trim()) {
      setPinError('Please enter authorized Supervisor PIN.');
      return;
    }

    // Industrial supervisor PIN authentication (9999 or 1234)
    if (supervisorPin === '9999' || supervisorPin === '1234') {
      onApproveOverride(
        attemptedPrice,
        overrideReason || 'Supervisor in-person authorized override',
        'Store Manager (PIN Auth)'
      );
      onClose();
    } else {
      setPinError('Invalid Supervisor PIN. Access denied.');
    }
  };

  const handleSendToManagerQueue = () => {
    onRequestManagerApproval(
      attemptedPrice,
      overrideReason || `Price-floor override requested for ${item.sku} at $${attemptedPrice.toFixed(2)}`
    );
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Price-Floor & Minimum Margin Protection"
    >
      <div className="space-y-4 text-xs">
        {/* Header Alert */}
        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-md p-3 flex items-start space-x-2.5 text-[#991b1b]">
          <ShieldAlert className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Below Price-Floor Policy Threshold</div>
            <p className="text-xs text-[#7f1d1d] mt-0.5">
              The entered price violates minimum allowable gross margin thresholds. An authorized supervisor override is required to proceed.
            </p>
          </div>
        </div>

        {/* Product Details Header */}
        <div className="bg-[#f8f9fa] border border-[#e1e4ea] rounded p-3">
          <div className="font-semibold text-sm text-[#1c1d22]">{item.name || item.description}</div>
          <div className="font-mono text-[#6e7485] mt-0.5">SKU: {item.sku} • Department: {item.department || 'General'}</div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-[#e1e4ea] rounded p-3 bg-white space-y-1.5">
            <div className="text-[#6e7485] text-[11px] uppercase tracking-wider font-semibold">Pricing Parameters</div>
            <div className="flex justify-between">
              <span>Attempted Price:</span>
              <span className="font-bold text-[#dc2626]">${attemptedPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Unit Cost Basis:</span>
              <span className="font-semibold text-[#1c1d22]">${evaluation.unitCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Minimum Allowed Price:</span>
              <span className="font-bold text-[#059669]">${evaluation.minimumAllowedPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="border border-[#e1e4ea] rounded p-3 bg-white space-y-1.5">
            <div className="text-[#6e7485] text-[11px] uppercase tracking-wider font-semibold">Gross Margin Analysis</div>
            <div className="flex justify-between">
              <span>Expected Margin:</span>
              <span className={`font-bold ${evaluation.expectedMarginPercent < 0 ? 'text-[#dc2626]' : 'text-[#ea580c]'}`}>
                {evaluation.expectedMarginPercent}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Required Floor:</span>
              <span className="font-semibold text-[#1c1d22]">{evaluation.minimumMarginPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span>Margin Shortfall:</span>
              <span className="font-bold text-[#dc2626]">-{evaluation.marginShortfallPercent}%</span>
            </div>
          </div>
        </div>

        {/* Reason Explanation */}
        <div className="bg-[#fffaf6] border border-[#fbd6b8] rounded p-2.5 text-[11px] text-[#555a68] leading-relaxed">
          <div className="font-semibold text-[#e05e00] mb-0.5 flex items-center">
            <Info className="w-3.5 h-3.5 mr-1" />
            Deterministic Evaluation (Rule v1.0)
          </div>
          {evaluation.reason}
        </div>

        {/* Supervisor Override Flow */}
        {!showPinInput ? (
          <div className="border-t border-[#e1e4ea] pt-3 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel (Revert Price)
            </Button>
            <div className="space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendToManagerQueue}
                className="text-xs border-[#d2d6e0]"
              >
                Send to Manager Approval
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setShowPinInput(true)}
                className="bg-[#e05e00] hover:bg-[#c95400] text-white text-xs font-medium"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1" />
                Supervisor PIN Override
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerifySupervisorPin} className="border-t border-[#e1e4ea] pt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1c1d22] mb-1">
                Reason for Price Floor Exception
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Damaged packaging, trade price match, bulk purchase discount..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#d2d6e0] rounded-md focus:outline-hidden focus:border-[#e05e00]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1c1d22] mb-1">
                Supervisor PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={supervisorPin}
                onChange={(e) => {
                  setSupervisorPin(e.target.value);
                  setPinError(null);
                }}
                placeholder="Enter 4-digit PIN (e.g. 9999)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#d2d6e0] rounded-md focus:outline-hidden focus:border-[#e05e00] font-mono tracking-widest text-center"
                autoFocus
              />
              {pinError && <p className="text-[11px] text-[#dc2626] mt-1 font-medium">{pinError}</p>}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPinInput(false)}>
                Back
              </Button>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm" 
                  className="bg-[#e05e00] hover:bg-[#c95400] text-white font-medium text-xs"
                >
                  Authorize Price Override
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
