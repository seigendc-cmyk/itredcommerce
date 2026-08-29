import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Boxes, 
  Clock, 
  UserCheck, 
  MapPin,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import { StocktakeSession, StaffMember } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface StocktakeAuditSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StocktakeSession | null;
  currentStaff: StaffMember;
}

export const StocktakeAuditSlipModal: React.FC<StocktakeAuditSlipModalProps> = ({
  isOpen,
  onClose,
  session,
  currentStaff,
}) => {
  const [printFormat, setPrintFormat] = useState<'STANDARD' | 'THERMAL'>('STANDARD');

  if (!isOpen || !session) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['SKU', 'Barcode', 'Description', 'Category', 'Bin Location', 'Book Qty', 'Counted Qty', 'Variance Qty', 'Unit Cost', 'Valuation Delta', 'Reason Code', 'Notes'];
    const rows = session.items.map((item) => [
      item.sku,
      item.barcode,
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.binLocation || '-',
      item.bookQty,
      item.countedQty ?? 'Uncounted',
      item.varianceQty,
      item.unitCost.toFixed(2),
      item.varianceValuation.toFixed(2),
      item.reasonCode || '-',
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stocktake_Audit_Slip_${session.sessionNumber}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics breakdown
  let shortageUnits = 0;
  let shortageValue = 0;
  let overageUnits = 0;
  let overageValue = 0;

  session.items.forEach((item) => {
    if (item.varianceQty < 0) {
      shortageUnits += Math.abs(item.varianceQty);
      shortageValue += Math.abs(item.varianceValuation);
    } else if (item.varianceQty > 0) {
      overageUnits += item.varianceQty;
      overageValue += item.varianceValuation;
    }
  });

  const varianceLinesCount = session.items.filter((i) => i.varianceQty !== 0).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
    >
      <div className="space-y-4 -mt-3 font-sans">
        {/* Header Controls Bar */}
        <div className="bg-slate-900 text-white p-3.5 -mx-6 -mt-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Official Stocktake Audit Slip & Variance Certificate
              </h2>
              <span className="text-xs font-mono text-amber-400 font-bold">
                Batch #{session.sessionNumber} | {session.locationName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-0.5 rounded-xs flex text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('STANDARD')}
                className={`px-2.5 py-1 rounded-xs font-medium transition-all ${
                  printFormat === 'STANDARD'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Standard A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                className={`px-2.5 py-1 rounded-xs font-medium transition-all ${
                  printFormat === 'THERMAL'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                80mm Thermal
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-xs"
              onClick={handleExportCSV}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-amber-500 text-slate-950 hover:bg-amber-600 font-bold text-xs"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Slip
            </Button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        {printFormat === 'THERMAL' ? (
          /* 80mm ESC/POS Receipt Style */
          <div className="max-w-[340px] mx-auto bg-white p-4 border border-slate-300 shadow-sm font-mono text-xs text-slate-900 leading-tight space-y-3">
            <div className="text-center border-b border-dashed border-slate-400 pb-2">
              <h3 className="font-bold text-sm uppercase tracking-wider">iTred Commerce POS</h3>
              <p className="text-[11px] text-slate-600">Stocktake Audit Certificate</p>
              <p className="text-[10px] text-slate-500 mt-1">{session.locationName}</p>
            </div>

            <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>Session:</span>
                <span className="font-bold">{session.sessionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{session.createdDateTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Auditor:</span>
                <span>{session.createdByStaffName}</span>
              </div>
              <div className="flex justify-between">
                <span>Approved By:</span>
                <span>{session.approvedByStaffName || 'Store Manager'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{session.status}</span>
              </div>
            </div>

            {/* Thermal Line Variance Breakdown */}
            <div className="border-b border-dashed border-slate-400 pb-2 space-y-1.5 text-[11px]">
              <div className="font-bold uppercase text-[10px] text-slate-500 flex justify-between">
                <span>Item / SKU</span>
                <span>Bk / Cnt / Var</span>
              </div>
              {session.items.map((item) => (
                <div key={item.sku} className="border-t border-slate-100 pt-1">
                  <div className="font-bold truncate text-[11px]">{item.name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span>{item.sku}</span>
                    <span>
                      {item.bookQty} &rarr; {item.countedQty ?? '-'} ({item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty})
                    </span>
                  </div>
                  {item.varianceQty !== 0 && (
                    <div className="flex justify-between font-bold text-slate-800 text-[10px]">
                      <span>Delta @ ${item.unitCost.toFixed(2)}</span>
                      <span>${item.varianceValuation.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Thermal Totals Summary */}
            <div className="space-y-1 text-[11px] font-bold">
              <div className="flex justify-between">
                <span>Book Total Units:</span>
                <span>{session.totalExpectedUnits}</span>
              </div>
              <div className="flex justify-between">
                <span>Counted Total Units:</span>
                <span>{session.totalCountedUnits}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Total Shortage:</span>
                <span>-{shortageUnits} (${shortageValue.toFixed(2)})</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Total Overage:</span>
                <span>+{overageUnits} (+${overageValue.toFixed(2)})</span>
              </div>
              <div className="flex justify-between border-t border-slate-400 pt-1 text-sm">
                <span>Net Valuation Delta:</span>
                <span>${session.totalVarianceValuation.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-400 pt-4 text-center text-[10px] text-slate-500 space-y-4">
              <div>
                <div className="border-b border-slate-400 w-36 mx-auto mb-1"></div>
                <span>Auditor Sign-off</span>
              </div>
              <div>
                <div className="border-b border-slate-400 w-36 mx-auto mb-1"></div>
                <span>Store Manager / Controller</span>
              </div>
              <p>*** END OF AUDIT SLIP ***</p>
            </div>
          </div>
        ) : (
          /* Standard A4 Detailed Report Style */
          <div className="bg-white p-5 border border-slate-200 shadow-2xs space-y-4">
            {/* Header Voucher */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block">
                  iTred Commerce Enterprise POS
                </span>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Formal Inventory Stocktake Audit Certificate
                </h1>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  Facility: <strong className="text-slate-900">{session.locationName}</strong> ({session.locationId})
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="bg-slate-900 text-amber-400 px-2 py-1 font-bold text-xs block mb-1">
                  BATCH: {session.sessionNumber}
                </span>
                <span className="text-slate-500 block">Status: <strong className="text-slate-900">{session.status}</strong></span>
                <span className="text-slate-500 block">Date: {session.createdDateTime}</span>
              </div>
            </div>

            {/* Sign-off & Audit Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Count Lead / Auditor</span>
                <strong className="text-slate-900">{session.createdByStaffName}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Reviewed & Approved By</span>
                <strong className="text-slate-900">{session.approvedByStaffName || 'Store Manager'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Lines Audited / Variances</span>
                <strong className="text-slate-900">{session.items.length} total ({varianceLinesCount} variances)</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Count Protocol</span>
                <strong className="text-slate-900">{session.isBlindCount ? 'Blind Count Mode' : 'Standard Audit'}</strong>
              </div>
            </div>

            {/* Key Totals Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Expected Book Qty</span>
                <span className="text-lg font-bold font-mono text-slate-900">{session.totalExpectedUnits} units</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Physical Counted Qty</span>
                <span className="text-lg font-bold font-mono text-slate-900">{session.totalCountedUnits} units</span>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200">
                <span className="text-[10px] uppercase text-rose-700 font-bold block">Shortage Valuation</span>
                <span className="text-lg font-bold font-mono text-rose-800">-${shortageValue.toFixed(2)}</span>
                <span className="text-[10px] text-rose-600 font-mono block">({shortageUnits} units missing)</span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] uppercase text-emerald-700 font-bold block">Overage Valuation</span>
                <span className="text-lg font-bold font-mono text-emerald-800">+${overageValue.toFixed(2)}</span>
                <span className="text-[10px] text-emerald-600 font-mono block">(+{overageUnits} units surplus)</span>
              </div>
            </div>

            {/* Line-by-Line Breakdown Table */}
            <div className="border border-slate-200 overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-2.5">SKU / Item</th>
                    <th className="py-2 px-2.5">Bin</th>
                    <th className="py-2 px-2.5 text-right font-mono">Book</th>
                    <th className="py-2 px-2.5 text-right font-mono">Counted</th>
                    <th className="py-2 px-2.5 text-right font-mono">Variance</th>
                    <th className="py-2 px-2.5 text-right font-mono">Cost</th>
                    <th className="py-2 px-2.5 text-right font-mono">Valuation Delta</th>
                    <th className="py-2 px-2.5">Reason Code</th>
                    <th className="py-2 px-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                  {session.items.map((item) => (
                    <tr key={item.sku} className={item.varianceQty !== 0 ? 'bg-amber-50/40 font-medium' : ''}>
                      <td className="py-1.5 px-2.5 font-sans">
                        <span className="font-bold text-slate-900 block font-mono">{item.sku}</span>
                        <span className="text-slate-600 text-[11px] truncate max-w-[160px] inline-block">{item.name}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-600">{item.binLocation || '-'}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-700">{item.bookQty}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">{item.countedQty ?? '-'}</td>
                      <td className={`py-1.5 px-2.5 text-right font-bold ${
                        item.varianceQty > 0 ? 'text-emerald-700' : item.varianceQty < 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}>
                        {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-700">${item.unitCost.toFixed(2)}</td>
                      <td className={`py-1.5 px-2.5 text-right font-bold ${
                        item.varianceValuation > 0 ? 'text-emerald-700' : item.varianceValuation < 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}>
                        ${item.varianceValuation.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2.5 font-sans text-xs">
                        {item.reasonCode ? (
                          <span className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded-xs text-[10px] font-mono font-bold">
                            {item.reasonCode}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-1.5 px-2.5 font-sans text-slate-600 text-xs">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit Certification Sign-off Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs font-mono">
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-6">Count Verified By (Auditor)</p>
                <div className="border-b border-slate-400 w-full mb-1"></div>
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Name: {session.createdByStaffName}</span>
                  <span>Date: {session.createdDateTime.slice(0, 10)}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-6">Approved & Posted By (Store Manager)</p>
                <div className="border-b border-slate-400 w-full mb-1"></div>
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Name: {session.approvedByStaffName || currentStaff.name}</span>
                  <span>Date: {new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Certified compliance with iTred Internal Audit & Perpetual Ledger Controls
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="px-5 font-bold"
          >
            Close Slip
          </Button>
        </div>
      </div>
    </Modal>
  );
};
