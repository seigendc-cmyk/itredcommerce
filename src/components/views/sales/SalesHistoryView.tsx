import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Printer, 
  ArrowLeft, 
  Eye, 
  RotateCcw, 
  Filter, 
  Download, 
  Calendar, 
  User, 
  CreditCard, 
  DollarSign, 
  ShoppingCart,
  FileText
} from 'lucide-react';
import { SaleTransaction, StaffMember, TransactionType, PaymentMethodType } from '../../../types';
import { Button } from '../../ui/Button';
import { ReceiptModal } from './ReceiptModal';

export interface SalesHistoryViewProps {
  sales: SaleTransaction[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onNavigateToSale: () => void;
  onInitiateReturn?: (sale: SaleTransaction) => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  sales,
  currentStaff,
  onBackToLanding,
  onNavigateToSale,
  onInitiateReturn,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cashierFilter, setCashierFilter] = useState<string>('ALL');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<SaleTransaction | null>(null);

  // Filter pipeline
  const filteredSales = sales.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      s.saleNumber.toLowerCase().includes(q) ||
      s.customer.name.toLowerCase().includes(q) ||
      s.customer.accountNumber.toLowerCase().includes(q) ||
      s.cashier.name.toLowerCase().includes(q) ||
      s.items.some((i) => (i.item.name || i.item.description).toLowerCase().includes(q) || i.item.sku.toLowerCase().includes(q))
    );

    const matchesType = typeFilter === 'ALL' || s.transactionType === typeFilter;
    const matchesPayment = paymentFilter === 'ALL' || s.payments.some((p) => p.method === paymentFilter);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesCashier = cashierFilter === 'ALL' || s.cashier.id === cashierFilter;

    return matchesSearch && matchesType && matchesPayment && matchesStatus && matchesCashier;
  });

  const totalGrossRevenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
  const totalTaxCollected = filteredSales.reduce((acc, s) => acc + s.taxTotal, 0);

  // Extract unique cashiers for filter dropdown
  const uniqueCashiers: { id: string; name: string }[] = Array.from(
    new Set<string>(sales.map((s) => JSON.stringify({ id: s.cashier.id, name: s.cashier.name })))
  ).map((str: string) => JSON.parse(str) as { id: string; name: string });

  const exportCSV = () => {
    const headers = ['Sale Number', 'Date/Time', 'Customer', 'Account #', 'Cashier', 'Type', 'Payments', 'Subtotal', 'Tax', 'Grand Total', 'Status'];
    const rows = filteredSales.map((s) => [
      s.saleNumber,
      s.dateTime,
      `"${s.customer.name}"`,
      s.customer.accountNumber,
      `"${s.cashier.name}"`,
      s.transactionType,
      `"${s.payments.map((p) => `${p.method}:$${p.amount}`).join('; ')}"`,
      s.subtotal.toFixed(2),
      s.taxTotal.toFixed(2),
      s.grandTotal.toFixed(2),
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Top Header Strip */}
      <div className="bg-slate-900 text-white p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Landing
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <History className="w-4 h-4 text-orange-400" />
                Sales Journal & Transaction History
              </h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-mono">
                {filteredSales.length} Transactions
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Audit log of completed, held, and refunded transactions with tender breakdown and receipt printing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-mono text-xs"
          >
            Export Journal CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToSale}
            leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
          >
            Open POS Register
          </Button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Total Transactions</div>
            <div className="text-xl font-black text-gray-900 font-mono">{filteredSales.length} Records</div>
          </div>
          <History className="w-7 h-7 text-gray-400" />
        </div>

        <div className="p-3 bg-[#FAF8F5] border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Gross Sales Value</div>
            <div className="text-xl font-black text-[#FF6B00] font-mono">${totalGrossRevenue.toFixed(2)}</div>
          </div>
          <DollarSign className="w-7 h-7 text-orange-500 opacity-80" />
        </div>

        <div className="p-3 bg-white border border-gray-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Fiscal Tax Collected (15%)</div>
            <div className="text-xl font-black text-emerald-800 font-mono">${totalTaxCollected.toFixed(2)}</div>
          </div>
          <CreditCard className="w-7 h-7 text-emerald-600 opacity-80" />
        </div>
      </div>

      {/* Comprehensive Filter Panel */}
      <div className="bg-white p-3 border border-slate-300 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sale #, customer, item SKU, cashier..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="CASH_SALE">Cash Sale</option>
              <option value="CREDIT_SALE">Credit Sale</option>
              <option value="HELD_SALE">Held Sale</option>
              <option value="LAYAWAY">Layaway Agreement</option>
              <option value="CREDIT_NOTE">Credit Note / Return</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash Tender</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="DEBIT_CARD">Debit / Credit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CUSTOMER_CREDIT">Customer Credit Ledger</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Cashiers</option>
              {uniqueCashiers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="HELD">Held</option>
              <option value="REFUNDED">Refunded</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Sale #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Date / Time</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Customer Account</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Cashier</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Type</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Payment Tender(s)</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Amount</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-24">Status</th>
                <th className="py-2.5 px-3 text-right uppercase tracking-wider font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    No transactions found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.saleNumber} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                      {sale.saleNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                      {sale.dateTime}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-gray-900">{sale.customer.name}</div>
                      <div className="text-[10px] font-mono text-gray-500">{sale.customer.accountNumber}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 font-mono text-[11px]">
                      {sale.cashier.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-gray-700">
                      {sale.transactionType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {sale.payments.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 font-mono text-[10px] text-gray-700"
                          >
                            {p.method.replace(/_/g, ' ')}: ${p.amount.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                      ${sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {sale.status === 'COMPLETED' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] uppercase">
                          Completed
                        </span>
                      )}
                      {sale.status === 'HELD' && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] uppercase">
                          Held
                        </span>
                      )}
                      {sale.status === 'REFUNDED' && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[10px] uppercase">
                          Refunded
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleForReceipt(sale)}
                        className="p-1 px-2 text-[11px] font-mono border border-gray-300 hover:bg-gray-100 text-gray-700 cursor-pointer inline-flex items-center gap-1"
                        title="View & Print ESC/POS Receipt"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setSelectedSaleForReceipt(null)}
          sale={selectedSaleForReceipt}
          currentStaff={currentStaff}
        />
      )}
    </div>
  );
};
