import { 
  InventoryItem, 
  InventoryMovement, 
  StocktakeSession, 
  StockTransfer, 
  GoodsReceiptNote, 
  OperationalException, 
  ActivityEvent, 
  BusinessRuleDefinition, 
  BusinessRuleResult, 
  ReorderRecommendation, 
  StocktakeRiskSignal, 
  StocktakeRiskLevel, 
  PriceFloorPolicy, 
  PriceFloorEvaluation, 
  OperationalReadinessSnapshot, 
  LicenceInfo, 
  FiscalConfig, 
  SoftwareUpdateInfo 
} from '../types';

// ============================================================================
// 1. DETERMINISTIC BUSINESS RULES DEFINITIONS (VERSIONED)
// ============================================================================
export const SYSTEM_BUSINESS_RULES: BusinessRuleDefinition[] = [
  {
    ruleId: 'RULE-INV-001',
    ruleVersion: 1,
    name: 'Out of Stock Detection',
    category: 'INVENTORY',
    description: 'Triggers when sellable available inventory drops to zero or below.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { minAvailableQuantity: 0 },
    metricKey: 'AVAILABLE_STOCK',
    explanationTemplate: 'Item has {value} available units on hand. Retail checkout is blocked until restocked.',
  },
  {
    ruleId: 'RULE-INV-002',
    ruleVersion: 1,
    name: 'Low Stock Threshold Warning',
    category: 'INVENTORY',
    description: 'Triggers when sellable available quantity is at or below the configured reorder level.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { useConfiguredReorderLevel: true },
    metricKey: 'AVAILABLE_STOCK_VS_REORDER',
    explanationTemplate: 'Available stock ({available}) is at or below the configured reorder level ({reorderLevel}).',
  },
  {
    ruleId: 'RULE-INV-003',
    ruleVersion: 1,
    name: 'Deterministic Reorder Calculation',
    category: 'PURCHASING',
    description: 'Calculates recommended replenishment quantities based on reorder buffer, lead time, and recent consumption.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { defaultLeadTimeDays: 7, safetyBufferMultiplier: 2.0 },
    metricKey: 'SUGGESTED_REORDER_QTY',
    explanationTemplate: 'Replenishment recommended because available stock ({available}) is below reorder level ({reorderLevel}). Target stock: {targetStock}.',
  },
  {
    ruleId: 'RULE-DATA-001',
    ruleVersion: 1,
    name: 'Missing Cost Price Audit',
    category: 'GOVERNANCE',
    description: 'Flags active sellable inventory items that have no unit cost recorded.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { minCost: 0.01 },
    metricKey: 'UNIT_COST',
    explanationTemplate: 'Item has no cost price recorded ($0.00). Gross margins and stock valuation cannot be computed accurately.',
  },
  {
    ruleId: 'RULE-DATA-002',
    ruleVersion: 1,
    name: 'Missing Selling Price Audit',
    category: 'PRICING',
    description: 'Flags active sellable inventory items that have no retail selling price recorded.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { minPrice: 0.01 },
    metricKey: 'RETAIL_PRICE',
    explanationTemplate: 'Item has no retail selling price ($0.00). Normal checkout is blocked by policy.',
  },
  {
    ruleId: 'RULE-PRC-001',
    ruleVersion: 1,
    name: 'Price-Floor & Minimum Margin Protection',
    category: 'PRICING',
    description: 'Evaluates sale line prices against unit cost and minimum allowable gross margin thresholds.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { defaultMinMarginPercent: 15.0 },
    metricKey: 'GROSS_MARGIN_PERCENT',
    explanationTemplate: 'Selling price (${price}) yields a gross margin of {margin}% which is below the allowed price floor of {minMargin}%.',
  },
  {
    ruleId: 'RULE-STK-001',
    ruleVersion: 1,
    name: 'Risk-Weighted Stocktake Prioritization',
    category: 'INVENTORY',
    description: 'Computes transparent deterministic audit priorities based on variance history, adjustments, value, and count age.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: {
      varianceWeight: 3,
      adjustmentsWeight: 2,
      transferDiscrepancyWeight: 2,
      highValueWeight: 2,
      salesVolumeWeight: 1,
      countAgeWeight: 1,
      writeOffWeight: 2,
      urgentScoreThreshold: 6,
      priorityScoreThreshold: 4,
      reviewScoreThreshold: 2,
    },
    metricKey: 'RISK_SCORE',
    explanationTemplate: 'Stocktake priority score is {score} ({level}) based on operational signals: {reasons}.',
  },
  {
    ruleId: 'RULE-OPS-001',
    ruleVersion: 1,
    name: 'Operational Database & Backup Health',
    category: 'GOVERNANCE',
    description: 'Monitors time since last successful database backup and offline sync queue backlog.',
    isEnabled: true,
    effectiveDate: '2026-01-01',
    thresholds: { maxBackupAgeHours: 24, maxPendingSyncRecords: 50 },
    metricKey: 'BACKUP_HOURS_ELAPSED',
    explanationTemplate: 'Database backup is {status}. Offline queue contains {pending} records waiting for sync.',
  },
];

// ============================================================================
// 2. REORDER RECOMMENDATIONS EVALUATOR
// ============================================================================
export function generateReorderRecommendations(
  items: InventoryItem[],
  movements: InventoryMovement[] = []
): ReorderRecommendation[] {
  const recommendations: ReorderRecommendation[] = [];
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

  items.forEach((item) => {
    if (!item.isActive) return;

    const available = item.stockOnHand;
    const reorderLvl = item.reorderLevel || 0;

    // Check if below or equal to reorder level
    if (available <= reorderLvl) {
      // Calculate recent average daily sales from past 30 days of movements
      const itemSalesMovements = movements.filter(
        (m) => m.sku === item.sku && (m.movementType === 'POS Sale' || m.movementType === 'Sale Return' || m.movementType === 'Return')
      );
      const totalUnitsSold = itemSalesMovements.reduce((sum, m) => {
        return sum + (m.direction === 'OUT' ? m.quantity : -m.quantity);
      }, 0);

      const averageDailySales = Math.max(0.5, parseFloat((Math.max(1, totalUnitsSold) / 30).toFixed(1)));
      const supplierLeadTimeDays = 7; // Standard vendor delivery timeframe

      // Target Stock Formula: Max(2 * reorderLevel, reorderLevel + (avgDailySales * leadTimeDays))
      const calculatedTarget = Math.max(
        reorderLvl * 2,
        reorderLvl + Math.ceil(averageDailySales * supplierLeadTimeDays)
      );
      const targetStock = Math.max(calculatedTarget, 10);
      const suggestedReorderQty = Math.max(1, targetStock - available);
      const lastCost = item.unitCost || 0;
      const estimatedCostTotal = suggestedReorderQty * lastCost;

      let reason = `Available stock (${available} units) is at or below the configured reorder level (${reorderLvl} units).`;
      if (itemSalesMovements.length > 0) {
        reason += ` Recent sales velocity (~${averageDailySales} units/day) with ${supplierLeadTimeDays}-day vendor lead time requires a target stock of ${targetStock} units.`;
      } else {
        reason += ` Target stock established at ${targetStock} units based on standard safety buffer.`;
      }

      recommendations.push({
        id: `REC-REORDER-${item.sku}`,
        sku: item.sku,
        itemName: item.name || item.description,
        department: item.department || 'General',
        locationId: 'LOC-MAIN',
        locationName: item.location || 'Main Store Shelf',
        stockOnHand: item.stockOnHand,
        availableStock: available,
        reorderLevel: reorderLvl,
        targetStock,
        averageDailySales,
        supplierLeadTimeDays,
        suggestedReorderQty,
        preferredSupplierCode: item.preferredSupplier ? `SUP-${item.preferredSupplier.toUpperCase().slice(0, 3)}` : 'SUP-GEN',
        preferredSupplierName: item.preferredSupplier || 'Authorized Distributor',
        lastCost,
        estimatedCostTotal,
        reason,
        status: 'NEW',
        ruleVersion: 1,
        createdAt: nowStr,
      });
    }
  });

  return recommendations.sort((a, b) => (a.availableStock - a.reorderLevel) - (b.availableStock - b.reorderLevel));
}

// ============================================================================
// 3. RISK-BASED STOCKTAKE PRIORITIZATION ENGINE
// ============================================================================
export function evaluateStocktakeRiskSignals(
  items: InventoryItem[],
  movements: InventoryMovement[] = [],
  stocktakeSessions: StocktakeSession[] = [],
  transfers: StockTransfer[] = [],
  exceptions: OperationalException[] = []
): StocktakeRiskSignal[] {
  const signals: StocktakeRiskSignal[] = [];

  items.forEach((item) => {
    if (!item.isActive) return;

    let score = 0;
    const reasons: string[] = [];

    // 1. Previous Material Stocktake Variance (+3)
    let previousVarianceUnits = 0;
    let previousVarianceValuation = 0;
    let lastStocktakeDate = 'Never Counted';
    let daysSinceLastCount = 120; // default large if never counted

    // Find latest stocktake containing this item
    for (const session of stocktakeSessions) {
      const match = session.items.find((si) => si.sku === item.sku);
      if (match && match.countedQty !== null) {
        lastStocktakeDate = session.createdDateTime ? (session.createdDateTime.includes(' ') ? session.createdDateTime.split(' ')[0] : session.createdDateTime.split('T')[0]) : 'Never Counted';
        const countDate = new Date(session.createdDateTime);
        const diffMs = Date.now() - countDate.getTime();
        daysSinceLastCount = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        previousVarianceUnits = match.varianceQty;
        previousVarianceValuation = Math.abs(match.varianceValuation);

        if (Math.abs(match.varianceQty) > 0) {
          score += 3;
          reasons.push(`Previous stocktake recorded variance of ${match.varianceQty > 0 ? '+' : ''}${match.varianceQty} units ($${Math.abs(match.varianceValuation).toFixed(2)})`);
        }
        break;
      }
    }

    // 2. Long Time Since Last Physical Count (+1 if > 60 days)
    if (daysSinceLastCount > 60) {
      score += 1;
      reasons.push(`Last physical count was ${daysSinceLastCount} days ago (${lastStocktakeDate})`);
    }

    // 3. Repeated Manual Adjustments (+2)
    const manualAdjustments = movements.filter(
      (m) => m.sku === item.sku && (m.movementType.includes('Adjustment') || m.movementType === 'Approved Manual Adjustment')
    );
    if (manualAdjustments.length >= 2) {
      score += 2;
      reasons.push(`${manualAdjustments.length} manual stock adjustments posted since inception`);
    } else if (manualAdjustments.length === 1) {
      score += 1;
      reasons.push('1 manual stock adjustment posted');
    }

    // 4. Transfer Discrepancies (+2)
    const transferDiscrepancies = exceptions.filter(
      (e) => e.category === 'TRANSFER_DISCREPANCY' && e.title.includes(item.sku)
    );
    if (transferDiscrepancies.length > 0) {
      score += 2;
      reasons.push(`${transferDiscrepancies.length} inter-branch transfer discrepancies logged`);
    }

    // 5. High Inventory Value (+2 if valuation > $500)
    const currentValuation = item.stockOnHand * (item.unitCost || 0);
    if (currentValuation >= 500) {
      score += 2;
      reasons.push(`High inventory holding valuation ($${currentValuation.toFixed(2)})`);
    }

    // 6. High Sales Volume (+1)
    const salesMovements = movements.filter((m) => m.sku === item.sku && m.movementType === 'POS Sale');
    const totalSold = salesMovements.reduce((sum, m) => sum + m.quantity, 0);
    if (totalSold >= 5) {
      score += 1;
      reasons.push(`High transaction turnover (${totalSold} units sold recently)`);
    }

    // 7. Repeated Write-Offs / Damages (+2)
    const writeOffs = movements.filter(
      (m) => m.sku === item.sku && (m.movementType === 'Write-off' || m.movementType === 'Damage')
    );
    if (writeOffs.length > 0) {
      score += 2;
      reasons.push(`${writeOffs.length} write-off / damage events recorded`);
    }

    // Classification
    let riskLevel: StocktakeRiskLevel = 'Routine';
    if (score >= 6) {
      riskLevel = 'Urgent Count';
    } else if (score >= 4) {
      riskLevel = 'Priority Count';
    } else if (score >= 2) {
      riskLevel = 'Review';
    }

    signals.push({
      id: `RISK-${item.sku}`,
      sku: item.sku,
      itemName: item.name || item.description,
      department: item.department || 'General',
      locationId: 'LOC-MAIN',
      locationName: item.location || 'Main Shelf',
      riskScore: score,
      riskLevel,
      lastStocktakeDate,
      daysSinceLastCount,
      previousVarianceUnits,
      previousVarianceValuation,
      recentAdjustmentsCount: manualAdjustments.length,
      recentTransferDiscrepanciesCount: transferDiscrepancies.length,
      recentReturnsCount: movements.filter((m) => m.sku === item.sku && (m.movementType === 'Sale Return' || m.movementType === 'Return')).length,
      recentWriteOffsCount: writeOffs.length,
      stockOnHand: item.stockOnHand,
      unitCost: item.unitCost || 0,
      currentValuation,
      reasons: reasons.length > 0 ? reasons : ['Routine scheduled audit profile'],
    });
  });

  return signals.sort((a, b) => b.riskScore - a.riskScore);
}

// ============================================================================
// 4. DETERMINISTIC PRICE-FLOOR EVALUATION
// ============================================================================
export function evaluatePriceFloor(
  item: InventoryItem,
  attemptedPrice: number,
  policy: PriceFloorPolicy = {
    minimumGrossMarginPercent: 15.0,
    enforceDepartmentFloors: true,
    departmentMinMarginPercents: {
      'Motor Spares': 15.0,
      'Heavy Machinery Parts': 20.0,
      'Consumables': 12.0,
      'Lubricants': 10.0,
    },
    allowSupervisorOverride: true,
    blockOnNegativeMargin: true,
  }
): PriceFloorEvaluation {
  const cost = item.unitCost || 0;
  
  // If cost is missing ($0.00), warn that margin cannot be validated
  if (cost <= 0) {
    return {
      isAllowed: true,
      action: 'WARN',
      sellingPrice: attemptedPrice,
      minimumAllowedPrice: attemptedPrice,
      unitCost: 0,
      expectedMarginPercent: 0,
      minimumMarginPercent: 0,
      marginShortfallPercent: 0,
      reason: `Commercial Data Notice: Item cost is unconfigured ($0.00). Selling at $${attemptedPrice.toFixed(2)} without baseline margin verification.`,
    };
  }

  // Determine required min margin
  let minMargin = policy.minimumGrossMarginPercent;
  if (policy.enforceDepartmentFloors && item.department && policy.departmentMinMarginPercents?.[item.department]) {
    minMargin = policy.departmentMinMarginPercents[item.department];
  }

  // Minimum allowed price formula: cost / (1 - minMargin / 100)
  const minimumAllowedPrice = parseFloat((cost / (1 - minMargin / 100)).toFixed(2));
  
  // Expected margin percent at attempted price: ((Price - Cost) / Price) * 100
  const expectedMarginPercent = attemptedPrice > 0 
    ? parseFloat((((attemptedPrice - cost) / attemptedPrice) * 100).toFixed(1))
    : -100;

  // Negative margin attempt (Price < Cost)
  if (attemptedPrice < cost) {
    return {
      isAllowed: false,
      action: 'BLOCK',
      sellingPrice: attemptedPrice,
      minimumAllowedPrice,
      unitCost: cost,
      expectedMarginPercent,
      minimumMarginPercent: minMargin,
      marginShortfallPercent: parseFloat((minMargin - expectedMarginPercent).toFixed(1)),
      reason: `Negative Margin Violation: Attempted price ($${attemptedPrice.toFixed(2)}) is BELOW unit cost ($${cost.toFixed(2)}). Expected margin: ${expectedMarginPercent}%. Supervisor override required.`,
    };
  }

  // Below price floor margin
  if (attemptedPrice < minimumAllowedPrice) {
    const shortfall = parseFloat((minMargin - expectedMarginPercent).toFixed(1));
    return {
      isAllowed: false,
      action: 'WARN',
      sellingPrice: attemptedPrice,
      minimumAllowedPrice,
      unitCost: cost,
      expectedMarginPercent,
      minimumMarginPercent: minMargin,
      marginShortfallPercent: shortfall,
      reason: `Price-Floor Threshold: Selling at $${attemptedPrice.toFixed(2)} yields ${expectedMarginPercent}% gross margin, which is below the minimum required floor of ${minMargin}% (Shortfall: ${shortfall}%). Minimum allowed price: $${minimumAllowedPrice.toFixed(2)}.`,
    };
  }

  return {
    isAllowed: true,
    action: 'ALLOW',
    sellingPrice: attemptedPrice,
    minimumAllowedPrice,
    unitCost: cost,
    expectedMarginPercent,
    minimumMarginPercent: minMargin,
    marginShortfallPercent: 0,
    reason: `Price Compliant: Selling price of $${attemptedPrice.toFixed(2)} yields healthy gross margin of ${expectedMarginPercent}% (Minimum: ${minMargin}%).`,
  };
}

// ============================================================================
// 5. COMMERCIAL DATA QUALITY AUDIT
// ============================================================================
export interface CommercialDataQualityReport {
  totalItems: number;
  missingCostItems: InventoryItem[];
  missingPriceItems: InventoryItem[];
  missingDepartmentItems: InventoryItem[];
  missingSupplierItems: InventoryItem[];
  missingReorderLevelItems: InventoryItem[];
  duplicateSkuOrBarcodeWarnings: { sku: string; barcode: string; occurrences: number }[];
  incompleteSearchFieldsItems: InventoryItem[];
  overallQualityScore: number; // 0 - 100%
}

export function evaluateCommercialDataQuality(items: InventoryItem[]): CommercialDataQualityReport {
  const activeItems = items.filter((i) => i.isActive);
  const total = activeItems.length || 1;

  const missingCost = activeItems.filter((i) => !i.unitCost || i.unitCost <= 0);
  const missingPrice = activeItems.filter((i) => !i.retailPrice || i.retailPrice <= 0);
  const missingDept = activeItems.filter((i) => !i.department || i.department.trim() === '' || i.department === 'General');
  const missingSupplier = activeItems.filter((i) => !i.preferredSupplier || i.preferredSupplier.trim() === '');
  const missingReorder = activeItems.filter((i) => typeof i.reorderLevel !== 'number' || i.reorderLevel <= 0);
  const incompleteSearch = activeItems.filter((i) => !i.partNumber && !i.oemNumber && !i.barcode);

  // Duplicates check
  const barcodeMap = new Map<string, number>();
  activeItems.forEach((i) => {
    if (i.barcode) barcodeMap.set(i.barcode, (barcodeMap.get(i.barcode) || 0) + 1);
  });
  const duplicateWarnings: { sku: string; barcode: string; occurrences: number }[] = [];
  barcodeMap.forEach((count, barcode) => {
    if (count > 1) {
      const match = activeItems.find((i) => i.barcode === barcode);
      duplicateWarnings.push({ sku: match?.sku || 'UNKNOWN', barcode, occurrences: count });
    }
  });

  // Calculate Quality Score
  const defectsCount = (missingCost.length * 2) + (missingPrice.length * 2) + missingDept.length + missingSupplier.length + missingReorder.length;
  const maxDefects = total * 7;
  const qualityScore = Math.max(10, Math.min(100, Math.round(((maxDefects - defectsCount) / maxDefects) * 100)));

  return {
    totalItems: activeItems.length,
    missingCostItems: missingCost,
    missingPriceItems: missingPrice,
    missingDepartmentItems: missingDept,
    missingSupplierItems: missingSupplier,
    missingReorderLevelItems: missingReorder,
    duplicateSkuOrBarcodeWarnings: duplicateWarnings,
    incompleteSearchFieldsItems: incompleteSearch,
    overallQualityScore: qualityScore,
  };
}

// ============================================================================
// 6. OPERATIONAL READINESS & SYSTEM HEALTH SNAPSHOT
// ============================================================================
export function computeOperationalReadinessSnapshot(
  offlineEventQueue: ActivityEvent[] = [],
  exceptions: OperationalException[] = [],
  fiscalConfig?: FiscalConfig,
  licenseInfo?: LicenceInfo,
  lastBackupDateStr: string = '2026-08-19 00:15'
): OperationalReadinessSnapshot {
  // Check Backup Status
  const backupDate = new Date(lastBackupDateStr.replace(' ', 'T'));
  const hoursSinceBackup = Math.floor((Date.now() - backupDate.getTime()) / (1000 * 60 * 60));
  let backupStatus: 'SUCCESS' | 'BACKUP_DUE' | 'FAILED' | 'IN_PROGRESS' = 'SUCCESS';
  let backupMessage = `Local snapshot verified (${hoursSinceBackup}h ago)`;

  if (hoursSinceBackup > 36) {
    backupStatus = 'FAILED';
    backupMessage = `Backup overdue by ${hoursSinceBackup} hours`;
  } else if (hoursSinceBackup > 20) {
    backupStatus = 'BACKUP_DUE';
    backupMessage = `Scheduled daily backup recommended`;
  }

  // Check Sync & Queue
  const pendingSync = offlineEventQueue.filter((e) => e.syncStatus !== 'SYNCED').length;
  const failedSync = offlineEventQueue.filter((e) => e.syncStatus === 'FAILED').length;

  // Fiscalization Status
  let fiscalStatus: 'NOT_ENABLED' | 'READY' | 'PENDING_DOCUMENTS' | 'ATTENTION_REQUIRED' = 'NOT_ENABLED';
  let fiscalPending = 0;
  if (fiscalConfig && fiscalConfig.fiscalizationEnabled) {
    fiscalPending = fiscalConfig.pendingDocumentsCount || 0;
    if (fiscalConfig.status === 'ACTIVE' && fiscalPending === 0) {
      fiscalStatus = 'READY';
    } else if (fiscalPending > 0) {
      fiscalStatus = 'PENDING_DOCUMENTS';
    } else {
      fiscalStatus = 'ATTENTION_REQUIRED';
    }
  }

  // Licensing Status
  let licenseStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'GRACE_PERIOD' | 'RENEWAL_REQUIRED' = 'ACTIVE';
  if (licenseInfo) {
    if (licenseInfo.activationStatus === 'EXPIRED') {
      licenseStatus = 'RENEWAL_REQUIRED';
    } else if (licenseInfo.activationStatus === 'GRACE_PERIOD') {
      licenseStatus = 'GRACE_PERIOD';
    } else if (licenseInfo.activationStatus === 'REQUIRES_RENEWAL') {
      licenseStatus = 'EXPIRING_SOON';
    }
  }

  // Application Overall Status
  const criticalExceptions = exceptions.filter((e) => (e.status === 'OPEN' || e.status === 'UNDER_REVIEW') && e.severity === 'CRITICAL').length;
  let applicationStatus: 'READY' | 'ATTENTION' | 'WARNING' | 'ERROR' = 'READY';
  if (criticalExceptions > 0 || backupStatus === 'FAILED' || licenseStatus === 'RENEWAL_REQUIRED') {
    applicationStatus = 'ATTENTION';
  }

  return {
    applicationStatus,
    connectivityStatus: navigator.onLine ? 'ONLINE' : 'OFFLINE',
    localDatabaseStatus: 'READY',
    lastSuccessfulBackup: lastBackupDateStr,
    backupStatus,
    backupStatusMessage: backupMessage,
    pendingSyncRecordsCount: pendingSync,
    failedSyncRecordsCount: failedSync,
    lastSuccessfulSync: '2026-08-19 00:50',
    fiscalStatus,
    fiscalPendingCount: fiscalPending,
    licenseStatus,
    licenseExpiryDate: licenseInfo?.expiryDate || '2027-12-31',
    gracePeriodDays: licenseInfo?.gracePeriodDaysRemaining || 14,
  };
}
