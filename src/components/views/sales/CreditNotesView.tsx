import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShoppingCart,
  User,
  DollarSign
} from 'lucide-react';
import { CreditNote, Customer, InventoryItem, StaffMember, SaleTransaction, Shift } from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';
import { INITIAL_INVENTORY_ITEMS } from '../../../data/mockData';
import { apiGet, apiPost, ApiClientError } from '../../../api/client';
import { createCheckoutIdempotencyKey } from '../../../utils/saleTransactionEngine';

export interface CreditNotesViewProps {
  creditNotes: CreditNote[];
  customers: Customer[];
  sales: SaleTransaction[];
  currentStaff: StaffMember;
  activeShift?: Shift | null;
  terminalId?: string;
  onIssueCreditNote: (newNote: CreditNote) => void;
  onBackToLanding: () => void;
  onNavigateToPOS: () => void;
}

export const CreditNotesView: React.FC<CreditNotesViewProps> = ({
  creditNotes = [],
  customers = [],
  sales = [],
  currentStaff,
  activeShift,
  terminalId = 'POS-D01',
  onIssueCreditNote,
  onBackToLanding,
  onNavigateToPOS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Prompt 14: generated fresh each time the issuance modal opens, held for
  // the lifetime of that one attempt (including its own retries) — mirrors
  // PaymentTenderModal.tsx's sessionIdempotencyKey exactly, so two genuinely
  // separate returns of the same qty/sku never collide, but a retried
  // submit of the same attempt safely dedupes server-side.
  const [sessionIdempotencyKey, setSessionIdempotencyKey] = useState<string>('');
  useEffect(() => {
    if (isCreateModalOpen) {
      setSessionIdempotencyKey(createCheckoutIdempotencyKey(terminalId, currentStaff.id));
    }
  }, [isCreateModalOpen, terminalId, currentStaff.id]);
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // New Credit Note Form State
  const [refSaleNumber, setRefSaleNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers?.[1]?.id || customers?.[0]?.id || 'CUST-1001');
  const [reasonCategory, setReasonCategory] = useState<'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_RETURN' | 'PRICE_ADJUSTMENT'>('WRONG_ITEM');
  const [refundMethod, setRefundMethod] = useState<'CUSTOMER_CREDIT' | 'CASH' | 'ORIGINAL_METHOD'>('CUSTOMER_CREDIT');
  const [returnItems, setReturnItems] = useState<Array<{
    item: InventoryItem;
    returnQty: number;
    unitPrice: number;
    reason: string;
    restock: boolean;
  }>>([
    {
      item: INITIAL_INVENTORY_ITEMS[0],
      returnQty: 1,
      unitPrice: INITIAL_INVENTORY_ITEMS[0]?.retailPrice || 25,
      reason: 'Wrong fitment side requested by customer',
      restock: true,
    }
  ]);
  const [maxQtyBySku, setMaxQtyBySku] = useState<Record<string, number>>({});
  const [saleLookupStatus, setSaleLookupStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [isLookingUpSale, setIsLookingUpSale] = useState(false);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] = useState(false);

  // Look up what was actually sold on the referenced sale so returnQty can be
  // capped against real sold quantities instead of trusting free-text entry.
  const handleLookupSale = async () => {
    const saleNumber = refSaleNumber.trim();
    if (!saleNumber) return;
    setIsLookingUpSale(true);
    setSaleLookupStatus(null);
    try {
      const found = await apiGet<{
        saleNumber: string;
        customerId: string | null;
        customerName: string | null;
        items: Array<{ sku: string; itemName: string; quantitySold: number; unitPrice: number; taxRate: number }>;
      }>(`/credit-notes/sale/${encodeURIComponent(saleNumber)}`);

      const caps: Record<string, number> = {};
      const hydratedLines = found.items.map((line) => {
        caps[line.sku] = line.quantitySold;
        const invItem = INITIAL_INVENTORY_ITEMS.find((it) => it.sku === line.sku);
        return {
          item: invItem
            ? { ...invItem, taxRate: line.taxRate }
            : ({ sku: line.sku, name: line.itemName, description: line.itemName, taxRate: line.taxRate, retailPrice: line.unitPrice } as InventoryItem),
          returnQty: Math.min(1, line.quantitySold),
          unitPrice: line.unitPrice,
          reason: 'Customer return',
          restock: true,
        };
      });
      setMaxQtyBySku(caps);
      if (hydratedLines.length > 0) setReturnItems(hydratedLines);
      if (found.customerId) setSelectedCustomerId(found.customerId);
      setSaleLookupStatus({ message: `Found sale ${found.saleNumber} — return quantities capped to what was actually sold.`, type: 'success' });
    } catch (err) {
      setMaxQtyBySku({});
      setSaleLookupStatus({
        message: err instanceof ApiClientError && err.status === 404 ? `No sale found matching "${saleNumber}".` : 'Could not look up that sale.',
        type: 'error',
      });
    } finally {
      setIsLookingUpSale(false);
    }
  };

  const filteredNotes = (creditNotes || []).filter((cn) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      cn.id.toLowerCase().includes(q) ||
      (cn.originalSaleNumber && cn.originalSaleNumber.toLowerCase().includes(q)) ||
      cn.customer?.name?.toLowerCase().includes(q) ||
      cn.customer?.accountNumber?.toLowerCase().includes(q) ||
      cn.cashier?.name?.toLowerCase().includes(q)
    );
  });

  // Estimate only — the persisted totalRefundAmount is computed authoritatively
  // server-side from each SKU's real tax_rate (see server/routes/creditNotes.ts).
  const totalRefundAmount = returnItems.reduce(
    (s, it) => s + it.returnQty * it.unitPrice * (1 + (it.item.taxRate || 0) / 100),
    0
  );

  const handleAddReturnLine = () => {
    setReturnItems([
      ...returnItems,
      {
        item: INITIAL_INVENTORY_ITEMS[1],
        returnQty: 1,
        unitPrice: INITIAL_INVENTORY_ITEMS[1].retailPrice,
        reason: 'Customer return',
        restock: true,
      }
    ]);
  };

  const handleRemoveReturnLine = (idx: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== idx));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = (customers || []).find((c) => c.id === selectedCustomerId) || customers?.[0] || {
      id: 'CUST-001',
      name: 'Walk-In Customer',
      accountNumber: 'CUST-001',
      email: 'customer@itred.com',
      phone: '555-0100',
      accountType: 'CASH',
      status: 'APPROVED',
      creditLimit: 1000,
      currentBalance: 0,
    } as any;

    if (!activeShift || activeShift.status !== 'OPEN') {
      setActionAlert({ message: 'Active Shift Required: an open shift on this terminal is required before a return can be processed.', type: 'error' });
      return;
    }

    if (returnItems.length === 0) {
      setActionAlert({ message: 'At least one return item line is required.', type: 'error' });
      return;
    }
    for (const line of returnItems) {
      const cap = maxQtyBySku[line.item.sku];
      if (cap !== undefined && line.returnQty > cap) {
        setActionAlert({ message: `Return qty for ${line.item.sku} (${line.returnQty}) exceeds what was sold (${cap}).`, type: 'error' });
        return;
      }
    }

    setIsSubmittingCreditNote(true);
    try {
      const created = await apiPost<{ id: string; totalRefundAmount: number; terminalId?: string; branchId?: string; shiftId?: string }>(
        '/credit-notes',
        {
          originalSaleNumber: refSaleNumber.trim() || undefined,
          customerId: cust.id !== 'CUST-001' ? cust.id : undefined,
          customerName: cust.name,
          refundMethod,
          reasonCategory,
          shiftId: activeShift.id,
          idempotencyKey: sessionIdempotencyKey,
          returnedItems: returnItems.map((line) => ({
            sku: line.item.sku,
            itemName: line.item.name || line.item.description,
            returnQty: line.returnQty,
            unitPrice: line.unitPrice,
            reason: line.reason,
            restock: line.restock,
          })),
        }
      );

      const newCreditNote: CreditNote = {
        id: created.id,
        originalSaleNumber: refSaleNumber.trim() || undefined,
        customer: cust,
        cashier: currentStaff,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        returnedItems: returnItems,
        totalRefundAmount: created.totalRefundAmount,
        refundMethod,
        reasonCategory,
        status: 'ISSUED',
        terminalId: created.terminalId,
        branchId: created.branchId,
        shiftId: created.shiftId,
      };

      onIssueCreditNote(newCreditNote);
      setActionAlert({
        message: `Credit Note ${newCreditNote.id} for $${created.totalRefundAmount.toFixed(2)} issued successfully to ${cust.name}.`,
        type: 'success',
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setActionAlert({
        message: err instanceof ApiClientError ? `Credit note not saved: ${err.message}` : 'Could not reach the backend to issue this credit note.',
        type: 'error',
      });
    } finally {
      setIsSubmittingCreditNote(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Bar */}
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
                <RotateCcw className="w-4 h-4 text-orange-400" />
                Credit Notes & Sales Returns
              </h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-mono">
                {creditNotes.length} Issued Records
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Merchandise return requisitions, inventory restock adjustments, and customer ledger credits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Issue New Credit Note
          </Button>
        </div>
      </div>

      {actionAlert && (
        <Alert type={actionAlert.type} onClose={() => setActionAlert(null)} size="sm">
          {actionAlert.message}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 border border-slate-300">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Credit Note #, original sale #, customer, cashier..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
          />
        </div>

        <div className="text-xs font-mono text-gray-500">
          Showing {filteredNotes.length} of {creditNotes.length} credit notes
        </div>
      </div>

      {/* Credit Notes Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Credit Note #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Date / Time</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Orig. Sale #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Customer Account</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Reason</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Refund Method</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Refund Total</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-24">Status</th>
                <th className="py-2.5 px-3 text-right uppercase tracking-wider font-semibold w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    No credit notes recorded. Click "Issue New Credit Note" to register a customer return.
                  </td>
                </tr>
              ) : (
                filteredNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                      {cn.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                      {cn.dateTime}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-700 text-[11px]">
                      {cn.originalSaleNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-gray-900">{cn.customer.name}</div>
                      <div className="text-[10px] font-mono text-gray-500">{cn.customer.accountNumber}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-gray-700">
                      {cn.reasonCategory.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {cn.refundMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                      ${cn.totalRefundAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] uppercase">
                        {cn.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedNote(cn)}
                        className="p-1 px-2 text-[11px] font-mono border border-gray-300 hover:bg-gray-100 text-gray-700 cursor-pointer"
                      >
                        View Note
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Credit Note Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title="Issue Commercial Credit Note / Return"
          subtitle="Merchandise Reversal & Customer Ledger Credit"
          maxWidth="lg"
          headerColor="orange"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSubmit}
                isLoading={isSubmittingCreditNote}
                disabled={isSubmittingCreditNote}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold"
              >
                Issue Credit Note (${totalRefundAmount.toFixed(2)})
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs select-none">
            <Alert type="info" size="sm">
              Credit Notes reverse inventory sales and credit the customer's commercial account ledger or issue a cash reimbursement.
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Customer Account *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.accountNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Original Invoice / Sale # (Ref)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={refSaleNumber}
                    onChange={(e) => {
                      setRefSaleNumber(e.target.value);
                      setMaxQtyBySku({});
                      setSaleLookupStatus(null);
                    }}
                    placeholder="e.g. INV-20260815-001"
                    className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleLookupSale} isLoading={isLookingUpSale} disabled={!refSaleNumber.trim() || isLookingUpSale}>
                    Look Up
                  </Button>
                </div>
                {saleLookupStatus && (
                  <p className={`text-[10px] mt-1 font-mono ${saleLookupStatus.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {saleLookupStatus.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Return Reason Category *
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value as any)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="WRONG_ITEM">Wrong Item / Fitment</option>
                  <option value="DEFECTIVE">Defective / Damaged</option>
                  <option value="CUSTOMER_RETURN">Customer Change of Mind</option>
                  <option value="PRICE_ADJUSTMENT">Price / Billing Adjustment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Refund Tender Method *
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="CUSTOMER_CREDIT">Customer Account Credit (Debtor Ledger)</option>
                <option value="CASH">Cash Refund</option>
                <option value="ORIGINAL_METHOD">Original Tender Reimbursement</option>
              </select>
            </div>

            {/* Returned Items List */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Returned Line Items ({returnItems.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddReturnLine}
                  className="text-xs font-mono font-bold text-[#FF6B00] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-gray-300 divide-y divide-gray-200">
                {returnItems.map((line, idx) => (
                  <div key={idx} className="p-2.5 bg-white space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5">
                        <select
                          value={line.item.sku}
                          onChange={(e) => {
                            const found = INITIAL_INVENTORY_ITEMS.find((it) => it.sku === e.target.value);
                            if (found) {
                              const updated = [...returnItems];
                              updated[idx].item = found;
                              updated[idx].unitPrice = found.retailPrice;
                              setReturnItems(updated);
                            }
                          }}
                          className="w-full p-1.5 bg-gray-50 border border-gray-300 text-xs font-medium focus:outline-none focus:border-[#FF6B00]"
                        >
                          {INITIAL_INVENTORY_ITEMS.map((it) => (
                            <option key={it.sku} value={it.sku}>
                              {it.sku} - {it.name || it.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          max={maxQtyBySku[line.item.sku]}
                          value={line.returnQty}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            const cap = maxQtyBySku[line.item.sku];
                            const parsed = parseInt(e.target.value) || 1;
                            updated[idx].returnQty = cap !== undefined ? Math.min(parsed, cap) : parsed;
                            setReturnItems(updated);
                          }}
                          className="w-full p-1.5 bg-gray-50 border border-gray-300 font-mono text-center text-xs"
                          placeholder="Qty"
                        />
                        {maxQtyBySku[line.item.sku] !== undefined && (
                          <div className="text-[9px] text-gray-400 font-mono text-center">of {maxQtyBySku[line.item.sku]} sold</div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setReturnItems(updated);
                          }}
                          className="w-full p-1.5 bg-gray-50 border border-gray-300 font-mono text-right text-xs"
                          placeholder="Price"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-1">
                        <label className="flex items-center gap-1 text-[10px] font-mono text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.restock}
                            onChange={(e) => {
                              const updated = [...returnItems];
                              updated[idx].restock = e.target.checked;
                              setReturnItems(updated);
                            }}
                            className="text-[#FF6B00] rounded-none focus:ring-0"
                          />
                          <span>Restock SOH</span>
                        </label>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveReturnLine(idx)}
                          className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={line.reason}
                      onChange={(e) => {
                        const updated = [...returnItems];
                        updated[idx].reason = e.target.value;
                        setReturnItems(updated);
                      }}
                      placeholder="Specific condition / return comment..."
                      className="w-full p-1.5 bg-gray-50 border border-gray-200 text-[11px] font-sans"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-gray-300 font-mono flex justify-between items-center">
              <span className="font-bold uppercase text-xs text-gray-700">Total Credit Note Refund:</span>
              <span className="font-black text-lg text-rose-700">${totalRefundAmount.toFixed(2)}</span>
            </div>
          </form>
        </Modal>
      )}

      {/* View Credit Note Details Modal */}
      {selectedNote && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedNote(null)}
          title={`Credit Note Details: ${selectedNote.id}`}
          subtitle={`Customer: ${selectedNote.customer.name} • ${selectedNote.dateTime}`}
          maxWidth="md"
          headerColor="orange"
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedNote(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 text-xs select-none font-mono">
            <div className="p-2.5 bg-gray-50 border border-gray-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Related Invoice:</span>
                <span className="font-bold">{selectedNote.originalSaleNumber || 'Direct Return'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reason Category:</span>
                <span className="font-bold">{selectedNote.reasonCategory.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Settlement Method:</span>
                <span className="font-bold">{selectedNote.refundMethod.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cashier:</span>
                <span>{selectedNote.cashier.name}</span>
              </div>
            </div>

            <div className="border border-gray-300 divide-y divide-gray-200">
              <div className="p-2 bg-gray-100 font-bold text-[10px] uppercase text-gray-600 flex justify-between">
                <span>Returned Item</span>
                <span>Refund Qty x Price</span>
              </div>
              {selectedNote.returnedItems.map((line, idx) => (
                <div key={idx} className="p-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900 font-sans">{line.item.name || line.item.description}</div>
                    <div className="text-[10px] text-gray-500">
                      SKU: {line.item.sku} • {line.restock ? 'Restocked to SOH' : 'Quarantined/Scrapped'}
                    </div>
                  </div>
                  <div className="font-bold text-rose-700">
                    {line.returnQty} @ ${line.unitPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold uppercase text-xs">Total Refund Credited:</span>
              <span className="font-black text-base text-rose-400">${selectedNote.totalRefundAmount.toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
