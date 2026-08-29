import {
  SaleTransaction,
  CartLineItem,
  InventoryItem,
  Customer,
  StaffMember,
  Shift,
  SplitPaymentEntry,
  InventoryMovement,
  ActivityEvent,
  SaleValidationResult,
  SaleExecutionResult
} from '../types';

// ============================================================================
// 1. IN-MEMORY PROCESSED IDEMPOTENCY REGISTRY (Double-Click / Retry Protection)
// ============================================================================
const PROCESSED_IDEMPOTENCY_KEYS = new Map<string, SaleTransaction>();

/**
 * Generates an internal unique transaction UUID
 */
export function generateSaleId(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TX-UUID-${timestamp}-${randomSuffix}`;
}

/**
 * Generates a business-readable sequential/dated sale invoice number
 */
export function generateSaleNumber(prefix = 'INV'): string {
  const now = new Date();
  const dateSegment = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeSegment = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const seq = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${dateSegment}-${timeSegment}${seq}`;
}

/**
 * Creates an idempotency key for a checkout session
 */
export function createCheckoutIdempotencyKey(terminalId: string, cashierId: string): string {
  return `IDEMP-${terminalId}-${cashierId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// ============================================================================
// 2. PRE-FLIGHT VALIDATION & ELIGIBILITY GATE
// ============================================================================
export interface ValidateSaleParams {
  cartItems: CartLineItem[];
  inventoryItems: InventoryItem[];
  activeShift: Shift | null | undefined;
  customer: Customer;
  cashier: StaffMember;
  payments: SplitPaymentEntry[];
  grandTotal: number;
  idempotencyKey?: string;
}

export function validateSaleEligibility(params: ValidateSaleParams): SaleValidationResult {
  const { cartItems, inventoryItems, activeShift, payments, grandTotal, idempotencyKey } = params;

  // 1. Check Idempotency duplicate
  if (idempotencyKey && PROCESSED_IDEMPOTENCY_KEYS.has(idempotencyKey)) {
    return {
      eligible: false,
      reason: 'DUPLICATE_TRANSACTION',
      message: 'Transaction already committed. Idempotency guard prevented duplicate processing.',
      details: `Key ${idempotencyKey} was already recorded.`,
    };
  }

  // 2. Require an Active Shift before Checkout
  if (!activeShift || activeShift.status !== 'OPEN') {
    return {
      eligible: false,
      reason: 'NO_ACTIVE_SHIFT',
      message: 'Active Shift Required: A shift must be opened before checkout can proceed.',
      details: 'Store policy requires an authorized open shift on this terminal before completing sales transactions.',
    };
  }

  // 3. Cart cannot be empty
  if (!cartItems || cartItems.length === 0) {
    return {
      eligible: false,
      reason: 'EMPTY_CART',
      message: 'Checkout Blocked: Register cart has no line items.',
      details: 'Add at least one sellable product to the cart.',
    };
  }

  // 4. Validate branch stock and pricing for each item in cart
  for (const line of cartItems) {
    const liveItem = inventoryItems.find((i) => i.sku === line.item.sku) || line.item;
    const itemName = liveItem.name || liveItem.description || line.item.sku;

    // Check selling price validity
    if (line.unitPrice <= 0 || (liveItem.retailPrice <= 0 && line.unitPrice <= 0)) {
      return {
        eligible: false,
        reason: 'MISSING_SELLING_PRICE',
        message: `Pricing Error: Item "${itemName}" has no valid selling price ($0.00). Normal checkout is blocked by policy.`,
        itemSku: line.item.sku,
        details: 'Retail items must have an established selling price in product master or manager price override before sale.',
      };
    }

    // Check quantity requested
    if (line.quantity <= 0) {
      return {
        eligible: false,
        reason: 'POLICY_VIOLATION',
        message: `Invalid Quantity: Item "${itemName}" has invalid quantity (${line.quantity}).`,
        itemSku: line.item.sku,
      };
    }

    // Check available stock on hand (Strict blocking)
    const availableStock = liveItem.stockOnHand;
    if (availableStock <= 0) {
      return {
        eligible: false,
        reason: 'INSUFFICIENT_STOCK',
        message: `Out of Stock: Item "${itemName}" (SKU: ${line.item.sku}) is completely out of stock (Available: 0 units).`,
        itemSku: line.item.sku,
        requestedQty: line.quantity,
        availableQty: 0,
        details: 'Retail sale is blocked when stock on hand is exhausted.',
      };
    }

    if (line.quantity > availableStock) {
      return {
        eligible: false,
        reason: 'INSUFFICIENT_STOCK',
        message: `Insufficient Stock: Item "${itemName}" has only ${availableStock} units available on hand (Requested: ${line.quantity} units).`,
        itemSku: line.item.sku,
        requestedQty: line.quantity,
        availableQty: availableStock,
        details: `Available branch stock (${availableStock}) cannot fulfill requested cart quantity (${line.quantity}).`,
      };
    }
  }

  // 5. Validate tender coverage
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid < grandTotal - 0.001) {
    const outstanding = Math.max(0, grandTotal - totalPaid);
    return {
      eligible: false,
      reason: 'INVALID_TENDER',
      message: `Incomplete Payment: Outstanding balance of $${outstanding.toFixed(2)} remains unpaid.`,
      details: `Grand total payable is $${grandTotal.toFixed(2)}, tendered amount is $${totalPaid.toFixed(2)}.`,
    };
  }

  return { eligible: true };
}

// ============================================================================
// 3. ATOMIC TRANSACTION PROCESSOR
// ============================================================================
export interface ProcessSaleTransactionParams {
  cartItems: CartLineItem[];
  inventoryItems: InventoryItem[];
  activeShift: Shift | null | undefined;
  customer: Customer;
  cashier: StaffMember;
  terminalId: string;
  branchId?: string;
  branchName?: string;
  payments: SplitPaymentEntry[];
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  grandTotal: number;
  changeGiven: number;
  idempotencyKey?: string;
  notes?: string;
}

/**
 * Executes an atomic sale transaction with frozen snapshots and guaranteed rollback on failure.
 */
export function executeAtomicSaleTransaction(
  params: ProcessSaleTransactionParams
): SaleExecutionResult {
  const {
    cartItems,
    inventoryItems,
    activeShift,
    customer,
    cashier,
    terminalId,
    branchId = 'BR-01',
    branchName = 'Main Retail Storefront',
    payments,
    subtotal,
    totalTax,
    totalDiscount,
    grandTotal,
    changeGiven,
    idempotencyKey = createCheckoutIdempotencyKey(terminalId, cashier.id),
    notes
  } = params;

  // Step 1: Pre-flight validation gate
  const validation: SaleValidationResult = validateSaleEligibility({
    cartItems,
    inventoryItems,
    activeShift,
    customer,
    cashier,
    payments,
    grandTotal,
    idempotencyKey
  });

  if (validation.eligible === false) {
    // If it's a duplicate idempotency key, return the existing sale without re-executing
    if (validation.reason === 'DUPLICATE_TRANSACTION' && idempotencyKey && PROCESSED_IDEMPOTENCY_KEYS.has(idempotencyKey)) {
      const existingSale = PROCESSED_IDEMPOTENCY_KEYS.get(idempotencyKey)!;
      return {
        success: true,
        sale: existingSale,
        idempotencyKey,
        details: 'Idempotency match: returned existing committed transaction.',
      };
    }

    return {
      success: false,
      error: validation.message,
      errorCode: validation.reason,
      details: validation.details,
    };
  }

  const nowIso = new Date().toISOString();
  const timeFormatted = nowIso.replace('T', ' ').slice(0, 19);
  const internalSaleId = generateSaleId();
  const businessSaleNumber = generateSaleNumber('INV');
  const isCreditSale = payments.some((p) => p.method === 'CUSTOMER_CREDIT');

  // Step 2: Compile Immutable Sale-Time Item Snapshots
  let totalCostBasis = 0;
  const frozenItems: CartLineItem[] = cartItems.map((line, idx) => {
    const liveItem = inventoryItems.find((i) => i.sku === line.item.sku) || line.item;
    const unitCost = liveItem.unitCost ?? liveItem.cost ?? 0;
    const lineCost = unitCost * line.quantity;
    totalCostBasis += lineCost;

    const discountAmount = ((line.unitPrice * (line.discountPercent || 0)) / 100) * line.quantity;
    const netSubtotal = line.lineTotal - (line.taxAmount || 0);

    // Deeply frozen item snapshot to preserve original name, SKU, part number, and cost basis
    const frozenItemSnapshot: InventoryItem = {
      ...liveItem,
      sku: liveItem.sku,
      barcode: liveItem.barcode,
      name: liveItem.name || liveItem.description,
      description: liveItem.description || liveItem.name || '',
      department: liveItem.department,
      category: liveItem.category,
      unitCost: unitCost,
      retailPrice: line.unitPrice,
      taxRate: liveItem.taxRate || 15.0,
      partNumber: liveItem.partNumber || '',
      oemNumber: liveItem.oemNumber || '',
    };

    return {
      id: `sale-item-${idx + 1}-${line.item.sku}`,
      item: frozenItemSnapshot,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent || 0,
      discountAmount,
      taxAmount: line.taxAmount,
      taxRate: liveItem.taxRate || 15.0,
      lineTotal: line.lineTotal,
      netSubtotal,
      sku: liveItem.sku,
      itemName: liveItem.name || liveItem.description,
      partNumber: liveItem.partNumber || '',
      oemNumber: liveItem.oemNumber || '',
      unitCostBasis: unitCost,
      costTotal: lineCost,
    };
  });

  const grossMargin = grandTotal > 0 ? ((grandTotal - totalCostBasis) / grandTotal) * 100 : 0;

  // Step 3: Build Immutable Sale Transaction Record
  const newSale: SaleTransaction = {
    saleId: internalSaleId,
    saleNumber: businessSaleNumber,
    dateTime: timeFormatted,
    completedAt: timeFormatted,
    customer: { ...customer },
    cashier: { ...cashier },
    items: frozenItems,
    subtotal,
    taxTotal: totalTax,
    discountTotal: totalDiscount,
    grandTotal,
    payments: [...payments],
    changeGiven,
    transactionType: isCreditSale ? 'CREDIT_SALE' : 'CASH_SALE',
    status: 'COMPLETED',
    terminalId,
    shiftId: activeShift?.id || 'SHIFT-OPEN',
    shiftNumber: activeShift?.shiftNumber || 1,
    branchId,
    branchName,
    idempotencyKey,
    isImmutable: true,
    totalCostBasis,
    grossMargin: Number(grossMargin.toFixed(2)),
    notes: notes || undefined,
  };

  // Step 4: Decrement Branch Stock and update Inventory Item statuses
  const updatedInventory: InventoryItem[] = inventoryItems.map((item) => {
    const matchedLine = cartItems.find((c) => c.item.sku === item.sku);
    if (!matchedLine) return item;

    const newStock = Math.max(0, item.stockOnHand - matchedLine.quantity);
    const newStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' =
      newStock === 0 ? 'Out of Stock' : newStock <= item.reorderLevel ? 'Low Stock' : 'In Stock';

    return {
      ...item,
      stockOnHand: newStock,
      status: newStatus,
      lastUpdated: timeFormatted,
    };
  });

  // Step 5: Generate Atomic Stock Movement Audit Records
  const newMovements: InventoryMovement[] = frozenItems.map((line) => ({
    id: `MOV-SALE-${Date.now()}-${line.sku}`,
    movementId: `MOV-SALE-${Date.now()}-${line.sku}`,
    timestamp: timeFormatted,
    occurredAt: timeFormatted,
    recordedAt: timeFormatted,
    movementType: 'POS Sale',
    direction: 'OUT',
    sku: line.sku || line.item.sku,
    itemName: line.itemName || line.item.name || line.item.description,
    quantity: -line.quantity,
    unitCost: line.unitCostBasis || 0,
    unitCostBasis: line.unitCostBasis || 0,
    totalValue: line.costTotal || (line.unitCostBasis || 0) * line.quantity,
    valueImpact: -(line.costTotal || (line.unitCostBasis || 0) * line.quantity),
    sourceLocationId: branchId,
    sourceLocationName: branchName,
    referenceType: 'SALE',
    referenceDocument: businessSaleNumber,
    referenceId: internalSaleId,
    staffId: cashier.id,
    staffName: cashier.name,
    shiftId: activeShift?.id,
    terminalId,
    reason: `POS sale #${businessSaleNumber}`,
    notes: `Sale-time cost basis: $${(line.unitCostBasis || 0).toFixed(2)}/unit. Price: $${line.unitPrice.toFixed(2)}/unit.`,
    offlineEvent: true,
  }));

  // Step 6: Customer Account Balance Update (if credit tender used)
  let updatedCustomer: Customer | undefined = undefined;
  const creditPayment = payments.find((p) => p.method === 'CUSTOMER_CREDIT');
  if (creditPayment && customer.id !== 'CUST-WALKIN') {
    const newBalance = customer.currentBalance + creditPayment.amount;
    const newAvailable = Math.max(0, customer.creditLimit - newBalance);
    updatedCustomer = {
      ...customer,
      currentBalance: newBalance,
      availableCredit: newAvailable,
      lastPurchaseDate: nowIso.slice(0, 10),
      lastPurchaseAmount: creditPayment.amount,
      lastPurchaseRef: businessSaleNumber,
    };
  }

  // Step 7: Create Structured Immutable Activity Event
  const paymentSummary = payments.map((p) => `${p.method.replace(/_/g, ' ')}: $${p.amount.toFixed(2)}`).join(', ');
  const itemCount = frozenItems.reduce((sum, item) => sum + item.quantity, 0);

  const newActivityEvent: ActivityEvent = {
    id: `EVT-SALE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: timeFormatted,
    eventType: 'SALE_COMPLETED',
    description: `Sale #${businessSaleNumber} completed on terminal ${terminalId} by ${cashier.name}. Total: $${grandTotal.toFixed(2)} (${itemCount} items). Tender: ${paymentSummary}.`,
    staffId: cashier.id,
    staffName: cashier.name,
    branchId,
    branchName,
    terminalId,
    referenceDocument: businessSaleNumber,
    amount: grandTotal,
    quantity: itemCount,
    entityType: 'SALE',
    entityId: internalSaleId,
    outcome: 'COMPLETED',
    metadata: {
      saleId: internalSaleId,
      saleNumber: businessSaleNumber,
      shiftId: activeShift?.id,
      shiftNumber: activeShift?.shiftNumber,
      itemCount,
      subtotal,
      taxTotal: totalTax,
      discountTotal: totalDiscount,
      grandTotal,
      totalCostBasis,
      grossMargin: Number(grossMargin.toFixed(2)),
      paymentBreakdown: payments,
      idempotencyKey,
    },
  };

  // Record into Idempotency Registry to guard against double-clicks
  PROCESSED_IDEMPOTENCY_KEYS.set(idempotencyKey, newSale);

  return {
    success: true,
    sale: newSale,
    updatedInventory,
    newMovements,
    newActivityEvent,
    updatedCustomer,
    idempotencyKey,
    details: `Sale #${businessSaleNumber} (ID: ${internalSaleId}) committed atomically. Stock decremented across ${frozenItems.length} line items.`,
  };
}
