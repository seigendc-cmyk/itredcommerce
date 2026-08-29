import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, AlertTriangle, TrendingUp, Tag } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

export interface QuickPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSave: (updatedItem: InventoryItem) => void;
}

export const QuickPriceUpdateModal: React.FC<QuickPriceUpdateModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
}) => {
  const [cost, setCost] = useState<string>('');
  const [price, setPrice] = useState<string>('');

  useEffect(() => {
    if (item) {
      setCost(item.unitCost ? String(item.unitCost) : '');
      setPrice(item.retailPrice ? String(item.retailPrice) : '');
    }
  }, [item, isOpen]);

  if (!item) return null;

  const parsedCost = parseFloat(cost) || 0;
  const parsedPrice = parseFloat(price) || 0;
  const grossProfit = Math.max(0, parsedPrice - parsedCost);
  const marginPercent = parsedPrice > 0 ? ((grossProfit / parsedPrice) * 100).toFixed(1) : '0.0';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: InventoryItem = {
      ...item,
      unitCost: parsedCost,
      retailPrice: parsedPrice,
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    onSave(updated);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Price & Cost Revision"
      subtitle={`${item.sku} • ${item.name || item.description}`}
      maxWidth="md"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Apply Price Revision
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs select-none">
        <div className="p-3 bg-[#FAF8F5] border border-gray-200 font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Department:</span>
            <span className="font-bold text-gray-900">{item.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Stock on Hand:</span>
            <span className="font-bold text-gray-900">{item.stockOnHand} {item.unitOfMeasure || 'Units'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
              Unit Cost Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-base focus:border-[#FF6B00] focus:outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
              Selling Retail Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-base text-gray-900 focus:border-[#FF6B00] focus:outline-none"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        {/* Real-time Profit Preview */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between font-mono text-xs">
          <div>
            <span className="text-emerald-800 block text-[10px] uppercase font-bold">Projected Margin</span>
            <span className="font-black text-lg text-emerald-900">{marginPercent}%</span>
          </div>
          <div className="text-right">
            <span className="text-emerald-800 block text-[10px] uppercase font-bold">Gross Profit / Unit</span>
            <span className="font-black text-lg text-emerald-900">${grossProfit.toFixed(2)}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
