import { 
  Shift, 
  StaffMember, 
  SaleTransaction, 
  HeldSale, 
  TenderReconciliationEntry, 
  CashMovementBreakdown, 
  ImmutableShiftReconciliationSnapshot, 
  OperationalException, 
  ActivityEvent, 
  CashUpMode, 
  ExceptionSeverity, 
  ActivityReasonCode,
  ShiftTenderType 
} from '../types';

export const CONTROLLED_VARIANCE_REASON_CODES: { code: ActivityReasonCode; label: string; description: string }[] = [
  { code: 'CASH_SHORTAGE', label: 'Cash Shortage in Drawer', description: 'Physical cash counted is less than expected sales and float.' },
  { code: 'CASH_OVERAGE', label: 'Cash Overage in Drawer', description: 'Physical cash counted exceeds expected sales and float.' },
  { code: 'COUNT_ERROR', label: 'Physical Cash Count Error', description: 'Miscounted notes/coins during initial register count.' },
  { code: 'WRONG_CHANGE', label: 'Cashier Change Calculation Error', description: 'Incorrect change handed to customer during checkout.' },
  { code: 'UNRECORDED_PAYOUT', label: 'Unrecorded Petty Cash / Expense Payout', description: 'Cash disbursed from till without immediate POS payout posting.' },
  { code: 'UNRECORDED_CASH_IN', label: 'Unrecorded Cash Float Top-Up', description: 'Additional currency introduced to till without register log.' },
  { code: 'TENDER_MISCLASSIFICATION', label: 'Tender Misclassification in POS', description: 'Transaction rang up as Cash instead of Mobile/Card (or vice-versa).' },
  { code: 'REFUND_DIFFERENCE', label: 'Refund / Return Calculation Discrepancy', description: 'Return cash paid out differing from recorded credit note value.' },
  { code: 'PAYMENT_CONFIRMATION_DIFFERENCE', label: 'Payment Merchant Batch Discrepancy', description: 'Mobile money or EDC terminal batch settlement differs from recorded total.' },
  { code: 'OTHER', label: 'Other Operational Discrepancy (Requires Detailed Note)', description: 'Specific scenario not covered above. Full explanatory notes mandatory.' },
];

export function calculateVarianceSeverity(varianceAmount: number): ExceptionSeverity {
  const absVariance = Math.abs(varianceAmount);
  if (absVariance <= 5) return 'LOW';
  if (absVariance <= 50) return 'MEDIUM';
  return 'HIGH';
}

export function computeShiftTenderMetrics(
  shift: Shift,
  transactions: SaleTransaction[] = [],
  heldSales: HeldSale[] = []
): {
  tenderReconciliation: TenderReconciliationEntry[];
  cashMovements: CashMovementBreakdown;
  grossSales: number;
  totalSalesCount: number;
  heldSalesCount: number;
  heldSalesTotalValue: number;
  expectedCash: number;
} {
  const safeTx = Array.isArray(transactions) ? transactions : [];
  const safeHeld = Array.isArray(heldSales) ? heldSales : [];

  // Filter transactions for this shift or terminal during shift session
  // If transaction has terminalId matching shift or falling into shift timeframe
  const shiftTx = safeTx.filter((tx) => {
    if (tx.terminalId && shift.terminalId && tx.terminalId !== shift.terminalId) return false;
    return true;
  });

  let cashSales = 0;
  let mobileMoneySales = 0;
  let cardSales = 0;
  let customerCreditSales = 0;
  let otherSales = 0;
  let refunds = 0;
  let totalGross = 0;

  shiftTx.forEach((tx) => {
    if (tx.status === 'COMPLETED') {
      totalGross += tx.grandTotal || 0;
      if (Array.isArray(tx.payments)) {
        tx.payments.forEach((p) => {
          const method = (p.method || '').toUpperCase();
          const amt = Number(p.amount) || 0;
          if (method === 'CASH') {
            cashSales += amt;
          } else if (method === 'MOBILE_MONEY' || method === 'ECOCASH' || method === 'ONE_MONEY') {
            mobileMoneySales += amt;
          } else if (method === 'CARD' || method === 'DEBIT_CARD' || method === 'CREDIT_CARD') {
            cardSales += amt;
          } else if (method === 'CUSTOMER_CREDIT' || method === 'ACCOUNT') {
            customerCreditSales += amt;
          } else {
            otherSales += amt;
          }
        });
      } else {
        // Fallback to legacy transactionType
        if (tx.transactionType === 'CASH_SALE') cashSales += tx.grandTotal;
        else if (tx.transactionType === 'CREDIT_SALE') customerCreditSales += tx.grandTotal;
        else if (tx.transactionType === 'LAYAWAY') cashSales += tx.grandTotal;
        else cashSales += tx.grandTotal;
      }
    } else if (tx.status === 'REFUNDED') {
      refunds += tx.grandTotal || 0;
    }
  });

  // Include base shift stored totals if no dynamic transactions found
  if (shiftTx.length === 0 && (shift.totalCashSales > 0 || shift.totalCardSales > 0 || shift.totalMobileMoneySales > 0)) {
    cashSales = shift.totalCashSales || 0;
    mobileMoneySales = shift.totalMobileMoneySales || 0;
    cardSales = shift.totalCardSales || 0;
    customerCreditSales = shift.totalCreditSales || 0;
    totalGross = shift.grossSales || (cashSales + mobileMoneySales + cardSales + customerCreditSales);
  }

  const openingFloat = shift.openingFloat || 0;
  const cashReceipts = shift.totalLayawayReceipts || 0;
  const approvedCashIn = 0;
  const cashRefunds = refunds || (shift.totalRefunds || 0);
  const approvedCashOut = shift.totalPayouts || 0;
  const tillTransfersOut = 0;
  const bankingDepositsOut = 0;

  const expectedCash = openingFloat + cashSales + cashReceipts + approvedCashIn - cashRefunds - approvedCashOut - tillTransfersOut - bankingDepositsOut;

  const cashMovements: CashMovementBreakdown = {
    openingFloat,
    cashSales,
    cashReceipts,
    approvedCashIn,
    cashRefunds,
    approvedCashOut,
    tillTransfersOut,
    bankingDepositsOut,
    expectedCash,
  };

  // Outstanding held sales
  const openHeld = safeHeld.filter((h) => h.status === 'OUTSTANDING');
  const heldSalesCount = openHeld.length;
  const heldSalesTotalValue = openHeld.reduce((sum, h) => sum + (h.grandTotal || 0), 0);

  // Initial Tender Reconciliation list
  const tenderReconciliation: TenderReconciliationEntry[] = [
    {
      tenderType: 'CASH',
      tenderName: 'Cash in Drawer (Physical Currency)',
      expectedAmount: expectedCash,
      countedOrConfirmedAmount: shift.countedCash !== undefined ? shift.countedCash : expectedCash,
      variance: shift.countedCash !== undefined ? (shift.countedCash - expectedCash) : 0,
      isCash: true,
    },
    {
      tenderType: 'MOBILE_MONEY',
      tenderName: 'Mobile Money / EcoCash / Merchant Wallet',
      expectedAmount: mobileMoneySales,
      countedOrConfirmedAmount: mobileMoneySales,
      variance: 0,
      isCash: false,
    },
    {
      tenderType: 'DEBIT_CARD',
      tenderName: 'Card / POS Terminal Merchant Batch',
      expectedAmount: cardSales,
      countedOrConfirmedAmount: cardSales,
      variance: 0,
      isCash: false,
    },
    {
      tenderType: 'CUSTOMER_CREDIT',
      tenderName: 'Customer Account Credit Sales',
      expectedAmount: customerCreditSales,
      countedOrConfirmedAmount: customerCreditSales,
      variance: 0,
      isCash: false,
    },
  ];

  if (otherSales > 0) {
    tenderReconciliation.push({
      tenderType: 'OTHER',
      tenderName: 'Other Payment Methods',
      expectedAmount: otherSales,
      countedOrConfirmedAmount: otherSales,
      variance: 0,
      isCash: false,
    });
  }

  return {
    tenderReconciliation,
    cashMovements,
    grossSales: totalGross || shift.grossSales || 0,
    totalSalesCount: shiftTx.length || shift.totalSalesCount || 0,
    heldSalesCount,
    heldSalesTotalValue,
    expectedCash,
  };
}

export interface CreateExceptionOptions {
  shift: Shift;
  snapshot?: ImmutableShiftReconciliationSnapshot;
  closureData?: {
    closingFloat?: number;
    countedCash?: number;
    cashVariance?: number;
    closingNotes?: string;
    reasonCode?: ActivityReasonCode;
    severity?: ExceptionSeverity;
  };
  staff?: StaffMember;
  varianceAmount?: number;
  reasonCode?: ActivityReasonCode;
  notes?: string;
}

export function createOperationalExceptionFromVariance(
  shiftOrOptions: Shift | CreateExceptionOptions,
  varianceAmountArg?: number,
  reasonCodeArg?: ActivityReasonCode,
  notesArg?: string,
  currentStaffArg?: StaffMember
): OperationalException {
  let shift: Shift;
  let varianceAmount: number;
  let reasonCode: ActivityReasonCode;
  let notes: string;
  let currentStaff: StaffMember | undefined;

  if ('shift' in shiftOrOptions) {
    const opts = shiftOrOptions as CreateExceptionOptions;
    shift = opts.shift;
    varianceAmount = opts.closureData?.cashVariance !== undefined ? opts.closureData.cashVariance : (opts.varianceAmount || (shift.cashVariance || 0));
    reasonCode = opts.closureData?.reasonCode || opts.reasonCode || (varianceAmount < 0 ? 'CASH_SHORTAGE' : 'CASH_OVERAGE');
    notes = opts.closureData?.closingNotes || opts.notes || '';
    currentStaff = opts.staff;
  } else {
    shift = shiftOrOptions as Shift;
    varianceAmount = varianceAmountArg || 0;
    reasonCode = reasonCodeArg || (varianceAmount < 0 ? 'CASH_SHORTAGE' : 'CASH_OVERAGE');
    notes = notesArg || '';
    currentStaff = currentStaffArg;
  }

  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const exceptionNumber = `EXC-VAR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${randomSuffix}`;
  const severity = calculateVarianceSeverity(varianceAmount);
  
  const isShortage = varianceAmount < 0;
  const title = `Shift #${shift.shiftNumber} Cash ${isShortage ? 'Shortage' : 'Overage'} (${isShortage ? '-' : '+'}$${Math.abs(varianceAmount).toFixed(2)})`;
  
  const reasonObj = CONTROLLED_VARIANCE_REASON_CODES.find((r) => r.code === reasonCode);
  const reasonLabel = reasonObj ? reasonObj.label : reasonCode;

  const details = `Cash reconciliation discrepancy on ${shift.terminalName} operated by ${shift.cashierStaffName}. ` +
    `Expected Cash: $${shift.expectedCash.toFixed(2)}, Counted Cash: $${((shift.countedCash !== undefined ? shift.countedCash : (shift.expectedCash + varianceAmount))).toFixed(2)}, Variance: ${varianceAmount < 0 ? '-' : '+'}$${Math.abs(varianceAmount).toFixed(2)}. ` +
    `Reason: ${reasonLabel}. Explanatory notes: ${notes || 'None provided'}.`;

  return {
    id: `exc-${Date.now()}-${randomSuffix}`,
    exceptionNumber,
    title,
    category: 'CASH_VARIANCE',
    dateTime: formattedDate,
    branchId: shift.branchId,
    branchName: shift.branchName,
    terminalId: shift.terminalId,
    terminalName: shift.terminalName,
    staffId: shift.cashierStaffId,
    staffName: shift.cashierStaffName,
    relatedTransactionRef: `SHIFT #${shift.shiftNumber}`,
    severity,
    status: 'UNDER_REVIEW',
    varianceAmount,
    openedAt: formattedDate,
    details,
  };
}

export interface BuildSnapshotOptions {
  shift: Shift;
  closureData: {
    closingFloat: number;
    countedCash: number;
    cashVariance: number;
    closingNotes: string;
    requiresApproval: boolean;
    cashUpMode?: CashUpMode;
    tenderReconciliation?: TenderReconciliationEntry[];
    originalBlindCounts?: Record<string, number>;
    reasonCode?: ActivityReasonCode;
    severity?: ExceptionSeverity;
    managerApproved?: boolean;
    managerApprovedBy?: string;
  };
  closedByStaff?: StaffMember;
  transactions?: SaleTransaction[];
  heldSales?: HeldSale[];
  exceptionIds?: string[];
}

export function buildImmutableReconciliationSnapshot(
  shiftOrOptions: Shift | BuildSnapshotOptions,
  closingFloatArg?: number,
  countedCashArg?: number,
  cashVarianceArg?: number,
  tenderReconciliationArg?: TenderReconciliationEntry[],
  cashMovementsArg?: CashMovementBreakdown,
  cashUpModeArg?: CashUpMode,
  originalBlindCountsArg?: Record<string, number> | undefined,
  heldSalesCountArg?: number,
  heldSalesTotalValueArg?: number,
  exceptionIdsArg?: string[],
  closureReasonCodeArg?: string,
  closureNotesArg?: string,
  reviewerNameArg?: string
): ImmutableShiftReconciliationSnapshot {
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if ('closureData' in shiftOrOptions) {
    const opts = shiftOrOptions as BuildSnapshotOptions;
    const shift = opts.shift;
    const closureData = opts.closureData;
    const calculated = computeShiftTenderMetrics(shift, opts.transactions, opts.heldSales);

    const tenderReconciliation = closureData.tenderReconciliation && closureData.tenderReconciliation.length > 0
      ? closureData.tenderReconciliation
      : calculated.tenderReconciliation;

    const hasAnyDiscrepancy = Math.abs(closureData.cashVariance) > 0.01 || 
      tenderReconciliation.some(t => Math.abs(t.variance || 0) > 0.01);

    return {
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      terminalId: shift.terminalId,
      terminalName: shift.terminalName,
      branchId: shift.branchId,
      branchName: shift.branchName,
      cashierStaffId: shift.cashierStaffId,
      cashierStaffName: shift.cashierStaffName,
      openedDateTime: shift.openedDateTime,
      closedDateTime: formattedDate,
      cashUpMode: closureData.cashUpMode || 'STANDARD',
      openingFloat: shift.openingFloat,
      closingFloat: closureData.closingFloat,
      expectedCash: shift.expectedCash,
      countedCash: closureData.countedCash,
      cashVariance: closureData.cashVariance,
      tenderReconciliation,
      originalBlindCounts: closureData.originalBlindCounts,
      grossSales: calculated.grossSales || shift.grossSales,
      totalSalesCount: calculated.totalSalesCount || shift.totalSalesCount,
      cashMovements: calculated.cashMovements,
      heldSalesCount: calculated.heldSalesCount,
      heldSalesTotalValue: calculated.heldSalesTotalValue,
      exceptionIds: opts.exceptionIds || [],
      reviewedByStaffName: closureData.managerApproved ? (closureData.managerApprovedBy || opts.closedByStaff?.name) : undefined,
      closureReasonCode: closureData.reasonCode,
      closureNotes: closureData.closingNotes,
      hasAnyDiscrepancy,
      createdAt: formattedDate,
    };
  }

  const shift = shiftOrOptions as Shift;
  const cashVariance = cashVarianceArg || 0;
  const tenderReconciliation = tenderReconciliationArg || [];
  const hasAnyDiscrepancy = Math.abs(cashVariance) > 0.01 || 
    tenderReconciliation.some(t => Math.abs(t.variance || 0) > 0.01);

  return {
    shiftId: shift.id,
    shiftNumber: shift.shiftNumber,
    terminalId: shift.terminalId,
    terminalName: shift.terminalName,
    branchId: shift.branchId,
    branchName: shift.branchName,
    cashierStaffId: shift.cashierStaffId,
    cashierStaffName: shift.cashierStaffName,
    openedDateTime: shift.openedDateTime,
    closedDateTime: formattedDate,
    cashUpMode: cashUpModeArg || 'STANDARD',
    openingFloat: shift.openingFloat,
    closingFloat: closingFloatArg || 0,
    expectedCash: shift.expectedCash,
    countedCash: countedCashArg || shift.expectedCash,
    cashVariance,
    tenderReconciliation,
    originalBlindCounts: originalBlindCountsArg,
    grossSales: shift.grossSales,
    totalSalesCount: shift.totalSalesCount,
    cashMovements: cashMovementsArg || {
      openingFloat: shift.openingFloat,
      cashSales: shift.totalCashSales,
      cashReceipts: shift.totalLayawayReceipts,
      approvedCashIn: 0,
      cashRefunds: shift.totalRefunds,
      approvedCashOut: shift.totalPayouts,
      tillTransfersOut: 0,
      bankingDepositsOut: 0,
      expectedCash: shift.expectedCash,
    },
    heldSalesCount: heldSalesCountArg || 0,
    heldSalesTotalValue: heldSalesTotalValueArg || 0,
    exceptionIds: exceptionIdsArg || [],
    reviewedByStaffName: reviewerNameArg,
    closureReasonCode: closureReasonCodeArg,
    closureNotes: closureNotesArg,
    hasAnyDiscrepancy,
    createdAt: formattedDate,
  };
}
