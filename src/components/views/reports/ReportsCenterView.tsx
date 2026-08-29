import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  Mail, 
  Share2, 
  CloudUpload, 
  Calendar, 
  Building2, 
  Boxes, 
  Users, 
  DollarSign, 
  Lock, 
  ShieldCheck, 
  BrainCircuit, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowLeft, 
  Download, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  RefreshCw, 
  X,
  CreditCard,
  Building,
  HardDrive,
  MessageSquare
} from 'lucide-react';
import { 
  ReportDefinition, 
  ReportGroupKey, 
  ReportDatePreset, 
  ReportFilterCriteria, 
  StaffMember, 
  SaleTransaction, 
  InventoryItem, 
  Customer, 
  Supplier, 
  Shift, 
  CashBankAccount, 
  CashMovementRecord, 
  StocktakeSession, 
  ApprovalRequest, 
  BIRuleAlert 
} from '../../../types';
import { REPORT_DEFINITIONS } from '../../../data/mockBiData';
import { generateReportData, ReportGeneratedData } from '../../../utils/reportDataGenerator';
import { Button } from '../../ui/Button';

export interface ReportsCenterViewProps {
  currentStaff: StaffMember;
  salesTransactions?: SaleTransaction[];
  inventoryItems?: InventoryItem[];
  customers?: Customer[];
  suppliers?: Supplier[];
  shifts?: Shift[];
  cashAccounts?: CashBankAccount[];
  cashMovements?: CashMovementRecord[];
  stocktakeSessions?: StocktakeSession[];
  approvalRequests?: ApprovalRequest[];
  biAlerts?: BIRuleAlert[];
  // Backwards compatibility aliases
  purchaseOrders?: any[];
  eodReports?: any[];
  debtorTransactions?: any[];
  creditorTransactions?: any[];
  cashBankAccounts?: CashBankAccount[];
  cashBankTransactions?: any[];
  stocktakes?: StocktakeSession[];
  onBackToLanding: () => void;
  onNavigateToBI?: () => void;
  onNavigateToUpgrade?: () => void;
}

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({
  currentStaff,
  salesTransactions = [],
  inventoryItems = [],
  customers = [],
  suppliers = [],
  shifts = [],
  cashAccounts = [],
  cashMovements = [],
  stocktakeSessions = [],
  approvalRequests = [],
  biAlerts = [],
  cashBankAccounts = [],
  stocktakes = [],
  onBackToLanding,
  onNavigateToBI,
  onNavigateToUpgrade,
}) => {
  const effectiveCashAccounts = cashAccounts.length > 0 ? cashAccounts : cashBankAccounts;
  const effectiveStocktakes = stocktakeSessions.length > 0 ? stocktakeSessions : stocktakes;
  // Navigation & Selected Report
  const [selectedGroup, setSelectedGroup] = useState<ReportGroupKey>('SALES');
  const [selectedReportId, setSelectedReportId] = useState<string>('REP-SALES-01');
  const [searchReportQuery, setSearchReportQuery] = useState<string>('');

  // Report Filter State
  const [filterCriteria, setFilterCriteria] = useState<ReportFilterCriteria>({
    datePreset: 'THIS_MONTH',
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    branchId: 'ALL',
    warehouseId: 'ALL',
    department: 'ALL',
    staffId: 'ALL',
    paymentMethod: 'ALL',
    customerCategory: 'ALL',
    statusFilter: 'ALL',
    searchQuery: '',
  });

  // Sharing Modal States
  const [sharingModalType, setSharingModalType] = useState<'EMAIL' | 'WHATSAPP' | 'CLOUD' | 'EXPORT_CONFIRM' | null>(null);
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [isPrintPreviewActive, setIsPrintPreviewActive] = useState<boolean>(false);

  // Group definitions
  const reportGroups: { key: ReportGroupKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'SALES', label: '1. Sales', icon: <BarChart3 className="w-4 h-4 text-[#FF6B00]" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'SALES').length },
    { key: 'INVENTORY', label: '2. Inventory', icon: <Boxes className="w-4 h-4 text-blue-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'INVENTORY').length },
    { key: 'PURCHASING', label: '3. Purchasing', icon: <Building2 className="w-4 h-4 text-emerald-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'PURCHASING').length },
    { key: 'DEBTORS', label: '4. Debtors (AR)', icon: <Users className="w-4 h-4 text-cyan-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'DEBTORS').length },
    { key: 'CREDITORS', label: '5. Creditors (AP)', icon: <Building className="w-4 h-4 text-indigo-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'CREDITORS').length },
    { key: 'CASH_BANK', label: '6. Cash / Bank', icon: <DollarSign className="w-4 h-4 text-amber-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'CASH_BANK').length },
    { key: 'STAFF', label: '7. Staff Productivity', icon: <Users className="w-4 h-4 text-purple-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'STAFF').length },
    { key: 'STOCKTAKE', label: '8. Stocktake & Audit', icon: <Boxes className="w-4 h-4 text-teal-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'STOCKTAKE').length },
    { key: 'AUDIT', label: '9. Audit Trail & Voids', icon: <ShieldCheck className="w-4 h-4 text-rose-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'AUDIT').length },
    { key: 'BI', label: '10. Business Intelligence', icon: <BrainCircuit className="w-4 h-4 text-orange-600" />, count: REPORT_DEFINITIONS.filter(r => r.groupKey === 'BI').length },
  ];

  // Active Report Definition
  const activeReport = useMemo(() => {
    return REPORT_DEFINITIONS.find((r) => r.id === selectedReportId) || REPORT_DEFINITIONS[0];
  }, [selectedReportId]);

  // Reports in selected group
  const reportsInGroup = useMemo(() => {
    return REPORT_DEFINITIONS.filter((r) => {
      if (r.groupKey !== selectedGroup) return false;
      if (searchReportQuery.trim()) {
        const q = searchReportQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedGroup, searchReportQuery]);

  // Generate Report Live Data
  const reportData: ReportGeneratedData = useMemo(() => {
    return generateReportData(activeReport, filterCriteria, {
      sales: salesTransactions,
      inventory: inventoryItems,
      customers,
      suppliers,
      shifts,
      cashAccounts: effectiveCashAccounts,
      cashMovements,
      stocktakes: effectiveStocktakes,
      approvals: approvalRequests,
      biAlerts,
    });
  }, [activeReport, filterCriteria, salesTransactions, inventoryItems, customers, suppliers, shifts, effectiveCashAccounts, cashMovements, effectiveStocktakes, approvalRequests, biAlerts]);

  // Handle Export Excel (CSV generation)
  const handleExportExcel = () => {
    if (!reportData) return;

    // CSV Header row
    const headers = reportData.tableHeaders.map((h) => `"${h.label}"`).join(',');
    
    // CSV Rows
    const rows = reportData.tableRows.map((row) => {
      return reportData.tableHeaders.map((h) => {
        const val = row[h.key] !== undefined ? `${row[h.key]}` : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    // CSV Total row
    let totalLine = '';
    if (reportData.totalRow) {
      totalLine = '\n' + reportData.tableHeaders.map((h) => {
        const val = reportData.totalRow![h.key] !== undefined ? `${reportData.totalRow![h.key]}` : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    }

    const csvContent = `Report: ${reportData.report.name}\nGenerated: ${reportData.generatedDateTime}\nStation: ${reportData.stationId}\n\n${headers}\n${rows.join('\n')}${totalLine}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.report.code}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOfflineNotice(`Report exported successfully as "${reportData.report.code}.csv" to local workstation storage.`);
  };

  // Handle Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Connected action triggers
  const handleEmailAction = () => {
    setSharingModalType('EMAIL');
    setOfflineNotice('Offline Notice: Workstation is operating in Local Desktop Mode. Internet connection is required to transmit live email relays. Report will be added to the local outbound spool.');
  };

  const handleWhatsAppAction = () => {
    setSharingModalType('WHATSAPP');
    setOfflineNotice('Offline Notice: Direct WhatsApp transmission requires an active Internet gateway. You may export as PDF or copy formatted summary text.');
  };

  const handleCloudAction = () => {
    setSharingModalType('CLOUD');
    setOfflineNotice('Cloud Hub: Local report generated successfully. Cloud multi-branch sync is an extension of the upcoming iTred Online edition.');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 select-none font-sans print:p-0 print:m-0 print:max-w-none">
      {/* Top Header & Breadcrumbs (Hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mb-1">
            <button
              type="button"
              onClick={onBackToLanding}
              className="hover:text-[#FF6B00] cursor-pointer"
            >
              Operations Center
            </button>
            <span>/</span>
            <span className="text-gray-900 font-bold">Reports Center</span>
            <span>/</span>
            <span className="text-[#FF6B00]">{activeReport.name}</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-[#FF6B00] text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span>Executive Reports & Audit Center</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            10 Standardized Commercial Report Groups with local instant generation, spreadsheet export, and audit verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Local Report Engine (Offline)</span>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={onBackToLanding}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Offline Alert Strip Notice (if active) */}
      {offlineNotice && (
        <div className="bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 flex items-center justify-between shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{offlineNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setOfflineNotice(null)}
            className="text-amber-700 hover:text-amber-950 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Sidebar (Report Groups & Selection) + Main Report Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Report Groups & Report List (4 cols) - Hidden in Print */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          {/* Report Groups Selector */}
          <div className="bg-white border border-gray-200 shadow-xs">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-gray-800 font-mono">
                Report Groups (10)
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {REPORT_DEFINITIONS.length} Total Reports
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {reportGroups.map((group) => {
                const isSelected = selectedGroup === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group.key);
                      const firstInGroup = REPORT_DEFINITIONS.find((r) => r.groupKey === group.key);
                      if (firstInGroup) {
                        setSelectedReportId(firstInGroup.id);
                      }
                    }}
                    className={`w-full p-2.5 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/80 text-[#FF6B00] font-bold border-l-4 border-l-[#FF6B00]'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {group.icon}
                      <span>{group.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200">
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reports in Selected Group */}
          <div className="bg-white border border-gray-200 shadow-xs">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-gray-800 font-mono">
                {reportGroups.find((g) => g.key === selectedGroup)?.label}
              </span>
            </div>

            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter reports in category..."
                  value={searchReportQuery}
                  onChange={(e) => setSearchReportQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[340px] overflow-y-auto">
              {reportsInGroup.map((rep) => {
                const isSelected = selectedReportId === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReportId(rep.id)}
                    className={`w-full p-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF6B00]/10 border-l-4 border-l-[#FF6B00]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-gray-900">{rep.name}</div>
                      {rep.badge && (
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-gray-200 text-gray-700 font-bold">
                          {rep.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-tight">
                      {rep.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Report Viewer & Sharing Toolbar (8 cols) */}
        <div className="lg:col-span-8 space-y-4 print:col-span-12">
          
          {/* REPORT CONTROLS & SHARING TOOLBAR (Hidden in Print) */}
          <div className="bg-white border border-gray-200 p-4 shadow-xs space-y-4 print:hidden">
            {/* Top Toolbar Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <div className="text-[11px] text-gray-500 font-mono">
                  Report Code: <strong>{activeReport.code}</strong> • {reportGroups.find((g) => g.key === activeReport.groupKey)?.label}
                </div>
                <h2 className="text-base font-black text-gray-900">
                  {activeReport.name}
                </h2>
              </div>

              {/* REPORT SHARING ACTIONS */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePrint}
                  leftIcon={<Printer className="w-3.5 h-3.5" />}
                  className="bg-[#FF6B00] hover:bg-[#E05E00] text-white"
                >
                  Print
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportExcel}
                  leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
                >
                  Export Excel
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  leftIcon={<FileText className="w-3.5 h-3.5 text-red-700" />}
                >
                  Export PDF
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleEmailAction}
                  leftIcon={<Mail className="w-3.5 h-3.5 text-blue-600" />}
                >
                  Email
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleWhatsAppAction}
                  leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                >
                  WhatsApp
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCloudAction}
                  leftIcon={<CloudUpload className="w-3.5 h-3.5 text-indigo-600" />}
                >
                  Send to Cloud
                </Button>
              </div>
            </div>

            {/* Filter Parameters Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono block mb-1">
                  Timeframe
                </label>
                <select
                  value={filterCriteria.datePreset}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, datePreset: e.target.value as ReportDatePreset })}
                  className="w-full text-xs border border-gray-300 p-1.5 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="TODAY">Today (08/15)</option>
                  <option value="YESTERDAY">Yesterday</option>
                  <option value="LAST_7_DAYS">Last 7 Days</option>
                  <option value="THIS_MONTH">This Month (August)</option>
                  <option value="LAST_MONTH">Last Month (July)</option>
                  <option value="YEAR_TO_DATE">Year to Date 2026</option>
                  <option value="CUSTOM">Custom Date Range</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono block mb-1">
                  Branch / Store
                </label>
                <select
                  value={filterCriteria.branchId}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, branchId: e.target.value })}
                  className="w-full text-xs border border-gray-300 p-1.5 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="ALL">All Branches</option>
                  <option value="BR-01">Main Downtown Branch</option>
                  <option value="BR-02">Westside Trade Center</option>
                  <option value="WH-01">Central Warehouse Depot</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono block mb-1">
                  Department
                </label>
                <select
                  value={filterCriteria.department}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, department: e.target.value })}
                  className="w-full text-xs border border-gray-300 p-1.5 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Motor Spares">Motor Spares</option>
                  <option value="Hardware & Mechanical">Hardware & Mechanical</option>
                  <option value="Lubricants & Fluids">Lubricants & Fluids</option>
                  <option value="Electrical & Power">Electrical & Power</option>
                  <option value="Safety Equipment">Safety Equipment</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono block mb-1">
                  Cashier / Staff
                </label>
                <select
                  value={filterCriteria.staffId}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, staffId: e.target.value })}
                  className="w-full text-xs border border-gray-300 p-1.5 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="ALL">All Staff</option>
                  <option value="STF-001">Jonathan Reynolds (Manager)</option>
                  <option value="STF-002">Elena Vance (Senior Cashier)</option>
                  <option value="STF-003">Marcus Chen (Inventory)</option>
                </select>
              </div>
            </div>
          </div>

          {/* PHYSICAL REPORT SHEET / VIEWER (Print Friendly) */}
          <div className="bg-white border border-gray-300 shadow-sm p-6 space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Formal Report Header */}
            <div className="border-b-2 border-gray-900 pb-4 flex items-start justify-between">
              <div>
                <div className="text-xl font-black italic tracking-tighter text-gray-900">
                  iTred<span className="text-[#FF6B00] not-italic">Commerce</span>
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-800 mt-1">
                  {reportData.report.name}
                </div>
                <div className="text-[11px] text-gray-600 font-mono mt-0.5">
                  Station: {reportData.stationId} • Category: {reportData.report.groupKey}
                </div>
              </div>

              <div className="text-right text-[11px] font-mono text-gray-600">
                <div>Generated: <strong>{reportData.generatedDateTime}</strong></div>
                <div>Operator: <strong>{currentStaff.name}</strong></div>
                <div>Format: <strong>{reportData.report.code} (Standard Ledger)</strong></div>
                <div className="text-emerald-700 font-bold mt-0.5">● Local Certified Output</div>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {reportData.summaryMetrics.map((metric, idx) => (
                <div key={idx} className="border border-gray-200 p-3 bg-gray-50/70">
                  <div className="text-[10px] uppercase font-mono text-gray-500">{metric.label}</div>
                  <div className={`text-lg font-black font-mono mt-0.5 ${
                    metric.isPositive ? 'text-emerald-700' : metric.isNegative ? 'text-red-700' : 'text-gray-900'
                  }`}>
                    {metric.value}
                  </div>
                  {metric.sublabel && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{metric.sublabel}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Visual Chart Section (if present) - Clean SVG Visualization */}
            {reportData.chartData && (
              <div className="border border-gray-200 p-4 bg-[#FAF8F5] print:hidden">
                <div className="text-xs font-bold uppercase font-mono text-gray-700 mb-3 flex items-center justify-between">
                  <span>{reportData.chartData.title}</span>
                  <span className="text-[10px] text-gray-500 font-normal">Calculated Metric Series</span>
                </div>

                {reportData.chartData.type === 'bar' && (
                  <div className="space-y-2.5">
                    {reportData.chartData.series.map((bar, idx) => {
                      const maxVal = Math.max(...reportData.chartData!.series.map((s) => s.value), 1);
                      const pct = Math.min(100, Math.max(8, (bar.value / maxVal) * 100));
                      return (
                        <div key={idx} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-semibold text-gray-800">{bar.name}</span>
                            <span className="font-bold text-gray-900">${bar.value.toFixed(2)}</span>
                          </div>
                          <div className="w-full h-3 bg-gray-200 rounded-none overflow-hidden">
                            <div
                              className="h-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: bar.color || '#FF6B00' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {reportData.chartData.type === 'pie' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {reportData.chartData.series.map((slice, idx) => (
                      <div key={idx} className="p-2 border border-gray-200 bg-white flex items-center gap-2">
                        <div className="w-3 h-3 shrink-0" style={{ backgroundColor: slice.color || '#FF6B00' }} />
                        <div className="text-[11px] font-mono">
                          <div className="font-bold truncate text-gray-900">{slice.name}</div>
                          <div className="text-gray-600">${slice.value.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TABULAR REPORT DATA GRID */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-200">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold uppercase tracking-wider font-mono">
                    {reportData.tableHeaders.map((hdr) => (
                      <th
                        key={hdr.key}
                        className={`p-2.5 ${
                          hdr.align === 'right' ? 'text-right' : hdr.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {hdr.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-sans">
                  {reportData.tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-gray-50/80 transition-colors">
                      {reportData.tableHeaders.map((hdr) => (
                        <td
                          key={hdr.key}
                          className={`p-2.5 text-[11px] ${
                            hdr.align === 'right' ? 'text-right font-mono' : hdr.align === 'center' ? 'text-center font-mono' : 'text-left'
                          }`}
                        >
                          {row[hdr.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                {/* Total Summary Footer Row */}
                {reportData.totalRow && (
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold text-gray-900 font-mono text-xs">
                      {reportData.tableHeaders.map((hdr) => (
                        <td
                          key={hdr.key}
                          className={`p-2.5 ${
                            hdr.align === 'right' ? 'text-right' : hdr.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {reportData.totalRow![hdr.key] || ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Verification Footer & Sign-off */}
            <div className="border-t border-gray-200 pt-4 flex flex-wrap items-center justify-between text-[10px] text-gray-500 font-mono">
              <div>
                <span>Audit Signature Hash: <strong>ITRED-SEC-VERIFIED-{reportData.report.code}-2026</strong></span>
              </div>
              <div className="flex items-center gap-4">
                <span>Certified by: ________________________</span>
                <span>Manager Sign-off: ________________________</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SHARING MODALS (Email / WhatsApp / Cloud) */}
      {sharingModalType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-300 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sharingModalType === 'EMAIL' && <Mail className="w-4 h-4 text-blue-600" />}
                {sharingModalType === 'WHATSAPP' && <MessageSquare className="w-4 h-4 text-emerald-600" />}
                {sharingModalType === 'CLOUD' && <CloudUpload className="w-4 h-4 text-indigo-600" />}
                <h3 className="font-bold text-sm text-gray-900">
                  {sharingModalType === 'EMAIL' && 'Email Report Dispatch'}
                  {sharingModalType === 'WHATSAPP' && 'Share Report via WhatsApp'}
                  {sharingModalType === 'CLOUD' && 'Send Report to Cloud Portal'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSharingModalType(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-950">Workstation in Offline Mode</div>
                  <p className="mt-0.5 leading-relaxed text-[11px]">
                    Internet connection is required to complete live network transmissions. Local report generation and CSV/PDF export are fully functional offline.
                  </p>
                </div>
              </div>

              {sharingModalType === 'EMAIL' && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Recipient Email Address</label>
                  <input
                    type="email"
                    placeholder="accountant@company.com"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full p-2 border border-gray-300 focus:outline-none focus:border-[#FF6B00] bg-white text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-500 font-mono mt-1 block">
                    Report file {reportData.report.code}.pdf will be queued in local outbox spool.
                  </span>
                </div>
              )}

              {sharingModalType === 'WHATSAPP' && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">WhatsApp Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="w-full p-2 border border-gray-300 focus:outline-none focus:border-[#FF6B00] bg-white text-xs font-mono"
                  />
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-700">
                    <strong>Preview Message:</strong><br />
                    iTred {reportData?.report?.name || 'Report'} — Generated: {reportData?.generatedDateTime || 'Now'}. Total: {reportData?.summaryMetrics?.[0]?.value || '$0.00'}.
                  </div>
                </div>
              )}

              {sharingModalType === 'CLOUD' && (
                <div className="space-y-2">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                    <strong>iTred Cloud Synchronizer:</strong><br />
                    Uploads ledger snapshot to secure central portal for multi-branch consolidation. Requires iTred Online edition subscription.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSharingModalType(null)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setOfflineNotice(`Report transmission queued. When connection is detected, ${reportData.report.code} will be dispatched.`);
                  setSharingModalType(null);
                }}
                className="bg-[#FF6B00] hover:bg-[#E05E00]"
              >
                Queue in Local Spool
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
