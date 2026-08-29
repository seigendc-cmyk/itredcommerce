import React from 'react';
import { 
  X, 
  Printer, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  Building, 
  User, 
  Clock, 
  ShieldAlert, 
  FileText,
  DollarSign,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { Shift, OperationalException } from '../../../types';
import { Button } from '../../ui/Button';

export interface ShiftSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  exceptions?: OperationalException[];
}

export const ShiftSlipModal: React.FC<ShiftSlipModalProps> = ({
  isOpen,
  onClose,
  shift,
  exceptions = [],
}) => {
  if (!isOpen || !shift) return null;

  const snapshot = shift.reconciliationSnapshot;
  const linkedExceptions = exceptions.filter(e => 
    e.relatedTransactionRef?.includes(shift.shiftNumber) || 
    (shift.exceptionIds && shift.exceptionIds.includes(e.id))
  );

  const handlePrint = () => {
    window.print();
  };

  const cashVariance = shift.cashVariance !== undefined ? shift.cashVariance : 
    (shift.countedCash !== undefined ? (shift.countedCash - shift.expectedCash) : 0);
  const hasVariance = Math.abs(cashVariance) > 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header Bar */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Shift Reconciliation Summary Slip
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Slip Body */}
        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-gray-900 bg-white">
          {/* Slip Header */}
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 space-y-1">
            <div className="text-base font-black tracking-wider uppercase">iTred Commerce POS</div>
            <div className="text-[11px] font-sans font-bold text-gray-700 uppercase">
              {shift.branchName} • {shift.terminalName}
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              SHIFT RECONCILIATION SLIP — #{shift.shiftNumber}
            </div>
            <div className="text-[10px] text-gray-400 pt-1">
              Mode: <strong className="uppercase">{shift.cashUpMode || 'STANDARD'}</strong> • Status: <strong className="uppercase">{shift.status}</strong>
            </div>
          </div>

          {/* Session Timing & Cashier Info */}
          <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-gray-300 pb-3">
            <div>
              <span className="text-gray-500 block uppercase text-[10px]">Cashier / Operator:</span>
              <strong className="text-gray-900">{shift.cashierStaffName}</strong>
            </div>
            <div className="text-right">
              <span className="text-gray-500 block uppercase text-[10px]">Session Status:</span>
              <strong className={shift.status === 'CLOSED' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                {shift.status}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block uppercase text-[10px]">Opened At:</span>
              <span className="text-gray-800">{shift.openedDateTime}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 block uppercase text-[10px]">Closed At:</span>
              <span className="text-gray-800">{shift.closedDateTime || 'Still Active'}</span>
            </div>
          </div>

          {/* Sales Performance Summary */}
          <div className="space-y-1.5 border-b border-dashed border-gray-300 pb-3">
            <div className="text-[11px] font-bold uppercase text-gray-700">Trading Sales Performance</div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gross Sales:</span>
              <span className="font-bold">${(shift.grossSales || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Transactions Count:</span>
              <span>{shift.totalSalesCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Refunds Processed:</span>
              <span className="text-rose-700">-${(shift.totalRefunds || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Layaway Receipts:</span>
              <span>+${(shift.totalLayawayReceipts || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Tender-by-Tender Breakdown */}
          <div className="space-y-1.5 border-b border-dashed border-gray-300 pb-3">
            <div className="text-[11px] font-bold uppercase text-gray-700">Tender Reconciliation Table</div>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                  <th className="py-1">Tender</th>
                  <th className="py-1 text-right">Expected</th>
                  <th className="py-1 text-right">Counted</th>
                  <th className="py-1 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="font-bold">
                  <td className="py-1 text-emerald-800">Cash in Drawer</td>
                  <td className="py-1 text-right">${shift.expectedCash.toFixed(2)}</td>
                  <td className="py-1 text-right">${(shift.countedCash !== undefined ? shift.countedCash : shift.expectedCash).toFixed(2)}</td>
                  <td className={`py-1 text-right ${cashVariance < 0 ? 'text-rose-600' : cashVariance > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {cashVariance >= 0 ? `+$${cashVariance.toFixed(2)}` : `-$${Math.abs(cashVariance).toFixed(2)}`}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-blue-800">Mobile Money / EcoCash</td>
                  <td className="py-1 text-right">${(shift.totalMobileMoneySales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right">${(shift.totalMobileMoneySales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right text-gray-500">$0.00</td>
                </tr>
                <tr>
                  <td className="py-1 text-purple-800">Card / EDC Terminal</td>
                  <td className="py-1 text-right">${(shift.totalCardSales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right">${(shift.totalCardSales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right text-gray-500">$0.00</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-800">Customer Account Credit</td>
                  <td className="py-1 text-right">${(shift.totalCreditSales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right">${(shift.totalCreditSales || 0).toFixed(2)}</td>
                  <td className="py-1 text-right text-gray-500">$0.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cash Accountability Formula Math */}
          <div className="space-y-1 border-b border-dashed border-gray-300 pb-3 text-[11px]">
            <div className="font-bold uppercase text-gray-700">Cash Flow Accountability Formula</div>
            <div className="flex justify-between text-gray-600">
              <span>(+) Opening Float:</span>
              <span>${(shift.openingFloat || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>(+) Cash Sales:</span>
              <span>+${(shift.totalCashSales || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>(+) Layaway / Cash Receipts:</span>
              <span>+${(shift.totalLayawayReceipts || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>(-) Cash Refunds:</span>
              <span>-${(shift.totalRefunds || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>(-) Payouts / Petty Cash Out:</span>
              <span>-${(shift.totalPayouts || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1 text-gray-900">
              <span>(=) Expected Cash Total:</span>
              <span>${shift.expectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Counted Physical Cash:</span>
              <span>${(shift.countedCash !== undefined ? shift.countedCash : shift.expectedCash).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-black text-xs ${
              cashVariance < 0 ? 'text-rose-600' : cashVariance > 0 ? 'text-amber-600' : 'text-emerald-700'
            }`}>
              <span>Net Cash Variance:</span>
              <span>{cashVariance >= 0 ? `+$${cashVariance.toFixed(2)}` : `-$${Math.abs(cashVariance).toFixed(2)}`}</span>
            </div>
          </div>

          {/* Variance & Operational Exception Trail if any */}
          {hasVariance && (
            <div className="p-3 bg-rose-50 border border-rose-300 space-y-1.5 text-[11px]">
              <div className="font-bold text-rose-900 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Operational Discrepancy Evidence
              </div>
              <div className="text-gray-800">
                Reason Code: <strong>{shift.closureReasonCode || 'CASH_VARIANCE'}</strong>
              </div>
              <div className="text-gray-700">
                Remarks: <em>"{shift.closingNotes || 'Discrepancy recorded during shift reconciliation'}"</em>
              </div>
              {linkedExceptions.length > 0 && (
                <div className="pt-1 text-[10px] text-rose-800 font-bold">
                  Linked Exception Ref: {linkedExceptions.map(e => e.exceptionNumber).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Signoff / Audit Trail */}
          <div className="pt-2 text-[10px] text-gray-500 space-y-1 text-center">
            {shift.approvedByStaffName ? (
              <div className="text-emerald-700 font-bold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Supervisor Signed Off By: {shift.approvedByStaffName} ({shift.approvedDateTime || 'Approved'})
              </div>
            ) : (
              <div>Shift Recorded by {shift.cashierStaffName}</div>
            )}
            <div className="text-[9px] text-gray-400">
              IMMUTABLE RECONCILIATION SLIP — iTred Commerce Offline Event Queue Active
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Close Slip
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handlePrint}
            className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
};
