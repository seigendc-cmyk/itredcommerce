export type StaffRole = 'SYS_ADMIN' | 'STORE_MANAGER' | 'SENIOR_CASHIER' | 'CASHIER' | 'INVENTORY_OFFICER' | 'ACCOUNTANT';

// Auth-scope role (DL-005): distinct from StaffRole above, which is a
// free-form job role/title. This is the controlled vocabulary that drives
// which of the five app surfaces and which RLS policies a staff member's
// session gets — see ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-002/DL-005.
export type StaffAccessRole = 'TILL_OPERATOR' | 'HEAD_OFFICE_STAFF' | 'EXECUTIVE' | 'RIDER' | 'PLATFORM_SUPER_ADMIN';

export interface StaffMember {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  role: StaffRole;
  roleTitle: string;
  department: string;
  accessRole?: StaffAccessRole;
  homeBranchId?: string;
  accessCode: string; // 4-6 digit pin
  permissions: string[];
  avatarInitials: string;
  lastLogin?: string;
  terminalAccess: string[];
  // Optional recovery contact details, captured for the tenant's first
  // (owner/admin) staff record by the Business Profile onboarding wizard —
  // generically useful on any staff record, not onboarding-only.
  contactPhone?: string;
  contactEmail?: string;
}

export interface Supplier {
  tenantId?: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  taxNumber?: string;
  currentBalance?: number;
  dueAmount?: number;
  overdueAmount?: number;
  lastPurchaseDate?: string;
  lastPurchaseAmount?: number;
  lastPurchaseRef?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  lastPaymentRef?: string;
  bankAccountDetails?: string;
  status?: 'ACTIVE' | 'ON_HOLD' | 'DISPUTED' | 'ARCHIVED';
}

// ACTIVATION and ONBOARDING are new (Business Profile onboarding wizard):
// ACTIVATION is a real, minimal pre-login gate — it resolves whether this
// install's code belongs to a brand-new tenant (-> ONBOARDING, the full
// wizard) or an existing one (-> a lightweight branch/terminal confirm,
// still under the ONBOARDING stage) before STAFF_ACCESS, since the admin
// PIN created by the wizard IS the first staff record — there's no one to
// log in as until onboarding finishes. See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
// Business Profile Onboarding addendum.
export type AppStage = 'SPLASH' | 'WELCOME_UPDATE' | 'ACTIVATION' | 'ONBOARDING' | 'STAFF_ACCESS' | 'MAIN_APP';

export type ActiveView = 
  | 'LANDING'
  | 'SALES_CASH'
  | 'SALES_CREDIT'
  | 'SALES_RETURN'
  | 'SALES_HISTORY'
  | 'DELIVERY_DISPATCH'
  | 'HELD_SALES'
  | 'HELD_RECEIPTS'
  | 'LAYAWAY'
  | 'SHIFT_MANAGEMENT'
  | 'EOD_REPORT'
  | 'APPROVALS'
  | 'DEBTORS'
  | 'DEBTOR_ACCOUNT'
  | 'CREDITORS'
  | 'CREDITOR_ACCOUNT'
  | 'CASH_BANK'
  | 'CASH_MANAGER'
  | 'CASHFLOW_PROJECTOR'
  | 'RESERVES'
  | 'PURCHASING'
  | 'PURCHASE_MEMO'
  | 'PURCHASE_ORDER'
  | 'RECEIVE_STOCK'
  | 'ITEM_LIST'
  | 'PO_LIST'
  | 'SUPPLIERS'
  | 'CUSTOMERS'
  | 'DEPARTMENTS'
  | 'BANK_ACCOUNTS'
  | 'FINANCIAL_ACCOUNTS'
  | 'STAFF_MANAGEMENT'
  | 'ROLES_RIGHTS'
  | 'TERMINALS'
  | 'BRANCHES'
  | 'BRANCH_DETAIL'
  | 'WAREHOUSES'
  | 'WAREHOUSE_DETAIL'
  | 'TAX_FISCAL'
  | 'DEVICES'
  | 'VENDOR_PREFERENCES'
  | 'BACKUP_RESTORE'
  | 'RATE_CONFIG'
  | 'DATA_PROTECTION'
  | 'RESTORE_DATA'
  | 'DATABASE_INTEGRITY'
  | 'STOCKTAKE'
  | 'STOCKTAKE_DETAIL'
  | 'STOCK_ADJUSTMENTS'
  | 'STOCK_TRANSFERS'
  | 'INVENTORY_MOVEMENTS'
  | 'REORDER_REVIEW'
  | 'STOCKTAKE_PRIORITIES'
  | 'COMMERCIAL_DATA_QUALITY'
  | 'INVENTORY_ATTENTION'
  | 'OPERATIONAL_READINESS'
  | 'BI_ACTIVITY'
  | 'REPORTS_CENTER'
  | 'ONLINE_UPGRADE'
  | 'LICENSING'
  | 'BUSINESS_PROFILE'
  | 'BI_CONFIG'
  | 'UPDATES'
  | 'SOFTWARE_UPDATES'
  | 'PAYMENT_METHODS'
  | 'FISCALIZATION'
  | 'EXCEPTION_LEDGER'
  | 'ACTIVITY_EVENTS'
  | 'METRIC_DICTIONARY'
  | 'GENERIC_LIST';

export type POStatus = 'All' | 'Open' | 'Part Received' | 'Completed' | 'Rejected' | 'Cancelled';

export type CustomFieldType = 'text' | 'number' | 'decimal' | 'date' | 'boolean' | 'select' | 'multi-select';

export interface CustomFieldDefinition {
  tenantId?: string;
  id: string;
  label: string;
  industry: string;
  type: CustomFieldType;
  options?: string[];
  isSearchable: boolean;
  isFilterable: boolean;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface PurchaseOrder {
  tenantId?: string;
  poNumber: string;
  supplierName: string;
  supplierCode: string;
  dateCreated: string;
  deliveryDueDate: string;
  destinationWarehouseId?: string;
  destinationWarehouseName?: string;
  totalItems: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  currency: string;
  status: 'Open' | 'Part Received' | 'Completed' | 'Rejected' | 'Cancelled';
  paymentTerms: string;
  authorizedBy: string;
  notes?: string;
  originMemoNumber?: string;
  items: Array<{
    sku: string;
    description: string;
    orderedQty: number;
    receivedQty: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export type PurchaseMemoStatus = 'Draft' | 'Submitted' | 'Approved' | 'Converted to PO' | 'CONVERTED' | 'Rejected' | 'Cancelled';

export interface PurchaseMemoItem {
  sku: string;
  description: string;
  requestedQty: number;
  estimatedUnitCost?: number;
  notes?: string;
}

export interface PurchaseMemo {
  tenantId?: string;
  id: string;
  memoNumber: string;
  supplierName?: string;
  supplierCode?: string;
  requestDate: string;
  requiredDate?: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  department: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: PurchaseMemoStatus;
  items: PurchaseMemoItem[];
  notes?: string;
  convertedPoNumber?: string;
  approvedByStaffName?: string;
  approvalDate?: string;
}

// --------------------------------------------------------
// MULTI-TENANCY (DL-001) — Tenant → Branch → Terminal
// --------------------------------------------------------
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface Tenant {
  id: string;
  legalName: string;
  displayName: string;
  country: string; // ISO 3166-1 alpha-2; selects the FiscalizationProvider (DL-003)
  baseCurrency: string; // ISO 4217
  fiscalizationProvider?: string; // e.g. 'KRA_ETIMS'; unset until assigned (Prompt 11)
  status: TenantStatus;
  timezone: string;
}

export type LocationType = 'WAREHOUSE' | 'BRANCH';

export interface Warehouse {
  id: string;
  tenantId?: string;
  branchId?: string;
  code: string;
  name: string;
  address: string;
  managerName: string;
  contactPhone: string;
  email: string;
  totalCapacitySqM: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  isDefault: boolean;
  notes?: string;
}

export type TerminalStatus = 'ONLINE' | 'OFFLINE' | 'LOCKED' | 'IN_USE' | 'ACTIVE';

export interface Terminal {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  branchId: string;
  branchName: string;
  workstationType: 'COUNTER_POS' | 'EXPRESS_CHECKOUT' | 'BACKOFFICE_REGISTER';
  // Which of the two Tauri deployables this install runs (DL-002).
  appSurface?: 'BRANCH_TERMINAL' | 'HEAD_OFFICE';
  activationCode?: string;
  activatedAt?: string;
  activeCashierName?: string;
  currentCashierStaffId?: string;
  currentCashierStaffName?: string;
  cashDrawerPort: string;
  receiptPrinter: string;
  status: TerminalStatus;
  isDefault: boolean;
  lastActive: string;
  ipAddress?: string;
  dailySalesTotal?: number;
  dailyTransactionsCount?: number;
}

export interface Branch {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  address: string;
  city?: string;
  managerName: string;
  contactPhone: string;
  email: string;
  operatingHours?: string;
  status: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'INACTIVE';
  isDefault: boolean;
  defaultWarehouseId?: string;
  defaultWarehouseName?: string;
  terminals?: Terminal[];
  staffIds?: string[];
  notes?: string;
  // Geocoded pickup coordinates. Introduced client-side-only in Prompt 7
  // (delivery subsystem) since branches had no CRUD API/table rows at all
  // then; the Business Profile onboarding wizard is what first persists a
  // real branch row (including these columns) to both Supabase and local
  // SQLite — see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business Profile
  // Onboarding addendum, which closes the branch-persistence gap the
  // "Second Tauri flag" note had carried since Prompt 3.
  latitude?: number;
  longitude?: number;
}

export interface LocationStock {
  locationId: string;
  locationType: LocationType;
  locationName: string;
  sku: string;
  quantity: number;
  binLocation: string;
  reorderLevel: number;
  lastCountDate?: string;
}

export type StockTransferStatus = 'Draft' | 'Requested' | 'Approved' | 'Dispatched' | 'In Transit' | 'Received' | 'Rejected' | 'Cancelled';

export type StockTransferFlowType = 'WAREHOUSE_TO_BRANCH' | 'BRANCH_TO_WAREHOUSE' | 'BRANCH_TO_BRANCH';

export type TransferDiscrepancyReasonCode =
  | 'SHORT_DELIVERY'
  | 'DAMAGED_IN_TRANSIT'
  | 'COUNT_DIFFERENCE'
  | 'WRONG_ITEM'
  | 'OTHER';

export interface StockTransferItem {
  sku: string;
  description: string;
  requestedQty: number;
  dispatchedQty: number;
  receivedQty: number;
  varianceQty?: number;
  discrepancyReason?: TransferDiscrepancyReasonCode;
  discrepancyNotes?: string;
  unitCost: number;
  // Prompt 18 / DL-078: stock_on_hand at the moment this line was
  // dispatched, and how much the dispatch exceeded it (if at all) — dispatch
  // is never blocked on insufficient stock, only flagged for reconciliation.
  stockOnHandAtDispatch?: number;
  dispatchShortfallQty?: number;
}

export interface StockTransfer {
  tenantId?: string;
  id: string;
  transferNumber: string;
  flowType?: StockTransferFlowType;
  sourceLocationId?: string;
  sourceLocationType?: LocationType;
  sourceLocationName?: string;
  originLocationId?: string;
  originLocationType?: LocationType;
  originLocationName?: string;
  destinationLocationId: string;
  destinationLocationType?: LocationType;
  destinationLocationName: string;
  requestDate?: string;
  items: StockTransferItem[];
  status: StockTransferStatus;
  requestedByStaffName: string;
  requestedDate?: string;
  approvedByStaffName?: string;
  approvedDate?: string;
  dispatchedByStaffName?: string;
  dispatchedDate?: string;
  carrierOrVehicle?: string;
  carrierVehicle?: string;
  dispatchNotes?: string;
  receivedByStaffName?: string;
  receivedDate?: string;
  receivingNotes?: string;
  rejectionReason?: string;
  notes?: string;
  totalItemsCount?: number;
  totalValuation?: number;
  hasDiscrepancy?: boolean;
  discrepancyReason?: TransferDiscrepancyReasonCode;
  discrepancyNotes?: string;
  // Prompt 18 / DL-078: true if any line's dispatched_qty exceeded
  // stock_on_hand at dispatch time — see each item's dispatchShortfallQty
  // for the per-line detail.
  hasDispatchStockWarning?: boolean;
}

export type MovementType = 
  | 'Supplier Receipt' | 'SUPPLIER_RECEIPT'
  | 'Warehouse Transfer Out' | 'TRANSFER_OUT'
  | 'Branch Transfer In' | 'TRANSFER_IN'
  | 'Sale' | 'POS Sale' | 'SALE_OUT'
  | 'Sale Return' | 'SALE_RETURN_IN'
  | 'Supplier Return' | 'SUPPLIER_RETURN_OUT'
  | 'Stocktake Adjustment' | 'STOCKTAKE_ADJUSTMENT_IN' | 'STOCKTAKE_ADJUSTMENT_OUT'
  | 'Damage' | 'DAMAGE_OUT'
  | 'Write-off' | 'WRITE_OFF_OUT'
  | 'Approved Manual Adjustment' | 'MANUAL_ADJUSTMENT_IN' | 'MANUAL_ADJUSTMENT_OUT'
  | 'Transfer Out'
  | 'Transfer In'
  | 'Reservation' | 'RESERVATION'
  | 'Reservation Release' | 'RESERVATION_RELEASE'
  | 'Return'
  | 'Adjustment';

export type InventoryMovementType = MovementType;

export type StocktakeVarianceReasonCode =
  | 'COUNT_ERROR'
  | 'STOCK_SHORTAGE'
  | 'STOCK_OVERAGE'
  | 'DAMAGE_NOT_RECORDED'
  | 'BREAKAGE'
  | 'UNEXPLAINED_SHORTAGE'
  | 'SUPPLIER_VARIANCE'
  | 'TRANSFER_VARIANCE'
  | 'RETURN_NOT_RECORDED'
  | 'WRONG_LOCATION'
  | 'DATA_CORRECTION'
  | 'OTHER';

export type ManualAdjustmentReasonCode =
  | 'DAMAGE'
  | 'BREAKAGE'
  | 'EXPIRED'
  | 'DATA_CORRECTION'
  | 'FOUND_STOCK'
  | 'WRITE_OFF'
  | 'OTHER';

export interface InventoryMovement {
  id: string; // movementId
  movementId?: string;
  tenantId?: string;
  timestamp: string; // occurredAt
  occurredAt?: string;
  recordedAt?: string;
  movementType: MovementType;
  sku: string;
  itemId?: string;
  itemName: string;
  quantity: number; // positive for additions, negative for reductions
  direction?: 'IN' | 'OUT' | 'ADJUSTMENT';
  unitCost: number;
  unitCostBasis?: number;
  totalValue: number;
  valueImpact?: number;
  sourceLocationId?: string;
  sourceLocationName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
  referenceType?: string; // e.g. PO, TRF, SALE, STOCKTAKE, MANUAL_ADJUSTMENT
  referenceDocument: string; // referenceId (e.g. PO-2026-0801, TRF-2026-001, INV-20260815-001)
  referenceId?: string;
  staffId?: string;
  staffName: string;
  shiftId?: string;
  terminalId?: string;
  reasonCode?: string;
  reason?: string;
  approvalRef?: string;
  approvalStatus?: string;
  notes?: string;
  offlineEvent?: boolean;
}

export type StockMovement = InventoryMovement;

export interface GoodsReceiptNoteItem {
  sku: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string;
  expiryDate?: string;
  condition: 'GOOD' | 'DAMAGED' | 'DISCREPANCY';
}

export interface GoodsReceiptNote {
  tenantId?: string;
  id: string;
  grnNumber: string;
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  receivedDate: string;
  receivedByStaffName: string;
  deliveryNoteNumber: string;
  items: GoodsReceiptNoteItem[];
  totalUnitsReceived: number;
  totalValuation: number;
  status: 'ACCEPTED' | 'ACCEPTED_WITH_DISCREPANCY' | 'REJECTED';
  notes?: string;
}

export interface StocktakeRecord {
  tenantId?: string;
  id: string;
  batchNo: string;
  locationId: string;
  locationType: LocationType;
  locationName: string;
  date: string;
  auditorStaffName: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  itemsCount: number;
  countedQty: number;
  bookQty: number;
  varianceUnits: number;
  valuationDelta: number;
  notes?: string;
}

export interface StockAdjustmentRecord {
  tenantId?: string;
  id: string;
  adjustmentNumber: string;
  locationId: string;
  locationType: LocationType;
  locationName: string;
  sku: string;
  itemName: string;
  adjustmentType: 'WRITE_OFF_DAMAGE' | 'WRITE_OFF_SHRINKAGE' | 'MANUAL_WRITE_ON' | 'CORRECTION';
  quantityDelta: number;
  unitCost: number;
  totalDeltaValue: number;
  staffName: string;
  date: string;
  reason: string;
}

export interface ConnectedShopConfig {
  tenantId?: string;
  id: string;
  locationId: string;
  locationType: LocationType;
  name: string;
  city: string;
  isConnectedOnline: boolean;
  syncStatus: 'ONLINE' | 'OFFLINE' | 'CONNECTING';
  lastPing: string;
  allowPeerStockViewing: boolean;
  ipOrDomain: string;
}

export interface InventoryItem {
  tenantId?: string;
  sku: string;
  barcode: string;
  name?: string;
  description: string;
  department: string;
  category: string;
  unitOfMeasure?: string;
  stockOnHand: number;
  reorderLevel: number;
  unitCost: number; // Cost price (0 means unpriced/missing)
  retailPrice: number; // Selling price (0 means unpriced/missing)
  cost?: number; // helper alias
  price?: number; // helper alias
  preferredSupplier?: string;
  isActive: boolean;
  imageUrl?: string | null;
  imageStatus?: 'ready' | 'optimizing' | 'none';
  taxRate: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  location: string;
  partNumber?: string;
  oemNumber?: string;
  customFields?: Record<string, any>;
  lastUpdated?: string;
}

export interface CartLineItem {
  id: string;
  item: InventoryItem;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxAmount: number;
  lineTotal: number;
  frozenSnapshot?: InventoryItem;
  // Sale-time snapshot attributes
  sku?: string;
  itemName?: string;
  partNumber?: string;
  oemNumber?: string;
  unitCostBasis?: number;
  discountAmount?: number;
  taxRate?: number;
  netSubtotal?: number;
  costTotal?: number;
}

export type CustomerStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'REJECTED';

export type CreditStatus = 'ACTIVE' | 'SUSPENDED' | 'UNDER_REVIEW' | 'BLOCKED' | 'EXCEPTIONAL_OVERRIDE';

export type DebtorAccountStatus = 'GOOD_STANDING' | 'OVERDUE' | 'ON_HOLD' | 'IN_ARREARS' | 'ARCHIVED';

export interface Customer {
  tenantId?: string;
  id: string;
  accountNumber: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  taxExempt?: boolean;
  taxExemptionCertNumber?: string;
  status: CustomerStatus;
  creditStatus?: CreditStatus;
  debtorStatus?: DebtorAccountStatus;
  isCreditApproved: boolean;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  paymentTerms?: string; // e.g. 'Net 30 Days', 'Net 15 Days', 'Net 7 Days', 'Due upon Receipt', 'COD'
  paymentTermsDays?: number;
  lastPurchaseDate?: string;
  lastPurchaseAmount?: number;
  lastPurchaseRef?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  lastPaymentRef?: string;
  overdueAmount?: number;
  createdDate: string;
  createdByStaffId?: string;
  approvedByManagerId?: string;
  creditApprovedDate?: string;
  exceptionalCreditOverrideNotes?: string;
  notes?: string;
}

export type PaymentMethodType = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'DEBIT_CARD' | 'CUSTOMER_CREDIT' | 'OTHER';

export interface SplitPaymentEntry {
  method: PaymentMethodType;
  amount: number;
  reference?: string;
}

export type TransactionType = 'CASH_SALE' | 'CREDIT_SALE' | 'HELD_SALE' | 'LAYAWAY' | 'CREDIT_NOTE';

export interface SaleTransaction {
  tenantId?: string;
  saleId?: string;
  saleNumber: string;
  dateTime: string;
  completedAt?: string;
  customer: Customer;
  cashier: StaffMember;
  items: CartLineItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  payments: SplitPaymentEntry[];
  changeGiven: number;
  transactionType: TransactionType;
  status: 'COMPLETED' | 'HELD' | 'REFUNDED' | 'VOIDED';
  terminalId: string;
  shiftId?: string;
  shiftNumber?: number | string;
  branchId?: string;
  branchName?: string;
  idempotencyKey?: string;
  isImmutable?: boolean;
  totalCostBasis?: number;
  grossMargin?: number;
  notes?: string;
}

export interface SaleValidationFailure {
  eligible: false;
  reason: 'NO_ACTIVE_SHIFT' | 'INSUFFICIENT_STOCK' | 'INVALID_TENDER' | 'MISSING_SELLING_PRICE' | 'DUPLICATE_TRANSACTION' | 'EMPTY_CART' | 'POLICY_VIOLATION';
  message: string;
  details?: string;
  itemSku?: string;
  requestedQty?: number;
  availableQty?: number;
}

export interface SaleValidationSuccess {
  eligible: true;
}

export type SaleValidationResult = SaleValidationSuccess | SaleValidationFailure;

export interface SaleExecutionResult {
  success: boolean;
  sale?: SaleTransaction;
  updatedInventory?: InventoryItem[];
  newMovements?: InventoryMovement[];
  newActivityEvent?: ActivityEvent;
  updatedCustomer?: Customer;
  idempotencyKey?: string;
  error?: string;
  errorCode?: string;
  details?: string;
}

export interface HeldSale {
  tenantId?: string;
  id: string;
  saleNumber: string;
  customer: Customer;
  cashier: StaffMember;
  items: CartLineItem[];
  subtotal: number;
  grandTotal: number;
  dateTime: string;
  expectedSettlementTime: string;
  status: 'OUTSTANDING' | 'SETTLED' | 'CONVERTED_CREDIT' | 'CANCELLED';
  notes?: string;
  settledDateTime?: string;
  convertedByStaff?: string;
}

export interface HeldReceipt {
  tenantId?: string;
  id: string;
  cashier: StaffMember;
  customer: Customer;
  items: CartLineItem[];
  parkedAt: string;
  note?: string;
  totalAmount: number;
}

export interface LayawayPaymentRecord {
  date: string;
  amount: number;
  method: PaymentMethodType;
  cashierName: string;
  receiptNo: string;
}

export interface LayawayOrder {
  tenantId?: string;
  id: string;
  customer: Customer;
  cashier: StaffMember;
  reservedItems: CartLineItem[];
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  paymentHistory: LayawayPaymentRecord[];
  nextExpectedPaymentDate: string;
  depositPercent: number;
  createdDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FORFEITED';
  convertedSaleNumber?: string;
}

export interface CreditNoteReturnItem {
  item: InventoryItem;
  returnQty: number;
  unitPrice: number;
  reason: string;
  restock: boolean;
}

export interface CreditNote {
  tenantId?: string;
  id: string;
  originalSaleNumber?: string;
  customer: Customer;
  cashier: StaffMember;
  dateTime: string;
  returnedItems: CreditNoteReturnItem[];
  totalRefundAmount: number;
  refundMethod: 'CASH' | 'CUSTOMER_CREDIT' | 'ORIGINAL_METHOD';
  reasonCategory: 'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_RETURN' | 'PRICE_ADJUSTMENT';
  status: 'ISSUED' | 'APPLIED' | 'CANCELLED';
  // DL-068 (Prompt 14): the terminal/branch/shift that actually issued this
  // refund — what shiftReconciliation.ts now attributes it to, replacing
  // the removed synthetic reconstruction that used to hardcode 'POS-D01'.
  terminalId?: string;
  branchId?: string;
  shiftId?: string;
}

// --------------------------------------------------------------------
// DELIVERY SUBSYSTEM (Prompt 7 — dispatch-side data model & creation flow
// only; fare formula is Prompt 8, rider board is Prompt 9). See
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's delivery subsystem addendum.
// --------------------------------------------------------------------

// Business decisions confirmed for this prompt (not invented unilaterally,
// per the governance doc's "do not implement without sign-off" rule):
// local/intercity boundary is 10km; confirmation codes are 6-character
// alphanumeric; load-size tiers are Small/Medium/Large; ride types are
// Bicycle/Motorbike/Car/Van.
export type DeliveryOrderStatus =
  | 'posted'
  | 'accepted'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'under_investigation'
  | 'cancelled';

export type DeliveryRouteClass = 'local' | 'intercity';
export type DeliveryLoadSizeTier = 'small' | 'medium' | 'large';
export type DeliveryRideType = 'bicycle' | 'motorbike' | 'car' | 'van';
export type RiderStatus = 'ACTIVE' | 'OFF_DUTY' | 'SUSPENDED';

export interface DeliveryOrder {
  id: string;
  tenantId?: string;
  saleId: string;
  saleNumber: string;
  pickupBranchId: string;
  pickupBranchName?: string;
  deliveryAddressLine: string;
  deliveryCity?: string;
  deliveryLandmark?: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  loadSizeTier: DeliveryLoadSizeTier;
  rideTypeRequirement: DeliveryRideType;
  distanceKm: number;
  routeClass: DeliveryRouteClass;
  // Computed by the fare engine (Prompt 8) at creation time from the then-
  // active rate_config version, which fareRateConfigVersion locks in — a
  // later rate change never retroactively alters an existing dispatch.
  // Stays null only if no rate_config has been published yet.
  fareAmount: number | null;
  fareCurrency: string | null;
  fareRateConfigVersion: number | null;
  status: DeliveryOrderStatus;
  confirmationCode: string;
  confirmationCodeExpiresAt: string;
  confirmationCodeAttemptCount: number;
  riderId?: string | null;
  createdByStaffId?: string;
  createdByStaffName?: string;
  createdAt: string;
  updatedAt?: string;
}

// Riders are the business's own employed/contracted riders, not a
// third-party marketplace — tenant-scoped, one rider per underlying staff
// record with the RIDER access role.
export interface Rider {
  id: string;
  tenantId?: string;
  staffId: string;
  name?: string;
  vehicleType: DeliveryRideType;
  phone?: string;
  status: RiderStatus;
  homeBranchId?: string;
  // Self-managed via the Rider PWA (Prompt 9) — a single live value, not a
  // tracked history.
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  locationUpdatedAt?: string | null;
  isAvailable?: boolean;
}

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  requiredPermission?: string;
  viewTarget: ActiveView;
  category: 'File' | 'Cart' | 'Lists' | 'Inventory' | 'Employees' | 'Financial' | 'Reports' | 'System';
  description?: string;
}

export interface MenuGroup {
  name: 'File' | 'Cart' | 'Lists' | 'Inventory' | 'Employees' | 'Financial' | 'Reports' | 'System';
  label: string;
  items: MenuItem[];
}

// --------------------------------------------------------
// SHIFT & REGISTER CONTROLS
// --------------------------------------------------------
export type ShiftStatus = 'OPEN' | 'CLOSED' | 'REQUIRES_CLOSURE' | 'PENDING_APPROVAL';

export type CashUpMode = 'STANDARD' | 'BLIND';

export type ShiftClosePolicy = 
  | 'ALLOW_WITH_OPEN_EXCEPTIONS' 
  | 'REQUIRE_MANAGER_APPROVAL_ON_VARIANCE' 
  | 'BLOCK_ON_SEVERE_VARIANCE';

export type ShiftTenderType = 
  | 'CASH' 
  | 'MOBILE_MONEY' 
  | 'BANK_TRANSFER' 
  | 'DEBIT_CARD' 
  | 'CREDIT_CARD' 
  | 'CUSTOMER_CREDIT' 
  | 'OTHER';

export interface TenderReconciliationEntry {
  tenderType: ShiftTenderType;
  tenderName: string;
  expectedAmount: number;
  countedOrConfirmedAmount: number;
  variance: number;
  reasonCode?: string;
  notes?: string;
  isCash: boolean;
}

export interface CashMovementBreakdown {
  openingFloat: number;
  cashSales: number;
  cashReceipts: number;
  approvedCashIn: number;
  cashRefunds: number;
  approvedCashOut: number;
  tillTransfersOut: number;
  bankingDepositsOut: number;
  expectedCash: number;
}

export interface ImmutableShiftReconciliationSnapshot {
  shiftId: string;
  shiftNumber: string;
  terminalId: string;
  terminalName: string;
  branchId: string;
  branchName: string;
  cashierStaffId: string;
  cashierStaffName: string;
  openedDateTime: string;
  closedDateTime: string;
  cashUpMode: CashUpMode;
  openingFloat: number;
  closingFloat: number;
  expectedCash: number;
  countedCash: number;
  cashVariance: number;
  tenderReconciliation: TenderReconciliationEntry[];
  originalBlindCounts?: Record<string, number>;
  grossSales: number;
  totalSalesCount: number;
  cashMovements: CashMovementBreakdown;
  heldSalesCount: number;
  heldSalesTotalValue: number;
  exceptionIds: string[];
  reviewedByStaffName?: string;
  closureReasonCode?: string;
  closureNotes?: string;
  hasAnyDiscrepancy?: boolean;
  createdAt: string;
}

export interface Shift {
  tenantId?: string;
  id: string;
  shiftNumber: string;
  terminalId: string;
  terminalName: string;
  branchId: string;
  branchName: string;
  cashierStaffId: string;
  cashierStaffName: string;
  openedDateTime: string; // e.g. '2026-08-15 08:00'
  openingDate: string; // '2026-08-15'
  openingFloat: number;
  openingNotes?: string;
  closedDateTime?: string;
  closingFloat?: number;
  status: ShiftStatus;
  
  // Reconciled Metrics
  expectedCash: number;
  countedCash?: number;
  cashVariance?: number;
  cashVarianceTolerance?: number;
  cashUpMode?: CashUpMode;
  closePolicy?: ShiftClosePolicy;
  
  totalSalesCount: number;
  grossSales: number;
  totalCashSales: number;
  totalMobileMoneySales: number;
  totalCardSales: number;
  totalCreditSales: number;
  totalRefunds: number;
  totalPayouts: number;
  totalHeldSales: number;
  totalLayawayReceipts: number;
  
  tenderReconciliation?: TenderReconciliationEntry[];
  originalBlindCounts?: Record<string, number>;
  blindCountSubmitted?: boolean;
  cashMovements?: CashMovementBreakdown;
  reconciliationSnapshot?: ImmutableShiftReconciliationSnapshot;
  exceptionIds?: string[];
  closureReasonCode?: string;
  cashDiscrepancySeverity?: ExceptionSeverity;

  closingNotes?: string;
  approvedByStaffName?: string;
  approvedDateTime?: string;
}

// --------------------------------------------------------
// END OF DAY (EOD) RECONCILIATION
// --------------------------------------------------------
export type EODCategoryType = 
  | 'CASH' 
  | 'MOBILE_MONEY' 
  | 'CARD_BANK' 
  | 'CREDIT_SALES' 
  | 'LAYAWAYS' 
  | 'REFUNDS' 
  | 'PAYOUTS';

export interface EODReconciliationEntry {
  category: EODCategoryType;
  label: string;
  expectedAmount: number;
  countedAmount: number;
  variance: number;
  notes?: string;
}

export interface EODReport {
  tenantId?: string;
  id: string;
  reportNumber: string;
  date: string;
  branchId: string;
  branchName: string;
  terminalId?: string;
  terminalName?: string;
  generatedByStaffId: string;
  generatedByStaffName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'DISCREPANCY_FLAGGED';
  reconciliation: EODReconciliationEntry[];
  totalSales: number;
  totalCashExpected: number;
  totalCashCounted: number;
  totalVariance: number;
  unresolvedHeldSalesCount: number;
  unresolvedHeldSalesValue: number;
  unapprovedRefundsCount: number;
  unapprovedRefundsValue: number;
  openTillsCount: number;
  pendingStockAdjustmentsCount: number;
  managerApprovedBy?: string;
  managerApprovalDate?: string;
  managerNotes?: string;
  createdDateTime: string;
}

// --------------------------------------------------------
// FORMAL STOCKTAKE
// --------------------------------------------------------
export interface StocktakeCountItem {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  binLocation?: string;
  unitCost: number;
  retailPrice: number;
  bookQty: number; // Expected count in system
  expectedQtySnapshot?: number; // Immutable snapshot at stocktake creation
  countedQty: number | null; // null if not yet counted
  varianceQty: number;
  varianceValuation: number;
  reasonCode?: StocktakeVarianceReasonCode;
  notes?: string;
  lastCountedTimestamp?: string;
  countedByStaffName?: string;
  exceptionId?: string;
}

export type StocktakeStatus = 
  | 'DRAFT'
  | 'COUNTING'
  | 'VARIANCE_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'CLOSED'
  | 'CANCELLED';

export interface StocktakeSession {
  tenantId?: string;
  id: string;
  sessionNumber: string;
  title: string;
  locationId: string;
  locationType: LocationType;
  locationName: string;
  departmentFilter?: string;
  isBlindCount: boolean; // if true, hide expected bookQty from counter view
  status: StocktakeStatus;
  createdByStaffId: string;
  createdByStaffName: string;
  createdDateTime: string;
  completedDateTime?: string;
  items: StocktakeCountItem[];
  totalExpectedUnits: number;
  totalCountedUnits: number;
  totalVarianceUnits: number;
  totalVarianceValuation: number;
  approvalRequired: boolean;
  approvedByStaffName?: string;
  approvedDateTime?: string;
  approvalNotes?: string;
  notes?: string;
}

// --------------------------------------------------------
// MANAGER CONTROLS & APPROVALS
// --------------------------------------------------------
export type ApprovalType = 
  | 'CUSTOMER_APPROVAL'
  | 'CREDIT_LIMIT_OVERRIDE'
  | 'STOCK_ADJUSTMENT'
  | 'PRICE_OVERRIDE'
  | 'DISCOUNT_OVERRIDE'
  | 'SALES_RETURN'
  | 'CREDIT_NOTE'
  | 'CASH_VARIANCE'
  | 'STOCKTAKE_VARIANCE'
  | 'UNRESOLVED_HELD_SALE'
  | 'SENSITIVE_CONFIG_CHANGE'
  // BI Brain's REDIRECT_TO_APPROVAL rule consequence (DL-061/062/065) —
  // server/lib/biRuleGate.ts's createApprovalTicket() is the only writer.
  // `title` is already the rule's own description text, not this constant.
  | 'BI_RULE_REDIRECT';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalRequest {
  tenantId?: string;
  id: string;
  requestNumber: string;
  type: ApprovalType;
  title: string;
  description: string;
  amount?: number;
  referenceId?: string; // e.g. CUST-1004, STK-003, SHIFT-01, PO-01, HS-0815-01
  referenceType?: string;
  locationName: string;
  
  // Requested by
  requestedByStaffId: string;
  requestedByStaffName: string;
  requestedByRole: string;
  requestedDateTime: string;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Decision / Audit
  status: ApprovalStatus;
  decidedByStaffId?: string;
  decidedByStaffName?: string;
  decidedByRole?: string;
  decisionDateTime?: string;
  decisionNotes?: string;
  
  // Meta details payload
  meta?: Record<string, any>;
}

// --------------------------------------------------------
// DEBTORS & CUSTOMER CREDIT
// --------------------------------------------------------
export type DebtorTransactionType = 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'JOURNAL_ADJ' | 'OPENING_BALANCE';

export interface DebtorTransaction {
  tenantId?: string;
  id: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  dateTime: string;
  transactionType: DebtorTransactionType;
  referenceNumber: string; // e.g. INV-20260815-01, PAY-REC-89201, CN-2026-001
  description: string;
  debit: number; // Increases debt (invoices)
  credit: number; // Decreases debt (payments, credit notes)
  runningBalance: number;
  dueDate?: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  allocatedAmount?: number;
  paymentMethod?: PaymentMethodType;
  notes?: string;
  cashierOrStaffName?: string;
}

export interface DebtorAgingBucket {
  customerId: string;
  customerName: string;
  accountNumber: string;
  creditLimit: number;
  current0To30Days: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalOutstanding: number;
  availableCredit: number;
  overdueAmount: number;
  paymentTerms: string;
  debtorStatus: DebtorAccountStatus;
}

// --------------------------------------------------------
// CREDITORS & SUPPLIER PAYABLES
// --------------------------------------------------------
export type CreditorTransactionType = 'PURCHASE_INVOICE' | 'GRN_ACCRUAL' | 'PAYMENT_MADE' | 'DEBIT_NOTE' | 'ADJUSTMENT';

export interface CreditorTransaction {
  tenantId?: string;
  id: string;
  supplierCode: string;
  supplierName: string;
  dateTime: string;
  transactionType: CreditorTransactionType;
  referenceNumber: string; // e.g. PINV-2026-0801, GRN-2026-004, VOUCHER-9012
  description: string;
  invoiceAmount: number; // Increases our liability
  paymentAmount: number; // Decreases our liability
  runningBalance: number;
  dueDate?: string;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
  paymentMethod?: string;
  authorizedByStaffName?: string;
  notes?: string;
}

export interface CreditorAgingBucket {
  supplierCode: string;
  supplierName: string;
  current0To30Days: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalOutstanding: number;
  dueAmount: number;
  overdueAmount: number;
  paymentTerms: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'DISPUTED' | 'ARCHIVED';
}

// --------------------------------------------------------
// CASH & BANK ACCOUNTS
// --------------------------------------------------------
export type CashBankAccountType = 
  | 'CASH_TILL' 
  | 'CASH_SAFE' 
  | 'BANK_ACCOUNT' 
  | 'MOBILE_MONEY' 
  | 'CARD_SETTLEMENT' 
  | 'OTHER';

export interface CashBankAccount {
  tenantId?: string;
  id: string;
  code: string;
  name: string;
  accountType: CashBankAccountType;
  accountNumber: string;
  institutionOrProvider: string;
  branchId?: string;
  branchName?: string;
  currency: string;
  currentBalance: number;
  openingBalance: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  isDefault: boolean;
  requiresDualApprovalForTransfer?: boolean;
  maxDailyOutflowLimit?: number;
  lastReconciledDate?: string;
  notes?: string;
}

export type CashBankMovementType = 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'TRANSFER_IN' 
  | 'TRANSFER_OUT' 
  | 'PAYOUT' 
  | 'FLOAT_IN' 
  | 'BANKING' 
  | 'CARD_SETTLEMENT';

export interface CashBankTransaction {
  tenantId?: string;
  id: string;
  accountId: string;
  accountName: string;
  dateTime: string;
  movementType: CashBankMovementType;
  amount: number; // positive for inflow, negative for outflow
  feeAmount?: number;
  balanceAfter: number;
  referenceNumber: string;
  counterAccountId?: string;
  counterAccountName?: string;
  description: string;
  performedByStaffId: string;
  performedByStaffName: string;
  approvedByStaffName?: string;
  status: 'POSTED' | 'PENDING_APPROVAL' | 'RECONCILED';
  receiptOrSlipNumber?: string;
  notes?: string;
}

// --------------------------------------------------------
// CASH MANAGER MOVEMENTS
// --------------------------------------------------------
export type CashMovementCategory = 
  | 'CASH_IN' 
  | 'CASH_OUT' 
  | 'TILL_TRANSFER' 
  | 'SAFE_TRANSFER' 
  | 'BANKING' 
  | 'PAYOUT' 
  | 'RECONCILIATION';

export interface CashMovementRecord {
  tenantId?: string;
  id: string;
  movementNumber: string;
  category: CashMovementCategory;
  sourceAccountId?: string;
  sourceAccountName?: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
  amount: number;
  reasonCategory: string;
  description: string;
  receiptSlipNumber?: string;
  bagSealNumber?: string;
  denominationBreakdown?: Record<string, number>;
  requestedByStaffId: string;
  requestedByStaffName: string;
  isSensitive: boolean;
  requiresApproval: boolean;
  approvalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedByStaffName?: string;
  approvedDateTime?: string;
  dateTime: string;
}

// --------------------------------------------------------
// BUSINESS RESERVES (OPERATIONAL)
// --------------------------------------------------------
export type ReserveCategory = 
  | 'COGS_RESERVE' 
  | 'TAX_RESERVE' 
  | 'PAYROLL_RESERVE' 
  | 'RENT_OPERATING_RESERVE' 
  | 'MANAGEMENT_EMERGENCY_RESERVE';

export interface BusinessReserve {
  tenantId?: string;
  id: string;
  code: string;
  name: string;
  category: ReserveCategory;
  targetAmount: number;
  currentFundedBalance: number;
  allocationRulePercent: number; // e.g. 45% of gross sales or fixed rate
  linkedBankAccountId: string;
  linkedBankAccountName: string;
  description: string;
  priority: 'MANDATORY' | 'HIGH' | 'MEDIUM';
  status: 'ACTIVE' | 'PAUSED' | 'TARGET_MET';
  lastContributionDate?: string;
  lastDrawdownDate?: string;
}

export interface ReserveTransferRecord {
  tenantId?: string;
  id: string;
  reserveId: string;
  reserveName: string;
  dateTime: string;
  type: 'CONTRIBUTION' | 'DRAWDOWN' | 'INTER_RESERVE_SWAP';
  amount: number;
  fromAccountName: string;
  toAccountName: string;
  referenceNumber: string;
  authorizedByStaffName: string;
  notes: string;
}

// --------------------------------------------------------
// VAT / TAX & FISCAL INTEGRATION CONFIG
// --------------------------------------------------------
export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  standardRate: number; // e.g. 15.0
  isCompound: boolean;
  isExempt: boolean;
  isZeroRated: boolean;
  description: string;
  active: boolean;
  fiscalCode?: string; // Code used by fiscal electronic signature devices
}

export interface ItemTaxClassification {
  departmentOrCategory: string;
  taxCategoryId: string;
  taxCategoryName: string;
  taxRate: number;
  itemCount: number;
}

export interface TaxFiscalConfig {
  tenantId?: string;
  taxSystemName: string; // e.g. "Value Added Tax (VAT)", "Goods & Services Tax (GST)", "Sales Tax"
  taxRegistrationNumber: string; // e.g. "VAT-88492019-B"
  fiscalDeviceSerialNumber: string; // e.g. "FISCAL-ETR-2026-9921"
  taxInvoiceHeaderDisclaimer: string;
  taxInvoiceFooterDisclaimer: string;
  taxInclusivePricing: boolean;
  currencySymbol: string;
  categories: TaxCategory[];
  classifications: ItemTaxClassification[];
}

// --------------------------------------------------------
// PHASE 7: LOCAL BUSINESS INTELLIGENCE & RECOMMENDATIONS
// --------------------------------------------------------
export type BIRuleType =
  | 'LOW_STOCK'
  | 'DEAD_STOCK'
  | 'NO_COST'
  | 'NO_SELLING_PRICE'
  | 'STOCK_VARIANCE'
  | 'EXCESSIVE_DISCOUNTS'
  | 'FREQUENT_RETURNS'
  | 'OVERDUE_CUSTOMERS'
  | 'SLOW_PAYING_CUSTOMERS'
  | 'EXCESSIVE_HELD_SALES'
  | 'SHIFT_VARIANCES'
  | 'CASH_VARIANCES'
  | 'PURCHASE_RECOMMENDATIONS'
  | 'UNUSUAL_PRICE_OVERRIDES';

export type BICategory =
  | 'INVENTORY'
  | 'PRICING'
  | 'SALES_CASHIER'
  | 'DEBTORS_AR'
  | 'CREDITORS_AP'
  | 'SHIFT_CASH'
  | 'PURCHASING'
  | 'GOVERNANCE';

export type BIPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type BIStatus = 'NEW' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'IGNORED';

export interface BIRelatedRecord {
  type: string; // e.g. 'SKU', 'CUSTOMER', 'SHIFT', 'PURCHASE_ORDER', 'CASH_ACCOUNT', 'STAFF'
  id: string;
  name: string;
  code?: string;
  targetView?: ActiveView;
  targetParams?: any;
}

export interface BIUserResponse {
  action: string;
  notes?: string;
  timestamp: string;
  staffId: string;
  staffName: string;
}

export interface BIRuleAlert {
  tenantId?: string;
  id: string;
  ruleType: BIRuleType;
  category: BICategory;
  title: string;
  recommendation: string;
  explanation: string;
  relatedRecord: BIRelatedRecord;
  priority: BIPriority;
  status: BIStatus;
  dateTime: string;
  impactMetric?: {
    label: string;
    value: string | number;
    amount?: number;
    variance?: number;
  };
  suggestedActionLabel?: string;
  userResponse?: BIUserResponse;
  ruleTriggerCriteria?: string;
}

// --------------------------------------------------------
// DETERMINISTIC INVENTORY INTELLIGENCE & RULE ENGINE
// --------------------------------------------------------
export type RuleSeverityStatus = 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';

export interface BusinessRuleDefinition {
  ruleId: string;
  ruleVersion: number;
  name: string;
  category: BICategory;
  description: string;
  isEnabled: boolean;
  effectiveDate: string;
  thresholds: Record<string, number | string | boolean>;
  metricKey: string;
  explanationTemplate: string;
}

export interface BusinessRuleResult {
  ruleId: string;
  ruleVersion: number;
  tenantId?: string;
  entityType: 'ITEM' | 'CUSTOMER' | 'TRANSACTION' | 'STOCKTAKE' | 'LOCATION' | 'SYSTEM';
  entityId: string;
  entityName?: string;
  status: RuleSeverityStatus;
  reasonCode: string;
  metricKey?: string;
  metricValue?: number;
  threshold?: number;
  recommendation?: string;
  evidence: {
    label: string;
    value: string | number;
  }[];
  generatedAt: string;
  relatedEventIds?: string[];
}

export type ReorderRecommendationStatus = 'NEW' | 'REVIEWED' | 'ACCEPTED' | 'IGNORED' | 'CONVERTED' | 'RESOLVED';

export interface ReorderRecommendation {
  tenantId?: string;
  id: string;
  sku: string;
  itemName: string;
  department: string;
  locationId: string;
  locationName: string;
  stockOnHand: number;
  availableStock: number;
  reorderLevel: number;
  targetStock: number;
  averageDailySales: number;
  supplierLeadTimeDays?: number;
  suggestedReorderQty: number;
  preferredSupplierCode?: string;
  preferredSupplierName?: string;
  lastCost: number;
  estimatedCostTotal: number;
  reason: string;
  status: ReorderRecommendationStatus;
  ruleVersion: number;
  createdAt: string;
  reviewedByStaffName?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  convertedDocumentType?: 'PURCHASE_MEMO' | 'DRAFT_PO';
  convertedDocumentNumber?: string;
}

export type StocktakeRiskLevel = 'Routine' | 'Review' | 'Priority Count' | 'Urgent Count';

export interface StocktakeRiskSignal {
  id: string;
  sku: string;
  itemName: string;
  department: string;
  locationId: string;
  locationName: string;
  riskScore: number;
  riskLevel: StocktakeRiskLevel;
  lastStocktakeDate?: string;
  daysSinceLastCount?: number;
  previousVarianceUnits?: number;
  previousVarianceValuation?: number;
  recentAdjustmentsCount: number;
  recentTransferDiscrepanciesCount: number;
  recentReturnsCount: number;
  recentWriteOffsCount: number;
  stockOnHand: number;
  unitCost: number;
  currentValuation: number;
  reasons: string[];
}

export interface PriceFloorPolicy {
  minimumGrossMarginPercent: number; // default e.g. 15%
  enforceDepartmentFloors: boolean;
  departmentMinMarginPercents?: Record<string, number>;
  allowSupervisorOverride: boolean;
  blockOnNegativeMargin: boolean;
}

export interface PriceFloorEvaluation {
  isAllowed: boolean;
  action: 'ALLOW' | 'WARN' | 'BLOCK';
  sellingPrice: number;
  minimumAllowedPrice: number;
  unitCost: number;
  expectedMarginPercent: number;
  minimumMarginPercent: number;
  marginShortfallPercent: number;
  reason: string;
}

export type ReadinessStatus = 'READY' | 'ATTENTION' | 'WARNING' | 'ERROR';

export interface OperationalReadinessSnapshot {
  applicationStatus: ReadinessStatus;
  connectivityStatus: 'ONLINE' | 'OFFLINE';
  localDatabaseStatus: ReadinessStatus;
  lastSuccessfulBackup: string;
  backupStatus: 'SUCCESS' | 'BACKUP_DUE' | 'FAILED' | 'IN_PROGRESS';
  backupStatusMessage?: string;
  pendingSyncRecordsCount: number;
  failedSyncRecordsCount: number;
  lastSuccessfulSync?: string;
  fiscalStatus: 'NOT_ENABLED' | 'READY' | 'PENDING_DOCUMENTS' | 'ATTENTION_REQUIRED';
  fiscalPendingCount?: number;
  licenseStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'GRACE_PERIOD' | 'RENEWAL_REQUIRED';
  licenseExpiryDate?: string;
  gracePeriodDays?: number;
}

// --------------------------------------------------------
// PHASE 7: REPORTS CENTER SPECIFICATIONS
// --------------------------------------------------------
export type ReportGroupKey = 
  | 'SALES' 
  | 'INVENTORY' 
  | 'PURCHASING' 
  | 'DEBTORS' 
  | 'CREDITORS' 
  | 'CASH_BANK' 
  | 'STAFF' 
  | 'STOCKTAKE' 
  | 'AUDIT' 
  | 'BI';

export interface ReportDefinition {
  id: string;
  groupKey: ReportGroupKey;
  code: string;
  name: string;
  description: string;
  defaultTimeframe?: string;
  supportedFormats: ('PRINT' | 'EXCEL' | 'PDF' | 'EMAIL' | 'WHATSAPP' | 'CLOUD')[];
  badge?: string;
}

export type ReportDatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'CUSTOM';

export interface ReportFilterCriteria {
  datePreset: ReportDatePreset;
  startDate: string;
  endDate: string;
  branchId: string;
  warehouseId: string;
  department: string;
  staffId: string;
  paymentMethod: string;
  customerCategory: string;
  statusFilter: string;
  searchQuery: string;
}

export interface ReportExportOptions {
  format: 'PRINT' | 'EXCEL' | 'PDF' | 'EMAIL' | 'WHATSAPP' | 'CLOUD';
  recipientEmail?: string;
  whatsappPhone?: string;
  includeSummaryCharts: boolean;
  includeAuditHeader: boolean;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
}

// --------------------------------------------------------
// BUSINESS PROFILE ONBOARDING — tenant-level profile, set once by the
// first-install wizard and editable thereafter from the System menu's
// Business Profile page (same fields, same shared form-section
// components — not two separate systems). See
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business Profile Onboarding
// addendum for the wizard-scope and field-locking decisions.
// --------------------------------------------------------
export type BusinessType =
  | 'GENERAL_RETAIL'
  | 'WHOLESALE_DISTRIBUTION'
  | 'HOSPITALITY'
  | 'PHARMACY'
  | 'HARDWARE_BUILDING'
  | 'FASHION_APPAREL'
  | 'ELECTRONICS_APPLIANCES'
  | 'LIQUOR_BOTTLE_STORE'
  | 'BUTCHERY_FRESH_PRODUCE'
  | 'AUTOMOTIVE_PARTS_SERVICES'
  | 'SALON_PERSONAL_CARE'
  | 'OTHER';

// Fields marked (sensitive) below are the confirm-to-change set on the
// permanent Business Profile page: tin, vatNumber, registrationNumber,
// country, baseCurrency.
export interface BusinessProfile {
  tenantId: string;
  legalName: string;
  // "Trading/brand name" reuses the tenant's existing display_name column
  // rather than adding a redundant field — see Section 1.6's warning
  // against duplicate/legacy type pairs.
  displayName: string;
  registrationNumber?: string;
  tin?: string; // sensitive — what fiscalization submissions are tied to
  vatRegistered: boolean;
  vatNumber?: string; // sensitive
  country: string; // sensitive — ISO 3166-1 alpha-2; also drives FiscalizationProvider selection
  businessType?: BusinessType;
  registeredAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  whatsappBusinessNumber?: string;
  website?: string;
  logoDataUrl?: string;
  brandColor?: string;
  baseCurrency: string; // sensitive — ISO 4217
  multiCurrencyEnabled: boolean;
  fiscalYearStartMonth: number; // 1-12
  pairingCode: string;
  onboardingCompletedAt?: string;
  // Primary branch, created alongside the tenant at onboarding.
  primaryBranch: {
    id: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
}

// --------------------------------------------------------
// PHASE 8: LICENSING & ACTIVATION
// --------------------------------------------------------
export type LicenceStatus = 'LICENSED' | 'GRACE_PERIOD' | 'REQUIRES_RENEWAL' | 'EXPIRED';
export type ProductPlanEdition = 'STANDARD_DESKTOP' | 'PROFESSIONAL_DESKTOP' | 'ENTERPRISE_BRANCH' | 'ENTERPRISE_CLOUD';

export interface LicenceInfo {
  productCode: string;
  installationId: string;
  // Fixed at activation time and never changed without a full
  // re-activation (DL-001/DL-002) — this is what binds a single
  // installation to exactly one tenant (and, for terminal installs, one
  // branch and one terminal record).
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  appSurface?: 'BRANCH_TERMINAL' | 'HEAD_OFFICE';
  activationCode: string;
  productStatus: 'ACTIVE' | 'WARNING' | 'EXPIRED';
  currentPlan: ProductPlanEdition;
  planLabel: string;
  entitlements: string[];
  activationDate: string;
  expiryDate: string;
  lastActivation: string;
  activationStatus: LicenceStatus;
  gracePeriodDaysRemaining?: number;
  supportContactWhatsApp: string;
  companyName: string;
  branchRegistered: string;
  cryptographicSignatureStatus: 'VALID_OFFLINE_SIGNATURE' | 'PENDING_VERIFICATION' | 'REVOKED';
  maxAllowedTerminals: number;
}

// --------------------------------------------------------
// PHASE 10: BACKUP, RESTORE, OFFLINE INTEGRITY & UPDATE/MIGRATION HARDENING
// --------------------------------------------------------
export type BackupType = 
  | 'SCHEDULED' 
  | 'MANUAL' 
  | 'PRE_UPDATE' 
  | 'PRE_MIGRATION' 
  | 'PRE_RESTORE';

export type BackupVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED';

export type BackupFailureReason = 
  | 'DESTINATION_UNAVAILABLE'
  | 'INSUFFICIENT_STORAGE'
  | 'DATABASE_BUSY'
  | 'DATABASE_INTEGRITY_ERROR'
  | 'FILE_WRITE_FAILED'
  | 'VERIFICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export interface BackupRecord {
  backupId: string;
  type: BackupType;
  createdAt: string;
  applicationVersion: string;
  schemaVersion: number;
  filePath: string;
  fileSize: number; // in bytes or MB
  verificationStatus: BackupVerificationStatus;
  checksum: string; // SHA-256 integrity hash simulation
  tenantId: string;
  tablesCount: number;
  recordsCount: number;
  walCheckpointCompleted: boolean;
  failureReason?: BackupFailureReason;
  notes?: string;
  initiatedByStaffId?: string;
  initiatedByStaffName?: string;
}

export interface BackupRetentionPolicy {
  dailyRetentionDays: number; // e.g. 14
  manualBackupsRetainedCount: number; // e.g. 20
  preUpdateRetentionDays: number; // e.g. 60
  preMigrationRetentionDays: number; // e.g. 60
  autoBackupHour: number; // 23:00 (11 PM)
  storageLocationPath: string; // e.g. C:\Users\Public\Documents\SCI\backup\Data
  warnIfStorageBelowMb: number; // e.g. 500
}

export type MigrationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

export interface DatabaseMigrationRecord {
  migrationId: string;
  sourceVersion: number;
  targetVersion: number;
  description: string;
  appliedAt: string;
  applicationVersion: string;
  status: MigrationStatus;
  executionTimeMs: number;
  preMigrationBackupId?: string;
  errorDetails?: string;
  appliedByStaffName?: string;
}

export type IntegrityCheckType = 
  | 'STARTUP_LIGHTWEIGHT' 
  | 'SCHEDULED_DEEP' 
  | 'PRE_UPDATE' 
  | 'PRE_MIGRATION' 
  | 'POST_RESTORE' 
  | 'MANUAL'
  | 'STARTUP'
  | 'DEEP';

export type DatabaseIntegrityStatus = 'HEALTHY' | 'CHECKING' | 'ATTENTION_REQUIRED' | 'RECOVERY_REQUIRED';

export interface TableIntegrityCheckItem {
  tableName: string;
  rowCount?: number;
  recordsCount?: number;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  indexStatus?: string;
  foreignKeyStatus?: string;
  corruptPages?: number;
  error?: string;
}

export interface DatabaseIntegrityCheckResult {
  checkId: string;
  timestamp: string;
  checkedAt?: string;
  checkType: IntegrityCheckType;
  overallStatus: DatabaseIntegrityStatus;
  sqliteHeaderValid: boolean;
  pageCount: number;
  freeListCount?: number;
  schemaVersion: number;
  walModeActive: boolean;
  walCheckpointStatus?: string;
  unresolvedForeignKeys: number;
  tableIntegrityChecks?: TableIntegrityCheckItem[];
  tablesChecked?: TableIntegrityCheckItem[];
  abnormalShutdownDetected: boolean;
  recoveryNotes?: string;
  checkedByStaffName?: string;
}

export type RestoreWorkflowStage = 
  | 'IDLE' 
  | 'SELECTING' 
  | 'CONFIRMING' 
  | 'PRE_RESTORE_BACKUP' 
  | 'VERIFYING_PRE_RESTORE' 
  | 'VALIDATING_SELECTED' 
  | 'VALIDATION'
  | 'STAGING_REPLACE' 
  | 'ATOMIC_SWAP' 
  | 'POST_RESTORE_VERIFY' 
  | 'POST_VERIFICATION'
  | 'COMPLETED' 
  | 'FAILED' 
  | 'ROLLED_BACK';

export interface RestoreExecutionResult {
  success: boolean;
  restoredBackupId: string;
  preRestoreBackupCreated?: BackupRecord;
  tablesRestoredCount: number;
  recordsRestoredCount: number;
  integrityVerified: boolean;
  error?: string;
  details?: string;
  failureStage?: string;
  completedAt: string;
}

export interface RestoreStagedState {
  stage: RestoreWorkflowStage;
  selectedBackup?: BackupRecord;
  preRestoreBackup?: BackupRecord;
  progress: number;
  statusMessage: string;
  error?: string;
  validationSummary?: {
    tenantMatch: boolean;
    schemaCompatible: boolean;
    checksumValid: boolean;
    recordsCount: number;
    tableCount: number;
  };
}

export interface StorageCapacityInfo {
  totalStorageBytes: number;
  availableStorageBytes: number;
  usedStorageBytes: number;
  appBinariesPath: string;
  activeDataPath: string;
  backupRootPath: string;
  isStorageAdequate: boolean;
}

// --------------------------------------------------------
// PHASE 8: SOFTWARE UPDATES & DATABASE SAFETY
// --------------------------------------------------------
export type UpdateCheckStatus = 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'CHECKING' | 'OFFLINE_UNAVAILABLE' | 'DOWNLOADING' | 'READY_TO_INSTALL';

export interface SoftwareUpdateInfo {
  currentVersion: string;
  releaseChannel: 'STABLE_LTS' | 'MONTHLY_RELEASE' | 'EARLY_ACCESS';
  lastChecked: string;
  updateStatus: UpdateCheckStatus;
  isOffline: boolean;
  availableVersion?: string;
  releaseNotes?: string[];
  downloadSizeMb?: number;
  requireDatabaseBackup: boolean;
  lastAutomaticBackupSnapshot?: string;
  minimumSchemaVersionRequired: string;
  currentSchemaVersion?: number;
  targetSchemaVersion?: number;
  isCryptographicallyVerified?: boolean;
  signatureKeyId?: string;
}

// --------------------------------------------------------
// PHASE 8: EXTERNAL DEVICE MANAGEMENT (GENERIC ADAPTERS)
// --------------------------------------------------------
export type DeviceCategory = 
  | 'RECEIPT_PRINTER' 
  | 'BARCODE_SCANNER' 
  | 'CASH_DRAWER' 
  | 'WEIGHING_SCALE' 
  | 'PAYMENT_TERMINAL' 
  | 'FISCAL_DEVICE';

export type DeviceConnectionType = 
  | 'USB_RAW' 
  | 'SERIAL_COM' 
  | 'NETWORK_TCPIP' 
  | 'BLUETOOTH' 
  | 'VIRTUAL_EMULATOR';

export type DeviceOperationalStatus = 
  | 'CONNECTED' 
  | 'DISCONNECTED' 
  | 'ERROR' 
  | 'TESTING' 
  | 'STANDBY';

export interface PosDevice {
  tenantId?: string;
  id: string;
  name: string;
  category: DeviceCategory;
  connectionType: DeviceConnectionType;
  portOrAddress: string;
  modelManufacturer: string;
  status: DeviceOperationalStatus;
  isDefault: boolean;
  lastTestedAt?: string;
  lastTestResult?: string;
  configParams: {
    baudRate?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    ipAddress?: string;
    tcpPort?: number;
    paperWidthMm?: number;
    autoCut?: boolean;
    drawerPin?: number;
    pulseMs?: number;
    scaleUnit?: 'KG' | 'LB' | 'G';
    continuousReading?: boolean;
    scannerPrefix?: string;
    scannerSuffix?: string;
    timeoutMs?: number;
  };
}

// --------------------------------------------------------
// PHASE 8: PAYMENT INTEGRATION CONFIGURATION
// --------------------------------------------------------
export interface PaymentMethodConfig {
  tenantId?: string;
  id: string;
  methodType: PaymentMethodType;
  name: string;
  isEnabled: boolean;
  isDefault: boolean;
  requiresReference: boolean;
  referenceLabel?: string;
  referenceValidationPattern?: string;
  openCashDrawerOnTender: boolean;
  allowSplitPayment: boolean;
  surchargePercentage?: number;
  surchargeFixedAmount?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  linkedSettlementAccountId?: string;
  linkedSettlementAccountName?: string;
  providerName?: string;
  merchantOrPaybillNumber?: string;
  stkPushEnabled?: boolean;
  autoPromptTerminal?: boolean;
  allowOfflineCapture?: boolean;
  requireManagerApprovalIfOverLimit?: boolean;
  notes?: string;
}

// --------------------------------------------------------
// PHASE 8: FISCALIZATION SETTINGS & JURISDICTIONS
// --------------------------------------------------------
export type FiscalDayStatus = 'OPEN' | 'CLOSED' | 'OVERDUE' | 'REQUIRED' | 'SUSPENDED';
export type FiscalDeviceMode = 'PHYSICAL_ETR' | 'VIRTUAL_SIGNING_SERVICE' | 'CONTROL_UNIT_ESD' | 'SOFTWARE_TIMS_VSCU';

export interface FiscalDocumentQueueItem {
  id: string;
  documentNumber: string;
  documentType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'Z_REPORT';
  timestamp: string;
  amount: number;
  taxAmount: number;
  status: 'PENDING' | 'RETRYING' | 'FAILED' | 'SIGNED_OFFLINE' | 'TRANSMITTED';
  retryCount: number;
  lastError?: string;
  fiscalSignature?: string;
  qrCodePayload?: string;
  verificationUrl?: string;
}

export interface FiscalConfig {
  fiscalizationEnabled: boolean;
  jurisdiction: string;
  provider: string;
  deviceOrServiceMode: FiscalDeviceMode;
  serviceEndpointOrPort: string;
  deviceSerialNumber: string;
  pinOrTaxId: string;
  status: 'ACTIVE' | 'OFFLINE_BUFFER' | 'ERROR' | 'INITIALIZING';
  fiscalDayStatus: FiscalDayStatus;
  fiscalDayNumber: number;
  fiscalDayOpenedAt?: string;
  lastZReportDate?: string;
  lastZReportNumber?: number;
  pendingDocumentsCount: number;
  memoryRemainingPercent: number;
  offlineGraceHoursRemaining: number;
  autoCloseFiscalDayAtMidnight: boolean;
  printFiscalQrOnReceipt: boolean;
  queue: FiscalDocumentQueueItem[];
}

// --------------------------------------------------------
// PHASE 8 MVP: EXCEPTION LEDGER & OPERATIONAL GOVERNANCE
// --------------------------------------------------------
export type ExceptionCategory = 
  | 'CASH_VARIANCE'
  | 'TENDER_VARIANCE'
  | 'STOCKTAKE_VARIANCE'
  | 'NEGATIVE_MARGIN_ATTEMPT'
  | 'PRICE_OVERRIDE'
  | 'STOCK_ADJUSTMENT'
  | 'UNRESOLVED_HELD_SALE'
  | 'OVERDUE_SHIFT'
  | 'MISSING_SELLING_PRICE'
  | 'MISSING_COST'
  | 'FAILED_SYNCHRONIZATION'
  | 'PENDING_FISCAL_DOCUMENT'
  | 'TRANSFER_DISCREPANCY'
  | 'SUPPLIER_RECEIVING_VARIANCE'
  | 'BACKUP_FAILURE'
  | 'DATABASE_INTEGRITY_FAILURE'
  | 'MIGRATION_FAILURE'
  | 'RESTORE_FAILURE'
  | 'INSUFFICIENT_STORAGE';

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ExceptionStatus = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface OperationalException {
  tenantId?: string;
  id: string;
  exceptionNumber: string;
  title: string;
  category: ExceptionCategory;
  dateTime: string;
  branchId: string;
  branchName: string;
  terminalId?: string;
  terminalName?: string;
  staffId: string;
  staffName: string;
  relatedTransactionRef?: string;
  relatedEventId?: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  varianceAmount?: number;
  varianceUnits?: number;
  assignedOrReviewedBy?: string;
  reviewedDateTime?: string;
  resolution?: string;
  details?: string;
  openedAt?: string;
  resolvedAt?: string;
}

// --------------------------------------------------------
// PHASE 8 MVP: CANONICAL ACTIVITY EVENT ARCHITECTURE
// --------------------------------------------------------
export type EventOutcome =
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'APPROVED'
  | 'REJECTED';

export type EventSyncStatus =
  | 'LOCAL_ONLY'
  | 'QUEUED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED';

export type ActivityEventCategory =
  | 'SHIFT'
  | 'SALES'
  | 'PAYMENT'
  | 'CUSTOMER'
  | 'INVENTORY'
  | 'PRICING'
  | 'APPROVAL'
  | 'SECURITY'
  | 'SYSTEM';

export type ActivityEventType =
  // Shift
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSE_STARTED'
  | 'SHIFT_CLOSED'
  | 'SHIFT_CLOSE_BLOCKED'
  | 'SHIFT_OVERDUE'
  // Sales
  | 'SALE_STARTED'
  | 'SALE_COMPLETED'
  | 'CREDIT_SALE_RECORDED'
  | 'SALE_CANCELLED'
  | 'SALE_BLOCKED'
  | 'SALE_RETURN_REQUESTED'
  | 'SALE_RETURN_APPROVED'
  | 'SALE_RETURN_COMPLETED'
  | 'CREDIT_NOTE_CREATED'
  // Payment
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REVERSED'
  | 'PAYMENT_VARIANCE_DETECTED'
  // Customer
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_APPROVED'
  | 'CUSTOMER_REJECTED'
  | 'CUSTOMER_SUSPENDED'
  | 'CUSTOMER_CREDIT_ENABLED'
  | 'CUSTOMER_CREDIT_APPROVED'
  | 'CUSTOMER_CREDIT_LIMIT_CHANGED'
  | 'CUSTOMER_CREDIT_BLOCKED'
  // Inventory
  | 'STOCK_RECEIVED'
  | 'STOCK_TRANSFER_REQUESTED'
  | 'STOCK_TRANSFER_APPROVED'
  | 'STOCK_TRANSFER_DISPATCHED'
  | 'STOCK_TRANSFER_RECEIVED'
  | 'TRANSFER_DISCREPANCY'
  | 'SUPPLIER_RECEIVING_VARIANCE'
  | 'STOCK_ADJUSTMENT_REQUESTED'
  | 'STOCK_ADJUSTMENT_APPROVED'
  | 'STOCK_ADJUSTMENT_POSTED'
  | 'STOCKTAKE_STARTED'
  | 'STOCKTAKE_COUNT_RECORDED'
  | 'STOCKTAKE_VARIANCE_DETECTED'
  | 'STOCKTAKE_APPROVED'
  | 'STOCKTAKE_COMPLETED'
  | 'REORDER_RECOMMENDATION_GENERATED'
  | 'REORDER_RECOMMENDATION_ACCEPTED'
  | 'REORDER_RECOMMENDATION_IGNORED'
  | 'REORDER_RECOMMENDATION_CONVERTED'
  | 'RECEIVING_BLOCKED'
  | 'TRANSFER_BLOCKED'
  // Pricing
  | 'PRICE_OVERRIDE_REQUESTED'
  | 'PRICE_OVERRIDE_APPROVED'
  | 'PRICE_OVERRIDE_REJECTED'
  | 'PRICE_FLOOR_BLOCKED'
  | 'PRODUCT_MISSING_PRICE'
  | 'PRODUCT_MISSING_COST'
  // Approval
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  // Security
  | 'STAFF_LOGIN_SUCCESS'
  | 'STAFF_LOGIN_FAILED'
  | 'ACCESS_DENIED'
  | 'PERMISSION_CHANGED'
  // System & Continuity
  | 'BACKUP_COMPLETED'
  | 'BACKUP_FAILED'
  | 'PRE_RESTORE_BACKUP_CREATED'
  | 'RESTORE_STARTED'
  | 'RESTORE_COMPLETED'
  | 'RESTORE_FAILED'
  | 'UPDATE_CHECK_COMPLETED'
  | 'UPDATE_STARTED'
  | 'UPDATE_COMPLETED'
  | 'UPDATE_FAILED'
  | 'MIGRATION_STARTED'
  | 'MIGRATION_COMPLETED'
  | 'MIGRATION_FAILED'
  | 'INTEGRITY_CHECK_COMPLETED'
  | 'INTEGRITY_CHECK_FAILED'
  | 'ABNORMAL_SHUTDOWN_RECOVERED'
  | 'SYNC_QUEUED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'FISCAL_DOCUMENT_PENDING'
  | 'FISCAL_DOCUMENT_COMPLETED'
  | 'FISCAL_DOCUMENT_FAILED'
  // Legacy / convenience mappings
  | 'VARIANCE_CREATED'
  | 'STOCK_TRANSFERRED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_COMPLETED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'SALE_RETURN_APPROVED';

export type ActivityReasonCode =
  | 'INSUFFICIENT_STOCK'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'CUSTOMER_NOT_APPROVED'
  | 'PRICE_BELOW_FLOOR'
  | 'MANAGER_APPROVAL_REQUIRED'
  | 'CASH_SHORTAGE'
  | 'CASH_OVERAGE'
  | 'COUNT_ERROR'
  | 'WRONG_CHANGE'
  | 'UNRECORDED_PAYOUT'
  | 'UNRECORDED_CASH_IN'
  | 'TENDER_MISCLASSIFICATION'
  | 'REFUND_DIFFERENCE'
  | 'PAYMENT_CONFIRMATION_DIFFERENCE'
  | 'STOCK_SHORTAGE'
  | 'STOCK_OVERAGE'
  | 'DAMAGED_STOCK'
  | 'EXPIRED_STOCK'
  | 'SUPPLIER_VARIANCE'
  | 'USER_CANCELLED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_UNAVAILABLE'
  | 'FISCAL_PROVIDER_UNAVAILABLE'
  | 'ROUTINE_CYCLE_COUNT'
  | 'FLOAT_INITIALIZATION'
  | 'PRICE_MATCH_APPROVED'
  | 'STANDARD_COMPLETION'
  | 'OTHER';

export interface ActivityEvent {
  eventId?: string;
  id: string; // Identifier alias
  eventType: ActivityEventType;
  eventVersion?: number;
  category?: ActivityEventCategory;

  tenantId?: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  terminalId?: string;
  terminalName?: string;
  stockLocationId?: string;

  staffId?: string;
  staffName?: string;
  roleId?: string;
  roleTitle?: string;
  shiftId?: string;
  sessionId?: string;

  entityType?: string;
  entityId?: string;
  parentEntityId?: string;

  action?: string;
  outcome?: EventOutcome;

  reasonCode?: ActivityReasonCode | string;
  humanNotes?: string;

  quantity?: number;
  amount?: number;
  currency?: string;

  occurredAt?: string;
  recordedAt?: string;
  timestamp?: string; // Backwards compatible timestamp alias

  offlineEvent?: boolean;
  syncStatus?: EventSyncStatus;

  deviceId?: string;
  applicationVersion?: string;

  referenceDocument?: string;
  description: string; // Human-readable business explanation
  exceptionId?: string; // Linked OperationalException if any

  metadata?: Record<string, unknown>;
}

// --------------------------------------------------------
// CASH FLOW SPREADSHEET PROJECTOR & VARIANCE ENGINE
// --------------------------------------------------------
export type CashFlowPeriodFilter = 'DAY' | 'WEEK' | 'MONTH';
export type CashFlowCategoryType = 'INFLOW' | 'OUTFLOW';
export type CashFlowLineItemCategory = 
  | 'SALES_CASH'
  | 'SALES_CREDIT_COLLECTION'
  | 'MOBILE_MONEY_SETTLEMENT'
  | 'BANK_TRANSFERS_IN'
  | 'WHOLESALE_CONTRACTS'
  | 'OTHER_INFLOW'
  | 'SUPPLIER_PAYMENTS'
  | 'INVENTORY_PURCHASE'
  | 'UTILITIES_BILLS'
  | 'PAYROLL_SALARIES'
  | 'TAX_SETTLEMENTS'
  | 'RENT_FACILITIES'
  | 'RESERVE_ALLOCATION'
  | 'CAPEX_EQUIPMENT'
  | 'OTHER_OUTFLOW';

export type ProjectionPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'DISCRETIONARY';

export interface CashFlowProjectionEntry {
  id: string;
  periodDate: string; // ISO date e.g. "2026-08-29"
  categoryType: CashFlowCategoryType;
  lineItemKey: CashFlowLineItemCategory;
  title: string;
  projectedAmount: number;
  actualAmount?: number;
  allocatedExpenseAccount?: string;
  notes?: string;
  priority?: ProjectionPriority;
  createdBy?: string;
  createdAt?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export interface CashFlowSpreadsheetPeriodColumn {
  periodKey: string;
  periodLabel: string;
  subLabel?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  isPast?: boolean;
  isFuture?: boolean;
}

export interface CashFlowSpreadsheetRow {
  key: string;
  title: string;
  categoryType: CashFlowCategoryType;
  lineItemKey: CashFlowLineItemCategory;
  isTotal?: boolean;
  isHeader?: boolean;
  periods: Record<string, {
    projected: number;
    actual: number;
    variance: number;
    variancePercent: number;
    isOverBudget?: boolean;
    isUnderCollected?: boolean;
  }>;
  totalProjected: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
}

// --------------------------------------------------------
// PHASE 8 MVP: FORMAL CANONICAL METRIC DICTIONARY
// --------------------------------------------------------
export type MetricCategory = 'SALES_MARGIN' | 'INVENTORY_CONTROL' | 'CASH_ACCOUNTABILITY' | 'OPERATIONAL_EFFICIENCY';

export type MetricScope = 
  | 'Vendor'
  | 'Warehouse'
  | 'Branch'
  | 'Terminal'
  | 'Staff'
  | 'Shift'
  | 'Item'
  | 'Department'
  | 'Customer'
  | 'Supplier'
  | 'Period';

export interface MetricDefinition {
  id: string;
  metricKey: string;
  metricName: string;
  code?: string; // alias for metricKey
  name?: string; // alias for metricName
  description: string;
  formalDefinition?: string; // alias for description
  formula: string;
  requiredInputs: string[];
  unit: string;
  scope: MetricScope[];
  refreshTrigger: string;
  category: MetricCategory;
  isMvpStandard: boolean;
  businessContext?: string;
  exampleCalculation?: string;
  deterministicRules?: string;
}





