import React, { useState } from 'react';
import { Printer, Barcode, CheckCircle2, Copy } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [isPrinted, setIsPrinted] = useState(false);

  if (!item) return null;

  const handlePrint = () => {
    setIsPrinted(true);
    setTimeout(() => {
      setIsPrinted(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Industrial Barcode Label Generator"
      subtitle={`Thermal Shelf Tag Print Preview • ${item.sku}`}
      maxWidth="md"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            {isPrinted ? 'Printing via ESC/POS...' : `Print ${printCopies} Label${printCopies > 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {/* Label Tag Preview - Sharp Industrial Shelf Tag */}
        <div className="bg-[#FAF8F5] p-6 border-2 border-dashed border-gray-300 flex justify-center">
          <div className="w-64 bg-white border-2 border-black p-3 text-black shadow-sm font-sans flex flex-col justify-between">
            {/* Header: Company & Department */}
            <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
              <span className="font-black text-[10px] tracking-tight italic">
                iTred<span className="font-light not-italic">Commerce</span>
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold">
                {item.department.slice(0, 14)}
              </span>
            </div>

            {/* Description */}
            <div className="font-bold text-xs leading-tight mb-1 text-black line-clamp-2">
              {item.name || item.description}
            </div>

            {/* SKU & Part Number info */}
            <div className="text-[10px] font-mono flex justify-between items-center text-gray-700 mb-1">
              <span>SKU: <strong>{item.sku}</strong></span>
              {item.partNumber && <span>PN: <strong>{item.partNumber}</strong></span>}
            </div>

            {/* Barcode Lines Simulation */}
            <div className="bg-black py-2.5 px-2 my-1 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between gap-[2px] h-9 bg-white px-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-black h-full"
                    style={{
                      width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1)}px`,
                      marginRight: `${(i % 4 === 0 ? 2 : 1)}px`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono text-white tracking-widest mt-0.5">
                {item.barcode || item.sku}
              </span>
            </div>

            {/* Price & Location Footer */}
            <div className="flex items-end justify-between border-t border-black pt-1 mt-1">
              <div className="text-[9px] font-mono text-gray-600">
                LOC: <strong>{item.location || 'BAY-01'}</strong>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold block text-gray-500 uppercase">RETAIL</span>
                <span className="font-black text-lg tracking-tight font-mono leading-none">
                  ${item.retailPrice > 0 ? item.retailPrice.toFixed(2) : '---'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Print Configuration */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-700">Copies:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={printCopies}
              onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 p-1.5 bg-white border border-gray-300 font-mono font-bold text-center text-xs"
            />
          </div>

          <div className="text-[11px] font-mono text-gray-500">
            Printer: <strong className="text-gray-800">Direct Thermal (58mm/80mm)</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
};
