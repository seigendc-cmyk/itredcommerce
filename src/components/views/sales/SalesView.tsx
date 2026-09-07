import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  PauseCircle, 
  CreditCard, 
  Banknote, 
  User, 
  Receipt, 
  Printer, 
  ArrowLeft, 
  CheckCircle2, 
  Tag, 
  Layers, 
  Clock, 
  AlertTriangle, 
  LayoutGrid, 
  List as ListIcon, 
  Percent, 
  ShieldAlert, 
  Lock, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  CartLineItem, 
  InventoryItem, 
  StaffMember, 
  Customer, 
  SaleTransaction, 
  HeldSale, 
  HeldReceipt, 
  LayawayOrder,
  PaymentMethodType,
  SplitPaymentEntry,
  Shift
} from '../../../types';
import { 
  INITIAL_INVENTORY_ITEMS, 
  INITIAL_CUSTOMERS, 
  INITIAL_HELD_SALES,
  INITIAL_HELD_RECEIPTS,
  INITIAL_LAYAWAY_ORDERS,
  INITIAL_SALES_TRANSACTIONS
} from '../../../data/mockData';
import { searchInventoryItems } from '../../../utils/searchUtils';
import { executeAtomicSaleTransaction, validateSaleEligibility } from '../../../utils/saleTransactionEngine';
import { calculateLineTotal, calculateCartTotals } from '../../../utils/saleCalculationEngine';
import { apiPost, ApiClientError } from '../../../api/client';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { StatusBadge } from '../../ui/StatusBadge';
import { Alert } from '../../ui/Alert';
import { CustomerSelectorModal } from './CustomerSelectorModal';
import { PaymentTenderModal } from './PaymentTenderModal';
import { HeldSaleModal } from './HeldSaleModal';
import { ParkCartModal } from './ParkCartModal';
import { LayawayModal } from './LayawayModal';
import { DiscountModal } from './DiscountModal';
import { ReceiptModal } from './ReceiptModal';

export interface SalesViewProps {
  saleType?: 'CASH' | 'CREDIT' | 'RETURN' | 'LAYAWAY';
  currentStaff: StaffMember;
  activeShift?: Shift | null;
  inventoryItems?: InventoryItem[];
  customers?: Customer[];
  heldSales?: HeldSale[];
  heldReceipts?: HeldReceipt[];
  terminalId?: string;
  branchId?: string;
  branchName?: string;
  onBackToLanding: () => void;
  onOpenShift?: () => void;
  onNavigateToHeldSales?: () => void;
  onNavigateToHeldReceipts?: () => void;
  onNavigateToLayaway?: () => void;
  /** Prompt 7: jumps to Delivery Dispatch with this sale pre-filled, once it's completed and its receipt is showing. */
  onNavigateToDeliveryDispatch?: (saleNumber: string) => void;
  onRecordCompletedSale?: (sale: SaleTransaction) => void;
  onRecordHeldSale?: (heldSale: HeldSale) => void;
  onParkCart?: (parked: HeldReceipt) => void;
  onRecordLayaway?: (layaway: LayawayOrder) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  saleType = 'CASH',
  currentStaff,
  activeShift,
  inventoryItems = INITIAL_INVENTORY_ITEMS,
  customers = INITIAL_CUSTOMERS,
  heldSales = INITIAL_HELD_SALES,
  heldReceipts = INITIAL_HELD_RECEIPTS,
  terminalId = 'POS-D01',
  branchId = 'BR-01',
  branchName = 'Main Retail Storefront',
  onBackToLanding,
  onOpenShift,
  onNavigateToHeldSales,
  onNavigateToHeldReceipts,
  onNavigateToLayaway,
  onNavigateToDeliveryDispatch,
  onRecordCompletedSale,
  onRecordHeldSale,
  onParkCart,
  onRecordLayaway,
}) => {
  // Active Customer (Defaults to Walk In Customer)
  const defaultWalkInCustomer: Customer = {
    id: 'CUST-WALKIN',
    name: 'Walk-In Cash Customer',
    accountNumber: 'CUST-0001',
    email: 'cash@store.local',
    phone: '555-0199',
    status: 'APPROVED',
    isCreditApproved: false,
    creditLimit: 0,
    currentBalance: 0,
    availableCredit: 0,
    createdDate: new Date().toISOString().split('T')[0],
  };

  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(
    (customers || []).find((c) => c.id === 'CUST-WALKIN') || customers?.[0] || defaultWalkInCustomer
  );

  // Cart State
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);

  // Catalog Browser & Tolerant Search
  const [barcodeInput, setBarcodeInput] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('grid');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isTenderModalOpen, setIsTenderModalOpen] = useState(false);
  const [isHeldSaleModalOpen, setIsHeldSaleModalOpen] = useState(false);
  const [isParkCartModalOpen, setIsParkCartModalOpen] = useState(false);
  const [isLayawayModalOpen, setIsLayawayModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<SaleTransaction | null>(null);

  const [alertNotice, setAlertNotice] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Outstanding Held Sales Count
  const outstandingHeldCount = heldSales.filter((hs) => hs.status === 'OUTSTANDING').length;

  // Catalog filtering using tolerant multi-token search on live inventory
  const displayedCatalog = catalogSearch.trim()
    ? searchInventoryItems(inventoryItems, catalogSearch)
    : inventoryItems;

  // Cart Calculations — sums per-line tax/discount via the shared engine
  // (Prompt 13) rather than applying one flat rate to the whole cart.
  const cartTotals = calculateCartTotals(
    cartItems.map((c) => ({
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      taxRate: c.taxRate ?? 15,
      discountPercent: c.discountPercent,
    }))
  );
  const { subtotal, totalDiscount, totalTax, grandTotal } = cartTotals;
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Hotkey listener for POS function keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || e.key === 'F2') {
        e.preventDefault();
        if (cartItems.length > 0) {
          if (!activeShift || activeShift.status !== 'OPEN') {
            setAlertNotice({
              message: 'Active Shift Required: An open shift is required before checkout.',
              type: 'error'
            });
            if (onOpenShift) onOpenShift();
          } else {
            setIsTenderModalOpen(true);
          }
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (cartItems.length > 0) setIsHeldSaleModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cartItems.length > 0) setIsParkCartModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cartItems.length > 0) setIsLayawayModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, activeShift, onOpenShift]);

  const handleAddItem = (item: InventoryItem) => {
    // ENFORCE INDUSTRIAL INVENTORY RULE: Find live item in branch inventory
    const liveItem = inventoryItems.find((i) => i.sku === item.sku) || item;

    if (liveItem.stockOnHand <= 0) {
      setAlertNotice({
        message: `Inventory Stock Violation: Cannot add "${liveItem.sku} - ${liveItem.description}". Item is Out of Stock (0 Units available).`,
        type: 'error',
      });
      return;
    }

    const existingIndex = cartItems.findIndex((c) => c.item.sku === liveItem.sku);
    if (existingIndex > -1) {
      const currentQtyInCart = cartItems[existingIndex].quantity;
      if (currentQtyInCart + 1 > liveItem.stockOnHand) {
        setAlertNotice({
          message: `Stock Warning: Cannot add more than available Stock on Hand (${liveItem.stockOnHand} Units) for SKU ${liveItem.sku}.`,
          type: 'warning',
        });
        return;
      }
      const updated = [...cartItems];
      const existingLine = updated[existingIndex];
      const newQty = existingLine.quantity + 1;
      // Recompute fresh from the new quantity — the bug this replaces left
      // taxAmount frozen at whatever it was when the line was first added.
      const recalced = calculateLineTotal({
        quantity: newQty,
        unitPrice: existingLine.unitPrice,
        taxRate: existingLine.taxRate ?? 15,
        discountPercent: existingLine.discountPercent,
      });
      updated[existingIndex] = {
        ...existingLine,
        quantity: newQty,
        discountAmount: recalced.discountAmount,
        taxAmount: recalced.taxAmount,
        lineTotal: recalced.lineTotal,
      };
      setCartItems(updated);
      setAlertNotice({ message: `Incremented quantity for ${liveItem.sku} (${updated[existingIndex].quantity} Units)`, type: 'success' });
    } else {
      const taxRate = liveItem.taxRate ?? 15;
      const calc = calculateLineTotal({
        quantity: 1,
        unitPrice: liveItem.retailPrice,
        taxRate,
        discountPercent: globalDiscountPercent,
      });
      const newItem: CartLineItem = {
        id: `cart-${Date.now()}-${Math.random()}`,
        item: { ...liveItem },
        quantity: 1,
        unitPrice: liveItem.retailPrice,
        discountPercent: globalDiscountPercent,
        discountAmount: calc.discountAmount,
        taxAmount: calc.taxAmount,
        lineTotal: calc.lineTotal,
        itemName: liveItem.name || liveItem.description,
        sku: liveItem.sku,
        unitCostBasis: liveItem.unitCost ?? liveItem.cost ?? 0,
        taxRate,
        frozenSnapshot: { ...liveItem },
      };
      setCartItems([...cartItems, newItem]);
      setAlertNotice({ message: `Added item: ${liveItem.name || liveItem.description}`, type: 'success' });
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim().toLowerCase();
    const cleanQuery = query.replace(/[^a-z0-9]/g, '');

    // Search SKU, Barcode, Part Number, OEM Number in live inventory
    const found = inventoryItems.find(
      (item) =>
        item.sku.toLowerCase() === query ||
        item.sku.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQuery ||
        item.barcode === barcodeInput.trim() ||
        (item.partNumber && item.partNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQuery) ||
        (item.oemNumber && item.oemNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanQuery)
    );

    if (found) {
      handleAddItem(found);
      setBarcodeInput('');
    } else {
      setAlertNotice({
        message: `Product barcode or SKU "${barcodeInput}" not found in local catalog journal.`,
        type: 'error',
      });
    }
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((line) => {
          if (line.id === id) {
            const liveItem = inventoryItems.find((i) => i.sku === line.item.sku) || line.item;
            const itemSOH = liveItem.stockOnHand;
            const newQty = line.quantity + delta;
            if (newQty > itemSOH) {
              setAlertNotice({
                message: `Stock Limit: Cannot exceed stock on hand of ${itemSOH} units for SKU ${line.item.sku}.`,
                type: 'warning',
              });
              return line;
            }
            if (newQty < 1) return null;
            const recalced = calculateLineTotal({
              quantity: newQty,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate ?? 15,
              discountPercent: line.discountPercent,
            });
            return {
              ...line,
              quantity: newQty,
              discountAmount: recalced.discountAmount,
              taxAmount: recalced.taxAmount,
              lineTotal: recalced.lineTotal,
            };
          }
          return line;
        })
        .filter(Boolean) as CartLineItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Complete Sales Tender Handler with Atomic Transaction Execution & Snapshots
  const handleFinalizeSale = async (payments: SplitPaymentEntry[], changeGiven: number, idempotencyKey: string) => {
    const result = executeAtomicSaleTransaction({
      cartItems,
      inventoryItems,
      activeShift,
      customer: selectedCustomer,
      cashier: currentStaff,
      terminalId,
      branchId,
      branchName,
      payments,
      subtotal,
      totalTax,
      totalDiscount,
      grandTotal,
      changeGiven,
      idempotencyKey,
    });

    if (!result.success || !result.sale) {
      setAlertNotice({
        message: result.error || 'Sale transaction failed. No changes were committed.',
        type: 'error',
      });
      throw new Error(result.error || 'Sale transaction validation error.');
    }

    // Persist through the outbox before touching local state — a checkout
    // that only lives in memory isn't durable. Only the inventory rows this
    // sale actually touched are sent (result.updatedInventory otherwise
    // includes every unchanged item too).
    const changedInventory = (result.updatedInventory || [])
      .filter((inv) => cartItems.some((c) => c.item.sku === inv.sku))
      .map((inv) => ({ sku: inv.sku, stockOnHand: inv.stockOnHand, status: inv.status }));

    try {
      await apiPost('/sales', {
        sale: result.sale,
        updatedInventory: changedInventory,
        newMovements: result.newMovements || [],
        newActivityEvent: result.newActivityEvent,
        updatedCustomer: result.updatedCustomer,
      });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Could not reach the backend to record this sale.';
      setAlertNotice({ message: `Sale not saved: ${message}`, type: 'error' });
      throw err;
    }

    // Call parent handler to update root state in one batch
    if (onRecordCompletedSale) {
      onRecordCompletedSale(result.sale);
    }

    setCompletedSaleData(result.sale);
    setCartItems([]);
    setIsTenderModalOpen(false);
    setIsReceiptModalOpen(true);
    setAlertNotice({
      message: `Sale #${result.sale.saleNumber} completed & immutably sealed. Receipt ready.`,
      type: 'success',
    });
  };

  const cartItemsForApi = () =>
    cartItems.map((c) => ({
      sku: c.item.sku,
      itemName: c.itemName || c.item.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      discountPercent: c.discountPercent,
      taxAmount: c.taxAmount,
      lineTotal: c.lineTotal,
    }));

  // Held Sale Confirmation Handler
  const handleConfirmHeldSale = async (data: { expectedSettlementTime: string; notes: string }) => {
    const randHeldNum = `HELD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const newHeld: HeldSale = {
      id: `HS-${Date.now()}`,
      saleNumber: randHeldNum,
      customer: selectedCustomer,
      cashier: currentStaff,
      items: [...cartItems],
      subtotal,
      grandTotal,
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      expectedSettlementTime: data.expectedSettlementTime,
      status: 'OUTSTANDING',
      notes: data.notes,
    };

    try {
      await apiPost('/held-sales', {
        customer: selectedCustomer && selectedCustomer.id !== 'CUST-WALKIN' ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
        items: cartItemsForApi(),
        subtotal,
        grandTotal,
        expectedSettlementTime: data.expectedSettlementTime,
        notes: data.notes,
      });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Could not reach the backend to hold this sale.';
      setAlertNotice({ message: `Held sale not saved: ${message}`, type: 'error' });
      return;
    }

    if (onRecordHeldSale) {
      onRecordHeldSale(newHeld);
    }

    setCartItems([]);
    setAlertNotice({
      message: `Operational Held Sale ${randHeldNum} recorded. Outstanding settlement expected at ${data.expectedSettlementTime}.`,
      type: 'warning',
    });
  };

  // Park Cart Handler (Held Receipts)
  const handleConfirmParkCart = async (note: string) => {
    const randParkId = `PARK-${Math.floor(100 + Math.random() * 900)}`;
    const newPark: HeldReceipt = {
      id: randParkId,
      cashier: currentStaff,
      customer: selectedCustomer,
      items: [...cartItems],
      parkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note,
      totalAmount: grandTotal,
    };

    try {
      await apiPost('/held-receipts', {
        customer: selectedCustomer && selectedCustomer.id !== 'CUST-WALKIN' ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
        items: cartItemsForApi(),
        totalAmount: grandTotal,
        note,
      });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Could not reach the backend to park this cart.';
      setAlertNotice({ message: `Cart not parked: ${message}`, type: 'error' });
      return;
    }

    if (onParkCart) {
      onParkCart(newPark);
    }

    setCartItems([]);
    setAlertNotice({
      message: `Cart parked to Held Receipts (${randParkId}). Ready for next customer in queue.`,
      type: 'info',
    });
  };

  // Layaway Agreement Confirmation Handler
  const handleConfirmLayaway = (data: {
    depositAmount: number;
    paymentMethod: PaymentMethodType;
    nextPaymentDate: string;
    notes?: string;
  }) => {
    const randLayId = `LAY-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newLayaway: LayawayOrder = {
      id: randLayId,
      customer: selectedCustomer,
      cashier: currentStaff,
      reservedItems: [...cartItems],
      totalAmount: grandTotal,
      amountPaid: data.depositAmount,
      balanceRemaining: Math.max(0, grandTotal - data.depositAmount),
      paymentHistory: [
        {
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          amount: data.depositAmount,
          method: data.paymentMethod,
          cashierName: currentStaff.name,
          receiptNo: `REC-LAY-${Math.floor(100 + Math.random() * 900)}`,
        }
      ],
      nextExpectedPaymentDate: data.nextPaymentDate,
      depositPercent: Math.round((data.depositAmount / grandTotal) * 100),
      createdDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'ACTIVE',
    };

    if (onRecordLayaway) {
      onRecordLayaway(newLayaway);
    }

    setCartItems([]);
    setAlertNotice({
      message: `Layaway agreement ${randLayId} established. Deposit of $${data.depositAmount.toFixed(2)} accepted. Merchandise reserved.`,
      type: 'success',
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-3 space-y-3 select-none">
      {/* Top POS Register Header Bar */}
      <div className="bg-slate-900 text-white p-2.5 border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-mono text-xs"
          >
            Landing
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-[#FF6B00]" />
                <span>POS Sales Workstation</span>
              </h2>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono">
                {terminalId}
              </span>
              {activeShift && activeShift.status === 'OPEN' ? (
                <span className="px-1.5 py-0.2 bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 text-[10px] font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Shift #{activeShift.shiftNumber} Active
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  No Active Shift
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Cashier: {currentStaff.name} ({currentStaff.code}) • Branch: {branchName}
            </p>
          </div>
        </div>

        {/* Top Badges & Operational Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {(!activeShift || activeShift.status !== 'OPEN') && onOpenShift && (
            <button
              type="button"
              onClick={onOpenShift}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Open active shift on this terminal"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Open Register Shift</span>
            </button>
          )}
          {/* Persistent Held Sales Indicator */}
          {outstandingHeldCount > 0 && (
            <button
              type="button"
              onClick={onNavigateToHeldSales}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Click to view and reconcile outstanding held sales"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{outstandingHeldCount} Held Sales Outstanding</span>
            </button>
          )}

          {/* Held Receipts Badge */}
          {heldReceipts.length > 0 && (
            <button
              type="button"
              onClick={onNavigateToHeldReceipts}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5 text-orange-400" />
              <span>{heldReceipts.length} Parked Carts</span>
            </button>
          )}

          {/* Customer Selector Card in Header */}
          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1 border border-slate-700 text-xs transition-colors cursor-pointer text-left"
          >
            <User className="w-3.5 h-3.5 text-orange-400" />
            <div>
              <div className="text-white font-bold flex items-center gap-1 text-[11px]">
                <span>{selectedCustomer.name}</span>
                {selectedCustomer.status === 'PENDING_APPROVAL' && (
                  <span className="text-[9px] bg-amber-500 text-black px-1 font-mono font-bold">
                    PENDING
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {selectedCustomer.id === 'CUST-WALKIN'
                  ? 'Walk-In Customer'
                  : `Avail Credit: $${selectedCustomer.availableCredit.toFixed(2)}`}
              </div>
            </div>
          </button>
        </div>
      </div>

      {alertNotice && (
        <Alert
          type={alertNotice.type === 'error' ? 'error' : alertNotice.type === 'warning' ? 'warning' : alertNotice.type === 'info' ? 'info' : 'success'}
          onClose={() => setAlertNotice(null)}
          size="sm"
        >
          {alertNotice.message}
        </Alert>
      )}

      {/* Main POS Register Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Left Column: Barcode, Active Cart Line Items Table, and Catalog Drawer */}
        <div className="lg:col-span-8 space-y-3 flex flex-col">
          
          {/* Prominent Barcode / Part # Search Bar */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1 bg-white border border-slate-300 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode or enter Part Number / SKU (e.g. 12345-23456 or ITM-MS-101)..."
                className="w-full pl-9 pr-3 py-2 text-xs font-mono focus:outline-none placeholder:text-slate-400 placeholder:font-sans"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold"
            >
              Add Item
            </Button>
          </form>

          {/* Active Cart Line Items Table */}
          <div className="border border-slate-300 bg-white shadow-xs flex-1 flex flex-col justify-between min-h-[300px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                    <th className="py-2 px-3 uppercase tracking-wider font-semibold">SKU / Item Description</th>
                    <th className="py-2 px-3 uppercase tracking-wider font-semibold text-center w-28">Qty</th>
                    <th className="py-2 px-3 uppercase tracking-wider font-semibold text-right w-24">Price</th>
                    <th className="py-2 px-3 uppercase tracking-wider font-semibold text-right w-20">Tax</th>
                    <th className="py-2 px-3 uppercase tracking-wider font-semibold text-right w-28">Total</th>
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-slate-400">
                        <ShoppingCart className="w-9 h-9 mx-auto mb-1.5 opacity-30 text-slate-400" />
                        <div className="font-semibold uppercase tracking-wider text-slate-600 text-xs">Cart is Empty</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Scan barcode or select products from catalog below
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((line) => (
                      <tr key={line.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{line.item.name || line.item.description}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                            <span>SKU: {line.item.sku}</span>
                            {line.item.partNumber && <span>Part: {line.item.partNumber}</span>}
                            <span>Loc: {line.item.location}</span>
                            <span className="text-gray-400">SOH: {line.item.stockOnHand}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-300 bg-white">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(line.id, -1)}
                              className="p-1 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-mono font-bold text-xs text-slate-900 min-w-[28px] text-center">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(line.id, 1)}
                              className="p-1 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800">
                          ${line.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600 text-[11px]">
                          15%
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ${line.lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(line.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                            title="Remove item from cart"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Catalog Bar with Compact Grid/List Toggle */}
            <div className="p-2.5 bg-[#FAF8F5] border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-slate-600 font-bold">
                    Catalog Browser ({displayedCatalog.length} Items):
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter catalog..."
                      className="px-2 py-0.5 text-[11px] bg-white border border-gray-300 font-mono focus:outline-none focus:border-[#FF6B00] w-36"
                    />
                  </div>
                </div>

                {/* Compact Grid vs List Toggle */}
                <div className="flex items-center border border-gray-300 bg-white">
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('grid')}
                    className={`p-1 text-[11px] cursor-pointer flex items-center gap-1 ${
                      catalogViewMode === 'grid' ? 'bg-[#FF6B00] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Compact Grid View"
                  >
                    <LayoutGrid className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('list')}
                    className={`p-1 text-[11px] cursor-pointer flex items-center gap-1 ${
                      catalogViewMode === 'list' ? 'bg-[#FF6B00] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Compact List View"
                  >
                    <ListIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Grid Cards (Small enough for fast POS operation) */}
              {catalogViewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {displayedCatalog.map((itm) => {
                    const isOut = itm.stockOnHand <= 0;
                    return (
                      <button
                        key={itm.sku}
                        type="button"
                        onClick={() => handleAddItem(itm)}
                        className={`p-1.5 text-left border transition-colors cursor-pointer text-xs select-none relative ${
                          isOut
                            ? 'bg-rose-50/60 border-rose-200 opacity-75 hover:border-rose-400'
                            : 'bg-white border-slate-200 hover:border-[#FF6B00] hover:bg-orange-50/40'
                        }`}
                      >
                        <div className="font-semibold text-slate-900 truncate text-[11px]">
                          {itm.name || itm.description}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                          <span>{itm.sku}</span>
                          {isOut ? (
                            <span className="text-rose-700 font-bold text-[9px] bg-rose-100 px-1 border border-rose-300">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="text-gray-600 font-medium">SOH: {itm.stockOnHand}</span>
                          )}
                        </div>
                        <div className="text-right font-mono font-bold text-[#FF6B00] text-xs mt-0.5">
                          ${itm.retailPrice.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Compact List View */
                <div className="border border-gray-300 divide-y divide-gray-200 bg-white max-h-[160px] overflow-y-auto">
                  {displayedCatalog.map((itm) => {
                    const isOut = itm.stockOnHand <= 0;
                    return (
                      <div
                        key={itm.sku}
                        onClick={() => handleAddItem(itm)}
                        className={`p-1.5 px-2 flex items-center justify-between text-xs cursor-pointer ${
                          isOut ? 'bg-rose-50/40 opacity-70 hover:bg-rose-100/50' : 'hover:bg-orange-50/40'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-gray-900 text-[11px]">{itm.name || itm.description}</span>
                          <span className="text-[10px] font-mono text-gray-500 ml-2">SKU: {itm.sku}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono shrink-0">
                          {isOut ? (
                            <span className="text-rose-700 font-bold text-[9px] bg-rose-100 px-1">OUT OF STOCK</span>
                          ) : (
                            <span className="text-[10px] text-gray-500">SOH: {itm.stockOnHand}</span>
                          )}
                          <strong className="text-[#FF6B00]">${itm.retailPrice.toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Register Summary & Tender Action Panel */}
        <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
          
          {/* Summary Box */}
          <div className="bg-white border border-slate-300 p-3.5 shadow-xs space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1.5 border-b border-slate-200 flex items-center justify-between">
              <span>Register Summary</span>
              <span className="font-mono text-slate-500">{totalItemCount} Units ({cartItems.length} Lines)</span>
            </div>

            {/* Customer Summary Card in Right Panel */}
            <div className="p-2 bg-[#FAF8F5] border border-gray-300 font-mono text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900 truncate">{selectedCustomer.name}</span>
              </div>
              {selectedCustomer.id !== 'CUST-WALKIN' && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Status:</span>
                    <span className={`font-bold ${selectedCustomer.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {selectedCustomer.status}
                    </span>
                  </div>
                  {selectedCustomer.isCreditApproved && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Available Credit:</span>
                      <span className="font-bold text-emerald-800">${selectedCustomer.availableCredit.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Math Breakdown */}
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Net):</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {/* Discount Row & Modal Trigger */}
              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-1">
                  <span>Discount:</span>
                  <button
                    type="button"
                    onClick={() => setIsDiscountModalOpen(true)}
                    className="text-[10px] text-[#FF6B00] hover:underline font-mono cursor-pointer"
                  >
                    ({globalDiscountPercent > 0 ? `${globalDiscountPercent}%` : 'Add %'})
                  </button>
                </div>
                <span className={totalDiscount > 0 ? 'text-rose-600 font-bold' : ''}>
                  -${totalDiscount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax / VAT (15%):</span>
                <span>${totalTax.toFixed(2)}</span>
              </div>
            </div>

            {/* High-Contrast Grand Total Block */}
            <div className="p-3 bg-slate-900 text-white border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-orange-400 font-mono">
                Total Payable:
              </div>
              <div className="text-3xl font-black font-mono text-white tracking-tight mt-0.5">
                ${grandTotal.toFixed(2)}
              </div>
            </div>

            {/* Fast Tender Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsTenderModalOpen(true)}
                disabled={cartItems.length === 0}
                leftIcon={<Banknote className="w-4 h-4" />}
                className="w-full font-bold text-sm bg-[#FF6B00] hover:bg-[#E05E00]"
                shortcutBadge="F1"
              >
                Tender Payment / Split
              </Button>

              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHeldSaleModalOpen(true)}
                  disabled={cartItems.length === 0}
                  leftIcon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
                  shortcutBadge="F3"
                  className="text-xs"
                  title="Operational Held Sale (Same-day contractor settlement)"
                >
                  Hold Sale
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsParkCartModalOpen(true)}
                  disabled={cartItems.length === 0}
                  leftIcon={<PauseCircle className="w-3.5 h-3.5 text-slate-600" />}
                  shortcutBadge="F4"
                  className="text-xs"
                  title="Park unfinished cart to serve next customer"
                >
                  Park Cart
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLayawayModalOpen(true)}
                  disabled={cartItems.length === 0}
                  leftIcon={<Layers className="w-3.5 h-3.5 text-blue-600" />}
                  shortcutBadge="F8"
                  className="text-xs"
                  title="Layaway installment agreement"
                >
                  Layaway
                </Button>
              </div>
            </div>
          </div>

          {/* POS Keyboard Shortcuts Reference Card */}
          <div className="bg-[#FAF8F5] border border-slate-300 p-2.5 text-[10px] font-mono text-slate-600 space-y-1">
            <div className="font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
              POS Terminal Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span><strong>[F1]</strong> Tender Split</span>
              <span><strong>[F3]</strong> Held Sale</span>
              <span><strong>[F4]</strong> Park Cart</span>
              <span><strong>[F8]</strong> Layaway</span>
            </div>
          </div>

          {/* Void Cart Action */}
          {cartItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCartItems([])}
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 text-xs w-full"
            >
              Void Active Cart
            </Button>
          )}
        </div>
      </div>

      {/* Customer Selector Modal */}
      <CustomerSelectorModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        selectedCustomerId={selectedCustomer.id}
        onSelectCustomer={(c) => setSelectedCustomer(c)}
        onAddNewCustomer={(c) => {
          setSelectedCustomer(c);
          setAlertNotice({
            message: `Registered new customer account "${c.name}" (Status: PENDING APPROVAL). Selected for active cart.`,
            type: 'info',
          });
        }}
        currentStaff={currentStaff}
      />

      {/* Payment Split Tender Modal */}
      <PaymentTenderModal
        isOpen={isTenderModalOpen}
        onClose={() => setIsTenderModalOpen(false)}
        grandTotal={grandTotal}
        customer={selectedCustomer}
        currentStaff={currentStaff}
        activeShift={activeShift}
        cartItems={cartItems}
        inventoryItems={inventoryItems}
        terminalId={terminalId}
        onCompleteSale={handleFinalizeSale}
      />

      {/* Held Sale Modal */}
      <HeldSaleModal
        isOpen={isHeldSaleModalOpen}
        onClose={() => setIsHeldSaleModalOpen(false)}
        customer={selectedCustomer}
        currentStaff={currentStaff}
        cartItems={cartItems}
        subtotal={subtotal}
        grandTotal={grandTotal}
        onConfirmHeldSale={handleConfirmHeldSale}
      />

      {/* Park Cart Modal (Held Receipts) */}
      <ParkCartModal
        isOpen={isParkCartModalOpen}
        onClose={() => setIsParkCartModalOpen(false)}
        customer={selectedCustomer}
        cartItems={cartItems}
        grandTotal={grandTotal}
        onConfirmParkCart={handleConfirmParkCart}
      />

      {/* Layaway Modal */}
      <LayawayModal
        isOpen={isLayawayModalOpen}
        onClose={() => setIsLayawayModalOpen(false)}
        customer={selectedCustomer}
        currentStaff={currentStaff}
        cartItems={cartItems}
        grandTotal={grandTotal}
        onConfirmLayaway={handleConfirmLayaway}
      />

      {/* Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        currentDiscountPercent={globalDiscountPercent}
        subtotal={subtotal}
        currentStaff={currentStaff}
        onApplyDiscount={(percent) => {
          setGlobalDiscountPercent(percent);
          // Recompute every existing line against the new percent — same
          // staleness bug as quantity change, triggered by the other input
          // (discount, not quantity) that invalidates a cached per-line
          // calc result.
          setCartItems((prev) =>
            prev.map((line) => {
              const recalced = calculateLineTotal({
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                taxRate: line.taxRate ?? 15,
                discountPercent: percent,
              });
              return {
                ...line,
                discountPercent: percent,
                discountAmount: recalced.discountAmount,
                taxAmount: recalced.taxAmount,
                lineTotal: recalced.lineTotal,
              };
            })
          );
          setAlertNotice({
            message: percent > 0 ? `Applied ${percent.toFixed(1)}% cart discount.` : 'Discount cleared.',
            type: 'info',
          });
        }}
      />

      {/* Thermal ESC/POS Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setCartItems([]);
          setGlobalDiscountPercent(0);
        }}
        sale={completedSaleData}
        currentStaff={currentStaff}
        onCreateDelivery={
          onNavigateToDeliveryDispatch && completedSaleData
            ? () => onNavigateToDeliveryDispatch(completedSaleData.saleNumber)
            : undefined
        }
      />
    </div>
  );
};
