import React, { useState } from 'react';
import { Printer, Check, Copy, X } from 'lucide-react';
import { SaleTransaction, StaffMember } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleTransaction | null;
  currentStaff: StaffMember;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  currentStaff,
}) => {
  const [isPrinted, setIsPrinted] = useState(false);

  if (!sale) return null;

  const handlePrint = () => {
    setIsPrinted(true);
    setTimeout(() => {
      setIsPrinted(false);
    }, 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Commercial Tax Receipt"
      subtitle={`Transaction: ${sale.saleNumber} • ${sale.dateTime}`}
      maxWidth="sm"
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
            leftIcon={isPrinted ? <Check className="w-4 h-4 text-white" /> : <Printer className="w-4 h-4" />}
            className="font-bold"
          >
            {isPrinted ? 'Printed to ESC/POS' : 'Print Thermal Receipt'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center select-none">
        {/* Thermal Paper Container */}
        <div className="w-full max-w-[320px] bg-[#FFFFFA] border border-gray-300 shadow-sm p-4 font-mono text-[11px] text-gray-900 leading-tight">
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-2">
            <div className="font-black text-base tracking-tighter">iTred COMMERCE</div>
            <div className="text-[10px] text-gray-600">INDUSTRIAL & AUTOMOTIVE SUPPLIES</div>
            <div className="text-[9px] text-gray-500">14 Industrial Parkway • Tel: +1 (555) 019-2831</div>
            <div className="text-[9px] text-gray-500">VAT Reg: VAT-882901928</div>
          </div>

          {/* Metadata */}
          <div className="space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-2 text-[10px]">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{sale.saleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{sale.dateTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Terminal:</span>
              <span>{sale.terminalId}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{sale.cashier.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-bold">{sale.customer.name}</span>
            </div>
            {sale.customer.accountNumber && (
              <div className="flex justify-between text-gray-500">
                <span>Account #:</span>
                <span>{sale.customer.accountNumber}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[#FF6B00]">
              <span>Type:</span>
              <span>{sale.transactionType.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="space-y-1.5 border-b border-dashed border-gray-400 pb-2 mb-2">
            <div className="flex justify-between font-bold text-[10px] uppercase border-b border-gray-200 pb-0.5">
              <span>Description / Qty</span>
              <span>Amount</span>
            </div>
            {sale.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold truncate">{it.itemName || it.item.name || it.item.description}</div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>
                    <span className="text-[9px] text-gray-500 mr-1">[{it.sku || it.item.sku}]</span>
                    {it.quantity} x ${it.unitPrice.toFixed(2)}
                    {it.discountPercent > 0 && ` (-${it.discountPercent}%)`}
                  </span>
                  <span className="font-bold text-gray-900">${it.lineTotal.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-1 border-b border-dashed border-gray-400 pb-2 mb-2 text-[10px]">
            <div className="flex justify-between">
              <span>Net Subtotal:</span>
              <span>${sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount Applied:</span>
                <span>-${sale.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>VAT / Tax (15% Included):</span>
              <span>${sale.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-black pt-1 border-t border-gray-200">
              <span>GRAND TOTAL:</span>
              <span>${sale.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payments & Tenders */}
          <div className="space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-2 text-[10px]">
            <div className="font-bold uppercase text-[9px] text-gray-500 mb-0.5">Tender Breakdown:</div>
            {sale.payments.map((p, pIdx) => (
              <div key={pIdx} className="flex justify-between">
                <span>
                  {p.method.replace(/_/g, ' ')}
                  {p.reference && ` (${p.reference})`}:
                </span>
                <span className="font-bold">${p.amount.toFixed(2)}</span>
              </div>
            ))}
            {sale.changeGiven > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold pt-0.5">
                <span>Change Given:</span>
                <span>${sale.changeGiven.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Barcode / Footer */}
          <div className="text-center pt-1 space-y-1 text-[9px] text-gray-500">
            <div className="font-mono tracking-widest text-xs font-bold text-gray-800">
              ||||| | |||| || |||| || ||| | |||
            </div>
            <div>{sale.saleNumber}</div>
            <div className="italic">Thank you for your valued custom!</div>
            <div>Goods returned subject to manager terms & credit note.</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
