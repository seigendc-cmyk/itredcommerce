import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Tag, 
  Layers, 
  Edit3, 
  Info, 
  FileSpreadsheet, 
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  PackageX,
  Building2,
  Barcode
} from 'lucide-react';
import { InventoryItem, StaffMember, ActiveView } from '../../../types';
import { 
  evaluateCommercialDataQuality, 
  CommercialDataQualityReport 
} from '../../../utils/deterministicRulesEngine';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';

export interface CommercialDataQualityViewProps {
  currentStaff: StaffMember;
  inventoryItems: InventoryItem[];
  onBackToLanding: () => void;
  onEditProduct: (item: InventoryItem) => void;
  onQuickPriceUpdate: (item: InventoryItem) => void;
}

export const CommercialDataQualityView: React.FC<CommercialDataQualityViewProps> = ({
  currentStaff,
  inventoryItems,
  onBackToLanding,
  onEditProduct,
  onQuickPriceUpdate,
}) => {
  const [selectedIssueTab, setSelectedIssueTab] = useState<
    'ALL_ISSUES' | 'MISSING_COST' | 'MISSING_PRICE' | 'MISSING_DEPT' | 'MISSING_SUPPLIER' | 'MISSING_REORDER' | 'DUPLICATES'
  >('ALL_ISSUES');
  const [searchTerm, setSearchTerm] = useState('');

  const qualityReport: CommercialDataQualityReport = useMemo(() => {
    return evaluateCommercialDataQuality(inventoryItems);
  }, [inventoryItems]);

  // Filter items based on active tab
  const displayedItems = useMemo(() => {
    let list: InventoryItem[] = [];

    switch (selectedIssueTab) {
      case 'MISSING_COST':
        list = qualityReport.missingCostItems;
        break;
      case 'MISSING_PRICE':
        list = qualityReport.missingPriceItems;
        break;
      case 'MISSING_DEPT':
        list = qualityReport.missingDepartmentItems;
        break;
      case 'MISSING_SUPPLIER':
        list = qualityReport.missingSupplierItems;
        break;
      case 'MISSING_REORDER':
        list = qualityReport.missingReorderLevelItems;
        break;
      case 'DUPLICATES':
        const dupSkus = qualityReport.duplicateSkuOrBarcodeWarnings.map((w) => w.sku);
        list = inventoryItems.filter((i) => dupSkus.includes(i.sku));
        break;
      case 'ALL_ISSUES':
      default:
        const combined = new Set<string>([
          ...qualityReport.missingCostItems.map((i) => i.sku),
          ...qualityReport.missingPriceItems.map((i) => i.sku),
          ...qualityReport.missingDepartmentItems.map((i) => i.sku),
          ...qualityReport.missingSupplierItems.map((i) => i.sku),
          ...qualityReport.missingReorderLevelItems.map((i) => i.sku),
        ]);
        list = inventoryItems.filter((i) => combined.has(i.sku));
        break;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return list.filter((i) => 
        i.sku.toLowerCase().includes(q) || 
        i.description.toLowerCase().includes(q) ||
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.toLowerCase().includes(q))
      );
    }

    return list;
  }, [selectedIssueTab, qualityReport, inventoryItems, searchTerm]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] text-[#1c1d22]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e4ea] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="p-1.5 hover:bg-[#f1f3f7] rounded-md">
            <ArrowLeft className="w-4 h-4 text-[#555a68]" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1c1d22]">Commercial Data Quality Audit</h1>
              <span className="bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] text-xs font-semibold px-2 py-0.5 rounded">
                Score: {qualityReport.overallQualityScore}%
              </span>
            </div>
            <p className="text-xs text-[#6e7485] mt-0.5">
              Deterministic validation of master catalog fields to ensure accurate gross margins, price-floor controls, and automated reorder buffers.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Score & Defect Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 px-6 py-4">
        <div 
          onClick={() => setSelectedIssueTab('MISSING_COST')}
          className={`cursor-pointer bg-white border rounded-lg p-3 shadow-xs transition-all ${
            selectedIssueTab === 'MISSING_COST' ? 'border-[#e05e00] ring-1 ring-[#e05e00]' : 'border-[#e1e4ea] hover:border-[#cbd0dc]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-[#6e7485] font-semibold">Missing Cost</div>
            <DollarSign className="w-4 h-4 text-[#dc2626]" />
          </div>
          <div className="text-xl font-bold text-[#dc2626] mt-1">{qualityReport.missingCostItems.length}</div>
          <div className="text-[11px] text-[#6e7485] mt-0.5">Blocks margin logic</div>
        </div>

        <div 
          onClick={() => setSelectedIssueTab('MISSING_PRICE')}
          className={`cursor-pointer bg-white border rounded-lg p-3 shadow-xs transition-all ${
            selectedIssueTab === 'MISSING_PRICE' ? 'border-[#e05e00] ring-1 ring-[#e05e00]' : 'border-[#e1e4ea] hover:border-[#cbd0dc]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-[#6e7485] font-semibold">Missing Price ($0)</div>
            <Tag className="w-4 h-4 text-[#ea580c]" />
          </div>
          <div className="text-xl font-bold text-[#ea580c] mt-1">{qualityReport.missingPriceItems.length}</div>
          <div className="text-[11px] text-[#6e7485] mt-0.5">Blocks normal sale</div>
        </div>

        <div 
          onClick={() => setSelectedIssueTab('MISSING_REORDER')}
          className={`cursor-pointer bg-white border rounded-lg p-3 shadow-xs transition-all ${
            selectedIssueTab === 'MISSING_REORDER' ? 'border-[#e05e00] ring-1 ring-[#e05e00]' : 'border-[#e1e4ea] hover:border-[#cbd0dc]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-[#6e7485] font-semibold">Missing Reorder Lvl</div>
            <PackageX className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="text-xl font-bold text-[#1c1d22] mt-1">{qualityReport.missingReorderLevelItems.length}</div>
          <div className="text-[11px] text-[#6e7485] mt-0.5">Disables reorder rules</div>
        </div>

        <div 
          onClick={() => setSelectedIssueTab('MISSING_SUPPLIER')}
          className={`cursor-pointer bg-white border rounded-lg p-3 shadow-xs transition-all ${
            selectedIssueTab === 'MISSING_SUPPLIER' ? 'border-[#e05e00] ring-1 ring-[#e05e00]' : 'border-[#e1e4ea] hover:border-[#cbd0dc]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-[#6e7485] font-semibold">Missing Supplier</div>
            <Building2 className="w-4 h-4 text-[#64748b]" />
          </div>
          <div className="text-xl font-bold text-[#1c1d22] mt-1">{qualityReport.missingSupplierItems.length}</div>
          <div className="text-[11px] text-[#6e7485] mt-0.5">Vendor unassigned</div>
        </div>

        <div 
          onClick={() => setSelectedIssueTab('DUPLICATES')}
          className={`cursor-pointer bg-white border rounded-lg p-3 shadow-xs transition-all ${
            selectedIssueTab === 'DUPLICATES' ? 'border-[#e05e00] ring-1 ring-[#e05e00]' : 'border-[#e1e4ea] hover:border-[#cbd0dc]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-xs text-[#6e7485] font-semibold">Duplicate Barcodes</div>
            <Barcode className="w-4 h-4 text-[#2563eb]" />
          </div>
          <div className="text-xl font-bold text-[#1c1d22] mt-1">{qualityReport.duplicateSkuOrBarcodeWarnings.length}</div>
          <div className="text-[11px] text-[#6e7485] mt-0.5">Barcode collisions</div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedIssueTab('ALL_ISSUES')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedIssueTab === 'ALL_ISSUES'
                ? 'bg-[#1c1d22] text-white'
                : 'bg-white text-[#555a68] border border-[#d2d6e0] hover:bg-[#f8f9fa]'
            }`}
          >
            All Defect Items
          </button>
          <button
            onClick={() => setSelectedIssueTab('MISSING_COST')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedIssueTab === 'MISSING_COST'
                ? 'bg-[#dc2626] text-white'
                : 'bg-white text-[#555a68] border border-[#d2d6e0] hover:bg-[#f8f9fa]'
            }`}
          >
            Missing Cost ({qualityReport.missingCostItems.length})
          </button>
          <button
            onClick={() => setSelectedIssueTab('MISSING_PRICE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedIssueTab === 'MISSING_PRICE'
                ? 'bg-[#ea580c] text-white'
                : 'bg-white text-[#555a68] border border-[#d2d6e0] hover:bg-[#f8f9fa]'
            }`}
          >
            Missing Price ({qualityReport.missingPriceItems.length})
          </button>
          <button
            onClick={() => setSelectedIssueTab('MISSING_REORDER')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedIssueTab === 'MISSING_REORDER'
                ? 'bg-[#f59e0b] text-white'
                : 'bg-white text-[#555a68] border border-[#d2d6e0] hover:bg-[#f8f9fa]'
            }`}
          >
            Missing Reorder Lvl ({qualityReport.missingReorderLevelItems.length})
          </button>
          <button
            onClick={() => setSelectedIssueTab('MISSING_SUPPLIER')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedIssueTab === 'MISSING_SUPPLIER'
                ? 'bg-[#64748b] text-white'
                : 'bg-white text-[#555a68] border border-[#d2d6e0] hover:bg-[#f8f9fa]'
            }`}
          >
            Missing Supplier ({qualityReport.missingSupplierItems.length})
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-[#8c92a4] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU or item name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#d2d6e0] rounded-md focus:outline-hidden focus:border-[#e05e00]"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8f9fa] border-b border-[#e1e4ea] sticky top-0 z-10 text-[#555a68] font-semibold">
              <tr>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Cost Basis</th>
                <th className="p-3 text-right">Retail Selling Price</th>
                <th className="p-3 text-right">Reorder Level</th>
                <th className="p-3">Preferred Supplier</th>
                <th className="p-3">Identified Commercial Defects</th>
                <th className="p-3 text-right">Quick Fix Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7]">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8c92a4]">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-[#10b981] mb-2 opacity-80" />
                    <p className="font-medium text-[#1c1d22]">No Commercial Defects in Selected Category</p>
                    <p className="text-xs mt-1">All verified items in this view meet master catalog governance standards.</p>
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const isMissingCost = !item.unitCost || item.unitCost <= 0;
                  const isMissingPrice = !item.retailPrice || item.retailPrice <= 0;
                  const isMissingDept = !item.department || item.department === 'General';
                  const isMissingSupplier = !item.preferredSupplier;
                  const isMissingReorder = typeof item.reorderLevel !== 'number' || item.reorderLevel <= 0;

                  return (
                    <tr key={item.sku} className="hover:bg-[#fbfcfd] transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-[#1c1d22]">{item.name || item.description}</div>
                        <div className="font-mono text-[11px] text-[#6e7485]">{item.sku} • Barcode: {item.barcode || 'None'}</div>
                      </td>

                      <td className="p-3 text-[#555a68]">
                        {isMissingDept ? (
                          <span className="text-[#f59e0b] italic font-medium">Uncategorized</span>
                        ) : (
                          item.department
                        )}
                      </td>

                      <td className="p-3 text-right font-medium">
                        {isMissingCost ? (
                          <span className="text-[#dc2626] font-bold bg-[#fef2f2] px-2 py-0.5 rounded border border-[#fca5a5]">
                            $0.00 Missing
                          </span>
                        ) : (
                          `$${item.unitCost?.toFixed(2)}`
                        )}
                      </td>

                      <td className="p-3 text-right font-medium">
                        {isMissingPrice ? (
                          <span className="text-[#ea580c] font-bold bg-[#fff7ed] px-2 py-0.5 rounded border border-[#fed7aa]">
                            $0.00 Missing
                          </span>
                        ) : (
                          `$${item.retailPrice?.toFixed(2)}`
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {isMissingReorder ? (
                          <span className="text-[#64748b] bg-[#f1f3f7] px-2 py-0.5 rounded text-[11px]">
                            0 (Not Set)
                          </span>
                        ) : (
                          `${item.reorderLevel} Units`
                        )}
                      </td>

                      <td className="p-3 text-[#555a68]">
                        {isMissingSupplier ? (
                          <span className="text-[#64748b] italic">Unassigned</span>
                        ) : (
                          item.preferredSupplier
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {isMissingCost && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]">
                              No Cost
                            </span>
                          )}
                          {isMissingPrice && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa]">
                              No Price
                            </span>
                          )}
                          {isMissingReorder && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                              No Reorder Level
                            </span>
                          )}
                          {isMissingSupplier && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">
                              No Supplier
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onQuickPriceUpdate(item)}
                          className="px-2 py-1 text-[11px] rounded bg-[#f1f3f7] hover:bg-[#e4e7ee] text-[#3b4050] font-medium"
                          title="Quick Price / Cost Update"
                        >
                          Quick Price
                        </button>
                        <button
                          onClick={() => onEditProduct(item)}
                          className="px-2 py-1 text-[11px] rounded bg-[#e05e00] hover:bg-[#c95400] text-white font-medium"
                          title="Full Master Edit"
                        >
                          Edit Master
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
    </div>
  );
};
