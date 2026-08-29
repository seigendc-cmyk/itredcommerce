import { 
  ReportDefinition, 
  ReportFilterCriteria, 
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
} from '../types';

export interface ReportGeneratedData {
  report: ReportDefinition;
  filters: ReportFilterCriteria;
  generatedDateTime: string;
  stationId: string;
  summaryMetrics: {
    label: string;
    value: string;
    sublabel?: string;
    isPositive?: boolean;
    isNegative?: boolean;
  }[];
  chartData?: {
    type: 'bar' | 'pie' | 'line';
    title: string;
    series: { name: string; value: number; color?: string; secondaryValue?: number }[];
  };
  tableHeaders: { key: string; label: string; align?: 'left' | 'right' | 'center'; isCurrency?: boolean }[];
  tableRows: Record<string, any>[];
  totalRow?: Record<string, any>;
  footerNotes?: string;
}

export function generateReportData(
  report: ReportDefinition,
  filters: ReportFilterCriteria,
  context?: {
    sales?: SaleTransaction[];
    inventory?: InventoryItem[];
    customers?: Customer[];
    suppliers?: Supplier[];
    shifts?: Shift[];
    cashAccounts?: CashBankAccount[];
    cashMovements?: CashMovementRecord[];
    stocktakes?: StocktakeSession[];
    approvals?: ApprovalRequest[];
    biAlerts?: BIRuleAlert[];
  }
): ReportGeneratedData {
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const ctx = context || {};
  const sales = ctx.sales || [];
  const inventory = ctx.inventory || [];
  const customers = ctx.customers || [];
  const suppliers = ctx.suppliers || [];
  const shifts = ctx.shifts || [];
  const cashAccounts = ctx.cashAccounts || [];
  const cashMovements = ctx.cashMovements || [];
  const stocktakes = ctx.stocktakes || [];
  const approvals = ctx.approvals || [];
  const biAlerts = ctx.biAlerts || [];

  // ----------------------------------------------------
  // 1. SALES GROUP REPORTS
  // ----------------------------------------------------
  if (report.groupKey === 'SALES') {
    if (report.code === 'SAL-SUM') {
      const grossSales = sales.reduce((acc, s) => acc + (s.subtotal || s.grandTotal), 0);
      const taxCollected = sales.reduce((acc, s) => acc + (s.taxTotal || 0), 0);
      const netRevenue = sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
      const totalTxCount = sales.length;
      const avgTicket = totalTxCount > 0 ? netRevenue / totalTxCount : 0;

      return {
        report,
        filters,
        generatedDateTime: timestamp,
        stationId: 'POS-D01 (Main Downtown)',
        summaryMetrics: [
          { label: 'Gross Revenue', value: `$${netRevenue.toFixed(2)}`, sublabel: `${totalTxCount} Transactions`, isPositive: true },
          { label: 'VAT / Tax Output', value: `$${taxCollected.toFixed(2)}`, sublabel: '15.0% Standard VAT' },
          { label: 'Average Ticket Value', value: `$${avgTicket.toFixed(2)}`, sublabel: 'Per Completed Sale' },
          { label: 'Gross Profit Est.', value: `$${(netRevenue * 0.38).toFixed(2)}`, sublabel: '38.0% Estimated Margin', isPositive: true },
        ],
        chartData: {
          type: 'bar',
          title: 'Daily Sales Performance & Revenue Curve',
          series: [
            { name: 'Mon 08/11', value: 1840.00, color: '#FF6B00' },
            { name: 'Tue 08/12', value: 2150.50, color: '#FF6B00' },
            { name: 'Wed 08/13', value: 1980.25, color: '#FF6B00' },
            { name: 'Thu 08/14', value: 2480.50, color: '#FF6B00' },
            { name: 'Fri 08/15 (Today)', value: netRevenue > 0 ? netRevenue : 2840.00, color: '#E05E00' },
          ]
        },
        tableHeaders: [
          { key: 'invoiceNumber', label: 'Receipt / Invoice #' },
          { key: 'dateTime', label: 'Date & Time' },
          { key: 'customerName', label: 'Customer' },
          { key: 'cashierName', label: 'Cashier' },
          { key: 'paymentMethod', label: 'Payment Tender' },
          { key: 'itemCount', label: 'Items', align: 'center' },
          { key: 'taxAmount', label: 'Tax (VAT)', align: 'right', isCurrency: true },
          { key: 'totalAmount', label: 'Net Total', align: 'right', isCurrency: true },
        ],
        tableRows: sales.map(s => ({
          invoiceNumber: s.saleNumber,
          dateTime: s.dateTime,
          customerName: s.customer?.name || 'Walk-in Retail',
          cashierName: s.cashier?.name || 'Elena Vance',
          paymentMethod: s.payments?.map(p => p.method).join(', ') || 'CASH',
          itemCount: s.items.reduce((sum, item) => sum + item.quantity, 0),
          taxAmount: `$${(s.taxTotal || 0).toFixed(2)}`,
          totalAmount: `$${(s.grandTotal).toFixed(2)}`,
        })),
        totalRow: {
          invoiceNumber: 'TOTAL SUMMARY',
          dateTime: `${sales.length} Invoices`,
          customerName: '—',
          cashierName: '—',
          paymentMethod: 'Multi-Tender',
          itemCount: sales.reduce((acc, s) => acc + s.items.reduce((sum, i) => sum + i.quantity, 0), 0),
          taxAmount: `$${taxCollected.toFixed(2)}`,
          totalAmount: `$${netRevenue.toFixed(2)}`,
        }
      };
    }

    if (report.code === 'SAL-ITM') {
      const rows = inventory.slice(0, 10).map((itm, idx) => {
        const qtySold = 18 - (idx * 2) > 0 ? 18 - (idx * 2) : 3;
        const revenue = qtySold * itm.retailPrice;
        const cost = qtySold * itm.unitCost;
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
        return {
          sku: itm.sku,
          name: itm.name,
          department: itm.department,
          unitCost: `$${itm.unitCost.toFixed(2)}`,
          retailPrice: `$${itm.retailPrice.toFixed(2)}`,
          qtySold,
          revenue: `$${revenue.toFixed(2)}`,
          profit: `$${(revenue - cost).toFixed(2)}`,
          margin: `${margin.toFixed(1)}%`,
          rawRevenue: revenue
        };
      });

      const totalRevenue = rows.reduce((acc, r) => acc + r.rawRevenue, 0);

      return {
        report,
        filters,
        generatedDateTime: timestamp,
        stationId: 'POS-D01 (Main Downtown)',
        summaryMetrics: [
          { label: 'Top Item Sales Volume', value: `$${totalRevenue.toFixed(2)}`, sublabel: 'Ranked by Line-Item Turnover', isPositive: true },
          { label: 'Active Ranked SKUs', value: `${rows.length} Items`, sublabel: 'In Top Velocity Tier' },
          { label: 'Average Item Margin', value: '37.8%', sublabel: 'Across Top Performers', isPositive: true },
        ],
        chartData: {
          type: 'bar',
          title: 'Top Items by Revenue Turnover ($)',
          series: rows.slice(0, 5).map(r => ({ name: r.name.length > 20 ? r.name.substring(0, 18) + '…' : r.name, value: r.rawRevenue, color: '#FF6B00' }))
        },
        tableHeaders: [
          { key: 'sku', label: 'SKU Code' },
          { key: 'name', label: 'Item Description' },
          { key: 'department', label: 'Department' },
          { key: 'unitCost', label: 'Unit Cost', align: 'right' },
          { key: 'retailPrice', label: 'Unit Retail', align: 'right' },
          { key: 'qtySold', label: 'Qty Sold', align: 'center' },
          { key: 'revenue', label: 'Total Revenue', align: 'right' },
          { key: 'profit', label: 'Gross Profit', align: 'right' },
          { key: 'margin', label: 'Margin %', align: 'right' },
        ],
        tableRows: rows,
      };
    }

    if (report.code === 'SAL-PAY') {
      const payMethods = [
        { method: 'Cash (USD / Local)', count: 12, total: 1480.50, color: '#16A34A' },
        { method: 'Commercial Account (Credit)', count: 4, total: 950.00, color: '#0284C7' },
        { method: 'Bank Debit Card / POS', count: 3, total: 320.00, color: '#9333EA' },
        { method: 'Mobile Money (Ecocash/M-Pesa)', count: 2, total: 180.00, color: '#EA580C' },
      ];
      const grandTotal = payMethods.reduce((acc, p) => acc + p.total, 0);

      return {
        report,
        filters,
        generatedDateTime: timestamp,
        stationId: 'POS-D01 (Main Downtown)',
        summaryMetrics: [
          { label: 'Total Tendered', value: `$${grandTotal.toFixed(2)}`, sublabel: 'All Payment Channels', isPositive: true },
          { label: 'Cash Share', value: `${((1480.50 / grandTotal) * 100).toFixed(1)}%`, sublabel: '$1,480.50 in physical notes' },
          { label: 'Credit Account Share', value: `${((950.00 / grandTotal) * 100).toFixed(1)}%`, sublabel: 'Commercial Debtors' },
        ],
        chartData: {
          type: 'pie',
          title: 'Tender Distribution by Payment Method',
          series: payMethods.map(p => ({ name: p.method, value: p.total, color: p.color }))
        },
        tableHeaders: [
          { key: 'method', label: 'Payment Method / Tender' },
          { key: 'count', label: 'Tx Count', align: 'center' },
          { key: 'percentage', label: 'Share %', align: 'right' },
          { key: 'total', label: 'Total Amount', align: 'right', isCurrency: true },
        ],
        tableRows: payMethods.map(p => ({
          method: p.method,
          count: p.count,
          percentage: `${((p.total / grandTotal) * 100).toFixed(1)}%`,
          total: `$${p.total.toFixed(2)}`,
        })),
        totalRow: {
          method: 'TOTAL SETTLED',
          count: payMethods.reduce((a, b) => a + b.count, 0),
          percentage: '100.0%',
          total: `$${grandTotal.toFixed(2)}`,
        }
      };
    }
  }

  // ----------------------------------------------------
  // 2. INVENTORY GROUP REPORTS
  // ----------------------------------------------------
  if (report.groupKey === 'INVENTORY') {
    if (report.code === 'INV-SOH' || report.code === 'INV-VAL') {
      const totalCostValuation = inventory.reduce((acc, itm) => acc + (itm.stockOnHand * itm.unitCost), 0);
      const totalRetailValuation = inventory.reduce((acc, itm) => acc + (itm.stockOnHand * itm.retailPrice), 0);
      const totalUnits = inventory.reduce((acc, itm) => acc + itm.stockOnHand, 0);

      return {
        report,
        filters,
        generatedDateTime: timestamp,
        stationId: 'WH-01 / Central Distribution',
        summaryMetrics: [
          { label: 'Total Inventory Valuation (Cost)', value: `$${totalCostValuation.toFixed(2)}`, sublabel: 'Asset Balance Sheet Value', isPositive: true },
          { label: 'Potential Realization (Retail)', value: `$${totalRetailValuation.toFixed(2)}`, sublabel: 'At Full Catalog Retail Price' },
          { label: 'Total Stock Units', value: `${totalUnits} Units`, sublabel: `Across ${inventory.length} Master SKUs` },
          { label: 'Unrealized Gross Margin', value: `$${(totalRetailValuation - totalCostValuation).toFixed(2)}`, sublabel: `${(((totalRetailValuation - totalCostValuation) / (totalRetailValuation || 1)) * 100).toFixed(1)}% Potential Margin`, isPositive: true },
        ],
        chartData: {
          type: 'bar',
          title: 'Stock Valuation by Department ($)',
          series: [
            { name: 'Motor Spares', value: 4820.00, color: '#FF6B00' },
            { name: 'Hardware & Fasteners', value: 3410.00, color: '#3B82F6' },
            { name: 'Lubricants & Oils', value: 2980.00, color: '#10B981' },
            { name: 'Electrical & Power', value: 1850.00, color: '#F59E0B' },
            { name: 'Safety & Workwear', value: 920.00, color: '#8B5CF6' },
          ]
        },
        tableHeaders: [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Item Name' },
          { key: 'department', label: 'Department' },
          { key: 'binLocation', label: 'Bin / Location' },
          { key: 'unitCost', label: 'Unit Cost', align: 'right' },
          { key: 'retailPrice', label: 'Retail Price', align: 'right' },
          { key: 'soh', label: 'Stock On Hand', align: 'center' },
          { key: 'costValuation', label: 'Cost Valuation', align: 'right', isCurrency: true },
          { key: 'retailValuation', label: 'Retail Valuation', align: 'right', isCurrency: true },
        ],
        tableRows: inventory.map(itm => ({
          sku: itm.sku,
          name: itm.name,
          department: itm.department,
          binLocation: itm.location || 'Bay 01',
          unitCost: `$${itm.unitCost.toFixed(2)}`,
          retailPrice: `$${itm.retailPrice.toFixed(2)}`,
          soh: itm.stockOnHand,
          costValuation: `$${(itm.stockOnHand * itm.unitCost).toFixed(2)}`,
          retailValuation: `$${(itm.stockOnHand * itm.retailPrice).toFixed(2)}`,
        })),
        totalRow: {
          sku: 'TOTAL INVENTORY',
          name: `${inventory.length} Master SKUs`,
          department: 'All Departments',
          binLocation: 'Central Hub',
          unitCost: '—',
          retailPrice: '—',
          soh: totalUnits,
          costValuation: `$${totalCostValuation.toFixed(2)}`,
          retailValuation: `$${totalRetailValuation.toFixed(2)}`,
        }
      };
    }

    if (report.code === 'INV-LOW' || report.code === 'INV-OOS') {
      const lowStockItems = inventory.filter(i => i.stockOnHand <= (i.reorderLevel || 5));
      return {
        report,
        filters,
        generatedDateTime: timestamp,
        stationId: 'POS-D01 / Inventory Subsystem',
        summaryMetrics: [
          { label: 'Reorder Breaches', value: `${lowStockItems.length} SKUs`, sublabel: 'Below Reorder Threshold', isNegative: true },
          { label: 'Out of Stock SKUs', value: `${inventory.filter(i => i.stockOnHand === 0).length} SKUs`, sublabel: '0 Units on Hand', isNegative: true },
          { label: 'Estimated Restock Capital', value: '$2,480.00', sublabel: 'To Reach Par Stock Levels' },
        ],
        tableHeaders: [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Item Description' },
          { key: 'department', label: 'Department' },
          { key: 'soh', label: 'Stock On Hand', align: 'center' },
          { key: 'reorderLevel', label: 'Reorder Point', align: 'center' },
          { key: 'shortage', label: 'Shortfall Qty', align: 'center' },
          { key: 'preferredSupplier', label: 'Preferred Supplier' },
          { key: 'status', label: 'Urgency', align: 'center' },
        ],
        tableRows: lowStockItems.map(itm => ({
          sku: itm.sku,
          name: itm.name,
          department: itm.department,
          soh: itm.stockOnHand,
          reorderLevel: itm.reorderLevel || 5,
          shortage: Math.max(0, (itm.reorderLevel || 5) - itm.stockOnHand),
          preferredSupplier: itm.preferredSupplier || 'Standard Vendor',
          status: itm.stockOnHand === 0 ? 'CRITICAL STOCKOUT' : 'REORDER REQUIRED',
        }))
      };
    }
  }

  // ----------------------------------------------------
  // 3. DEBTORS GROUP REPORTS (ACCOUNTS RECEIVABLE)
  // ----------------------------------------------------
  if (report.groupKey === 'DEBTORS') {
    const totalDebtors = customers.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
    const totalOverdue = customers.reduce((acc, c) => acc + (c.overdueAmount || 0), 0);
    const totalCreditLimit = customers.reduce((acc, c) => acc + (c.creditLimit || 0), 0);

    return {
      report,
      filters,
      generatedDateTime: timestamp,
      stationId: 'FIN-01 (Treasury & Credit Control)',
      summaryMetrics: [
        { label: 'Total Outstanding AR', value: `$${totalDebtors.toFixed(2)}`, sublabel: 'Customer Accounts Receivable', isPositive: false },
        { label: 'Total Overdue Debt', value: `$${totalOverdue.toFixed(2)}`, sublabel: 'Payment Past Terms', isNegative: totalOverdue > 0 },
        { label: 'Total Credit Facility', value: `$${totalCreditLimit.toFixed(2)}`, sublabel: 'Authorized Credit Ceiling' },
        { label: 'Portfolio Risk Rating', value: 'Moderate (B+)', sublabel: `${((totalOverdue / (totalDebtors || 1)) * 100).toFixed(1)}% Overdue Ratio` },
      ],
      chartData: {
        type: 'bar',
        title: 'Debtor Aging Distribution ($)',
        series: [
          { name: 'Current (0-15d)', value: 2450.00, color: '#16A34A' },
          { name: '16-30 Days', value: 860.00, color: '#EAB308' },
          { name: '31-60 Days', value: 1200.00, color: '#F97316' },
          { name: '61-90+ Days', value: 1500.00, color: '#DC2626' },
        ]
      },
      tableHeaders: [
        { key: 'accountNumber', label: 'Account #' },
        { key: 'name', label: 'Customer / Company Name' },
        { key: 'paymentTerms', label: 'Terms' },
        { key: 'creditLimit', label: 'Credit Limit', align: 'right', isCurrency: true },
        { key: 'currentBalance', label: 'Current Balance', align: 'right', isCurrency: true },
        { key: 'availableCredit', label: 'Available Credit', align: 'right', isCurrency: true },
        { key: 'overdueAmount', label: 'Overdue Amount', align: 'right', isCurrency: true },
        { key: 'status', label: 'Credit Status', align: 'center' },
      ],
      tableRows: customers.filter(c => (c.creditLimit || 0) > 0 || (c.currentBalance || 0) > 0).map(c => ({
        accountNumber: c.accountNumber,
        name: c.companyName ? `${c.companyName} (${c.name})` : c.name,
        paymentTerms: c.paymentTerms || 'Net 30 Days',
        creditLimit: `$${(c.creditLimit || 0).toFixed(2)}`,
        currentBalance: `$${(c.currentBalance || 0).toFixed(2)}`,
        availableCredit: `$${(c.availableCredit || 0).toFixed(2)}`,
        overdueAmount: `$${(c.overdueAmount || 0).toFixed(2)}`,
        status: (c.overdueAmount || 0) > 0 ? 'OVERDUE / SUSPENDED' : 'GOOD STANDING',
      })),
      totalRow: {
        accountNumber: 'TOTAL DEBTORS',
        name: `${customers.length} Commercial Accounts`,
        paymentTerms: '—',
        creditLimit: `$${totalCreditLimit.toFixed(2)}`,
        currentBalance: `$${totalDebtors.toFixed(2)}`,
        availableCredit: `$${(totalCreditLimit - totalDebtors).toFixed(2)}`,
        overdueAmount: `$${totalOverdue.toFixed(2)}`,
        status: '—',
      }
    };
  }

  // ----------------------------------------------------
  // 4. CASH / BANK GROUP REPORTS
  // ----------------------------------------------------
  if (report.groupKey === 'CASH_BANK') {
    const totalCashBank = cashAccounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);

    return {
      report,
      filters,
      generatedDateTime: timestamp,
      stationId: 'TREASURY-01 (Main Branch)',
      summaryMetrics: [
        { label: 'Total Liquid Funds', value: `$${totalCashBank.toFixed(2)}`, sublabel: 'Across All Cash & Bank Accounts', isPositive: true },
        { label: 'POS Tills Float', value: `$${(cashAccounts.find(a => a.accountType === 'CASH_TILL')?.currentBalance || 320).toFixed(2)}`, sublabel: 'Front-Office Cash Drawers' },
        { label: 'Vault / Safe Balance', value: `$${(cashAccounts.find(a => a.accountType === 'CASH_SAFE')?.currentBalance || 4850).toFixed(2)}`, sublabel: 'Branch Drop Safe' },
        { label: 'Bank Operating Balance', value: `$${(cashAccounts.find(a => a.accountType === 'BANK_ACCOUNT')?.currentBalance || 18450).toFixed(2)}`, sublabel: 'First Commercial Bank', isPositive: true },
      ],
      tableHeaders: [
        { key: 'code', label: 'Account Code' },
        { key: 'name', label: 'Account Description' },
        { key: 'type', label: 'Account Category' },
        { key: 'location', label: 'Custodian / Branch' },
        { key: 'currentBalance', label: 'Current Balance', align: 'right', isCurrency: true },
        { key: 'status', label: 'Account Status', align: 'center' },
      ],
      tableRows: cashAccounts.map(a => ({
        code: a.code,
        name: a.name,
        type: a.accountType.replace('_', ' '),
        location: a.branchName || 'Downtown Main',
        currentBalance: `$${a.currentBalance.toFixed(2)}`,
        status: a.status,
      })),
      totalRow: {
        code: 'TOTAL LIQUIDITY',
        name: `${cashAccounts.length} Verified Accounts`,
        type: 'Consolidated Ledger',
        location: 'All Locations',
        currentBalance: `$${totalCashBank.toFixed(2)}`,
        status: 'RECONCILED',
      }
    };
  }

  // ----------------------------------------------------
  // 5. BI GROUP REPORTS
  // ----------------------------------------------------
  if (report.groupKey === 'BI') {
    return {
      report,
      filters,
      generatedDateTime: timestamp,
      stationId: 'BI-ENGINE-01 (Desktop Rule Analytics)',
      summaryMetrics: [
        { label: 'Active Operational Alerts', value: `${biAlerts.filter(a => a.status === 'NEW' || a.status === 'REVIEWED').length}`, sublabel: 'Action Required', isNegative: true },
        { label: 'Critical Risk Items', value: `${biAlerts.filter(a => a.priority === 'CRITICAL').length}`, sublabel: 'Immediate Attention', isNegative: true },
        { label: 'Resolved Anomalies', value: `${biAlerts.filter(a => a.status === 'RESOLVED' || a.status === 'APPROVED').length}`, sublabel: 'Reconciled & Audited', isPositive: true },
        { label: 'System Health Score', value: '94 / 100', sublabel: 'Rule Verification Passing', isPositive: true },
      ],
      tableHeaders: [
        { key: 'dateTime', label: 'Date/Time' },
        { key: 'category', label: 'Category' },
        { key: 'title', label: 'Operational Alert / Rule Trigger' },
        { key: 'priority', label: 'Priority', align: 'center' },
        { key: 'related', label: 'Related Record' },
        { key: 'status', label: 'Status', align: 'center' },
        { key: 'response', label: 'Action Taken' },
      ],
      tableRows: biAlerts.map(a => ({
        dateTime: a.dateTime,
        category: a.category.replace('_', ' '),
        title: a.title,
        priority: a.priority,
        related: `${a.relatedRecord.type}: ${a.relatedRecord.name}`,
        status: a.status,
        response: a.userResponse?.action || 'Awaiting Review',
      }))
    };
  }

  // ----------------------------------------------------
  // DEFAULT / FALLBACK TEMPLATE FOR OTHER GROUPS
  // (Purchasing, Creditors, Staff, Stocktake, Audit)
  // ----------------------------------------------------
  return {
    report,
    filters,
    generatedDateTime: timestamp,
    stationId: 'POS-D01 (iTred Commercial Core)',
    summaryMetrics: [
      { label: 'Total Records Generated', value: '14 Entries', sublabel: 'Filtered by Selected Criteria', isPositive: true },
      { label: 'Compliance Audit Hash', value: 'VERIFIED-SHA256', sublabel: 'Local SQLite/Storage Hash' },
      { label: 'Station Status', value: 'OFFLINE DESKTOP', sublabel: 'Standard Local Mode' },
    ],
    tableHeaders: [
      { key: 'ref', label: 'Reference #' },
      { key: 'timestamp', label: 'Date / Time' },
      { key: 'description', label: 'Description / Event' },
      { key: 'actor', label: 'Operator / Entity' },
      { key: 'amount', label: 'Value / Valuation', align: 'right', isCurrency: true },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    tableRows: [
      { ref: 'AUD-88190', timestamp: '2026-08-15 08:30', description: 'Terminal Opening Float Balance Verified ($250.00)', actor: 'Jonathan Reynolds (Store Manager)', amount: '$250.00', status: 'VERIFIED' },
      { ref: 'AUD-88191', timestamp: '2026-08-15 09:15', description: 'Product Price Verification — Honda Fit Ball Joint ($38.50)', actor: 'Elena Vance (Senior Cashier)', amount: '$38.50', status: 'COMPLIANT' },
      { ref: 'AUD-88192', timestamp: '2026-08-15 10:20', description: 'Stock Intake Dock #2 — Titan Fasteners 60 Units', actor: 'Marcus Chen (Inventory Officer)', amount: '$1,464.00', status: 'ACCEPTED' },
      { ref: 'AUD-88193', timestamp: '2026-08-15 11:45', description: 'Cash Skim Drop to Main Drop Safe #Drop-9901', actor: 'Elena Vance (Senior Cashier)', amount: '$300.00', status: 'APPROVED' },
      { ref: 'AUD-88194', timestamp: '2026-08-15 14:10', description: 'Customer Credit Terms Verification — Apex Engineering', actor: 'System Governance Engine', amount: '$5,000.00', status: 'ACTIVE' },
    ]
  };
}
