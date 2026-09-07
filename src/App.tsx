import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiPut, ApiClientError } from './api/client';
import { 
  AppStage, 
  ActiveView, 
  StaffMember, 
  POStatus,
  Customer,
  Supplier,
  HeldSale,
  HeldReceipt,
  LayawayOrder,
  SaleTransaction,
  CreditNote,
  PaymentMethodType,
  Warehouse,
  Branch,
  Terminal,
  PurchaseMemo,
  PurchaseOrder,
  StockTransfer,
  InventoryMovement,
  StocktakeRecord,
  StockAdjustmentRecord,
  ConnectedShopConfig,
  InventoryItem,
  GoodsReceiptNote,
  Shift,
  EODReport,
  StocktakeSession,
  ApprovalRequest,
  DebtorTransaction,
  CreditorTransaction,
  CashBankAccount,
  CashBankTransaction,
  CashMovementRecord,
  BusinessReserve,
  ReserveTransferRecord,
  TaxFiscalConfig,
  BIRuleAlert,
  BIStatus,
  LicenceInfo,
  SoftwareUpdateInfo,
  PosDevice,
  PaymentMethodConfig,
  FiscalConfig,
  OperationalException,
  ActivityEvent,
  CashUpMode,
  TenderReconciliationEntry,
  ActivityReasonCode,
  ExceptionSeverity,
  BackupRecord,
  CashFlowProjectionEntry,
  DeliveryOrder
} from './types';
import {
  INITIAL_STAFF_MEMBERS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_HELD_SALES,
  INITIAL_HELD_RECEIPTS,
  INITIAL_LAYAWAY_ORDERS,
  INITIAL_SALES_TRANSACTIONS,
  INITIAL_CREDIT_NOTES,
  INITIAL_WAREHOUSES,
  INITIAL_BRANCHES,
  INITIAL_TERMINALS,
  INITIAL_PURCHASE_MEMOS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_STOCK_TRANSFERS,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_STOCKTAKES,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_CONNECTED_SHOPS,
  INITIAL_INVENTORY_ITEMS,
  INITIAL_SHIFTS,
  INITIAL_EOD_REPORTS,
  INITIAL_STOCKTAKE_SESSIONS,
  INITIAL_APPROVAL_REQUESTS,
  INITIAL_DEBTOR_TRANSACTIONS,
  INITIAL_CREDITOR_TRANSACTIONS,
  INITIAL_CASH_BANK_ACCOUNTS,
  INITIAL_CASH_BANK_TRANSACTIONS,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_BUSINESS_RESERVES,
  INITIAL_RESERVE_TRANSFERS,
  INITIAL_TAX_CONFIG,
  INITIAL_LICENCE_INFO,
  INITIAL_SOFTWARE_UPDATE_INFO,
  INITIAL_POS_DEVICES,
  INITIAL_PAYMENT_METHODS_CONFIG,
  INITIAL_FISCAL_CONFIG,
  INITIAL_OPERATIONAL_EXCEPTIONS,
  INITIAL_ACTIVITY_EVENTS,
  INITIAL_BACKUP_MANIFEST,
  CENTRAL_METRIC_DICTIONARY,
  INITIAL_CASH_FLOW_PROJECTIONS
} from './data/mockData';
import { INITIAL_BI_ALERTS } from './data/mockBiData';
import { SplashScreen } from './components/startup/SplashScreen';
import { WelcomeUpdateScreen } from './components/startup/WelcomeUpdateScreen';
import { StaffAccessScreen } from './components/auth/StaffAccessScreen';
import { ActivationScreen, ResolvedTenant } from './components/onboarding/ActivationScreen';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { JoinTenantConfirm } from './components/onboarding/JoinTenantConfirm';
import { BusinessProfileView } from './components/views/system/BusinessProfileView';
import { BIConfigView } from './components/views/bi/BIConfigView';
import { HeaderNav } from './components/layout/HeaderNav';
import { LandingPage } from './components/views/LandingPage';
import { SalesView } from './components/views/sales/SalesView';
import { HeldSalesView } from './components/views/sales/HeldSalesView';
import { HeldReceiptsView } from './components/views/sales/HeldReceiptsView';
import { LayawayView } from './components/views/sales/LayawayView';
import { SalesHistoryView } from './components/views/sales/SalesHistoryView';
import { CreditNotesView } from './components/views/sales/CreditNotesView';
import { DeliveryDispatchView } from './components/views/sales/DeliveryDispatchView';
import { PurchasingView } from './components/views/purchasing/PurchasingView';
import { PurchaseMemoView } from './components/views/purchasing/PurchaseMemoView';
import { ReceiveStockView } from './components/views/purchasing/ReceiveStockView';
import { InventoryItemListView } from './components/views/inventory/InventoryItemListView';
import { InventoryMovementHistoryView } from './components/views/inventory/InventoryMovementHistoryView';
import { WarehouseListView } from './components/views/locations/WarehouseListView';
import { WarehouseDetailView } from './components/views/locations/WarehouseDetailView';
import { BranchListView } from './components/views/locations/BranchListView';
import { BranchDetailView } from './components/views/locations/BranchDetailView';
import { TerminalsListView } from './components/views/locations/TerminalsListView';
import { StockTransfersView } from './components/views/transfers/StockTransfersView';
import { SettingsView } from './components/views/settings/SettingsView';
import { GenericBusinessView } from './components/views/common/GenericBusinessView';
import { ShiftManagementView } from './components/views/shifts/ShiftManagementView';
import { ShiftOpeningModal } from './components/views/shifts/ShiftOpeningModal';
import { ShiftClosureModal } from './components/views/shifts/ShiftClosureModal';
import { EODSummaryView } from './components/views/eod/EODSummaryView';
import { StocktakeView } from './components/views/stocktake/StocktakeView';
import { ApprovalsView } from './components/views/approvals/ApprovalsView';
import { DebtorsView } from './components/views/debtors/DebtorsView';
import { CreditorsView } from './components/views/creditors/CreditorsView';
import { CashBankView } from './components/views/cashbank/CashBankView';
import { CashManagerView } from './components/views/cashmanager/CashManagerView';
import { CashFlowProjectorView } from './components/views/cashflow/CashFlowProjectorView';
import { ReservesView } from './components/views/reserves/ReservesView';
import { TaxFiscalView } from './components/views/tax/TaxFiscalView';
import { BIActivityView } from './components/views/bi/BIActivityView';
import { ReportsCenterView } from './components/views/reports/ReportsCenterView';
import { OnlineUpgradeView } from './components/views/upgrade/OnlineUpgradeView';
import { LicensingView } from './components/views/system/LicensingView';
import { SoftwareUpdatesView } from './components/views/system/SoftwareUpdatesView';
import { DevicesManagementView } from './components/views/system/DevicesManagementView';
import { PaymentMethodsConfigView } from './components/views/system/PaymentMethodsConfigView';
import { FiscalizationView } from './components/views/system/FiscalizationView';
import { ExceptionLedgerView } from './components/views/exceptions/ExceptionLedgerView';
import { ActivityEventsView } from './components/views/activity/ActivityEventsView';
import { MetricDictionaryView } from './components/views/metrics/MetricDictionaryView';
import { ReorderReviewView } from './components/views/inventory/ReorderReviewView';
import { StocktakePrioritiesView } from './components/views/stocktake/StocktakePrioritiesView';
import { CommercialDataQualityView } from './components/views/inventory/CommercialDataQualityView';
import { OperationalReadinessView } from './components/views/system/OperationalReadinessView';
import { DataProtectionBackupView } from './components/views/system/DataProtectionBackupView';
import { RestoreDataView } from './components/views/system/RestoreDataView';
import { DatabaseIntegrityView } from './components/views/system/DatabaseIntegrityView';
import { InventoryAttentionCenterView } from './components/views/inventory/InventoryAttentionCenterView';
import { AccessRestrictedView } from './components/common/AccessRestrictedView';
import { canAccessView, canAccessViewWithModuleLock, isBackOfficeAccessRole, isModuleLockedView } from './utils/accessRoleGate';
import { useModuleLock } from './hooks/useModuleLock';
import { 
  generateReorderRecommendations, 
  evaluateStocktakeRiskSignals, 
  evaluateCommercialDataQuality, 
  computeOperationalReadinessSnapshot 
} from './utils/deterministicRulesEngine';
import { 
  ReorderRecommendation,
  ReorderRecommendationStatus,
  StocktakeRiskSignal, 
  OperationalReadinessSnapshot 
} from './types';

export default function App() {
  const [appStage, setAppStage] = useState<AppStage>('SPLASH');
  const [currentStaff, setCurrentStaff] = useState<StaffMember>(INITIAL_STAFF_MEMBERS[0]);
  const [activeView, setActiveView] = useState<ActiveView>('LANDING');
  // DL-040/DL-048: polled at launch + every 15 minutes, and re-checked on
  // navigation into a locked-eligible view below (handleNavigate) — so a
  // terminal left open across the expiry+grace boundary still locks out
  // Sales/Purchasing without requiring a restart.
  const moduleLock = useModuleLock();
  const [navigationParams, setNavigationParams] = useState<any>(null);

  // Application State for Transactions and Commerce Entities
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [heldSales, setHeldSales] = useState<HeldSale[]>(INITIAL_HELD_SALES);
  const [heldReceipts, setHeldReceipts] = useState<HeldReceipt[]>(INITIAL_HELD_RECEIPTS);
  const [layawayOrders, setLayawayOrders] = useState<LayawayOrder[]>(INITIAL_LAYAWAY_ORDERS);
  const [salesTransactions, setSalesTransactions] = useState<SaleTransaction[]>(INITIAL_SALES_TRANSACTIONS);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(INITIAL_CREDIT_NOTES);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);

  // Phase 4 Multi-Location, Logistics & Purchasing State
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(INITIAL_WAREHOUSES[0]?.id || 'WH-01');
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(INITIAL_BRANCHES[0]?.id || 'BR-01');
  const [terminals, setTerminals] = useState<Terminal[]>(INITIAL_TERMINALS);
  const [purchaseMemos, setPurchaseMemos] = useState<PurchaseMemo[]>(INITIAL_PURCHASE_MEMOS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(INITIAL_STOCK_TRANSFERS);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(INITIAL_INVENTORY_MOVEMENTS);
  const [stocktakes, setStocktakes] = useState<StocktakeRecord[]>(INITIAL_STOCKTAKES);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>(INITIAL_STOCK_ADJUSTMENTS);
  const [connectedShops, setConnectedShops] = useState<ConnectedShopConfig[]>(INITIAL_CONNECTED_SHOPS);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(INITIAL_INVENTORY_ITEMS);

  // Phase 5 Shift, EOD, Stocktake & Governance State
  const [shifts, setShifts] = useState<Shift[]>(INITIAL_SHIFTS);
  // TERM-01 matches a real seeded terminals row so shift-open/checkout can
  // resolve it server-side; 'POS-D01' (the old default) doesn't exist in the
  // backend. Real terminal binding belongs to the still-open LicensingView/
  // installation_config wiring gap noted in the Prompt 3 plan, not this one.
  const [currentTerminalId, setCurrentTerminalId] = useState<string>('TERM-01');
  const [eodReports, setEodReports] = useState<EODReport[]>(INITIAL_EOD_REPORTS);
  const [stocktakeSessions, setStocktakeSessions] = useState<StocktakeSession[]>(INITIAL_STOCKTAKE_SESSIONS);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(INITIAL_APPROVAL_REQUESTS);
  const [isShiftOpeningModalOpen, setIsShiftOpeningModalOpen] = useState<boolean>(false);
  const [closureShiftTarget, setClosureShiftTarget] = useState<Shift | null>(null);
  const [hasCheckedShiftOnEntry, setHasCheckedShiftOnEntry] = useState<boolean>(false);
  const [hasFetchedBackOfficeData, setHasFetchedBackOfficeData] = useState<boolean>(false);

  // Phase 6 Financial Control & Treasury State
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [debtorTransactions, setDebtorTransactions] = useState<DebtorTransaction[]>(INITIAL_DEBTOR_TRANSACTIONS);
  const [creditorTransactions, setCreditorTransactions] = useState<CreditorTransaction[]>(INITIAL_CREDITOR_TRANSACTIONS);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>(INITIAL_CASH_BANK_ACCOUNTS);
  const [cashBankTransactions, setCashBankTransactions] = useState<CashBankTransaction[]>(INITIAL_CASH_BANK_TRANSACTIONS);
  const [cashMovements, setCashMovements] = useState<CashMovementRecord[]>(INITIAL_CASH_MOVEMENTS);
  const [reserves, setReserves] = useState<BusinessReserve[]>(INITIAL_BUSINESS_RESERVES);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransferRecord[]>(INITIAL_RESERVE_TRANSFERS);
  const [taxConfig, setTaxConfig] = useState<TaxFiscalConfig>(INITIAL_TAX_CONFIG);
  const [cashFlowProjections, setCashFlowProjections] = useState<CashFlowProjectionEntry[]>(INITIAL_CASH_FLOW_PROJECTIONS);

  // Phase 7 Local BI & Reporting State
  const [biAlerts, setBiAlerts] = useState<BIRuleAlert[]>(INITIAL_BI_ALERTS);

  // Phase 8 Licensing, Updates, Devices & Fiscalization State
  const [licenceInfo, setLicenceInfo] = useState<LicenceInfo>(INITIAL_LICENCE_INFO);
  const [softwareUpdateInfo, setSoftwareUpdateInfo] = useState<SoftwareUpdateInfo>(INITIAL_SOFTWARE_UPDATE_INFO);
  const [posDevices, setPosDevices] = useState<PosDevice[]>(INITIAL_POS_DEVICES);
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<PaymentMethodConfig[]>(INITIAL_PAYMENT_METHODS_CONFIG);
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig>(INITIAL_FISCAL_CONFIG);

  // MVP Accountability Foundations: Exceptions Ledger & Immutable Activity Events Stream
  const [operationalExceptions, setOperationalExceptions] = useState<OperationalException[]>(INITIAL_OPERATIONAL_EXCEPTIONS);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(INITIAL_ACTIVITY_EVENTS);

  const handleUpdateException = (updated: OperationalException) => {
    setOperationalExceptions((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    
    // Auto-record an immutable Activity Event for the sign-off / resolution
    const newEvent: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: updated.category === 'STOCKTAKE_VARIANCE' || updated.category === 'STOCK_ADJUSTMENT'
        ? 'STOCK_ADJUSTMENT_APPROVED'
        : 'VARIANCE_CREATED',
      description: `Exception ${updated.exceptionNumber} (${updated.title}) set to ${updated.status} by ${currentStaff.name}. ${updated.resolution || ''}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: updated.branchId || 'BR-01',
      branchName: updated.branchName || 'Main Store Downtown',
      terminalId: updated.terminalId || currentTerminalId,
      referenceDocument: updated.relatedTransactionRef || updated.exceptionNumber,
      amount: updated.varianceAmount,
      quantity: updated.varianceUnits,
      metadata: {
        exceptionId: updated.id,
        category: updated.category,
        severity: updated.severity,
        status: updated.status,
      }
    };
    setActivityEvents((prev) => [newEvent, ...prev]);
  };

  const handleUpdateLicence = (updated: LicenceInfo) => {
    setLicenceInfo(updated);
  };

  const handleUpdateSoftwareInfo = (updated: SoftwareUpdateInfo) => {
    setSoftwareUpdateInfo(updated);
  };

  const handleUpdateDevice = (updated: PosDevice) => {
    setPosDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAddDevice = (newDevice: PosDevice) => {
    setPosDevices((prev) => [...prev, newDevice]);
  };

  const handleUpdatePaymentMethodConfig = (updated: PaymentMethodConfig) => {
    setPaymentMethodsConfig((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleUpdateFiscalConfig = (updated: FiscalConfig) => {
    setFiscalConfig(updated);
  };

  // Phase 9 Deterministic Inventory Intelligence State
  const [reorderRecommendations, setReorderRecommendations] = useState<ReorderRecommendation[]>(() => 
    generateReorderRecommendations(INITIAL_INVENTORY_ITEMS, INITIAL_INVENTORY_MOVEMENTS)
  );
  const [lastBackupTime, setLastBackupTime] = useState<string>('2026-08-19 01:10');
  const [lastSyncTime, setLastSyncTime] = useState<string>('2026-08-19 01:15');
  const [offlineEventQueue, setOfflineEventQueue] = useState<ActivityEvent[]>([]);

  // Phase 10 Backup, Restore & Offline Integrity State
  const [backups, setBackups] = useState<BackupRecord[]>(INITIAL_BACKUP_MANIFEST);
  const [selectedRestoreBackupId, setSelectedRestoreBackupId] = useState<string | undefined>(undefined);

  const handleAddBackup = (newBackup: BackupRecord) => {
    setBackups((prev) => [newBackup, ...prev]);
    setLastBackupTime(newBackup.createdAt);
  };

  const handleAddOperationalException = (exc: Partial<OperationalException>) => {
    const newExc: OperationalException = {
      id: exc.id || `EXC-${Date.now()}`,
      exceptionNumber: exc.exceptionNumber || `EXC-${Date.now().toString().slice(-4)}`,
      title: exc.title || 'Operational System Exception',
      category: exc.category || 'DATABASE_INTEGRITY_FAILURE',
      severity: exc.severity || 'HIGH',
      status: exc.status || 'OPEN',
      dateTime: exc.dateTime || new Date().toISOString().replace('T', ' ').slice(0, 19),
      details: exc.details || 'Operational exception recorded.',
      staffId: exc.staffId || currentStaff.id,
      staffName: exc.staffName || currentStaff.name,
      terminalId: exc.terminalId || currentTerminalId,
      branchId: exc.branchId || 'BR-01',
      branchName: exc.branchName || 'Main Store Downtown',
      resolution: exc.resolution,
      ...exc
    };
    setOperationalExceptions((prev) => [newExc, ...prev]);
  };

  // Derived Operational Readiness Snapshot
  const operationalReadiness = computeOperationalReadinessSnapshot(
    offlineEventQueue,
    operationalExceptions,
    fiscalConfig,
    licenceInfo,
    lastBackupTime
  );

  const handleUpdateReorderStatus = (recId: string, newStatus: ReorderRecommendationStatus, notes?: string) => {
    const targetRec = reorderRecommendations.find(r => r.id === recId);
    const reviewedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);

    setReorderRecommendations((prev) =>
      prev.map((rec) =>
        rec.id === recId
          ? { ...rec, status: newStatus, decisionNotes: notes || rec.decisionNotes, reviewedByStaffName: currentStaff.name, reviewedAt }
          : rec
      )
    );

    if (targetRec) {
      apiPatch(`/inventory/reorder-recommendations/${encodeURIComponent(recId)}`, {
        recommendation: targetRec,
        status: newStatus,
        decisionNotes: notes,
      }).catch((err) => console.error('Failed to persist reorder recommendation decision', err));

      const event: ActivityEvent = {
        id: `EVT-${Date.now()}`,
        timestamp: reviewedAt,
        eventType: newStatus === 'ACCEPTED' ? 'REORDER_RECOMMENDATION_ACCEPTED' : 'REORDER_RECOMMENDATION_IGNORED',
        description: `Reorder recommendation for ${targetRec.sku} (${targetRec.itemName}) marked as ${newStatus} by ${currentStaff.name}. ${notes || ''}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        branchId: 'BR-01',
        branchName: 'Main Store',
        referenceDocument: targetRec.sku,
        quantity: targetRec.suggestedReorderQty,
      };
      setActivityEvents((prev) => [event, ...prev]);
    }
  };

  const handleCreateMemoFromReorders = (selectedRecs: ReorderRecommendation[]) => {
    const memoNumber = `MEMO-${Date.now().toString().slice(-4)}`;
    const newMemo: PurchaseMemo = {
      id: `memo-${Date.now()}`,
      memoNumber,
      requestDate: new Date().toISOString().split('T')[0],
      department: 'General Merchandising',
      destinationWarehouseId: 'WH-01',
      destinationWarehouseName: 'Main Store Floor',
      priority: 'MEDIUM',
      requestedByStaffId: currentStaff.id,
      requestedByStaffName: currentStaff.name,
      status: 'Submitted',
      notes: `Generated from deterministic reorder recommendations (${selectedRecs.length} items).`,
      items: selectedRecs.map((rec) => ({
        sku: rec.sku,
        description: rec.itemName,
        requestedQty: rec.suggestedReorderQty,
        estimatedUnitCost: rec.lastCost,
        notes: `Preferred Supplier: ${rec.preferredSupplierName || rec.preferredSupplierCode || 'Standard Wholesaler'}`,
      })),
    };

    handleCreatePurchaseMemo(newMemo);

    // Mark recommendations as accepted/converted
    selectedRecs.forEach(r => handleUpdateReorderStatus(r.id, 'ACCEPTED', `Converted to Memo ${memoNumber}`));

    // Emit event
    const totalEst = selectedRecs.reduce((acc, r) => acc + (r.suggestedReorderQty * r.lastCost), 0);
    const event: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      eventType: 'REORDER_RECOMMENDATION_CONVERTED',
      description: `Purchase Memo ${memoNumber} generated from ${selectedRecs.length} reorder recommendations. Total est. cost: $${totalEst.toFixed(2)}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: 'BR-01',
      branchName: 'Main Store',
      referenceDocument: memoNumber,
      amount: totalEst,
    };
    setActivityEvents((prev) => [event, ...prev]);

    handleNavigate('PURCHASE_MEMO');
  };

  const handleCreatePOFromReorders = (selectedRecs: ReorderRecommendation[]) => {
    const poNumber = `PO-${Date.now().toString().slice(-4)}`;
    // Reorder recommendations already carry their own preferred-supplier
    // fields (per-SKU) — with a mixed-supplier selection this collapses to
    // the first item's supplier, matching this being a single-supplier PO.
    const firstRec = selectedRecs[0];
    const matchedSupplier = (suppliers || []).find((s) => s.code === firstRec?.preferredSupplierCode);
    const supplier = matchedSupplier || {
      name: firstRec?.preferredSupplierName || 'Standard Supplier',
      code: firstRec?.preferredSupplierCode || 'SUP-101',
      paymentTerms: 'Net 30 Days',
    };
    const totalAmount = selectedRecs.reduce((acc, r) => acc + (r.suggestedReorderQty * r.lastCost), 0);

    const newPO: PurchaseOrder = {
      poNumber,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      dateCreated: new Date().toISOString().split('T')[0],
      deliveryDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      destinationWarehouseId: 'WH-01',
      destinationWarehouseName: 'Main Store Floor',
      totalItems: selectedRecs.length,
      subtotal: totalAmount,
      totalAmount,
      currency: 'USD',
      status: 'Open',
      paymentTerms: supplier.paymentTerms || 'Net 30 Days',
      authorizedBy: currentStaff?.name || 'Authorized Manager',
      notes: `Drafted from deterministic replenishment rule evaluation.`,
      items: selectedRecs.map((rec) => ({
        sku: rec.sku,
        description: rec.itemName,
        orderedQty: rec.suggestedReorderQty,
        receivedQty: 0,
        unitCost: rec.lastCost,
        totalCost: rec.suggestedReorderQty * rec.lastCost,
      })),
    };

    handleCreatePurchaseOrder(newPO);

    // Mark recommendations as accepted/converted
    selectedRecs.forEach(r => handleUpdateReorderStatus(r.id, 'ACCEPTED', `Converted to PO ${poNumber}`));

    const event: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      eventType: 'REORDER_RECOMMENDATION_CONVERTED',
      description: `Draft Purchase Order ${poNumber} created for supplier ${supplier.name} with ${selectedRecs.length} items. Total: $${totalAmount.toFixed(2)}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: 'BR-01',
      branchName: 'Main Store',
      referenceDocument: poNumber,
      amount: totalAmount,
    };
    setActivityEvents((prev) => [event, ...prev]);

    handleNavigate('PO_LIST');
  };

  const handleInitiateStocktakeForRiskItems = async (skus: string[], sessionName?: string) => {
    const targetItems = inventoryItems.filter(i => skus.includes(i.sku));
    const newSessionId = `ST-${Date.now()}`;
    const draftSession: StocktakeSession = {
      id: newSessionId,
      sessionNumber: `STK-${Date.now().toString().slice(-4)}`,
      title: sessionName || `Risk-weighted priority count for ${skus.length} targeted items`,
      locationId: 'WH-01',
      locationType: 'WAREHOUSE',
      locationName: 'Main Store Floor',
      isBlindCount: true,
      status: 'COUNTING',
      createdByStaffId: currentStaff.id,
      createdByStaffName: currentStaff.name,
      createdDateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      approvalRequired: false,
      notes: sessionName || `Risk-weighted priority count for ${skus.length} targeted items.`,
      items: targetItems.map((item) => ({
        sku: item.sku,
        barcode: item.barcode,
        name: item.name || item.description,
        category: item.department || 'General',
        unitCost: item.unitCost,
        retailPrice: item.retailPrice,
        bookQty: item.stockOnHand,
        countedQty: null,
        varianceQty: 0,
        varianceValuation: 0,
      })),
      totalExpectedUnits: targetItems.reduce((sum, i) => sum + i.stockOnHand, 0),
      totalCountedUnits: 0,
      totalVarianceUnits: 0,
      totalVarianceValuation: 0,
    };

    try {
      const saved = await apiPost<StocktakeSession>('/stocktake/sessions', draftSession);
      setStocktakeSessions((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('Failed to create stocktake session', err);
      setStocktakeSessions((prev) => [draftSession, ...prev]);
    }

    handleNavigate('STOCKTAKE');
  };

  const handleUpdateItemMasterFromAudit = (updatedItem: InventoryItem) => {
    setInventoryItems((prev) => prev.map(i => i.sku === updatedItem.sku ? updatedItem : i));

    const event: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      eventType: 'STOCK_ADJUSTMENT_POSTED',
      description: `Master catalog attributes updated for SKU ${updatedItem.sku} (${updatedItem.name}). Retail: $${updatedItem.retailPrice.toFixed(2)}, Cost: $${updatedItem.unitCost.toFixed(2)}, Reorder: ${updatedItem.reorderLevel}.`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: 'BR-01',
      branchName: 'Main Store',
      referenceDocument: updatedItem.sku,
    };
    setActivityEvents((prev) => [event, ...prev]);
  };

  const handleTriggerBackup = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const dateFormatted = timestamp.slice(0, 10).replace(/-/g, '');
    const timeFormatted = timestamp.slice(11, 19).replace(/:/g, '');
    const newBak: BackupRecord = {
      backupId: `BAK-${dateFormatted}-${timeFormatted}`,
      type: 'MANUAL',
      createdAt: timestamp,
      applicationVersion: '1.2.0',
      schemaVersion: 17,
      filePath: `C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\Manual\\itredcommerce_${dateFormatted}_${timeFormatted}.sqlite.bak`,
      fileSize: 8452100 + Math.floor(Math.random() * 20000),
      verificationStatus: 'VERIFIED',
      checksum: `sha256:${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      tenantId: 'TENANT-ITRED-001',
      tablesCount: 28,
      recordsCount: 4280 + inventoryItems.length,
      walCheckpointCompleted: true,
      notes: `Manual snapshot generated from operational readiness console by ${currentStaff.name}.`,
      initiatedByStaffId: currentStaff.id,
      initiatedByStaffName: currentStaff.name
    };
    handleAddBackup(newBak);
    setLastBackupTime(timestamp.slice(0, 16));
  };

  const handleTriggerSyncRetry = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setLastSyncTime(timestamp);
    setOfflineEventQueue([]);
  };

  const handleUpdateAlertStatus = (
    alertId: string,
    newStatus: BIStatus,
    userNotes?: string,
    actionName?: string
  ) => {
    setBiAlerts((prev) =>
      prev.map((alert) => {
        if (alert.id === alertId) {
          return {
            ...alert,
            status: newStatus,
            userResponse: {
              action: actionName || `Status changed to ${newStatus}`,
              notes: userNotes,
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              staffId: currentStaff.id,
              staffName: currentStaff.name
            }
          };
        }
        return alert;
      })
    );
  };

  // On entering the main app: pull the real product catalog, customer list,
  // and this terminal's currently-open shift (if any) from the backend
  // before deciding whether to prompt for a shift open — using the mock
  // `shifts` state here would race the fetch and could show a stale "shift
  // already open" that doesn't exist server-side (checkout would then fail
  // with an unknown-shift error).
  useEffect(() => {
    if (appStage !== 'MAIN_APP' || hasCheckedShiftOnEntry) return;
    setHasCheckedShiftOnEntry(true);

    (async () => {
      try {
        const [items, customerList, currentShift] = await Promise.all([
          apiGet<InventoryItem[]>('/inventory/items'),
          apiGet<Customer[]>('/customers'),
          apiGet<Shift | null>(`/shifts/current?terminalId=${encodeURIComponent(currentTerminalId)}`),
        ]);
        setInventoryItems(items);
        setCustomers(customerList);
        // Replace this terminal's shift state with the real backend truth —
        // otherwise a stale mock-seeded "open" shift for this terminal can
        // never be cleared and permanently blocks opening a real one.
        setShifts((prev) => {
          const withoutThisTerminal = prev.filter((s) => s.terminalId !== currentTerminalId);
          return currentShift ? [currentShift, ...withoutThisTerminal] : withoutThisTerminal;
        });
        if (!currentShift || currentShift.status === 'REQUIRES_CLOSURE') {
          setIsShiftOpeningModalOpen(true);
        }
      } catch {
        // Backend unreachable — fall back to whatever the mock-seeded local
        // state already has rather than blocking app entry entirely.
        const activeOrUnclosedShift = shifts.find(
          (s) => s.terminalId === currentTerminalId && (s.status === 'OPEN' || s.status === 'REQUIRES_CLOSURE')
        );
        if (!activeOrUnclosedShift || activeOrUnclosedShift.status === 'REQUIRES_CLOSURE') {
          setIsShiftOpeningModalOpen(true);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStage, hasCheckedShiftOnEntry, currentTerminalId]);

  // Head-office-only data: fetched once per session, only for a back-office
  // accessRole (DL-002/DL-005) — a till-operator session never needs these
  // and the routes are gated server-side anyway, so skipping the fetch for
  // them avoids a guaranteed-403 round trip on every login.
  useEffect(() => {
    if (appStage !== 'MAIN_APP' || hasFetchedBackOfficeData || !isBackOfficeAccessRole(currentStaff.accessRole)) return;
    setHasFetchedBackOfficeData(true);

    (async () => {
      try {
        const [memos, orders, transfers, sessions, allItems, salesHistory, shiftsHistory, approvals] = await Promise.all([
          apiGet<PurchaseMemo[]>('/purchasing/memos'),
          apiGet<PurchaseOrder[]>('/purchasing/orders'),
          apiGet<StockTransfer[]>('/transfers'),
          apiGet<StocktakeSession[]>('/stocktake/sessions'),
          // Head office needs inactive/discontinued items too (to review and
          // reactivate them) — the till's own fetch omits this deliberately.
          apiGet<InventoryItem[]>('/inventory/items?includeInactive=true'),
          // Full history for Reports Center (REPORTS_CENTER is head-office-only).
          apiGet<SaleTransaction[]>('/sales'),
          apiGet<Shift[]>('/shifts'),
          // Real approval_requests rows (DL-065 follow-up) — replaces the
          // mock-only INITIAL_APPROVAL_REQUESTS seed, which never reflected
          // BI Brain-generated BI_RULE_REDIRECT tickets or any real decision.
          apiGet<ApprovalRequest[]>('/approvals'),
        ]);
        setPurchaseMemos(memos);
        setPurchaseOrders(orders);
        setStockTransfers(transfers);
        setStocktakeSessions(sessions);
        setInventoryItems(allItems);
        setSalesTransactions(salesHistory);
        setApprovalRequests(approvals);
        // Preserve whichever shift the shift-check effect established for
        // this terminal; backfill full cross-terminal history around it.
        setShifts((prev) => {
          const currentTerminalShift = prev.find((s) => s.terminalId === currentTerminalId);
          const rest = shiftsHistory.filter((s) => s.terminalId !== currentTerminalId);
          return currentTerminalShift ? [currentTerminalShift, ...rest] : rest;
        });
      } catch (err) {
        console.error('Failed to fetch head-office data', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStage, hasFetchedBackOfficeData, currentStaff.accessRole]);

  // Delivery dispatch history (Prompt 7) — both till operators and
  // head-office staff can create/view these, unlike the head-office-only
  // fetch above.
  useEffect(() => {
    if (appStage !== 'MAIN_APP') return;
    (async () => {
      try {
        const orders = await apiGet<DeliveryOrder[]>('/delivery-orders');
        setDeliveryOrders(orders);
      } catch (err) {
        console.error('Failed to fetch delivery orders', err);
      }
    })();
  }, [appStage]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when on splash or auth screens
      if (appStage !== 'MAIN_APP') return;

      // Avoid intercepting inside text inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        handleNavigate('SALES_CASH');
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleNavigate('SALES_CREDIT');
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleNavigate('HELD_SALES');
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleNavigate('SALES_RETURN');
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleNavigate('LAYAWAY');
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleNavigate('EOD_REPORT');
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleNavigate('BI_ACTIVITY');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleNavigate('REPORTS_CENTER');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleNavigate('PURCHASE_ORDER');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleNavigate('BACKUP_RESTORE');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // currentStaff.accessRole is a dep (not just appStage) so a mid-session
    // "Switch Operator" re-subscribes hotkeys against the new role's gate
    // instead of keeping a stale closure over the previous operator's role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStage, currentStaff.accessRole]);

  const handleNavigate = (view: ActiveView, params?: any) => {
    // DL-002/DL-005/DL-040/DL-048 gate — every user-initiated navigation
    // (menu clicks, hotkeys, in-view "back to X" buttons) funnels through
    // here, so this is the single point that keeps a till-operator session
    // out of head-office-only views, and a locked terminal out of
    // Sales/Purchasing. See src/utils/accessRoleGate.ts.
    if (!canAccessViewWithModuleLock(currentStaff.accessRole, view, moduleLock.locked)) return;
    // Re-check the lock itself (not just gate on the last poll) whenever a
    // session is about to enter a view the lock could affect — DL-040's own
    // "not just once at startup" requirement, cheaper than a tighter global
    // poll interval since this only fires on relevant navigation.
    if (isModuleLockedView(view)) moduleLock.refresh();
    setActiveView(view);
    setNavigationParams(params || null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleStaffAuthenticated = (staff: StaffMember) => {
    setCurrentStaff(staff);
    setAppStage('MAIN_APP');
  };

  // Business Profile onboarding — see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
  // Business Profile Onboarding addendum. An already-provisioned install
  // (env.tenantId already set server-side) skips straight past ACTIVATION
  // to STAFF_ACCESS exactly as before this feature existed; only a fresh
  // install sees the new gate.
  const [onboardingActivationCode, setOnboardingActivationCode] = useState<string>('');
  const [onboardingPairingCode, setOnboardingPairingCode] = useState<string>('');
  const [onboardingJoinInfo, setOnboardingJoinInfo] = useState<ResolvedTenant | null>(null);

  const handleContinueFromWelcome = async () => {
    try {
      const { needsOnboarding } = await apiGet<{ needsOnboarding: boolean }>('/onboarding/status');
      setAppStage(needsOnboarding ? 'ACTIVATION' : 'STAFF_ACCESS');
    } catch {
      // Unreachable backend — fall through to the normal staff-access
      // screen, which already has its own "unable to reach server" state.
      setAppStage('STAFF_ACCESS');
    }
  };

  const handleLockSession = () => {
    setAppStage('STAFF_ACCESS');
  };

  const handleSwitchStaff = () => {
    setAppStage('STAFF_ACCESS');
  };

  // Sales Transaction Event Handlers - Hardened Atomic Commit
  const handleRecordCompletedSale = (newSale: SaleTransaction) => {
    // 1. Immutable Sales Register Commit
    setSalesTransactions((prev) => [newSale, ...prev]);

    // 2. Decrement Stock on Hand in live Inventory Items
    setInventoryItems((prev) =>
      prev.map((inv) => {
        const soldLine = newSale.items.find((line) => line.item.sku === inv.sku || (line.sku && line.sku === inv.sku));
        if (soldLine) {
          const newSOH = Math.max(0, inv.stockOnHand - soldLine.quantity);
          let newStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
          if (newSOH <= 0) {
            newStatus = 'Out of Stock';
          } else if (newSOH <= (inv.reorderPoint || inv.minStockLevel || 5)) {
            newStatus = 'Low Stock';
          }
          return {
            ...inv,
            stockOnHand: newSOH,
            status: newStatus,
          };
        }
        return inv;
      })
    );

    // 3. Record immutable Inventory Movements for each dispensed item
    const branchLoc = (branches || []).find((b) => b.id === (newSale.branchId || selectedBranchId)) || branches?.[0] || { id: 'BR-01', name: 'Downtown Branch' };
    const newMovements: InventoryMovement[] = newSale.items.map((line, idx) => {
      const unitCost = line.unitCostBasis ?? line.item.unitCost ?? line.item.cost ?? 0;
      return {
        id: `MOV-POS-${Date.now()}-${idx}-${line.item.sku}`,
        timestamp: newSale.dateTime,
        movementType: 'POS Sale',
        sku: line.item.sku,
        itemName: line.itemName || line.item.name || line.item.description,
        quantity: -line.quantity,
        unitCost,
        totalValue: line.quantity * unitCost,
        sourceLocationId: newSale.branchId || branchLoc?.id || 'BR-01',
        sourceLocationName: newSale.branchName || branchLoc?.name || 'Main Retail Storefront',
        referenceDocument: newSale.saleNumber,
        staffId: newSale.cashier.id,
        staffName: newSale.cashier.name,
      };
    });
    setInventoryMovements((prev) => [...newMovements, ...prev]);

    // 4. Update Customer Credit Balances if Customer Credit was tendered
    const creditPayment = newSale.payments.find((p) => p.method === 'CUSTOMER_CREDIT');
    if (creditPayment && creditPayment.amount > 0 && newSale.customer.id !== 'CUST-WALKIN') {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === newSale.customer.id) {
            const newBalance = c.currentBalance + creditPayment.amount;
            const newAvailable = Math.max(0, c.creditLimit - newBalance);
            return {
              ...c,
              currentBalance: newBalance,
              availableCredit: newAvailable,
            };
          }
          return c;
        })
      );
    }

    // 5. Update Shift Running Sales Metrics & Expected Cash Float
    setShifts((prev) =>
      prev.map((s) => {
        const isMatchingShift = s.id === newSale.shiftId || (s.terminalId === newSale.terminalId && s.status === 'OPEN');
        if (isMatchingShift) {
          const cashAmount = newSale.payments
            .filter((p) => p.method === 'CASH')
            .reduce((sum, p) => sum + p.amount, 0) - (newSale.changeGiven || 0);
          const cardAmount = newSale.payments
            .filter((p) => p.method === 'DEBIT_CARD')
            .reduce((sum, p) => sum + p.amount, 0);
          const mmAmount = newSale.payments
            .filter((p) => p.method === 'MOBILE_MONEY')
            .reduce((sum, p) => sum + p.amount, 0);
          const creditAmount = newSale.payments
            .filter((p) => p.method === 'CUSTOMER_CREDIT')
            .reduce((sum, p) => sum + p.amount, 0);

          return {
            ...s,
            totalSalesCount: s.totalSalesCount + 1,
            grossSales: s.grossSales + newSale.grandTotal,
            totalCashSales: s.totalCashSales + Math.max(0, cashAmount),
            totalCardSales: s.totalCardSales + cardAmount,
            totalMobileMoneySales: s.totalMobileMoneySales + mmAmount,
            totalCreditSales: s.totalCreditSales + creditAmount,
            expectedCash: s.expectedCash + Math.max(0, cashAmount),
          };
        }
        return s;
      })
    );

    // 6. Write Immutable Audit Activity Event (Event-Sourced Outbox Pattern)
    const totalUnits = newSale.items.reduce((sum, i) => sum + i.quantity, 0);
    const saleEvt: ActivityEvent = {
      id: `EVT-SALE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: newSale.dateTime,
      eventType: newSale.transactionType === 'CREDIT_SALE' ? 'CREDIT_SALE_RECORDED' : 'SALE_COMPLETED',
      description: `Sale #${newSale.saleNumber} (${newSale.transactionType}) finalized by ${newSale.cashier.name} on ${newSale.terminalId || 'POS-D01'} for customer ${newSale.customer.name}. Total: $${newSale.grandTotal.toFixed(2)} (${totalUnits} units).`,
      staffId: newSale.cashier.id,
      staffName: newSale.cashier.name,
      branchId: newSale.branchId || branchLoc?.id || 'BR-01',
      branchName: newSale.branchName || branchLoc?.name || 'Main Retail Storefront',
      terminalId: newSale.terminalId || 'POS-D01',
      referenceDocument: newSale.saleNumber,
      amount: newSale.grandTotal,
      quantity: totalUnits,
      metadata: {
        saleId: newSale.saleId,
        saleNumber: newSale.saleNumber,
        shiftId: newSale.shiftId,
        payments: newSale.payments,
        itemCount: newSale.items.length,
        idempotencyKey: newSale.idempotencyKey,
      }
    };
    setActivityEvents((prev) => [saleEvt, ...prev]);
  };

  const handleRecordHeldSale = (newHeld: HeldSale) => {
    setHeldSales((prev) => [newHeld, ...prev]);
  };

  const handleParkCart = (newPark: HeldReceipt) => {
    setHeldReceipts((prev) => [newPark, ...prev]);
  };

  const handleRecordLayaway = (newLayaway: LayawayOrder) => {
    setLayawayOrders((prev) => [newLayaway, ...prev]);
  };

  const handleSettleHeldSale = (heldSaleId: string, method: PaymentMethodType, reference?: string) => {
    setHeldSales((prev) =>
      prev.map((hs) => {
        if (hs.id === heldSaleId) {
          return { ...hs, status: 'SETTLED' };
        }
        return hs;
      })
    );

    const found = heldSales.find((hs) => hs.id === heldSaleId);
    if (found) {
      const settledTx: SaleTransaction = {
        saleNumber: found.saleNumber,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        customer: found.customer,
        cashier: currentStaff,
        items: found.items,
        subtotal: found.subtotal,
        taxTotal: found.grandTotal * 0.15,
        discountTotal: 0,
        grandTotal: found.grandTotal,
        payments: [{ method, amount: found.grandTotal, reference }],
        changeGiven: 0,
        transactionType: 'HELD_SALE',
        status: 'COMPLETED',
        terminalId: 'POS-D01',
      };
      setSalesTransactions((prev) => [settledTx, ...prev]);
    }
  };

  const handleConvertToCreditSale = (heldSaleId: string) => {
    setHeldSales((prev) =>
      prev.map((hs) => {
        if (hs.id === heldSaleId) {
          return { ...hs, status: 'CONVERTED_CREDIT' };
        }
        return hs;
      })
    );

    const found = heldSales.find((hs) => hs.id === heldSaleId);
    if (found) {
      // Deduct from customer's available credit
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === found.customer.id) {
            const newBal = c.currentBalance + found.grandTotal;
            const newAvail = Math.max(0, c.creditLimit - newBal);
            return { ...c, currentBalance: newBal, availableCredit: newAvail };
          }
          return c;
        })
      );

      const creditTx: SaleTransaction = {
        saleNumber: found.saleNumber,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        customer: found.customer,
        cashier: currentStaff,
        items: found.items,
        subtotal: found.subtotal,
        taxTotal: found.grandTotal * 0.15,
        discountTotal: 0,
        grandTotal: found.grandTotal,
        payments: [{ method: 'CUSTOMER_CREDIT', amount: found.grandTotal, reference: `Converted from ${found.saleNumber}` }],
        changeGiven: 0,
        transactionType: 'CREDIT_SALE',
        status: 'COMPLETED',
        terminalId: 'POS-D01',
      };
      setSalesTransactions((prev) => [creditTx, ...prev]);
    }
  };

  const handleResumeParkedReceipt = (receipt: HeldReceipt) => {
    setHeldReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
    setActiveView('SALES_CASH');
  };

  const handleCancelParkedReceipt = (receiptId: string) => {
    setHeldReceipts((prev) => prev.filter((r) => r.id !== receiptId));
  };

  const handleRecordLayawayPayment = (layawayId: string, amount: number, method: PaymentMethodType) => {
    setLayawayOrders((prev) =>
      prev.map((order) => {
        if (order.id === layawayId) {
          const newPaid = order.amountPaid + amount;
          const newBal = Math.max(0, order.totalAmount - newPaid);
          const isComplete = newBal === 0;

          return {
            ...order,
            amountPaid: newPaid,
            balanceRemaining: newBal,
            status: isComplete ? 'COMPLETED' : order.status,
            paymentHistory: [
              ...order.paymentHistory,
              {
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                amount,
                method,
                cashierName: currentStaff.name,
                receiptNo: `REC-LAY-${Math.floor(100 + Math.random() * 900)}`,
              }
            ],
          };
        }
        return order;
      })
    );
  };

  const handleConvertLayawayToSale = (layawayId: string) => {
    const found = layawayOrders.find((o) => o.id === layawayId);
    if (!found) return;

    setLayawayOrders((prev) =>
      prev.map((o) => (o.id === layawayId ? { ...o, status: 'COMPLETED' } : o))
    );

    const saleTx: SaleTransaction = {
      saleNumber: `INV-LAY-${found.id}`,
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customer: found.customer,
      cashier: currentStaff,
      items: found.reservedItems,
      subtotal: found.totalAmount / 1.15,
      taxTotal: found.totalAmount - found.totalAmount / 1.15,
      discountTotal: 0,
      grandTotal: found.totalAmount,
      payments: found.paymentHistory.map((p) => ({ method: p.method, amount: p.amount, reference: p.receiptNo })),
      changeGiven: 0,
      transactionType: 'LAYAWAY',
      status: 'COMPLETED',
      terminalId: 'POS-D01',
    };
    setSalesTransactions((prev) => [saleTx, ...prev]);
  };

  const handleCreateDeliveryOrder = (newOrder: DeliveryOrder) => {
    setDeliveryOrders((prev) => [newOrder, ...prev]);
  };

  const handleUpdateDeliveryOrder = (updatedOrder: DeliveryOrder) => {
    setDeliveryOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  };

  // DL-068 (Prompt 14): the synthetic negative SaleTransaction this used to
  // fabricate and push into local-only salesTransactions state — invisible
  // to reconciliation run from server-loaded data or on another terminal,
  // and hardcoded to terminalId 'POS-D01' regardless of which terminal
  // actually processed the return — is gone. server/routes/creditNotes.ts
  // now persists a real refund entity (the credit note itself, carrying
  // shiftId/terminalId) that shiftReconciliation.ts reads directly; no
  // client-side reconstruction is needed for that anymore.
  const handleIssueCreditNote = (newNote: CreditNote) => {
    setCreditNotes((prev) => [newNote, ...prev]);

    if (newNote.refundMethod === 'CUSTOMER_CREDIT') {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === newNote.customer.id) {
            const newBal = Math.max(0, c.currentBalance - newNote.totalRefundAmount);
            const newAvail = Math.min(c.creditLimit, c.creditLimit - newBal);
            return { ...c, currentBalance: newBal, availableCredit: newAvail };
          }
          return c;
        })
      );
    }
  };

  // Phase 4 Logistics & Location Handlers
  const handleSelectWarehouse = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    handleNavigate('WAREHOUSE_DETAIL', { warehouseId });
  };

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    handleNavigate('BRANCH_DETAIL', { branchId });
  };

  const handleCreateWarehouse = (wh: Warehouse) => {
    setWarehouses((prev) => [...prev, wh]);
  };

  const handleCreateBranch = (br: Branch) => {
    setBranches((prev) => [...prev, br]);
  };

  const handleCreateTerminal = (term: Terminal) => {
    setTerminals((prev) => [...prev, term]);
  };

  const handleCreateTransfer = async (transfer: StockTransfer) => {
    try {
      const saved = await apiPost<StockTransfer>('/transfers', transfer);
      setStockTransfers((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('Failed to create stock transfer', err);
      setStockTransfers((prev) => [transfer, ...prev]);
    }
  };

  // Prompt 18 / DL-078: approve/dispatch/receive/reject now require an
  // idempotencyKey (mirroring sales.ts/creditNotes.ts) — generated fresh
  // per click, not persisted across a modal session like checkout's
  // sessionIdempotencyKey, since these are single fire-and-forget button
  // presses with no multi-step retry UI to correlate across.
  const generateTransferActionIdempotencyKey = (action: string, transferId: string): string =>
    `TRXFER-${action}-${transferId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleApproveTransfer = async (transferId: string) => {
    try {
      const saved = await apiPost<StockTransfer>(`/transfers/${encodeURIComponent(transferId)}/approve`, {
        idempotencyKey: generateTransferActionIdempotencyKey('approve', transferId),
      });
      setStockTransfers((prev) => prev.map((t) => (t.id === transferId ? saved : t)));
    } catch (err) {
      console.error('Failed to approve stock transfer', err);
    }
  };

  const handleDispatchTransfer = async (transferId: string) => {
    try {
      const saved = await apiPost<StockTransfer & { dispatchWarnings?: Array<{ sku: string; requestedQty: number; stockOnHandBeforeDispatch: number; shortfallQty: number }> }>(
        `/transfers/${encodeURIComponent(transferId)}/dispatch`,
        { idempotencyKey: generateTransferActionIdempotencyKey('dispatch', transferId) }
      );
      setStockTransfers((prev) => prev.map((t) => (t.id === transferId ? saved : t)));
    } catch (err) {
      console.error('Failed to dispatch stock transfer', err);
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      const saved = await apiPost<StockTransfer>(`/transfers/${encodeURIComponent(transferId)}/receive`, {
        idempotencyKey: generateTransferActionIdempotencyKey('receive', transferId),
      });
      setStockTransfers((prev) => prev.map((t) => (t.id === transferId ? saved : t)));
    } catch (err) {
      console.error('Failed to receive stock transfer', err);
    }
  };

  const handleRejectTransfer = async (transferId: string, reason: string) => {
    try {
      const saved = await apiPost<StockTransfer>(`/transfers/${encodeURIComponent(transferId)}/reject`, {
        reason,
        idempotencyKey: generateTransferActionIdempotencyKey('reject', transferId),
      });
      setStockTransfers((prev) => prev.map((t) => (t.id === transferId ? saved : t)));
    } catch (err) {
      console.error('Failed to reject stock transfer', err);
    }
  };

  const handleCreatePurchaseMemo = async (memo: PurchaseMemo) => {
    try {
      const saved = await apiPost<PurchaseMemo>('/purchasing/memos', memo);
      setPurchaseMemos((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('Failed to create purchase memo', err);
      setPurchaseMemos((prev) => [memo, ...prev]);
    }
  };

  const handleCreatePurchaseOrder = async (po: PurchaseOrder) => {
    try {
      const saved = await apiPost<PurchaseOrder>('/purchasing/orders', po);
      setPurchaseOrders((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('Failed to create purchase order', err);
      setPurchaseOrders((prev) => [po, ...prev]);
    }
  };

  const handleApproveMemo = async (memoId: string) => {
    try {
      const saved = await apiPatch<PurchaseMemo>(`/purchasing/memos/${encodeURIComponent(memoId)}`, {
        status: 'Approved',
        approvedByStaffName: currentStaff.name,
        approvalDate: new Date().toISOString().split('T')[0],
      });
      setPurchaseMemos((prev) => prev.map((m) => (m.id === memoId ? saved : m)));
    } catch (err) {
      console.error('Failed to approve purchase memo', err);
    }
  };

  const handleRejectMemo = async (memoId: string, reason: string) => {
    try {
      const saved = await apiPatch<PurchaseMemo>(`/purchasing/memos/${encodeURIComponent(memoId)}`, {
        status: 'Rejected',
        rejectionReason: reason,
      });
      setPurchaseMemos((prev) => prev.map((m) => (m.id === memoId ? saved : m)));
    } catch (err) {
      console.error('Failed to reject purchase memo', err);
    }
  };

  const handleConvertMemoToPO = async (memo: PurchaseMemo) => {
    try {
      const saved = await apiPatch<PurchaseMemo>(`/purchasing/memos/${encodeURIComponent(memo.id)}`, { status: 'CONVERTED' });
      setPurchaseMemos((prev) => prev.map((m) => (m.id === memo.id ? saved : m)));
      handleNavigate('PURCHASING', { memoToConvert: saved });
    } catch (err) {
      console.error('Failed to mark purchase memo as converted', err);
      setPurchaseMemos((prev) => prev.map((m) => (m.id === memo.id ? { ...m, status: 'CONVERTED' } : m)));
      handleNavigate('PURCHASING', { memoToConvert: memo });
    }
  };

  const handleReceiveStockFromSupplier = async (
    poNumber: string | null,
    warehouseId: string,
    lines: Array<{
      sku: string;
      itemName: string;
      qtyReceiving: number;
      unitCost: number;
      batchNumber?: string;
      serialNumber?: string;
      expiryDate?: string;
      binLocation?: string;
    }>,
    notes: string
  ) => {
    try {
      const grn = await apiPost<GoodsReceiptNote>('/purchasing/receipts', { poNumber, warehouseId, lines, notes });
      // Reflect the server's authoritative stock levels and PO status rather
      // than re-deriving them from the request we just sent.
      const [items, orders] = await Promise.all([
        apiGet<InventoryItem[]>('/inventory/items'),
        apiGet<PurchaseOrder[]>('/purchasing/orders'),
      ]);
      setInventoryItems(items);
      setPurchaseOrders(orders);
      return grn;
    } catch (err) {
      console.error('Failed to record goods receipt', err);
      return null;
    }
  };

  const handleCreateStockAdjustment = (adj: StockAdjustmentRecord) => {
    setStockAdjustments((prev) => [adj, ...prev]);
  };

  const handleRecordStocktake = (stk: StocktakeRecord) => {
    setStocktakes((prev) => [stk, ...prev]);
  };

  const handleLaunchPOSFromLocation = (branchId: string, terminalId?: string) => {
    setSelectedBranchId(branchId);
    handleNavigate('SALES_CASH', { branchId, terminalId });
  };

  // Phase 5 Operational Handlers
  const handleOpenShift = async (shiftData: {
    terminalId: string;
    branchId: string;
    cashierStaffId: string;
    openingFloat: number;
    openingNotes?: string;
  }) => {
    let newShift: Shift;
    try {
      newShift = await apiPost<Shift>('/shifts', {
        terminalId: shiftData.terminalId,
        openingFloat: shiftData.openingFloat,
        openingNotes: shiftData.openingNotes,
      });
    } catch (err) {
      window.alert(err instanceof ApiClientError ? `Could not open shift: ${err.message}` : 'Could not reach the backend to open this shift.');
      return;
    }

    setShifts((prev) => [newShift, ...prev]);
    setIsShiftOpeningModalOpen(false);

    // Record Immutable Shift Opening Activity Event
    const shiftOpenEvt: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: newShift.openedDateTime,
      eventType: 'SHIFT_OPENED',
      description: `Shift #${newShift.shiftNumber} opened on ${newShift.terminalName} by ${currentStaff.name} with opening float of $${shiftData.openingFloat.toFixed(2)} USD.`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: newShift.branchId,
      branchName: newShift.branchName,
      terminalId: newShift.terminalId,
      referenceDocument: newShift.shiftNumber,
      amount: shiftData.openingFloat,
      metadata: {
        shiftId: newShift.id,
        terminalId: newShift.terminalId,
        openingFloat: shiftData.openingFloat,
      }
    };
    setActivityEvents((prev) => [shiftOpenEvt, ...prev]);
  };

  const handleCloseShift = async (
    shiftId: string,
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
    }
  ) => {
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift) return;

    // The server rebuilds the reconciliation snapshot from real persisted
    // sales/held-sales for this shift (via shiftReconciliation.ts, reused
    // server-side) and creates the variance exception row if one is
    // warranted — this is the authoritative close, not a local computation.
    let closedShift: Shift;
    try {
      closedShift = await apiPost<Shift>(`/shifts/${encodeURIComponent(shiftId)}/close`, closureData);
    } catch (err) {
      window.alert(err instanceof ApiClientError ? `Could not close shift: ${err.message}` : 'Could not reach the backend to close this shift.');
      return;
    }

    setShifts((prev) => prev.map((s) => (s.id === shiftId ? closedShift : s)));
    setClosureShiftTarget(null);

    const hasVariance = closedShift.reconciliationSnapshot?.hasAnyDiscrepancy;
    if (hasVariance) {
      const defaultReason: ActivityReasonCode = closureData.cashVariance < 0 ? 'CASH_SHORTAGE' : 'CASH_OVERAGE';
      const effectiveReason = closureData.reasonCode || defaultReason;
      const varianceEvt: ActivityEvent = {
        id: `EVT-VAR-${Date.now()}`,
        timestamp: closedShift.closedDateTime || new Date().toISOString().replace('T', ' ').slice(0, 16),
        eventType: 'PAYMENT_VARIANCE_DETECTED',
        description: `Shift tender variance of ${closureData.cashVariance >= 0 ? '+' : ''}$${closureData.cashVariance.toFixed(2)} (${effectiveReason}) recorded on shift #${targetShift.shiftNumber}.`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        branchId: targetShift.branchId || 'BR-01',
        branchName: targetShift.branchName || 'Main Store Downtown',
        terminalId: targetShift.terminalId || currentTerminalId,
        referenceDocument: targetShift.shiftNumber,
        amount: closureData.cashVariance,
        reasonCode: effectiveReason,
        metadata: {
          shiftId: targetShift.id,
          shiftNumber: targetShift.shiftNumber,
          varianceAmount: closureData.cashVariance,
          tenderReconciliation: closureData.tenderReconciliation,
          cashUpMode: closureData.cashUpMode || 'STANDARD',
        }
      };
      setActivityEvents((prev) => [varianceEvt, ...prev]);
    }

    // Record Immutable Shift Closed Event
    const shiftCloseEvt: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: closedShift.closedDateTime || targetShift.openedDateTime,
      eventType: 'SHIFT_CLOSED',
      description: `Shift #${targetShift.shiftNumber} closed by ${currentStaff.name} [Mode: ${closureData.cashUpMode || 'STANDARD'}]. Counted cash: $${closureData.countedCash.toFixed(2)}, Cash Variance: ${closureData.cashVariance >= 0 ? '+' : ''}$${closureData.cashVariance.toFixed(2)}.`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: targetShift.branchId || 'BR-01',
      branchName: targetShift.branchName || 'Main Store Downtown',
      terminalId: targetShift.terminalId || currentTerminalId,
      referenceDocument: targetShift.shiftNumber,
      amount: closureData.countedCash,
      metadata: {
        shiftId,
        shiftNumber: targetShift.shiftNumber,
        cashUpMode: closureData.cashUpMode || 'STANDARD',
        variance: closureData.cashVariance,
        countedCash: closureData.countedCash,
        expectedCash: targetShift.expectedCash,
        requiresApproval: closureData.requiresApproval,
        managerApproved: closureData.managerApproved || false,
      }
    };
    setActivityEvents((prev) => [shiftCloseEvt, ...prev]);
  };

  const handleSaveEODReport = (report: EODReport) => {
    setEodReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
  };

  const handleSaveStocktakeSession = async (session: StocktakeSession) => {
    try {
      const saved = await apiPut<StocktakeSession>(`/stocktake/sessions/${encodeURIComponent(session.id)}`, session);
      setStocktakeSessions((prev) => [saved, ...prev.filter((s) => s.id !== session.id)]);
    } catch (err) {
      console.error('Failed to save stocktake session', err);
      setStocktakeSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
    }
  };

  const handlePostStocktakeAdjustments = async (session: StocktakeSession) => {
    try {
      const saved = await apiPost<StocktakeSession>(`/stocktake/sessions/${encodeURIComponent(session.id)}/post-adjustments`);
      setStocktakeSessions((prev) => [saved, ...prev.filter((s) => s.id !== session.id)]);
      // Reflect the server's authoritative stock levels rather than
      // re-deriving them from the pre-post session snapshot.
      const items = await apiGet<InventoryItem[]>('/inventory/items');
      setInventoryItems(items);
    } catch (err) {
      console.error('Failed to post stocktake adjustments', err);
    }
  };

  // Server round trip added as this route's first real caller (DL-065
  // follow-up) — approval_requests previously had no route at all, so a
  // decision only ever existed in this component's local state and never
  // reached the real table biRuleGate.ts writes BI_RULE_REDIRECT tickets
  // into, nor Supabase (so executive-pwa's Decision Flows never saw it).
  // Awaited rather than fire-and-forget, unlike handleUpdateReorderStatus's
  // optimistic pattern, because APPROVED can have a real side effect here
  // (creating the purchase memo the ticket blocked) that only the server
  // can perform — local state must reflect what actually happened, not
  // what was requested.
  const handleApprovalDecision = async (requestId: string, status: 'APPROVED' | 'REJECTED', notes: string) => {
    const decisionTimeStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const targetReq = approvalRequests.find((r) => r.id === requestId);

    let decided: ApprovalRequest;
    try {
      const result = await apiPatch<{ request: ApprovalRequest; createdPurchaseMemo: PurchaseMemo | null }>(
        `/approvals/${encodeURIComponent(requestId)}/decide`,
        {
          status,
          decisionNotes: notes,
        }
      );
      decided = result.request;
      if (result.createdPurchaseMemo) {
        setPurchaseMemos((prev) => [result.createdPurchaseMemo as PurchaseMemo, ...prev]);
      }
    } catch (err) {
      console.error('Failed to record approval decision', err);
      return;
    }

    setApprovalRequests((prev) => prev.map((req) => (req.id === requestId ? decided : req)));

    // Record Activity Event for manager sign-off
    const apprvEvt: ActivityEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: decisionTimeStr,
      eventType: targetReq?.type === 'PRICE_OVERRIDE'
        ? (status === 'APPROVED' ? 'PRICE_OVERRIDE_APPROVED' : 'PRICE_OVERRIDE_REQUESTED')
        : targetReq?.type === 'RETURN_APPROVAL'
        ? (status === 'APPROVED' ? 'RETURN_APPROVED' : 'RETURN_REQUESTED')
        : targetReq?.type === 'STOCK_ADJUSTMENT'
        ? 'STOCK_ADJUSTMENT_APPROVED'
        : 'CUSTOMER_CREDIT_APPROVED',
      description: `Approval Request #${targetReq?.requestNumber || requestId} (${targetReq?.title}) was ${status} by ${currentStaff.name}. Notes: ${notes || 'Standard authorization.'}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      branchId: 'BR-01',
      branchName: 'Main Store Downtown',
      referenceDocument: targetReq?.requestNumber || requestId,
    };
    setActivityEvents((prev) => [apprvEvt, ...prev]);
  };

  // Phase 6 Financial Control & Treasury Handlers
  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
    );
  };

  const handleAddDebtorTransaction = (transaction: DebtorTransaction) => {
    setDebtorTransactions((prev) => [transaction, ...prev]);
  };

  const handleUpdateSupplier = (updatedSupplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.code === updatedSupplier.code ? updatedSupplier : s))
    );
  };

  const handleAddCreditorTransaction = (transaction: CreditorTransaction) => {
    setCreditorTransactions((prev) => [transaction, ...prev]);
  };

  const handleAddCashBankAccount = (account: CashBankAccount) => {
    setCashBankAccounts((prev) => [...prev, account]);
  };

  const handleUpdateCashBankAccount = (account: CashBankAccount) => {
    setCashBankAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? account : a))
    );
  };

  const handleUpdateAccountBalance = (accountId: string, newBalance: number) => {
    setCashBankAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, currentBalance: newBalance } : a))
    );
  };

  const handleAddCashBankTransaction = (transaction: CashBankTransaction) => {
    setCashBankTransactions((prev) => [transaction, ...prev]);
  };

  const handleAddCashMovement = (movement: CashMovementRecord) => {
    setCashMovements((prev) => [movement, ...prev]);
  };

  const handleUpdateReserve = (reserve: BusinessReserve) => {
    setReserves((prev) =>
      prev.map((r) => (r.id === reserve.id ? reserve : r))
    );
  };

  const handleAddReserveTransfer = (transfer: ReserveTransferRecord) => {
    setReserveTransfers((prev) => [transfer, ...prev]);
  };

  const handleUpdateTaxConfig = (config: TaxFiscalConfig) => {
    setTaxConfig(config);
  };

  const handleAddCashFlowProjection = (entry: Omit<CashFlowProjectionEntry, 'id' | 'createdAt'>) => {
    const newEntry: CashFlowProjectionEntry = {
      ...entry,
      id: `CFP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString()
    };
    setCashFlowProjections((prev) => [newEntry, ...prev]);
  };

  const handleUpdateCashFlowProjection = (entry: CashFlowProjectionEntry) => {
    setCashFlowProjections((prev) =>
      prev.map((p) => (p.id === entry.id ? entry : p))
    );
  };

  const handleDeleteCashFlowProjection = (id: string) => {
    setCashFlowProjections((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateApprovalRequest = (reqData: Partial<ApprovalRequest>) => {
    const newReq: ApprovalRequest = {
      id: `APR-${Date.now()}`,
      requestNumber: `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      type: reqData.type || 'CUSTOMER_APPROVAL',
      title: reqData.title || 'Operational Financial Approval Request',
      description: reqData.description || 'Action requiring manager authorization',
      amount: reqData.amount,
      referenceId: reqData.referenceId || '',
      referenceType: reqData.referenceType || 'CUSTOMER',
      locationName: reqData.locationName || 'Main Downtown Branch',
      requestedByStaffId: currentStaff.id,
      requestedByStaffName: currentStaff.name,
      requestedByRole: currentStaff.roleTitle,
      requestedDateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      reason: reqData.reason || 'Requested by staff operator',
      priority: reqData.priority || 'HIGH',
      status: 'PENDING',
      meta: reqData.meta,
    };
    setApprovalRequests((prev) => [newReq, ...prev]);
  };

  const activeWarehouse = (warehouses || []).find((w) => w.id === selectedWarehouseId) || warehouses?.[0] || { id: 'WH-01', name: 'Main Store Floor', code: 'WH-01', address: '100 Industrial Parkway', phone: '+1 555-0199', managerName: 'Marcus Chen', isCentralHub: true };
  const activeBranch: Branch = (branches || []).find((b) => b.id === selectedBranchId) || branches?.[0] || {
    id: 'BR-01',
    code: 'BR-01',
    name: 'Downtown Branch',
    address: '450 Commercial Ave',
    managerName: 'Jonathan Reynolds',
    contactPhone: '+1 555-0101',
    email: 'branch-downtown@itred.com',
    status: 'ACTIVE',
    isDefault: true,
  };

  // Render view router for MAIN_APP stage
  const renderActiveView = () => {
    // Defense-in-depth: handleNavigate and HeaderNav's menu filtering already
    // keep activeView from ever being set to a head-office-only or
    // module-locked view, but this catches it if it somehow happens anyway
    // (e.g. a stale navigationParams-driven deep link, or the lock engaging
    // mid-session on an already-open view).
    if (!canAccessView(currentStaff.accessRole, activeView)) {
      return <AccessRestrictedView reason="ROLE" onBackToLanding={() => handleNavigate('LANDING')} />;
    }
    if (moduleLock.locked && isModuleLockedView(activeView)) {
      return <AccessRestrictedView reason="MODULE_LOCK" onBackToLanding={() => handleNavigate('LANDING')} />;
    }
    switch (activeView) {
      case 'LANDING':
        return (
          <LandingPage 
            onNavigate={handleNavigate}
            shifts={shifts}
            approvals={approvalRequests}
            heldSales={heldSales}
            eodReports={eodReports}
            stocktakeSessions={stocktakeSessions}
            inventoryItems={inventoryItems}
            biAlerts={biAlerts}
            exceptions={operationalExceptions}
          />
        );

      case 'SALES_CASH':
        return (
          <SalesView
            saleType="CASH"
            currentStaff={currentStaff}
            activeShift={shifts.find((s) => s.status === 'OPEN' && (s.terminalId === currentTerminalId || s.branchId === selectedBranchId)) || shifts.find((s) => s.status === 'OPEN') || null}
            inventoryItems={inventoryItems}
            customers={customers}
            heldSales={heldSales}
            heldReceipts={heldReceipts}
            terminalId={currentTerminalId}
            branchId={selectedBranchId}
            branchName={activeBranch?.name || 'Main Retail Storefront'}
            onBackToLanding={() => handleNavigate('LANDING')}
            onOpenShift={() => setIsShiftOpeningModalOpen(true)}
            onNavigateToHeldSales={() => handleNavigate('HELD_SALES')}
            onNavigateToHeldReceipts={() => handleNavigate('HELD_RECEIPTS')}
            onNavigateToLayaway={() => handleNavigate('LAYAWAY')}
            onNavigateToDeliveryDispatch={(saleNumber) => handleNavigate('DELIVERY_DISPATCH', { saleNumber })}
            onRecordCompletedSale={handleRecordCompletedSale}
            onRecordHeldSale={handleRecordHeldSale}
            onParkCart={handleParkCart}
            onRecordLayaway={handleRecordLayaway}
          />
        );

      case 'SALES_CREDIT':
        return (
          <SalesView
            saleType="CREDIT"
            currentStaff={currentStaff}
            activeShift={shifts.find((s) => s.status === 'OPEN' && (s.terminalId === currentTerminalId || s.branchId === selectedBranchId)) || shifts.find((s) => s.status === 'OPEN') || null}
            inventoryItems={inventoryItems}
            customers={customers}
            heldSales={heldSales}
            heldReceipts={heldReceipts}
            terminalId={currentTerminalId}
            branchId={selectedBranchId}
            branchName={activeBranch?.name || 'Main Retail Storefront'}
            onBackToLanding={() => handleNavigate('LANDING')}
            onOpenShift={() => setIsShiftOpeningModalOpen(true)}
            onNavigateToHeldSales={() => handleNavigate('HELD_SALES')}
            onNavigateToHeldReceipts={() => handleNavigate('HELD_RECEIPTS')}
            onNavigateToLayaway={() => handleNavigate('LAYAWAY')}
            onNavigateToDeliveryDispatch={(saleNumber) => handleNavigate('DELIVERY_DISPATCH', { saleNumber })}
            onRecordCompletedSale={handleRecordCompletedSale}
            onRecordHeldSale={handleRecordHeldSale}
            onParkCart={handleParkCart}
            onRecordLayaway={handleRecordLayaway}
          />
        );

      case 'SALES_RETURN':
        return (
          <CreditNotesView
            creditNotes={creditNotes}
            customers={customers}
            sales={salesTransactions}
            currentStaff={currentStaff}
            activeShift={shifts.find((s) => s.status === 'OPEN' && (s.terminalId === currentTerminalId || s.branchId === selectedBranchId)) || shifts.find((s) => s.status === 'OPEN') || null}
            terminalId={currentTerminalId}
            onIssueCreditNote={handleIssueCreditNote}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToPOS={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'DELIVERY_DISPATCH':
        return (
          <DeliveryDispatchView
            deliveryOrders={deliveryOrders}
            activeBranch={activeBranch}
            currentStaff={currentStaff}
            onCreateDeliveryOrder={handleCreateDeliveryOrder}
            onUpdateDeliveryOrder={handleUpdateDeliveryOrder}
            onBackToLanding={() => handleNavigate('LANDING')}
            initialSaleNumber={navigationParams?.saleNumber}
          />
        );

      case 'HELD_SALES':
        return (
          <HeldSalesView
            heldSales={heldSales}
            currentStaff={currentStaff}
            onSettleHeldSale={handleSettleHeldSale}
            onConvertToCreditSale={handleConvertToCreditSale}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToPOS={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'HELD_RECEIPTS':
        return (
          <HeldReceiptsView
            heldReceipts={heldReceipts}
            currentStaff={currentStaff}
            onResumeReceipt={handleResumeParkedReceipt}
            onCancelReceipt={handleCancelParkedReceipt}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToPOS={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'LAYAWAY':
        return (
          <LayawayView
            layawayOrders={layawayOrders}
            currentStaff={currentStaff}
            onRecordPayment={handleRecordLayawayPayment}
            onConvertLayawayToSale={handleConvertLayawayToSale}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToPOS={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'SALES_HISTORY':
        return (
          <SalesHistoryView
            sales={salesTransactions}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToSale={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'PURCHASE_MEMO':
        return (
          <PurchaseMemoView
            memos={purchaseMemos}
            warehouses={warehouses}
            inventoryItems={inventoryItems}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('PURCHASING')}
            onCreateMemo={handleCreatePurchaseMemo}
            onApproveMemo={handleApproveMemo}
            onRejectMemo={handleRejectMemo}
            onConvertToPO={handleConvertMemoToPO}
          />
        );

      case 'RECEIVE_STOCK':
        return (
          <ReceiveStockView
            purchaseOrders={purchaseOrders}
            warehouses={warehouses}
            inventoryItems={inventoryItems}
            currentStaff={currentStaff}
            initialPoNumber={navigationParams?.poNumber}
            onBackToLanding={() => handleNavigate('PURCHASING')}
            onConfirmReceiving={handleReceiveStockFromSupplier}
          />
        );

      case 'PURCHASING':
      case 'PURCHASE_ORDER':
      case 'PO_LIST':
        return (
          <PurchasingView
            initialStatusFilter={(navigationParams?.statusFilter as POStatus) || 'All'}
            currentStaff={currentStaff}
            purchaseOrders={purchaseOrders}
            warehouses={warehouses}
            inventoryItems={inventoryItems}
            memoToConvert={navigationParams?.memoToConvert}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToMemos={() => handleNavigate('PURCHASE_MEMO')}
            onNavigateToReceive={(poNumber) => handleNavigate('RECEIVE_STOCK', { poNumber })}
            onSavePO={handleCreatePurchaseOrder}
          />
        );

      case 'WAREHOUSES':
        return (
          <WarehouseListView
            warehouses={warehouses}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onSelectWarehouse={handleSelectWarehouse}
            onCreateWarehouse={handleCreateWarehouse}
            onNavigateToReceive={() => handleNavigate('RECEIVE_STOCK')}
            onNavigateToTransfers={() => handleNavigate('STOCK_TRANSFERS')}
          />
        );

      case 'WAREHOUSE_DETAIL':
        return (
          <WarehouseDetailView
            warehouse={activeWarehouse}
            inventoryItems={inventoryItems}
            transfers={stockTransfers}
            stocktakes={stocktakes}
            adjustments={stockAdjustments}
            currentStaff={currentStaff}
            onBackToList={() => handleNavigate('WAREHOUSES')}
            onReceiveGoods={() => handleNavigate('RECEIVE_STOCK')}
            onDispatchTransfer={() => handleNavigate('STOCK_TRANSFERS')}
            onCreateAdjustment={handleCreateStockAdjustment}
            onRecordStocktake={handleRecordStocktake}
          />
        );

      case 'BRANCHES':
        return (
          <BranchListView
            branches={branches}
            terminals={terminals}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onSelectBranch={handleSelectBranch}
            onCreateBranch={handleCreateBranch}
            onLaunchPOS={handleLaunchPOSFromLocation}
            onNavigateToTransfers={() => handleNavigate('STOCK_TRANSFERS')}
          />
        );

      case 'BRANCH_DETAIL':
        return (
          <BranchDetailView
            branch={activeBranch}
            terminals={terminals}
            inventoryItems={inventoryItems}
            transfers={stockTransfers}
            staffMembers={INITIAL_STAFF_MEMBERS}
            stocktakes={stocktakes}
            currentStaff={currentStaff}
            onBackToList={() => handleNavigate('BRANCHES')}
            onLaunchPOS={handleLaunchPOSFromLocation}
            onLaunchTransfer={(bId) => handleNavigate('STOCK_TRANSFERS')}
            onOpenPeerLookup={(sku) => handleNavigate('STOCK_TRANSFERS')}
            onReceiveTransfer={handleReceiveTransfer}
            onCreateTerminal={handleCreateTerminal}
            onRecordStocktake={handleRecordStocktake}
          />
        );

      case 'TERMINALS':
        return (
          <TerminalsListView
            terminals={terminals}
            branches={branches}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onLaunchPOS={handleLaunchPOSFromLocation}
            onCreateTerminal={handleCreateTerminal}
          />
        );

      case 'STOCK_TRANSFERS':
        return (
          <StockTransfersView
            transfers={stockTransfers}
            warehouses={warehouses}
            branches={branches}
            inventoryItems={inventoryItems}
            connectedShops={connectedShops}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onCreateTransfer={handleCreateTransfer}
            onApproveTransfer={handleApproveTransfer}
            onDispatchTransfer={handleDispatchTransfer}
            onReceiveTransfer={handleReceiveTransfer}
            onRejectTransfer={handleRejectTransfer}
          />
        );

      case 'INVENTORY_MOVEMENTS':
        return (
          <InventoryMovementHistoryView
            movements={inventoryMovements}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'STOCKTAKE':
      case 'STOCKTAKE_DETAIL':
        return (
          <StocktakeView
            currentStaff={currentStaff}
            stocktakeSessions={stocktakeSessions}
            inventoryItems={inventoryItems}
            inventoryMovements={inventoryMovements}
            branches={branches}
            warehouses={warehouses}
            onBackToLanding={() => handleNavigate('LANDING')}
            onSaveSession={handleSaveStocktakeSession}
            onPostAdjustments={handlePostStocktakeAdjustments}
            onNavigateToApprovals={() => handleNavigate('APPROVALS')}
            onNavigateToPriorities={() => handleNavigate('STOCKTAKE_PRIORITIES')}
          />
        );

      case 'STOCK_ADJUSTMENTS':
        return (
          <WarehouseDetailView
            warehouse={activeWarehouse}
            inventoryItems={inventoryItems}
            transfers={stockTransfers}
            stocktakes={stocktakes}
            adjustments={stockAdjustments}
            currentStaff={currentStaff}
            onBackToList={() => handleNavigate('WAREHOUSES')}
            onReceiveGoods={() => handleNavigate('RECEIVE_STOCK')}
            onDispatchTransfer={() => handleNavigate('STOCK_TRANSFERS')}
            onCreateAdjustment={handleCreateStockAdjustment}
            onRecordStocktake={handleRecordStocktake}
          />
        );

      case 'SHIFT_MANAGEMENT':
      case 'SHIFTS':
        return (
          <ShiftManagementView
            shifts={shifts}
            terminals={terminals}
            branches={branches}
            transactions={salesTransactions}
            heldSales={heldSales}
            exceptions={operationalExceptions}
            currentTerminalId={currentTerminalId}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
            onNavigateToEOD={() => handleNavigate('EOD_REPORT')}
            onNavigateToApprovals={() => handleNavigate('APPROVALS')}
          />
        );

      case 'APPROVALS':
        return (
          <ApprovalsView
            currentStaff={currentStaff}
            approvalRequests={approvalRequests}
            onBackToLanding={() => handleNavigate('LANDING')}
            onDecision={handleApprovalDecision}
          />
        );

      case 'ITEM_LIST':
        return (
          <InventoryItemListView
            currentStaff={currentStaff}
            inventoryItems={inventoryItems}
            inventoryMovements={inventoryMovements}
            onBackToLanding={() => handleNavigate('LANDING')}
            onRecordMovement={(mov) => setInventoryMovements((prev) => [mov, ...prev])}
            onRequestApproval={handleCreateApprovalRequest}
          />
        );

      case 'STAFF_MANAGEMENT':
      case 'ROLES_RIGHTS':
      case 'VENDOR_PREFERENCES':
      case 'RATE_CONFIG':
        return (
          <SettingsView
            initialTab={
              activeView === 'STAFF_MANAGEMENT' ? 'staff'
              : activeView === 'ROLES_RIGHTS' ? 'roles'
              : activeView === 'VENDOR_PREFERENCES' ? 'vendor'
              : activeView === 'RATE_CONFIG' ? 'rates'
              : 'staff'
            }
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'DEBTORS':
      case 'DEBTOR_ACCOUNT':
      case 'CUSTOMERS':
        return (
          <DebtorsView
            currentStaff={currentStaff}
            customers={customers}
            debtorTransactions={debtorTransactions}
            onUpdateCustomer={handleUpdateCustomer}
            onAddDebtorTransaction={handleAddDebtorTransaction}
            onCreateApprovalRequest={handleCreateApprovalRequest}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToPOS={() => handleNavigate('SALES_CASH')}
          />
        );

      case 'CREDITORS':
      case 'CREDITOR_ACCOUNT':
      case 'SUPPLIERS':
        return (
          <CreditorsView
            currentStaff={currentStaff}
            suppliers={suppliers}
            creditorTransactions={creditorTransactions}
            bankAccounts={cashBankAccounts}
            onUpdateSupplier={handleUpdateSupplier}
            onAddCreditorTransaction={handleAddCreditorTransaction}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'DEPARTMENTS':
        return (
          <GenericBusinessView
            viewType="DEPARTMENTS"
            title="Catalog Departments & Tax Categories"
            subtitle="Item Classification & Target Margin Matrix"
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'CASH_BANK':
      case 'BANK_ACCOUNTS':
      case 'FINANCIAL_ACCOUNTS':
        return (
          <CashBankView
            currentStaff={currentStaff}
            accounts={cashBankAccounts}
            transactions={cashBankTransactions}
            onAddAccount={handleAddCashBankAccount}
            onUpdateAccount={handleUpdateCashBankAccount}
            onAddTransaction={handleAddCashBankTransaction}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToCashManager={() => handleNavigate('CASH_MANAGER')}
          />
        );

      case 'CASH_MANAGER':
        return (
          <CashManagerView
            currentStaff={currentStaff}
            bankAccounts={cashBankAccounts}
            cashMovements={cashMovements}
            onAddMovement={handleAddCashMovement}
            onUpdateAccountBalance={handleUpdateAccountBalance}
            onAddTransaction={handleAddCashBankTransaction}
            onCreateApprovalRequest={handleCreateApprovalRequest}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToAccounts={() => handleNavigate('CASH_BANK')}
          />
        );

      case 'CASHFLOW_PROJECTOR':
        return (
          <CashFlowProjectorView
            currentStaff={currentStaff}
            projections={cashFlowProjections}
            onAddProjection={handleAddCashFlowProjection}
            onUpdateProjection={handleUpdateCashFlowProjection}
            onDeleteProjection={handleDeleteCashFlowProjection}
            cashBankAccounts={cashBankAccounts}
            salesTransactions={salesTransactions}
            debtorTransactions={debtorTransactions}
            creditorTransactions={creditorTransactions}
            cashMovements={cashMovements}
            reserveTransfers={reserveTransfers}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToCashManager={() => handleNavigate('CASH_MANAGER')}
            onNavigateToCreditors={() => handleNavigate('CREDITORS')}
            onNavigateToDebtors={() => handleNavigate('DEBTORS')}
          />
        );

      case 'RESERVES':
        return (
          <ReservesView
            currentStaff={currentStaff}
            reserves={reserves}
            transfers={reserveTransfers}
            bankAccounts={cashBankAccounts}
            onUpdateReserve={handleUpdateReserve}
            onAddTransfer={handleAddReserveTransfer}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'TAX_FISCAL':
        return (
          <TaxFiscalView
            currentStaff={currentStaff}
            taxConfig={taxConfig}
            customers={customers}
            onUpdateTaxConfig={handleUpdateTaxConfig}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'EOD_REPORT':
        return (
          <EODSummaryView
            currentStaff={currentStaff}
            branches={branches}
            terminals={terminals}
            shifts={shifts}
            heldSales={heldSales}
            creditNotes={creditNotes}
            eodReports={eodReports}
            stockAdjustments={stockAdjustments}
            onBackToLanding={() => handleNavigate('LANDING')}
            onSaveEODReport={handleSaveEODReport}
            onNavigateToShifts={() => handleNavigate('SHIFT_MANAGEMENT')}
            onNavigateToApprovals={() => handleNavigate('APPROVALS')}
          />
        );

      case 'BI_ACTIVITY':
        return (
          <BIActivityView
            alerts={biAlerts}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateAlertStatus={handleUpdateAlertStatus}
            onNavigateToEntity={(targetView, entityId) => {
              handleNavigate(targetView, { targetId: entityId });
            }}
          />
        );

      case 'REPORTS_CENTER':
      case 'REPORT_VIEWER':
        return (
          <ReportsCenterView
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToBI={() => handleNavigate('BI_ACTIVITY')}
            onNavigateToUpgrade={() => handleNavigate('ONLINE_UPGRADE')}
            salesTransactions={salesTransactions}
            inventoryItems={inventoryItems}
            customers={customers}
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            shifts={shifts}
            eodReports={eodReports}
            debtorTransactions={debtorTransactions}
            creditorTransactions={creditorTransactions}
            cashBankAccounts={cashBankAccounts}
            cashBankTransactions={cashBankTransactions}
            stocktakes={stocktakes}
          />
        );

      case 'ONLINE_UPGRADE':
        return (
          <OnlineUpgradeView
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToReports={() => handleNavigate('REPORTS_CENTER')}
          />
        );

      case 'LICENSING':
        return (
          <LicensingView
            licenceInfo={licenceInfo}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateLicence={handleUpdateLicence}
          />
        );

      case 'BUSINESS_PROFILE':
        return (
          <BusinessProfileView
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'BI_CONFIG':
        return (
          <BIConfigView
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'UPDATES':
      case 'SOFTWARE_UPDATES':
        return (
          <SoftwareUpdatesView
            updateInfo={softwareUpdateInfo}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateSoftwareInfo={handleUpdateSoftwareInfo}
          />
        );

      case 'DEVICES':
        return (
          <DevicesManagementView
            devices={posDevices}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateDevice={handleUpdateDevice}
            onAddDevice={handleAddDevice}
          />
        );

      case 'PAYMENT_METHODS':
        return (
          <PaymentMethodsConfigView
            configs={paymentMethodsConfig}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateConfig={handleUpdatePaymentMethodConfig}
          />
        );

      case 'FISCALIZATION':
        return (
          <FiscalizationView
            fiscalConfig={fiscalConfig}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateFiscalConfig={handleUpdateFiscalConfig}
          />
        );

      case 'EXCEPTION_LEDGER':
        return (
          <ExceptionLedgerView
            exceptions={operationalExceptions}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateException={handleUpdateException}
            onEmitActivityEvent={(evt) => {
              const newEvt: ActivityEvent = {
                id: `EVT-${Date.now()}`,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                eventType: evt.eventType || 'VARIANCE_CREATED',
                description: evt.description || 'Exception audit update',
                staffId: evt.staffId || currentStaff.id,
                staffName: evt.staffName || currentStaff.name,
                branchId: evt.branchId || 'BR-01',
                branchName: evt.branchName || 'Main Store Downtown',
                terminalId: evt.terminalId || currentTerminalId,
                entityType: evt.entityType,
                entityId: evt.entityId,
                outcome: evt.outcome,
                referenceDocument: evt.referenceDocument,
                amount: evt.amount,
              };
              setActivityEvents((prev) => [newEvt, ...prev]);
            }}
          />
        );

      case 'ACTIVITY_EVENTS':
        return (
          <ActivityEventsView
            events={activityEvents}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
            onViewException={(exceptionId) => handleNavigate('EXCEPTION_LEDGER')}
          />
        );

      case 'METRIC_DICTIONARY':
        return (
          <MetricDictionaryView
            metrics={CENTRAL_METRIC_DICTIONARY}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );

      case 'REORDER_REVIEW':
        return (
          <ReorderReviewView
            currentStaff={currentStaff}
            recommendations={reorderRecommendations}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateRecommendationStatus={handleUpdateReorderStatus}
            onCreatePurchaseMemo={handleCreateMemoFromReorders}
            onCreatePurchaseOrder={handleCreatePOFromReorders}
            onNavigateToPOList={() => handleNavigate('PO_LIST')}
            onNavigateToMemos={() => handleNavigate('PURCHASE_MEMO')}
          />
        );

      case 'STOCKTAKE_PRIORITIES':
        return (
          <StocktakePrioritiesView
            currentStaff={currentStaff}
            riskSignals={evaluateStocktakeRiskSignals(inventoryItems, inventoryMovements, stocktakeSessions, stockTransfers, operationalExceptions)}
            onBackToLanding={() => handleNavigate('LANDING')}
            onInitiateStocktakeForItems={handleInitiateStocktakeForRiskItems}
            onNavigateToStocktakes={() => handleNavigate('STOCKTAKE')}
          />
        );

      case 'COMMERCIAL_DATA_QUALITY':
        return (
          <CommercialDataQualityView
            currentStaff={currentStaff}
            dataQualityResult={evaluateCommercialDataQuality(inventoryItems)}
            inventoryItems={inventoryItems}
            onBackToLanding={() => handleNavigate('LANDING')}
            onUpdateItemMaster={handleUpdateItemMasterFromAudit}
            onNavigateToItemList={() => handleNavigate('ITEM_LIST')}
          />
        );

      case 'OPERATIONAL_READINESS':
        return (
          <OperationalReadinessView
            currentStaff={currentStaff}
            readinessSnapshot={operationalReadiness}
            offlineEventQueue={offlineEventQueue}
            exceptions={operationalExceptions}
            fiscalConfig={fiscalConfig}
            licenseInfo={licenceInfo}
            onBackToLanding={() => handleNavigate('LANDING')}
            onTriggerBackup={handleTriggerBackup}
            onTriggerSyncRetry={handleTriggerSyncRetry}
            onNavigateToDataProtection={() => handleNavigate('DATA_PROTECTION')}
            onNavigateToIntegrity={() => handleNavigate('DATABASE_INTEGRITY')}
            onRecordActivityEvent={(evt) => setActivityEvents((prev) => [evt, ...prev])}
          />
        );

      case 'INVENTORY_ATTENTION':
        return (
          <InventoryAttentionCenterView
            currentStaff={currentStaff}
            inventoryItems={inventoryItems}
            reorderRecommendations={reorderRecommendations}
            stocktakeRiskSignals={evaluateStocktakeRiskSignals(inventoryItems, inventoryMovements, stocktakeSessions, stockTransfers, operationalExceptions)}
            exceptions={operationalExceptions}
            transfers={stockTransfers}
            stocktakes={stocktakeSessions}
            approvals={approvalRequests}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToView={handleNavigate}
          />
        );

      case 'BACKUP_RESTORE':
      case 'DATA_PROTECTION':
        return (
          <DataProtectionBackupView
            currentStaff={currentStaff}
            backups={backups}
            onBackToLanding={() => handleNavigate('LANDING')}
            onNavigateToRestore={(selectedBackupId) => {
              setSelectedRestoreBackupId(selectedBackupId);
              handleNavigate('RESTORE_DATA');
            }}
            onNavigateToIntegrity={() => handleNavigate('DATABASE_INTEGRITY')}
            onAddBackup={handleAddBackup}
            onEmitActivityEvent={(evt) => {
              const fullEvt: ActivityEvent = {
                id: evt.id || `EVT-${Date.now()}`,
                timestamp: evt.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
                eventType: evt.eventType || 'BACKUP_COMPLETED',
                description: evt.description || 'Data protection event recorded.',
                staffId: evt.staffId || currentStaff.id,
                staffName: evt.staffName || currentStaff.name,
                branchId: evt.branchId || 'BR-01',
                branchName: evt.branchName || 'Main Store Downtown',
                terminalId: evt.terminalId || currentTerminalId,
                referenceDocument: evt.referenceDocument,
                ...evt
              };
              setActivityEvents((prev) => [fullEvt, ...prev]);
            }}
            onAddOperationalException={handleAddOperationalException}
          />
        );

      case 'RESTORE_DATA':
        return (
          <RestoreDataView
            currentStaff={currentStaff}
            backups={backups}
            initialSelectedBackupId={selectedRestoreBackupId || navigationParams?.backupId}
            onBackToDataProtection={() => handleNavigate('DATA_PROTECTION')}
            onNavigateToLanding={() => handleNavigate('LANDING')}
            onAddBackup={handleAddBackup}
            onEmitActivityEvent={(evt) => {
              const fullEvt: ActivityEvent = {
                id: evt.id || `EVT-${Date.now()}`,
                timestamp: evt.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
                eventType: evt.eventType || 'RESTORE_COMPLETED',
                description: evt.description || 'Database recovery event recorded.',
                staffId: evt.staffId || currentStaff.id,
                staffName: evt.staffName || currentStaff.name,
                branchId: evt.branchId || 'BR-01',
                branchName: evt.branchName || 'Main Store Downtown',
                terminalId: evt.terminalId || currentTerminalId,
                referenceDocument: evt.referenceDocument,
                ...evt
              };
              setActivityEvents((prev) => [fullEvt, ...prev]);
            }}
            onAddOperationalException={handleAddOperationalException}
          />
        );

      case 'DATABASE_INTEGRITY':
        return (
          <DatabaseIntegrityView
            currentStaff={currentStaff}
            onBackToDataProtection={() => handleNavigate('DATA_PROTECTION')}
            onNavigateToLanding={() => handleNavigate('LANDING')}
            onEmitActivityEvent={(evt) => {
              const fullEvt: ActivityEvent = {
                id: evt.id || `EVT-${Date.now()}`,
                timestamp: evt.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
                eventType: evt.eventType || 'SYSTEM_INTEGRITY_CHECK',
                description: evt.description || 'Integrity audit completed.',
                staffId: evt.staffId || currentStaff.id,
                staffName: evt.staffName || currentStaff.name,
                branchId: evt.branchId || 'BR-01',
                branchName: evt.branchName || 'Main Store Downtown',
                terminalId: evt.terminalId || currentTerminalId,
                referenceDocument: evt.referenceDocument,
                ...evt
              };
              setActivityEvents((prev) => [fullEvt, ...prev]);
            }}
          />
        );

      default:
        return (
          <GenericBusinessView
            viewType="GENERIC_LIST"
            title={navigationParams?.itemTitle || 'Commercial Module'}
            currentStaff={currentStaff}
            onBackToLanding={() => handleNavigate('LANDING')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col font-sans">
      {appStage === 'SPLASH' && (
        <SplashScreen onFinish={() => setAppStage('WELCOME_UPDATE')} />
      )}

      {appStage === 'WELCOME_UPDATE' && (
        <WelcomeUpdateScreen
          onContinueToStaffAccess={handleContinueFromWelcome}
        />
      )}

      {appStage === 'ACTIVATION' && (
        <ActivationScreen
          onNewTenant={(code) => {
            setOnboardingActivationCode(code);
            setOnboardingJoinInfo(null);
            setAppStage('ONBOARDING');
          }}
          onJoinTenant={(code, pairingCode, resolved) => {
            setOnboardingActivationCode(code);
            setOnboardingPairingCode(pairingCode);
            setOnboardingJoinInfo(resolved);
            setAppStage('ONBOARDING');
          }}
          onBackToWelcome={() => setAppStage('WELCOME_UPDATE')}
        />
      )}

      {appStage === 'ONBOARDING' && (
        onboardingJoinInfo ? (
          <JoinTenantConfirm
            activationCode={onboardingActivationCode}
            pairingCode={onboardingPairingCode}
            resolved={onboardingJoinInfo}
            onJoined={() => setAppStage('STAFF_ACCESS')}
            onBack={() => setAppStage('ACTIVATION')}
          />
        ) : (
          <OnboardingWizard
            activationCode={onboardingActivationCode}
            onAuthenticated={handleStaffAuthenticated}
            onBack={() => setAppStage('ACTIVATION')}
          />
        )
      )}

      {appStage === 'STAFF_ACCESS' && (
        <StaffAccessScreen
          onAuthenticated={handleStaffAuthenticated}
          onBackToWelcome={() => setAppStage('WELCOME_UPDATE')}
        />
      )}

      {appStage === 'MAIN_APP' && (
        <>
          <HeaderNav
            currentStaff={currentStaff}
            activeView={activeView}
            onNavigate={handleNavigate}
            onLockSession={handleLockSession}
            onSwitchStaff={handleSwitchStaff}
            moduleLocked={moduleLock.locked}
          />
          <main className="flex-1 pb-10">{renderActiveView()}</main>

          {/* Operational Shift Modals */}
          <ShiftOpeningModal
            isOpen={isShiftOpeningModalOpen}
            onClose={() => setIsShiftOpeningModalOpen(false)}
            onOpenShift={handleOpenShift}
            terminals={terminals}
            branches={branches}
            currentStaff={currentStaff}
            allShifts={shifts}
            currentTerminalId={currentTerminalId}
            onResolveUnclosedShift={(shift) => {
              setIsShiftOpeningModalOpen(false);
              setClosureShiftTarget(shift);
            }}
          />

          <ShiftClosureModal
            isOpen={!!closureShiftTarget}
            shift={closureShiftTarget}
            currentStaff={currentStaff}
            onClose={() => setClosureShiftTarget(null)}
            onConfirmCloseShift={handleCloseShift}
          />
        </>
      )}
    </div>
  );
}
