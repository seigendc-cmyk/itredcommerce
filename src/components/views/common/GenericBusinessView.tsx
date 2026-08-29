import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Layers, 
  Calendar, 
  DollarSign, 
  User, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import { StaffMember, ActiveView } from '../../../types';
import { Button } from '../../ui/Button';
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface GenericBusinessViewProps {
  viewType: ActiveView;
  title: string;
  subtitle?: string;
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onNavigateToSale?: () => void;
}

export const GenericBusinessView: React.FC<GenericBusinessViewProps> = ({
  viewType,
  title,
  subtitle,
  currentStaff,
  onBackToLanding,
  onNavigateToSale,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Generate domain-appropriate business records
  const generateRecords = () => {
    switch (viewType) {
      case 'CUSTOMERS':
        return [
          { id: 'CUST-1001', name: 'Apex Engineering Corp', contact: 'David Miller', phone: '+1 555-0192', balance: 1450.00, terms: 'Net 30', status: 'Active' },
          { id: 'CUST-1002', name: 'Metro Manufacturing Ltd', contact: 'Sarah Jenkins', phone: '+1 555-0143', balance: 0.00, terms: 'Net 15', status: 'Active' },
          { id: 'CUST-1003', name: 'Highland Auto Fleet Service', contact: 'Carlos Ruiz', phone: '+1 555-0188', balance: 3200.50, terms: 'Net 30', status: 'Active' },
          { id: 'CUST-1004', name: 'Summit Construction Group', contact: 'Mark Evans', phone: '+1 555-0177', balance: 850.00, terms: 'COD', status: 'Active' },
        ];
      case 'SUPPLIERS':
        return [
          { id: 'SUP-101', name: 'Apex Industrial Bearings Ltd.', contact: 'Robert Shaw', email: 'orders@apex-bearings.com', rating: 'Tier 1 Vendor', terms: 'Net 30 Days', status: 'Active' },
          { id: 'SUP-104', name: 'Titan Fasteners & Metallurgy Co.', contact: 'Angela White', email: 'sales@titanfasteners.com', rating: 'Certified Supplier', terms: 'Net 15 Days', status: 'Active' },
          { id: 'SUP-109', name: 'Vanguard Industrial Fluids & Oils', contact: 'Leon Chen', email: 'vanguard@fluids.com', rating: 'Direct Distributor', terms: 'Prepaid COD', status: 'Active' },
          { id: 'SUP-112', name: 'Kodiak Safety Products Corp.', contact: 'Rachel Adams', email: 'procurement@kodiaksafety.com', rating: 'PPE Specialist', terms: 'Net 30 Days', status: 'Active' },
        ];
      case 'DEPARTMENTS':
        return [
          { code: 'D-01', name: 'Hardware & Mechanical', taxRate: '15.0%', marginTarget: '40%', itemsCount: 380, status: 'Active' },
          { code: 'D-02', name: 'Fasteners & Fixtures', taxRate: '15.0%', marginTarget: '45%', itemsCount: 420, status: 'Active' },
          { code: 'D-03', name: 'Lubricants & Fluids', taxRate: '15.0%', marginTarget: '35%', itemsCount: 95, status: 'Active' },
          { code: 'D-04', name: 'Safety Equipment (PPE)', taxRate: '15.0%', marginTarget: '50%', itemsCount: 160, status: 'Active' },
          { code: 'D-05', name: 'Pneumatics & Hydraulics', taxRate: '15.0%', marginTarget: '42%', itemsCount: 185, status: 'Active' },
        ];
      case 'BANK_ACCOUNTS':
        return [
          { code: 'ACC-01', name: 'Commercial Operating Account (Main)', bank: 'Industrial First Bank', accountNo: '••••-8921', balance: '$42,850.00', status: 'Active' },
          { code: 'ACC-02', name: 'Terminal Cash Drawer #1 Float', bank: 'Workstation Vault', accountNo: 'REGISTER-01', balance: '$450.00', status: 'Active' },
          { code: 'ACC-03', name: 'Petty Cash Operating Safe', bank: 'Store Vault', accountNo: 'SAFE-01', balance: '$1,200.00', status: 'Active' },
          { code: 'ACC-04', name: 'Debtor Clearing Account', bank: 'Industrial First Bank', accountNo: '••••-8924', balance: '$12,400.00', status: 'Active' },
        ];
      case 'SALES_HISTORY':
        return [
          { receiptNo: 'RCP-89201', time: '16:15', customer: 'Apex Engineering Corp', items: 3, tender: 'CREDIT', total: '$148.50', cashier: 'Jonathan Reynolds', status: 'Completed' },
          { receiptNo: 'RCP-89200', time: '15:42', customer: 'Walk-in Retail Customer', items: 1, tender: 'CASH', total: '$34.00', cashier: 'Elena Vance', status: 'Completed' },
          { receiptNo: 'RCP-89199', time: '14:20', customer: 'Highland Auto Fleet Service', items: 6, tender: 'CREDIT', total: '$412.00', cashier: 'Elena Vance', status: 'Completed' },
          { receiptNo: 'RCP-89198', time: '13:05', customer: 'Walk-in Retail Customer', items: 2, tender: 'CASH', total: '$56.50', cashier: 'Elena Vance', status: 'Completed' },
        ];
      case 'HELD_RECEIPTS':
      case 'HELD_SALES':
        return [
          { holdId: 'HOLD-001', time: '14:10', customer: 'Metro Manufacturing Ltd', items: 4, estimate: '$340.00', cashier: 'Elena Vance', status: 'Held' },
          { holdId: 'HOLD-002', time: '15:25', customer: 'Walk-in Retail Customer', items: 1, estimate: '$79.50', cashier: 'Jonathan Reynolds', status: 'Held' },
        ];
      case 'EOD_REPORT':
        return [
          { shift: 'Morning Register #01', date: '2026-08-15', openingFloat: '$300.00', cashSales: '$840.00', creditSales: '$1,640.50', expectedDrawer: '$1,140.00', variance: '$0.00', status: 'Completed' },
          { shift: 'Evening Register #01', date: '2026-08-14', openingFloat: '$300.00', cashSales: '$920.00', creditSales: '$1,210.00', expectedDrawer: '$1,220.00', variance: '$0.00', status: 'Completed' },
        ];
      case 'STOCKTAKE':
        return [
          { batchNo: 'STK-2026-Q3', date: '2026-08-01', location: 'Warehouse Bay A', itemsCount: 140, varianceUnits: '-2 Units', valuationDelta: '-$37.00', auditor: 'Marcus Chen', status: 'Completed' },
          { batchNo: 'STK-2026-Q2', date: '2026-05-15', location: 'Warehouse Bay B & C', itemsCount: 220, varianceUnits: '0 Units', valuationDelta: '$0.00', auditor: 'Jonathan Reynolds', status: 'Completed' },
        ];
      default:
        return [
          { id: 'REC-001', code: '1001', description: `${title} Record 01`, date: '2026-08-15', amount: '$1,200.00', status: 'Active' },
          { id: 'REC-002', code: '1002', description: `${title} Record 02`, date: '2026-08-14', amount: '$850.00', status: 'Active' },
          { id: 'REC-003', code: '1003', description: `${title} Record 03`, date: '2026-08-10', amount: '$2,400.00', status: 'Completed' },
        ];
    }
  };

  const records = generateRecords();

  const getColumns = (): Column<any>[] => {
    if (!records || records.length === 0) return [];
    const first = records[0];
    if (!first) return [];
    return Object.keys(first).map((key) => {
      const isAmount = key.toLowerCase().includes('balance') || key.toLowerCase().includes('total') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('estimate');
      const isStatus = key === 'status';

      return {
        key,
        header: key.replace(/([A-Z])/g, ' $1').toUpperCase(),
        align: isAmount ? 'right' : isStatus ? 'center' : 'left',
        isMono: isAmount || key.toLowerCase().includes('code') || key.toLowerCase().includes('id') || key.toLowerCase().includes('no') || key.toLowerCase().includes('phone'),
        render: isStatus ? (row) => <StatusBadge status={row[key]} size="sm" /> : undefined,
      };
    });
  };

  const handleCreateNew = () => {
    setIsAddModalOpen(false);
    setAlertNotice(`New record added to ${title}.`);
    setTimeout(() => setAlertNotice(null), 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header */}
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              {title}
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              {subtitle || `Commercial Management • Operator: ${currentStaff.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add New Entry
          </Button>
          {viewType === 'HELD_RECEIPTS' && onNavigateToSale && (
            <Button variant="secondary" size="sm" onClick={onNavigateToSale}>
              Open POS Register
            </Button>
          )}
        </div>
      </div>

      {alertNotice && (
        <Alert type="success" onClose={() => setAlertNotice(null)}>
          {alertNotice}
        </Alert>
      )}

      {/* Main Table */}
      <DataTable
        columns={getColumns()}
        data={records}
        keyField={(row) => row.id || row.code || row.receiptNo || row.holdId || row.shift || row.batchNo || JSON.stringify(row)}
        searchable
        searchPlaceholder={`Search ${title.toLowerCase()} records...`}
      />

      {/* Create Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Add New: ${title}`}
        subtitle="Workstation Business Record Creation"
        maxWidth="md"
        headerColor="orange"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateNew} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
              Save Entry
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Input label="Record Identifier / Name" placeholder="Enter identifier..." />
          <Input label="Description / Scope" placeholder="Details and operational notes..." />
          <Input label="Category / Reference Code" placeholder="REF-..." isMono />
        </div>
      </Modal>
    </div>
  );
};
