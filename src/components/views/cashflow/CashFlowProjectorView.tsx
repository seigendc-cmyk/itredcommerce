import React, { useState, useMemo } from 'react';
import { 
  StaffMember, 
  CashFlowProjectionEntry, 
  CashFlowPeriodFilter, 
  CashFlowCategoryType,
  CashFlowLineItemCategory,
  CashBankAccount,
  SaleTransaction,
  DebtorTransaction,
  CreditorTransaction,
  CashMovementRecord,
  ReserveTransferRecord,
  ProjectionPriority
} from '../../../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Plus, 
  Sliders, 
  RefreshCw, 
  Download, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  ArrowLeft, 
  FileSpreadsheet, 
  Building2, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  HelpCircle, 
  Tag, 
  Trash2, 
  Edit3, 
  X,
  PieChart,
  BarChart3,
  Flame,
  ShieldCheck,
  Scale
} from 'lucide-react';

export interface CashFlowProjectorViewProps {
  currentStaff: StaffMember;
  projections: CashFlowProjectionEntry[];
  onAddProjection: (entry: Omit<CashFlowProjectionEntry, 'id' | 'createdAt'>) => void;
  onUpdateProjection: (entry: CashFlowProjectionEntry) => void;
  onDeleteProjection: (id: string) => void;
  cashBankAccounts: CashBankAccount[];
  salesTransactions: SaleTransaction[];
  debtorTransactions: DebtorTransaction[];
  creditorTransactions: CreditorTransaction[];
  cashMovements: CashMovementRecord[];
  reserveTransfers: ReserveTransferRecord[];
  onBackToLanding: () => void;
  onNavigateToCashManager?: () => void;
  onNavigateToCreditors?: () => void;
  onNavigateToDebtors?: () => void;
}

const INFLOW_CATEGORIES: { key: CashFlowLineItemCategory; label: string; description: string }[] = [
  { key: 'SALES_CASH', label: 'POS Counter & Walk-in Cash Sales', description: 'Real-time retail walk-in and counter cash takings' },
  { key: 'SALES_CREDIT_COLLECTION', label: 'Debtor & Customer Credit Collections', description: 'Customer AR invoice settlements, cheques & wire recoveries' },
  { key: 'MOBILE_MONEY_SETTLEMENT', label: 'Mobile Money & Wallet Sweeps', description: 'Direct cellular wallet & till collection batches' },
  { key: 'BANK_TRANSFERS_IN', label: 'Bank Electronic Transfers & Deposits', description: 'Direct credit wire transfers and account deposits' },
  { key: 'WHOLESALE_CONTRACTS', label: 'Wholesale & Commercial Contracts', description: 'Bulk supply contract installments and commercial milestones' },
  { key: 'OTHER_INFLOW', label: 'Other Sundry Inflows & Capital Injections', description: 'Miscellaneous revenue, salvage sales and partner equity' },
];

const OUTFLOW_CATEGORIES: { key: CashFlowLineItemCategory; label: string; description: string }[] = [
  { key: 'SUPPLIER_PAYMENTS', label: 'Supplier Invoices & AP Disbursements', description: 'Creditor scheduled disbursements and supplier bill settlements' },
  { key: 'INVENTORY_PURCHASE', label: 'Direct Inventory & COD Procurement', description: 'Cash-on-delivery stock replenishment and emergency parts' },
  { key: 'UTILITIES_BILLS', label: 'Utilities, Fuel & Operational Overheads', description: 'Electricity, water, fiber broadband and generator diesel' },
  { key: 'PAYROLL_SALARIES', label: 'Staff Salaries, Wages & Commissions', description: 'Bi-weekly and monthly personnel remuneration' },
  { key: 'TAX_SETTLEMENTS', label: 'Statutory VAT & Electronic Fiscal Levies', description: 'Direct revenue authority tax debits and fiscal obligations' },
  { key: 'RENT_FACILITIES', label: 'Showroom & Workshop Facilities Rent', description: 'Leasehold premises and secure yard rental payments' },
  { key: 'RESERVE_ALLOCATION', label: 'Business Reserve Escrow Sweeps', description: 'Internal treasury retention for COGS, tax and emergency buffers' },
  { key: 'CAPEX_EQUIPMENT', label: 'Equipment & Workstation CapEx', description: 'Hardware refreshes, tools and POS hardware upgrades' },
  { key: 'OTHER_OUTFLOW', label: 'Sundry Outflows & Bank Charges', description: 'Merchant fees, statutory permits and general petty cash' },
];

export const CashFlowProjectorView: React.FC<CashFlowProjectorViewProps> = ({
  currentStaff,
  projections = [],
  onAddProjection,
  onUpdateProjection,
  onDeleteProjection,
  cashBankAccounts = [],
  salesTransactions = [],
  debtorTransactions = [],
  creditorTransactions = [],
  cashMovements = [],
  reserveTransfers = [],
  onBackToLanding,
  onNavigateToCashManager,
  onNavigateToCreditors,
  onNavigateToDebtors,
}) => {
  // Navigation & Filter States
  const [periodFilter, setPeriodFilter] = useState<CashFlowPeriodFilter>('DAY');
  const [currentBaseDate, setCurrentBaseDate] = useState<string>('2026-08-29');
  const [activeTab, setActiveTab] = useState<'SPREADSHEET' | 'ALLOCATIONS_LEDGER' | 'SCENARIO_SIMULATOR'>('SPREADSHEET');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // What-If Sensitivity Simulator States
  const [salesMultiplier, setSalesMultiplier] = useState<number>(100); // 100% is normal
  const [supplierMultiplier, setSupplierMultiplier] = useState<number>(100); // 100% is normal
  const [expenseMultiplier, setExpenseMultiplier] = useState<number>(100); // 100% is normal

  // Modal State for Logging New Projection
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<CashFlowProjectionEntry | null>(null);

  // New Projection Form State
  const [formCategoryType, setFormCategoryType] = useState<CashFlowCategoryType>('INFLOW');
  const [formLineItemKey, setFormLineItemKey] = useState<CashFlowLineItemCategory>('SALES_CASH');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('2026-08-29');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formActualAmount, setFormActualAmount] = useState<string>('');
  const [formPriority, setFormPriority] = useState<ProjectionPriority>('HIGH');
  const [formAllocatedAccount, setFormAllocatedAccount] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Starting aggregate cash balance across all active accounts
  const totalOpeningCash = useMemo(() => {
    return cashBankAccounts.reduce((acc, account) => acc + (account.currentBalance || 0), 0);
  }, [cashBankAccounts]);

  // Generate Period Columns based on Day, Week, or Month
  const periodColumns = useMemo(() => {
    const cols: {
      periodKey: string;
      label: string;
      subLabel: string;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
    }[] = [];

    const base = new Date(currentBaseDate);

    if (periodFilter === 'DAY') {
      // 7-day window centered/starting around base date (3 days prior, today, 3 days ahead)
      for (let i = -3; i <= 3; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        cols.push({
          periodKey: iso,
          label: `${dayName} ${monthDay}`,
          subLabel: iso === '2026-08-29' ? 'Today' : i < 0 ? 'Actual/Past' : 'Projected',
          startDate: iso,
          endDate: iso,
          isCurrent: iso === '2026-08-29'
        });
      }
    } else if (periodFilter === 'WEEK') {
      // 6-week window
      for (let i = -2; i <= 3; i++) {
        const start = new Date(base);
        start.setDate(base.getDate() + (i * 7) - start.getDay() + 1); // Monday of week
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday of week

        const startIso = start.toISOString().split('T')[0];
        const endIso = end.toISOString().split('T')[0];
        const weekNum = Math.ceil((start.getDate() + 6 - start.getDay()) / 7);
        const monthName = start.toLocaleDateString('en-US', { month: 'short' });
        const periodKey = `W${i >= 0 ? '+' : ''}${i}_${startIso}`;

        cols.push({
          periodKey,
          label: `Week ${i === 0 ? 'Current' : (i > 0 ? `+${i}` : `${i}`)} (${monthName})`,
          subLabel: `${start.getDate()} - ${end.getDate()} ${monthName}`,
          startDate: startIso,
          endDate: endIso,
          isCurrent: i === 0
        });
      }
    } else {
      // 6-month window (2 months prior, current month, 3 months ahead)
      for (let i = -2; i <= 3; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const startIso = new Date(year, month, 1).toISOString().split('T')[0];
        const endIso = new Date(year, month + 1, 0).toISOString().split('T')[0];
        const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        cols.push({
          periodKey,
          label: monthName,
          subLabel: i === 0 ? 'Current Month' : i < 0 ? 'Closed' : 'Forecast',
          startDate: startIso,
          endDate: endIso,
          isCurrent: i === 0
        });
      }
    }

    return cols;
  }, [periodFilter, currentBaseDate]);

  // Aggregate Actuals from POS transactions, Debtors, Creditors, Cash Movements
  const getActualFigureForPeriod = (
    lineItemKey: CashFlowLineItemCategory,
    startDate: string,
    endDate: string
  ): number => {
    let total = 0;

    if (lineItemKey === 'SALES_CASH') {
      salesTransactions.forEach(s => {
        const sDate = s.timestamp ? s.timestamp.split('T')[0] : '';
        if (sDate >= startDate && sDate <= endDate) {
          total += s.tenderSummary?.cash || (s.totalAmount * 0.6);
        }
      });
    } else if (lineItemKey === 'MOBILE_MONEY_SETTLEMENT') {
      salesTransactions.forEach(s => {
        const sDate = s.timestamp ? s.timestamp.split('T')[0] : '';
        if (sDate >= startDate && sDate <= endDate) {
          total += s.tenderSummary?.mobileMoney || 0;
        }
      });
    } else if (lineItemKey === 'SALES_CREDIT_COLLECTION') {
      debtorTransactions.forEach(d => {
        const dDate = d.date ? d.date.split('T')[0] : '';
        if (dDate >= startDate && dDate <= endDate && (d.type === 'PAYMENT' || d.type === 'RECEIPT')) {
          total += d.amount;
        }
      });
    } else if (lineItemKey === 'SUPPLIER_PAYMENTS') {
      creditorTransactions.forEach(c => {
        const cDate = c.date ? c.date.split('T')[0] : '';
        if (cDate >= startDate && cDate <= endDate && c.type === 'PAYMENT') {
          total += c.amount;
        }
      });
    } else if (lineItemKey === 'INVENTORY_PURCHASE') {
      cashMovements.forEach(m => {
        const mDate = m.timestamp ? m.timestamp.split('T')[0] : '';
        if (mDate >= startDate && mDate <= endDate && (m.movementType === 'STOCK_PURCHASE' || m.movementType === 'PAYOUT')) {
          total += m.amount;
        }
      });
    } else if (lineItemKey === 'UTILITIES_BILLS') {
      cashMovements.forEach(m => {
        const mDate = m.timestamp ? m.timestamp.split('T')[0] : '';
        if (mDate >= startDate && mDate <= endDate && m.movementType === 'EXPENSE_PAYOUT') {
          total += m.amount;
        }
      });
    } else if (lineItemKey === 'RESERVE_ALLOCATION') {
      reserveTransfers.forEach(r => {
        const rDate = r.timestamp ? r.timestamp.split('T')[0] : '';
        if (rDate >= startDate && rDate <= endDate && r.transferType === 'ALLOCATION') {
          total += r.amount;
        }
      });
    }

    return total;
  };

  // Compile full spreadsheet matrix with projected, actual, and variance for every cell
  const spreadsheetMatrix = useMemo(() => {
    // 1. Process Inflow Rows
    const inflowRows = INFLOW_CATEGORIES.map(cat => {
      const periods: Record<string, { projected: number; actual: number; variance: number; variancePercent: number }> = {};
      let totalProjected = 0;
      let totalActual = 0;

      periodColumns.forEach(col => {
        // Find matching projection entries
        const matchingProjections = projections.filter(p => {
          return p.categoryType === 'INFLOW' && 
                 p.lineItemKey === cat.key && 
                 p.periodDate >= col.startDate && 
                 p.periodDate <= col.endDate;
        });

        const rawProjected = matchingProjections.reduce((sum, p) => sum + p.projectedAmount, 0);
        // Apply What-If multiplier if applicable
        const projected = cat.key === 'SALES_CASH' || cat.key === 'WHOLESALE_CONTRACTS'
          ? (rawProjected * salesMultiplier) / 100
          : rawProjected;

        // Determine actual from logged entry or transaction engine
        const loggedActual = matchingProjections.reduce((sum, p) => sum + (p.actualAmount || 0), 0);
        const engineActual = getActualFigureForPeriod(cat.key, col.startDate, col.endDate);
        const actual = loggedActual > 0 ? loggedActual : (col.startDate <= '2026-08-29' ? engineActual : 0);

        const variance = actual - projected;
        const variancePercent = projected > 0 ? (variance / projected) * 100 : 0;

        periods[col.periodKey] = {
          projected,
          actual,
          variance,
          variancePercent
        };

        totalProjected += projected;
        totalActual += actual;
      });

      const totalVariance = totalActual - totalProjected;
      const totalVariancePercent = totalProjected > 0 ? (totalVariance / totalProjected) * 100 : 0;

      return {
        key: cat.key,
        title: cat.label,
        categoryType: 'INFLOW' as CashFlowCategoryType,
        lineItemKey: cat.key,
        periods,
        totalProjected,
        totalActual,
        totalVariance,
        totalVariancePercent
      };
    });

    // Inflow Subtotals
    const inflowTotalPeriods: Record<string, { projected: number; actual: number; variance: number; variancePercent: number }> = {};
    let grandTotalInflowProjected = 0;
    let grandTotalInflowActual = 0;

    periodColumns.forEach(col => {
      let colProj = 0;
      let colAct = 0;
      inflowRows.forEach(row => {
        colProj += row.periods[col.periodKey].projected;
        colAct += row.periods[col.periodKey].actual;
      });
      const colVar = colAct - colProj;
      const colVarPct = colProj > 0 ? (colVar / colProj) * 100 : 0;
      inflowTotalPeriods[col.periodKey] = {
        projected: colProj,
        actual: colAct,
        variance: colVar,
        variancePercent: colVarPct
      };
      grandTotalInflowProjected += colProj;
      grandTotalInflowActual += colAct;
    });

    // 2. Process Outflow Rows
    const outflowRows = OUTFLOW_CATEGORIES.map(cat => {
      const periods: Record<string, { projected: number; actual: number; variance: number; variancePercent: number }> = {};
      let totalProjected = 0;
      let totalActual = 0;

      periodColumns.forEach(col => {
        const matchingProjections = projections.filter(p => {
          return p.categoryType === 'OUTFLOW' && 
                 p.lineItemKey === cat.key && 
                 p.periodDate >= col.startDate && 
                 p.periodDate <= col.endDate;
        });

        const rawProjected = matchingProjections.reduce((sum, p) => sum + p.projectedAmount, 0);
        let projected = rawProjected;
        if (cat.key === 'SUPPLIER_PAYMENTS' || cat.key === 'INVENTORY_PURCHASE') {
          projected = (rawProjected * supplierMultiplier) / 100;
        } else if (cat.key === 'UTILITIES_BILLS' || cat.key === 'RENT_FACILITIES') {
          projected = (rawProjected * expenseMultiplier) / 100;
        }

        const loggedActual = matchingProjections.reduce((sum, p) => sum + (p.actualAmount || 0), 0);
        const engineActual = getActualFigureForPeriod(cat.key, col.startDate, col.endDate);
        const actual = loggedActual > 0 ? loggedActual : (col.startDate <= '2026-08-29' ? engineActual : 0);

        const variance = projected - actual; // For expenses, positive variance = under budget (good), negative = overspend
        const variancePercent = projected > 0 ? ((actual - projected) / projected) * 100 : 0;

        periods[col.periodKey] = {
          projected,
          actual,
          variance,
          variancePercent
        };

        totalProjected += projected;
        totalActual += actual;
      });

      const totalVariance = totalProjected - totalActual;
      const totalVariancePercent = totalProjected > 0 ? ((totalActual - totalProjected) / totalProjected) * 100 : 0;

      return {
        key: cat.key,
        title: cat.label,
        categoryType: 'OUTFLOW' as CashFlowCategoryType,
        lineItemKey: cat.key,
        periods,
        totalProjected,
        totalActual,
        totalVariance,
        totalVariancePercent
      };
    });

    // Outflow Subtotals
    const outflowTotalPeriods: Record<string, { projected: number; actual: number; variance: number; variancePercent: number }> = {};
    let grandTotalOutflowProjected = 0;
    let grandTotalOutflowActual = 0;

    periodColumns.forEach(col => {
      let colProj = 0;
      let colAct = 0;
      outflowRows.forEach(row => {
        colProj += row.periods[col.periodKey].projected;
        colAct += row.periods[col.periodKey].actual;
      });
      const colVar = colProj - colAct;
      const colVarPct = colProj > 0 ? ((colAct - colProj) / colProj) * 100 : 0;
      outflowTotalPeriods[col.periodKey] = {
        projected: colProj,
        actual: colAct,
        variance: colVar,
        variancePercent: colVarPct
      };
      grandTotalOutflowProjected += colProj;
      grandTotalOutflowActual += colAct;
    });

    // 3. Net Cash Flow & Running Ending Balance Matrix
    const netCashFlowPeriods: Record<string, { projected: number; actual: number; variance: number }> = {};
    const endingCashPeriods: Record<string, { projected: number; actual: number; variance: number }> = {};

    let runningProjCash = totalOpeningCash;
    let runningActCash = totalOpeningCash;

    periodColumns.forEach(col => {
      const inProj = inflowTotalPeriods[col.periodKey].projected;
      const inAct = inflowTotalPeriods[col.periodKey].actual;
      const outProj = outflowTotalPeriods[col.periodKey].projected;
      const outAct = outflowTotalPeriods[col.periodKey].actual;

      const netProj = inProj - outProj;
      const netAct = inAct - outAct;

      netCashFlowPeriods[col.periodKey] = {
        projected: netProj,
        actual: netAct,
        variance: netAct - netProj
      };

      runningProjCash += netProj;
      runningActCash += netAct;

      endingCashPeriods[col.periodKey] = {
        projected: runningProjCash,
        actual: runningActCash,
        variance: runningActCash - runningProjCash
      };
    });

    return {
      inflowRows,
      inflowTotalPeriods,
      grandTotalInflowProjected,
      grandTotalInflowActual,
      outflowRows,
      outflowTotalPeriods,
      grandTotalOutflowProjected,
      grandTotalOutflowActual,
      netCashFlowPeriods,
      grandNetProjected: grandTotalInflowProjected - grandTotalOutflowProjected,
      grandNetActual: grandTotalInflowActual - grandTotalOutflowActual,
      endingCashPeriods,
      finalProjectedCash: runningProjCash,
      finalActualCash: runningActCash
    };
  }, [
    periodColumns,
    projections,
    salesMultiplier,
    supplierMultiplier,
    expenseMultiplier,
    totalOpeningCash,
    salesTransactions,
    debtorTransactions,
    creditorTransactions,
    cashMovements,
    reserveTransfers
  ]);

  // Handle Form Submission for Adding or Editing Projection
  const handleSaveProjection = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid positive projected amount.');
      return;
    }

    const actualVal = formActualAmount ? parseFloat(formActualAmount) : undefined;

    if (editingEntry) {
      onUpdateProjection({
        ...editingEntry,
        categoryType: formCategoryType,
        lineItemKey: formLineItemKey,
        title: formTitle.trim() || `${formCategoryType === 'INFLOW' ? 'Projected Revenue' : 'Planned Outflow'} (${formDate})`,
        periodDate: formDate,
        projectedAmount: amountVal,
        actualAmount: actualVal,
        priority: formPriority,
        allocatedExpenseAccount: formAllocatedAccount.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      onAddProjection({
        categoryType: formCategoryType,
        lineItemKey: formLineItemKey,
        title: formTitle.trim() || `${formCategoryType === 'INFLOW' ? 'Projected Revenue' : 'Planned Outflow'} (${formDate})`,
        periodDate: formDate,
        projectedAmount: amountVal,
        actualAmount: actualVal,
        priority: formPriority,
        allocatedExpenseAccount: formAllocatedAccount.trim() || undefined,
        notes: formNotes.trim() || undefined,
        createdBy: currentStaff.name,
      });
    }

    // Reset and close modal
    setIsLogModalOpen(false);
    setEditingEntry(null);
    setFormTitle('');
    setFormAmount('');
    setFormActualAmount('');
    setFormNotes('');
    setFormAllocatedAccount('');
  };

  const openNewProjectionModal = (defaultCategory?: CashFlowCategoryType, defaultKey?: CashFlowLineItemCategory) => {
    setEditingEntry(null);
    setFormCategoryType(defaultCategory || 'INFLOW');
    setFormLineItemKey(defaultKey || (defaultCategory === 'OUTFLOW' ? 'SUPPLIER_PAYMENTS' : 'SALES_CASH'));
    setFormTitle('');
    setFormDate(currentBaseDate);
    setFormAmount('');
    setFormActualAmount('');
    setFormPriority('HIGH');
    setFormAllocatedAccount('');
    setFormNotes('');
    setIsLogModalOpen(true);
  };

  const openEditProjectionModal = (entry: CashFlowProjectionEntry) => {
    setEditingEntry(entry);
    setFormCategoryType(entry.categoryType);
    setFormLineItemKey(entry.lineItemKey);
    setFormTitle(entry.title);
    setFormDate(entry.periodDate);
    setFormAmount(entry.projectedAmount.toString());
    setFormActualAmount(entry.actualAmount !== undefined ? entry.actualAmount.toString() : '');
    setFormPriority(entry.priority || 'HIGH');
    setFormAllocatedAccount(entry.allocatedExpenseAccount || '');
    setFormNotes(entry.notes || '');
    setIsLogModalOpen(true);
  };

  // Shift Base Date for Navigation
  const handleShiftPeriod = (direction: 'PREV' | 'NEXT') => {
    const d = new Date(currentBaseDate);
    if (periodFilter === 'DAY') {
      d.setDate(d.getDate() + (direction === 'NEXT' ? 7 : -7));
    } else if (periodFilter === 'WEEK') {
      d.setDate(d.getDate() + (direction === 'NEXT' ? 28 : -28));
    } else {
      d.setMonth(d.getMonth() + (direction === 'NEXT' ? 3 : -3));
    }
    setCurrentBaseDate(d.toISOString().split('T')[0]);
  };

  // Filtered List of Projections for Ledger Tab
  const filteredLedgerEntries = useMemo(() => {
    return projections.filter(p => {
      const matchCat = selectedCategoryFilter === 'ALL' || p.categoryType === selectedCategoryFilter;
      const matchQuery = !searchQuery.trim() || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.lineItemKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.periodDate.includes(searchQuery);
      return matchCat && matchQuery;
    }).sort((a, b) => b.periodDate.localeCompare(a.periodDate));
  }, [projections, selectedCategoryFilter, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Category Type', 'Line Item Key', 'Title', 'Date', 'Projected ($)', 'Actual ($)', 'Variance ($)', 'Priority', 'Notes'];
    const rows = projections.map(p => {
      const variance = (p.actualAmount || 0) - p.projectedAmount;
      return [
        p.categoryType,
        p.lineItemKey,
        `"${p.title.replace(/"/g, '""')}"`,
        p.periodDate,
        p.projectedAmount.toFixed(2),
        p.actualAmount ? p.actualAmount.toFixed(2) : '0.00',
        variance.toFixed(2),
        p.priority || 'NORMAL',
        `"${(p.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `iTred_CashFlow_Projections_${currentBaseDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-gray-100 flex flex-col font-sans text-gray-900 pb-16">
      {/* Top Breadcrumb & Control Bar */}
      <div className="bg-white border-b border-gray-300 px-4 py-3 shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBackToLanding}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-none text-gray-700 cursor-pointer transition-colors"
              title="Return to Landing Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="w-8 h-8 bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-gray-900 uppercase">
                  Cash Flow Spreadsheet Projector
                </h1>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 font-bold border border-emerald-300">
                  TREASURY ENGINE
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 font-bold border border-blue-300 hidden sm:inline">
                  VARIANCE AUDIT
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Log financial projections, allocate planned revenue & expenditure, monitor real-time POS actuals, and evaluate cash runway variances.
              </p>
            </div>
          </div>

          {/* Granularity Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
            {/* Granularity Filter Tabs */}
            <div className="flex items-center bg-gray-200 p-0.5 border border-gray-300 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPeriodFilter('DAY')}
                className={`px-3 py-1 cursor-pointer transition-colors ${
                  periodFilter === 'DAY'
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'text-gray-700 hover:text-black hover:bg-gray-100'
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('WEEK')}
                className={`px-3 py-1 cursor-pointer transition-colors ${
                  periodFilter === 'WEEK'
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'text-gray-700 hover:text-black hover:bg-gray-100'
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('MONTH')}
                className={`px-3 py-1 cursor-pointer transition-colors ${
                  periodFilter === 'MONTH'
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'text-gray-700 hover:text-black hover:bg-gray-100'
                }`}
              >
                Month
              </button>
            </div>

            {/* Horizon Shifter */}
            <div className="flex items-center space-x-1 bg-white border border-gray-300 px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleShiftPeriod('PREV')}
                className="p-0.5 hover:bg-gray-100 text-gray-700 cursor-pointer"
                title="Shift Backward"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-semibold px-1 text-gray-800 text-[11px]">
                {periodFilter === 'DAY' ? `Week of ${currentBaseDate}` : periodFilter === 'WEEK' ? `Month of ${currentBaseDate.substring(0, 7)}` : `FY 2026/27`}
              </span>
              <button
                type="button"
                onClick={() => handleShiftPeriod('NEXT')}
                className="p-0.5 hover:bg-gray-100 text-gray-700 cursor-pointer"
                title="Shift Forward"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Log New Projection Button */}
            <button
              type="button"
              onClick={() => openNewProjectionModal()}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Projection</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium cursor-pointer transition-colors"
              title="Download Projections CSV"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="max-w-7xl mx-auto flex items-center space-x-4 mt-3 pt-2 border-t border-gray-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('SPREADSHEET')}
            className={`pb-1 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'SPREADSHEET'
                ? 'border-[#FF6B00] text-[#FF6B00] font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Interactive Projector Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALLOCATIONS_LEDGER')}
            className={`pb-1 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'ALLOCATIONS_LEDGER'
                ? 'border-[#FF6B00] text-[#FF6B00] font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Allocations & Projections Ledger ({projections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SCENARIO_SIMULATOR')}
            className={`pb-1 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'SCENARIO_SIMULATOR'
                ? 'border-[#FF6B00] text-[#FF6B00] font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>What-If Sensitivity Simulator</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 w-full flex-1 flex flex-col space-y-4">
        {/* Executive Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Starting Balance */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs">
            <div className="text-[11px] font-mono uppercase text-gray-500 font-semibold flex items-center justify-between">
              <span>Opening Cash</span>
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-base font-black text-gray-900 font-mono mt-1">
              ${totalOpeningCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Across {cashBankAccounts.length} tills & accounts
            </div>
          </div>

          {/* Projected Inflows */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs">
            <div className="text-[11px] font-mono uppercase text-emerald-700 font-semibold flex items-center justify-between">
              <span>Projected Inflows</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-base font-black text-emerald-700 font-mono mt-1">
              ${spreadsheetMatrix.grandTotalInflowProjected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
              Actual: ${spreadsheetMatrix.grandTotalInflowActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Planned Outflows */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs">
            <div className="text-[11px] font-mono uppercase text-rose-700 font-semibold flex items-center justify-between">
              <span>Planned Outflows</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-base font-black text-rose-700 font-mono mt-1">
              ${spreadsheetMatrix.grandTotalOutflowProjected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-rose-600 font-mono mt-0.5">
              Actual: ${spreadsheetMatrix.grandTotalOutflowActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Projected Net Flow */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs">
            <div className="text-[11px] font-mono uppercase text-gray-700 font-semibold flex items-center justify-between">
              <span>Projected Net</span>
              <Scale className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className={`text-base font-black font-mono mt-1 ${
              spreadsheetMatrix.grandNetProjected >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {spreadsheetMatrix.grandNetProjected >= 0 ? '+' : ''}
              ${spreadsheetMatrix.grandNetProjected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              Actual Net: ${spreadsheetMatrix.grandNetActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Net Variance */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs">
            <div className="text-[11px] font-mono uppercase text-indigo-700 font-semibold flex items-center justify-between">
              <span>Net Variance</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className={`text-base font-black font-mono mt-1 ${
              (spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {(spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected) >= 0 ? '+' : ''}
              ${(spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-indigo-600 font-mono mt-0.5">
              {(spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected) >= 0 ? 'Favorable Surplus' : 'Deficit / Shortfall'}
            </div>
          </div>

          {/* Projected Closing Cash */}
          <div className="bg-white p-3 border border-gray-300 shadow-2xs bg-gradient-to-br from-white to-orange-50/50">
            <div className="text-[11px] font-mono uppercase text-[#FF6B00] font-bold flex items-center justify-between">
              <span>Ending Runway</span>
              <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
            </div>
            <div className="text-base font-black text-gray-900 font-mono mt-1">
              ${spreadsheetMatrix.finalProjectedCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-600 font-mono mt-0.5">
              Horizon End Cash
            </div>
          </div>
        </div>

        {/* TAB 1: SPREADSHEET MATRIX */}
        {activeTab === 'SPREADSHEET' && (
          <div className="bg-white border border-gray-300 shadow-xs flex flex-col flex-1">
            {/* Spreadsheet Table Header Controls */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#FF6B00]" />
                  <span>Cash Flow Matrix ({periodFilter} Breakdown)</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  • {periodColumns.length} Periods Filtered
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-2xs" />
                  <span className="text-[11px] text-gray-600">Favorable Variance</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-2xs" />
                  <span className="text-[11px] text-gray-600">Under-Collection / Overspend</span>
                </div>
              </div>
            </div>

            {/* High Density Spreadsheet Grid Container */}
            <div className="overflow-x-auto overflow-y-auto max-h-[650px] divide-y divide-gray-200">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                {/* Column Headers */}
                <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 border-b border-gray-300 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5 font-bold uppercase tracking-wider bg-gray-200 border-r border-gray-300 min-w-[260px] sticky left-0 z-30 shadow-2xs">
                      Cash Flow Line Items
                    </th>
                    <th className="p-2.5 font-bold uppercase text-right bg-gray-150 border-r border-gray-300 min-w-[110px]">
                      Total Proj
                    </th>
                    <th className="p-2.5 font-bold uppercase text-right bg-gray-150 border-r border-gray-300 min-w-[110px]">
                      Total Act
                    </th>
                    <th className="p-2.5 font-bold uppercase text-right bg-gray-150 border-r-2 border-gray-300 min-w-[110px]">
                      Variance
                    </th>
                    {periodColumns.map((col) => (
                      <th
                        key={col.periodKey}
                        className={`p-2.5 font-bold text-right border-r border-gray-300 min-w-[130px] ${
                          col.isCurrent
                            ? 'bg-orange-100/90 text-[#FF6B00] border-b-2 border-b-[#FF6B00]'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="font-semibold text-xs leading-tight">{col.label}</div>
                        <div className="text-[10px] text-gray-500 font-normal">{col.subLabel}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 font-mono text-xs">
                  {/* OPENING BALANCE ROW */}
                  <tr className="bg-gray-50/80 font-bold">
                    <td className="p-2.5 border-r border-gray-300 sticky left-0 bg-gray-100/90 z-10 text-gray-900 font-sans">
                      <div className="flex items-center justify-between">
                        <span>OPENING CASH BALANCE</span>
                        <Tag className="w-3 h-3 text-gray-400" />
                      </div>
                    </td>
                    <td className="p-2.5 text-right border-r border-gray-300 text-gray-700">
                      ${totalOpeningCash.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right border-r border-gray-300 text-gray-700">
                      ${totalOpeningCash.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right border-r-2 border-gray-300 text-gray-500">
                      $0.00
                    </td>
                    {periodColumns.map((col, idx) => {
                      return (
                        <td key={col.periodKey} className={`p-2.5 text-right border-r border-gray-300 text-gray-700 ${col.isCurrent ? 'bg-orange-50/40' : ''}`}>
                          ${totalOpeningCash.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECTION HEADER: INFLOWS */}
                  <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-600">
                    <td colSpan={4 + periodColumns.length} className="p-2 px-3 text-emerald-900 font-sans tracking-wide text-xs uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Planned & Realized Cash Inflows (Revenue Receipts)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openNewProjectionModal('INFLOW')}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-sans font-semibold cursor-pointer"
                      >
                        + Add Inflow Projection
                      </button>
                    </td>
                  </tr>

                  {/* INFLOW LINE ITEMS */}
                  {spreadsheetMatrix.inflowRows.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                      <td className="p-2.5 border-r border-gray-300 sticky left-0 bg-white z-10 font-sans">
                        <div className="font-semibold text-gray-900 leading-tight">{row.title}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.key}</div>
                      </td>
                      <td className="p-2.5 text-right border-r border-gray-300 text-gray-800">
                        ${row.totalProjected.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right border-r border-gray-300 font-semibold text-emerald-700">
                        ${row.totalActual.toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right border-r-2 border-gray-300 font-semibold ${
                        row.totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {row.totalVariance >= 0 ? '+' : ''}${row.totalVariance.toFixed(2)}
                        <span className="block text-[9px] font-normal text-gray-500">
                          {row.totalVariancePercent.toFixed(1)}%
                        </span>
                      </td>
                      {periodColumns.map((col) => {
                        const cell = row.periods[col.periodKey];
                        return (
                          <td 
                            key={col.periodKey} 
                            className={`p-2.5 text-right border-r border-gray-300 group hover:bg-orange-50/50 cursor-pointer ${
                              col.isCurrent ? 'bg-orange-50/30' : ''
                            }`}
                            onClick={() => openNewProjectionModal('INFLOW', row.lineItemKey)}
                            title={`Click to log projection or actual for ${col.label}`}
                          >
                            <div className="text-gray-900 font-medium">
                              ${cell.projected.toFixed(2)}
                            </div>
                            {cell.actual > 0 && (
                              <div className="text-[10px] font-semibold text-emerald-700">
                                Act: ${cell.actual.toFixed(2)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* INFLOW TOTAL ROW */}
                  <tr className="bg-emerald-100/70 font-bold border-y-2 border-emerald-300 text-emerald-950">
                    <td className="p-2.5 border-r border-emerald-300 sticky left-0 bg-emerald-100 z-10 font-sans">
                      TOTAL CASH INFLOWS
                    </td>
                    <td className="p-2.5 text-right border-r border-emerald-300">
                      ${spreadsheetMatrix.grandTotalInflowProjected.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right border-r border-emerald-300 text-emerald-800 font-black">
                      ${spreadsheetMatrix.grandTotalInflowActual.toFixed(2)}
                    </td>
                    <td className={`p-2.5 text-right border-r-2 border-emerald-300 ${
                      (spreadsheetMatrix.grandTotalInflowActual - spreadsheetMatrix.grandTotalInflowProjected) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {(spreadsheetMatrix.grandTotalInflowActual - spreadsheetMatrix.grandTotalInflowProjected) >= 0 ? '+' : ''}
                      ${(spreadsheetMatrix.grandTotalInflowActual - spreadsheetMatrix.grandTotalInflowProjected).toFixed(2)}
                    </td>
                    {periodColumns.map((col) => {
                      const totalCell = spreadsheetMatrix.inflowTotalPeriods[col.periodKey];
                      return (
                        <td key={col.periodKey} className="p-2.5 text-right border-r border-emerald-300">
                          <div>${totalCell.projected.toFixed(2)}</div>
                          {totalCell.actual > 0 && (
                            <div className="text-[10px] text-emerald-800">
                              Act: ${totalCell.actual.toFixed(2)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECTION HEADER: OUTFLOWS */}
                  <tr className="bg-rose-50 font-bold border-t-2 border-rose-600">
                    <td colSpan={4 + periodColumns.length} className="p-2 px-3 text-rose-900 font-sans tracking-wide text-xs uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-700" />
                        <span>Planned & Allocated Cash Outflows (Expenditures & AP)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openNewProjectionModal('OUTFLOW')}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-sans font-semibold cursor-pointer"
                      >
                        + Add Outflow Projection
                      </button>
                    </td>
                  </tr>

                  {/* OUTFLOW LINE ITEMS */}
                  {spreadsheetMatrix.outflowRows.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                      <td className="p-2.5 border-r border-gray-300 sticky left-0 bg-white z-10 font-sans">
                        <div className="font-semibold text-gray-900 leading-tight">{row.title}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.key}</div>
                      </td>
                      <td className="p-2.5 text-right border-r border-gray-300 text-gray-800">
                        ${row.totalProjected.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right border-r border-gray-300 font-semibold text-rose-700">
                        ${row.totalActual.toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right border-r-2 border-gray-300 font-semibold ${
                        row.totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {row.totalVariance >= 0 ? '-' : '+'}${Math.abs(row.totalVariance).toFixed(2)}
                        <span className="block text-[9px] font-normal text-gray-500">
                          {row.totalVariance >= 0 ? 'Under Budget' : 'Overspend'}
                        </span>
                      </td>
                      {periodColumns.map((col) => {
                        const cell = row.periods[col.periodKey];
                        return (
                          <td 
                            key={col.periodKey} 
                            className={`p-2.5 text-right border-r border-gray-300 group hover:bg-orange-50/50 cursor-pointer ${
                              col.isCurrent ? 'bg-orange-50/30' : ''
                            }`}
                            onClick={() => openNewProjectionModal('OUTFLOW', row.lineItemKey)}
                            title={`Click to log outflow projection for ${col.label}`}
                          >
                            <div className="text-gray-900 font-medium">
                              ${cell.projected.toFixed(2)}
                            </div>
                            {cell.actual > 0 && (
                              <div className="text-[10px] font-semibold text-rose-700">
                                Act: ${cell.actual.toFixed(2)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* OUTFLOW TOTAL ROW */}
                  <tr className="bg-rose-100/70 font-bold border-y-2 border-rose-300 text-rose-950">
                    <td className="p-2.5 border-r border-rose-300 sticky left-0 bg-rose-100 z-10 font-sans">
                      TOTAL CASH OUTFLOWS
                    </td>
                    <td className="p-2.5 text-right border-r border-rose-300">
                      ${spreadsheetMatrix.grandTotalOutflowProjected.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right border-r border-rose-300 text-rose-800 font-black">
                      ${spreadsheetMatrix.grandTotalOutflowActual.toFixed(2)}
                    </td>
                    <td className={`p-2.5 text-right border-r-2 border-rose-300 ${
                      (spreadsheetMatrix.grandTotalOutflowProjected - spreadsheetMatrix.grandTotalOutflowActual) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {(spreadsheetMatrix.grandTotalOutflowProjected - spreadsheetMatrix.grandTotalOutflowActual) >= 0 ? 'Savings: $' : 'Over: $'}
                      {Math.abs(spreadsheetMatrix.grandTotalOutflowProjected - spreadsheetMatrix.grandTotalOutflowActual).toFixed(2)}
                    </td>
                    {periodColumns.map((col) => {
                      const totalCell = spreadsheetMatrix.outflowTotalPeriods[col.periodKey];
                      return (
                        <td key={col.periodKey} className="p-2.5 text-right border-r border-rose-300">
                          <div>${totalCell.projected.toFixed(2)}</div>
                          {totalCell.actual > 0 && (
                            <div className="text-[10px] text-rose-800">
                              Act: ${totalCell.actual.toFixed(2)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* NET CASH FLOW ROW */}
                  <tr className="bg-gray-100 font-black border-y-2 border-gray-400 text-gray-900">
                    <td className="p-2.5 border-r border-gray-400 sticky left-0 bg-gray-200 z-10 font-sans">
                      NET CASH FLOW (INFLOW - OUTFLOW)
                    </td>
                    <td className={`p-2.5 text-right border-r border-gray-400 ${
                      spreadsheetMatrix.grandNetProjected >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {spreadsheetMatrix.grandNetProjected >= 0 ? '+' : ''}${spreadsheetMatrix.grandNetProjected.toFixed(2)}
                    </td>
                    <td className={`p-2.5 text-right border-r border-gray-400 ${
                      spreadsheetMatrix.grandNetActual >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {spreadsheetMatrix.grandNetActual >= 0 ? '+' : ''}${spreadsheetMatrix.grandNetActual.toFixed(2)}
                    </td>
                    <td className={`p-2.5 text-right border-r-2 border-gray-400 ${
                      (spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {(spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected) >= 0 ? '+' : ''}${(spreadsheetMatrix.grandNetActual - spreadsheetMatrix.grandNetProjected).toFixed(2)}
                    </td>
                    {periodColumns.map((col) => {
                      const netCell = spreadsheetMatrix.netCashFlowPeriods[col.periodKey];
                      return (
                        <td key={col.periodKey} className="p-2.5 text-right border-r border-gray-400">
                          <div className={netCell.projected >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {netCell.projected >= 0 ? '+' : ''}${netCell.projected.toFixed(2)}
                          </div>
                          {netCell.actual !== 0 && (
                            <div className={`text-[10px] ${netCell.actual >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                              Act: ${netCell.actual.toFixed(2)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ENDING CASH RUNWAY POSITION */}
                  <tr className="bg-orange-50 font-black border-t-2 border-[#FF6B00] text-gray-950">
                    <td className="p-3 border-r border-orange-200 sticky left-0 bg-orange-100 z-10 font-sans">
                      <div className="flex items-center justify-between">
                        <span>PROJECTED CLOSING CASH BALANCE</span>
                        <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
                      </div>
                    </td>
                    <td className="p-3 text-right border-r border-orange-200 text-gray-800">
                      ${spreadsheetMatrix.finalProjectedCash.toFixed(2)}
                    </td>
                    <td className="p-3 text-right border-r border-orange-200 text-emerald-800">
                      ${spreadsheetMatrix.finalActualCash.toFixed(2)}
                    </td>
                    <td className="p-3 text-right border-r-2 border-orange-200 text-[#FF6B00]">
                      ${(spreadsheetMatrix.finalActualCash - spreadsheetMatrix.finalProjectedCash).toFixed(2)}
                    </td>
                    {periodColumns.map((col) => {
                      const endCell = spreadsheetMatrix.endingCashPeriods[col.periodKey];
                      return (
                        <td key={col.periodKey} className="p-3 text-right border-r border-orange-200">
                          <div className="text-sm font-bold text-gray-950">
                            ${endCell.projected.toFixed(2)}
                          </div>
                          {col.startDate <= '2026-08-29' && (
                            <div className="text-[10px] text-emerald-800">
                              Act: ${endCell.actual.toFixed(2)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ALLOCATIONS & PROJECTIONS LEDGER */}
        {activeTab === 'ALLOCATIONS_LEDGER' && (
          <div className="bg-white border border-gray-300 shadow-xs flex flex-col flex-1">
            {/* Filter & Search Bar */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-gray-300 font-medium"
                >
                  <option value="ALL">All Flows (Inflows & Outflows)</option>
                  <option value="INFLOW">Inflows Only (Revenue & Collections)</option>
                  <option value="OUTFLOW">Outflows Only (Expenditure & AP)</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter by title, date, key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-gray-300 flex-1 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <button
                  type="button"
                  onClick={() => openNewProjectionModal()}
                  className="px-3 py-1 bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold cursor-pointer"
                >
                  + New Projection Entry
                </button>
              </div>
            </div>

            {/* Projections Table */}
            <div className="overflow-x-auto divide-y divide-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 font-mono text-[11px] uppercase text-gray-700 border-b border-gray-300">
                  <tr>
                    <th className="p-3">Type & Title</th>
                    <th className="p-3">Line Item Key</th>
                    <th className="p-3">Target Date</th>
                    <th className="p-3 text-right">Projected</th>
                    <th className="p-3 text-right">Realized Actual</th>
                    <th className="p-3 text-right">Variance</th>
                    <th className="p-3 text-center">Priority</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-xs">
                  {filteredLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500 font-sans">
                        No projections match the selected filters. Click "+ New Projection Entry" to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerEntries.map((p) => {
                      const isOver = p.actualAmount !== undefined && p.actualAmount > p.projectedAmount;
                      const variance = (p.actualAmount || 0) - p.projectedAmount;

                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-sans">
                            <div className="flex items-center space-x-2">
                              <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-2xs ${
                                p.categoryType === 'INFLOW' 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {p.categoryType}
                              </span>
                              <span className="font-bold text-gray-900">{p.title}</span>
                            </div>
                            {p.notes && (
                              <div className="text-[11px] text-gray-500 mt-0.5">{p.notes}</div>
                            )}
                          </td>
                          <td className="p-3 text-gray-600 text-[11px] font-mono">
                            {p.lineItemKey}
                            {p.allocatedExpenseAccount && (
                              <span className="block text-[10px] text-gray-400">
                                Acc: {p.allocatedExpenseAccount}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-800 font-semibold">
                            {p.periodDate}
                          </td>
                          <td className="p-3 text-right font-bold text-gray-900">
                            ${p.projectedAmount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {p.actualAmount !== undefined ? `$${p.actualAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className={`p-3 text-right font-semibold ${
                            p.actualAmount === undefined ? 'text-gray-400' :
                            (p.categoryType === 'INFLOW' ? variance >= 0 : variance <= 0) 
                              ? 'text-emerald-700' 
                              : 'text-rose-700'
                          }`}>
                            {p.actualAmount !== undefined ? (
                              <>
                                {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                              </>
                            ) : (
                              'Pending'
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase ${
                              p.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              p.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                              p.priority === 'DISCRETIONARY' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                              'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}>
                              {p.priority || 'NORMAL'}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1.5 font-sans">
                            <button
                              type="button"
                              onClick={() => openEditProjectionModal(p)}
                              className="p-1 hover:bg-gray-200 text-gray-700 cursor-pointer"
                              title="Edit projection"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete projection "${p.title}"?`)) {
                                  onDeleteProjection(p.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="Delete projection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WHAT-IF SENSITIVITY SIMULATOR */}
        {activeTab === 'SCENARIO_SIMULATOR' && (
          <div className="bg-white border border-gray-300 shadow-xs p-5 flex flex-col space-y-6">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FF6B00]" />
                <span>What-If Treasury & Sensitivity Simulator</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Dynamically adjust macro parameters to test cash buffer resilience under revenue slumps, supplier cost surges, or unexpected inflation.
              </p>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sales Multiplier */}
              <div className="bg-gray-50 p-4 border border-gray-200">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Retail Sales Revenue Velocity</span>
                  <span className="text-[#FF6B00] font-mono text-sm font-black">{salesMultiplier}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={salesMultiplier}
                  onChange={(e) => setSalesMultiplier(parseInt(e.target.value))}
                  className="w-full mt-3 cursor-pointer accent-[#FF6B00]"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                  <span>-50% Slump</span>
                  <span>100% (Baseline)</span>
                  <span>+50% Surge</span>
                </div>
              </div>

              {/* Supplier AP Inflation Multiplier */}
              <div className="bg-gray-50 p-4 border border-gray-200">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Supplier Invoices & Stock AP</span>
                  <span className="text-rose-700 font-mono text-sm font-black">{supplierMultiplier}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="140"
                  step="5"
                  value={supplierMultiplier}
                  onChange={(e) => setSupplierMultiplier(parseInt(e.target.value))}
                  className="w-full mt-3 cursor-pointer accent-rose-600"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                  <span>80% Discounts</span>
                  <span>100% (Baseline)</span>
                  <span>+40% Price Hikes</span>
                </div>
              </div>

              {/* Operational Expense Multiplier */}
              <div className="bg-gray-50 p-4 border border-gray-200">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Utilities & Overheads</span>
                  <span className="text-purple-700 font-mono text-sm font-black">{expenseMultiplier}%</span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="130"
                  step="5"
                  value={expenseMultiplier}
                  onChange={(e) => setExpenseMultiplier(parseInt(e.target.value))}
                  className="w-full mt-3 cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                  <span>90% Lean Ops</span>
                  <span>100% (Baseline)</span>
                  <span>+30% Inflation</span>
                </div>
              </div>
            </div>

            {/* Simulation Impact Outcome */}
            <div className="bg-gray-100 p-4 border border-gray-300">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Simulated Runway Impact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div className="bg-white p-3 border border-gray-200">
                  <div className="text-[11px] text-gray-500">Simulated Total Inflows</div>
                  <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                    ${spreadsheetMatrix.grandTotalInflowProjected.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white p-3 border border-gray-200">
                  <div className="text-[11px] text-gray-500">Simulated Total Outflows</div>
                  <div className="text-lg font-black text-rose-700 font-mono mt-0.5">
                    ${spreadsheetMatrix.grandTotalOutflowProjected.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white p-3 border border-gray-200">
                  <div className="text-[11px] text-gray-500">Simulated Ending Cash Position</div>
                  <div className={`text-lg font-black font-mono mt-0.5 ${
                    spreadsheetMatrix.finalProjectedCash >= 5000 ? 'text-emerald-700' :
                    spreadsheetMatrix.finalProjectedCash > 0 ? 'text-amber-600' : 'text-rose-700'
                  }`}>
                    ${spreadsheetMatrix.finalProjectedCash.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSalesMultiplier(100);
                    setSupplierMultiplier(100);
                    setExpenseMultiplier(100);
                  }}
                  className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-300 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Reset Multipliers to 100% Baseline
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('SPREADSHEET')}
                  className="px-3 py-1 bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
                >
                  View Updated Matrix →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: LOG OR EDIT PROJECTION / ALLOCATION */}
      {isLogModalOpen && (
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-lg border border-gray-300 shadow-2xl flex flex-col text-gray-900">
            {/* Modal Header */}
            <div className="p-4 bg-[#FF6B00] text-white flex items-center justify-between border-b border-[#E05E00]">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  {editingEntry ? 'Edit Cash Flow Projection' : 'Log New Projection & Allocation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProjection} className="p-5 space-y-4 text-xs">
              {/* Category Flow Selector */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Cash Flow Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormCategoryType('INFLOW');
                      setFormLineItemKey('SALES_CASH');
                    }}
                    className={`py-2 px-3 text-xs font-bold border text-center cursor-pointer transition-colors ${
                      formCategoryType === 'INFLOW'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    + Cash Inflow (Revenue / Collection)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormCategoryType('OUTFLOW');
                      setFormLineItemKey('SUPPLIER_PAYMENTS');
                    }}
                    className={`py-2 px-3 text-xs font-bold border text-center cursor-pointer transition-colors ${
                      formCategoryType === 'OUTFLOW'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    - Cash Outflow (Expenditure / AP)
                  </button>
                </div>
              </div>

              {/* Line Item Category Selection */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Line Item Category
                </label>
                <select
                  value={formLineItemKey}
                  onChange={(e) => setFormLineItemKey(e.target.value as CashFlowLineItemCategory)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 font-medium"
                >
                  {(formCategoryType === 'INFLOW' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES).map(cat => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label} ({cat.key})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Title / Reference Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled Wire from Apex Logistics, Fasteners AP, Monthly Rent..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900"
                />
              </div>

              {/* Date & Amounts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-gray-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Projected Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-gray-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Realized Actual ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                    value={formActualAmount}
                    onChange={(e) => setFormActualAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 font-mono text-emerald-700 font-bold"
                  />
                </div>
              </div>

              {/* Priority & Account Allocation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Priority / Criticality
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as ProjectionPriority)}
                    className="w-full px-3 py-2 bg-white border border-gray-300"
                  >
                    <option value="CRITICAL">Critical (Statutory / Immediate)</option>
                    <option value="HIGH">High (Key Suppliers & Stock)</option>
                    <option value="NORMAL">Normal (Standard Operations)</option>
                    <option value="DISCRETIONARY">Discretionary (CapEx / Buffer)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Allocated Account / Center
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ACC-AP-SUPP, ACC-EXP-UTIL"
                    value={formAllocatedAccount}
                    onChange={(e) => setFormAllocatedAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Treasury Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context, invoice references, payment terms..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold cursor-pointer"
                >
                  {editingEntry ? 'Update Projection' : 'Save Projection Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
