import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Plus, 
  ArrowLeft, 
  Edit3, 
  SlidersHorizontal, 
  AlertTriangle, 
  Package, 
  MapPin, 
  DollarSign, 
  CheckCircle2,
  Search,
  Filter,
  Download,
  List,
  LayoutGrid,
  Printer,
  Copy,
  Tag,
  Eye,
  Sliders,
  MoreVertical,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  ShieldAlert,
  Barcode as BarcodeIcon,
  RefreshCw
} from 'lucide-react';
import { InventoryItem, StaffMember, CustomFieldDefinition, InventoryMovement, ApprovalRequest } from '../../../types';
import { INITIAL_INVENTORY_ITEMS, INITIAL_CUSTOM_FIELD_DEFS, INITIAL_DEPARTMENTS, INITIAL_SUPPLIERS, INITIAL_INVENTORY_MOVEMENTS } from '../../../data/mockData';
import { Button } from '../../ui/Button';
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { AttentionRequiredCard, AttentionIssueType } from './AttentionRequiredCard';
import { ProductMasterModal } from './ProductMasterModal';
import { CustomFieldsManagerModal } from './CustomFieldsManagerModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { QuickPriceUpdateModal } from './QuickPriceUpdateModal';
import { ItemStockCardModal } from './ItemStockCardModal';
import { ManualStockAdjustmentModal } from './ManualStockAdjustmentModal';
import { searchInventoryItems } from '../../../utils/searchUtils';
import { apiPost, apiPatch } from '../../../api/client';

export interface InventoryItemListViewProps {
  currentStaff: StaffMember;
  inventoryItems?: InventoryItem[];
  inventoryMovements?: InventoryMovement[];
  onBackToLanding: () => void;
  onRecordMovement?: (movement: InventoryMovement) => void;
  onRequestApproval?: (request: ApprovalRequest) => void;
}

export const InventoryItemListView: React.FC<InventoryItemListViewProps> = ({
  currentStaff,
  inventoryItems,
  inventoryMovements = INITIAL_INVENTORY_MOVEMENTS,
  onBackToLanding,
  onRecordMovement,
  onRequestApproval,
}) => {
  // Master Inventory State
  const [items, setItems] = useState<InventoryItem[]>(inventoryItems || INITIAL_INVENTORY_ITEMS);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>(INITIAL_CUSTOM_FIELD_DEFS);
  const [movements, setMovements] = useState<InventoryMovement[]>(inventoryMovements);

  // Selection & Active Item
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Stock Card & Controlled Adjustment Modals
  const [stockCardItem, setStockCardItem] = useState<InventoryItem | null>(null);
  const [isManualAdjustmentOpen, setIsManualAdjustmentOpen] = useState(false);
  const [manualAdjustmentTargetItem, setManualAdjustmentTargetItem] = useState<InventoryItem | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [attentionIssueFilter, setAttentionIssueFilter] = useState<AttentionIssueType>('ALL');

  // View Mode: Compact Industrial List vs Compact Industrial Grid
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');

  // Modals
  const [isProductMasterOpen, setIsProductMasterOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);
  const [fieldManagerIndustry, setFieldManagerIndustry] = useState('Motor Spares');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeTargetItem, setBarcodeTargetItem] = useState<InventoryItem | null>(null);
  const [isQuickPriceModalOpen, setIsQuickPriceModalOpen] = useState(false);
  const [quickPriceItem, setQuickPriceItem] = useState<InventoryItem | null>(null);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetItem, setAdjustTargetItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock Count Variance');

  // Notification Banner
  const [alertNotice, setAlertNotice] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setAlertNotice({ message, type });
    setTimeout(() => setAlertNotice(null), 3500);
  };

  // Filtered and Searched Items Pipeline
  const filteredItems = useMemo(() => {
    // 1. Tolerant Industrial Search
    let result = searchInventoryItems(items, searchQuery, customFieldDefs);

    // 2. Department Filter
    if (departmentFilter !== 'ALL') {
      result = result.filter((item) => item.department === departmentFilter);
    }

    // 3. Stock Status Filter
    if (stockStatusFilter === 'IN_STOCK') {
      result = result.filter((item) => item.stockOnHand > item.reorderLevel);
    } else if (stockStatusFilter === 'LOW_STOCK') {
      result = result.filter((item) => item.stockOnHand > 0 && item.stockOnHand <= item.reorderLevel);
    } else if (stockStatusFilter === 'OUT_OF_STOCK') {
      result = result.filter((item) => item.stockOnHand <= 0);
    }

    // 4. Active Status Filter
    if (activeStatusFilter === 'ACTIVE') {
      result = result.filter((item) => item.isActive);
    } else if (activeStatusFilter === 'INACTIVE') {
      result = result.filter((item) => !item.isActive);
    }

    // 5. Supplier Filter
    if (supplierFilter !== 'ALL') {
      result = result.filter((item) => item.preferredSupplier === supplierFilter);
    }

    // 6. Attention Issue Filter
    if (attentionIssueFilter === 'NO_SELLING_PRICE') {
      result = result.filter((item) => item.isActive && (!item.retailPrice || item.retailPrice <= 0));
    } else if (attentionIssueFilter === 'NO_COST') {
      result = result.filter((item) => item.isActive && (!item.unitCost || item.unitCost <= 0));
    } else if (attentionIssueFilter === 'BELOW_REORDER') {
      result = result.filter((item) => item.isActive && item.stockOnHand > 0 && item.stockOnHand <= item.reorderLevel);
    } else if (attentionIssueFilter === 'OUT_OF_STOCK') {
      result = result.filter((item) => item.isActive && item.stockOnHand <= 0);
    } else if (attentionIssueFilter === 'INACTIVE') {
      result = result.filter((item) => !item.isActive);
    }

    return result;
  }, [items, searchQuery, customFieldDefs, departmentFilter, stockStatusFilter, activeStatusFilter, supplierFilter, attentionIssueFilter]);

  // Handle Save from Product Master Modal (Add or Edit)
  const handleSaveProductMaster = (savedItem: InventoryItem) => {
    const exists = items.some((i) => i.sku === savedItem.sku);
    if (exists) {
      setItems((prev) => prev.map((i) => (i.sku === savedItem.sku ? savedItem : i)));
      showNotification(`Item ${savedItem.sku} specifications updated successfully.`);
      apiPatch(`/inventory/items/${encodeURIComponent(savedItem.sku)}`, savedItem).catch((err) =>
        console.error('Failed to persist item update', err)
      );
    } else {
      setItems((prev) => [savedItem, ...prev]);
      showNotification(`New item ${savedItem.sku} registered in catalog.`);
      apiPost('/inventory/items', savedItem).catch((err) => console.error('Failed to persist new item', err));
    }
  };

  // Handle Quick Price Update
  const handleSaveQuickPrice = (updatedItem: InventoryItem) => {
    setItems((prev) => prev.map((i) => (i.sku === updatedItem.sku ? updatedItem : i)));
    showNotification(`Price revised for SKU ${updatedItem.sku}: Retail $${updatedItem.retailPrice.toFixed(2)}, Cost $${updatedItem.unitCost.toFixed(2)}.`);
    apiPatch(`/inventory/items/${encodeURIComponent(updatedItem.sku)}`, {
      retailPrice: updatedItem.retailPrice,
      unitCost: updatedItem.unitCost,
    }).catch((err) => console.error('Failed to persist price update', err));
  };

  // Handle Stock Adjustment Confirm
  const handleStockAdjustmentConfirm = () => {
    if (!adjustTargetItem) return;
    const updated = items.map((itm) => {
      if (itm.sku === adjustTargetItem.sku) {
        const newSoh = Math.max(0, itm.stockOnHand + adjustQty);
        return {
          ...itm,
          stockOnHand: newSoh,
          status: newSoh <= 0 ? ('Out of Stock' as const) : newSoh <= itm.reorderLevel ? ('Low Stock' as const) : ('In Stock' as const),
          lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
      }
      return itm;
    });

    setItems(updated);
    setIsAdjustModalOpen(false);
    showNotification(`Stock adjusted for SKU ${adjustTargetItem.sku} (${adjustQty > 0 ? '+' : ''}${adjustQty} units). Reason: ${adjustReason}.`);
  };

  // Handle Duplicate Item
  const handleDuplicateItem = (item: InventoryItem) => {
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    const duplicated: InventoryItem = {
      ...item,
      sku: `${item.sku}-DUP-${randomCode}`,
      barcode: `600980${randomCode}`,
      name: `${item.name || item.description} (Copy)`,
      description: `${item.description} (Duplicate copy)`,
      stockOnHand: 0,
      status: 'Out of Stock',
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    setItems([duplicated, ...items]);
    showNotification(`Item duplicated as ${duplicated.sku}.`);
  };

  // Handle Toggle Active
  const handleToggleActive = (item: InventoryItem) => {
    const updated = items.map((itm) => {
      if (itm.sku === item.sku) {
        return { ...itm, isActive: !itm.isActive };
      }
      return itm;
    });
    setItems(updated);
    showNotification(`Item ${item.sku} marked as ${!item.isActive ? 'Active' : 'Inactive'}.`);
    apiPatch(`/inventory/items/${encodeURIComponent(item.sku)}`, { isActive: !item.isActive }).catch((err) =>
      console.error('Failed to persist active-status toggle', err)
    );
  };

  // Export Catalog
  const handleExportCatalog = (format: 'CSV' | 'TSV') => {
    const headers = ['SKU', 'Barcode', 'Item Name', 'Department', 'Part Number', 'SOH', 'Cost', 'Retail Price', 'Status', 'Supplier'];
    const rows = filteredItems.map((i) => [
      i.sku,
      i.barcode,
      `"${(i.name || i.description).replace(/"/g, '""')}"`,
      `"${i.department}"`,
      i.partNumber || '',
      i.stockOnHand,
      i.unitCost.toFixed(2),
      i.retailPrice.toFixed(2),
      i.status,
      `"${i.preferredSupplier || ''}"`,
    ]);

    const delimiter = format === 'CSV' ? ',' : '\t';
    const content = [headers.join(delimiter), ...rows.map((r) => r.join(delimiter))].join('\n');
    const blob = new Blob([content], { type: format === 'CSV' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iTred_Catalog_Export_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`Exported ${filteredItems.length} items as ${format}.`);
  };

  // Data Table Columns
  const columns: Column<InventoryItem>[] = [
    {
      key: 'imageUrl',
      header: 'Img',
      width: '48px',
      align: 'center',
      render: (row) => (
        <div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center overflow-hidden">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.sku} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-4 h-4 text-gray-400" />
          )}
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU / Part No.',
      isMono: true,
      width: '130px',
      render: (row) => (
        <div>
          <span className="font-bold text-gray-900 block">{row.sku}</span>
          {row.partNumber && (
            <span className="text-[10px] text-gray-500 font-mono block">
              PN: <strong className="text-gray-700">{row.partNumber}</strong>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Item Master Specification',
      render: (row) => {
        const make = row.customFields?.make;
        const model = row.customFields?.model;
        const engine = row.customFields?.engine;

        return (
          <div>
            <div className="font-bold text-gray-900 text-xs">
              {row.name || row.description}
            </div>
            <div className="text-[11px] text-gray-500 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[#FF6B00] font-semibold">{row.department}</span>
              {row.barcode && <span>• Barcode: {row.barcode}</span>}
              {row.location && <span>• Loc: {row.location}</span>}
              {make && <span className="bg-gray-100 px-1 py-0.2 border border-gray-300 text-gray-800">{make} {model}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'stockOnHand',
      header: 'Stock On Hand',
      align: 'center',
      isMono: true,
      width: '110px',
      render: (row) => {
        const isOut = row.stockOnHand <= 0;
        const isLow = row.stockOnHand <= row.reorderLevel && !isOut;

        return (
          <div className="text-center">
            <span className={`font-black text-sm block ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
              {row.stockOnHand} {row.unitOfMeasure?.split(' ')[0] || 'ea'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Reorder @ {row.reorderLevel}
            </span>
          </div>
        );
      },
    },
    {
      key: 'unitCost',
      header: 'Cost ($)',
      align: 'right',
      isMono: true,
      width: '90px',
      render: (row) => (
        <div className="text-right">
          {row.unitCost > 0 ? (
            <span className="font-mono text-gray-700 font-medium">${row.unitCost.toFixed(2)}</span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuickPriceItem(row);
                setIsQuickPriceModalOpen(true);
              }}
              className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 border border-amber-300 hover:bg-amber-200"
            >
              Missing Cost
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'retailPrice',
      header: 'Selling Price ($)',
      align: 'right',
      isMono: true,
      width: '120px',
      render: (row) => {
        const profit = row.retailPrice - row.unitCost;
        const margin = row.retailPrice > 0 ? ((profit / row.retailPrice) * 100).toFixed(0) : '0';

        return (
          <div className="text-right">
            {row.retailPrice > 0 ? (
              <div>
                <span className="font-bold font-mono text-gray-900 text-sm block leading-none">
                  ${row.retailPrice.toFixed(2)}
                </span>
                {row.unitCost > 0 && (
                  <span className="text-[10px] font-mono text-emerald-700">
                    +{margin}% margin
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickPriceItem(row);
                  setIsQuickPriceModalOpen(true);
                }}
                className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 border border-amber-300 hover:bg-amber-200"
              >
                Set Price
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Stock Status',
      align: 'center',
      width: '110px',
      render: (row) => (
        <div className="flex flex-col items-center gap-1">
          <StatusBadge status={row.status} size="sm" />
          {!row.isActive && (
            <span className="text-[9px] font-mono font-bold bg-gray-200 text-gray-700 px-1">
              INACTIVE
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Strip */}
      <div className="bg-[#FF6B00] text-white p-3 border border-[#E05E00] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-black/20 text-white border-white/30 hover:bg-black/30"
          >
            Landing
          </Button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-white" />
              Product Master & Industrial Inventory
            </h2>
            <p className="text-[10px] font-mono text-white/90">
              Multi-Sector SKU Catalog • Specification Fields • Tolerant Part Search • Zero-Latency Journal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setManualAdjustmentTargetItem(null);
              setIsManualAdjustmentOpen(true);
            }}
            leftIcon={<SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />}
            className="bg-black/30 text-amber-200 border-amber-500/40 hover:bg-black/50 font-bold"
          >
            Adjust / Write-off
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFieldManagerIndustry(departmentFilter !== 'ALL' ? departmentFilter : 'Motor Spares');
              setIsFieldManagerOpen(true);
            }}
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
            className="bg-black/20 text-white border-white/30 hover:bg-black/30"
          >
            Custom Fields
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setIsProductMasterOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            shortcutBadge="Ins"
            className="bg-white text-gray-900 hover:bg-gray-100 border-white font-bold"
          >
            Add New Item
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {alertNotice && (
        <Alert
          type={alertNotice.type}
          onClose={() => setAlertNotice(null)}
          size="sm"
        >
          {alertNotice.message}
        </Alert>
      )}

      {/* Persistent Attention Required Card */}
      <AttentionRequiredCard
        items={items}
        activeIssue={attentionIssueFilter}
        onSelectIssue={(issue) => setAttentionIssueFilter(issue)}
      />

      {/* Search & Multi-Criteria Filter Bar */}
      <div className="bg-white border border-gray-300 p-3 shadow-2xs space-y-2.5">
        {/* Row 1: Tolerant Search Input & View Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tolerant search: Type part numbers (e.g. 12345-23456), makes, models, OEM numbers in any order..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 font-medium text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`p-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'LIST' ? 'bg-white text-[#FF6B00] shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Industrial High-Density List View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'GRID' ? 'bg-white text-[#FF6B00] shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Compact Industrial Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>

            {/* Export Dropdown / Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCatalog('CSV')}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Row 2: Filter Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-100 text-xs">
          {/* Department Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">
              Department:
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Departments ({items.length})</option>
              {INITIAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({items.filter((i) => i.department === dept).length})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">
              Stock Status:
            </label>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt; Reorder)</option>
              <option value="LOW_STOCK">Low Stock (≤ Reorder)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0 SOH)</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">
              Preferred Supplier:
            </label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Suppliers</option>
              {INITIAL_SUPPLIERS.map((sup) => (
                <option key={sup.code} value={sup.name}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">
              Active / Archived:
            </label>
            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value as any)}
              className="w-full p-1.5 bg-gray-50 border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
            >
              <option value="ALL">All Catalog Items</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive / Archived</option>
            </select>
          </div>
        </div>

        {/* Tolerant Search Tip Indicator */}
        {searchQuery && (
          <div className="text-[11px] font-mono text-gray-500 bg-amber-50/60 p-1.5 border border-amber-200 flex items-center justify-between">
            <span>
              Tolerant Multi-Token Matching for: <strong className="text-gray-900">"{searchQuery}"</strong> • Found <strong className="text-[#FF6B00]">{filteredItems.length}</strong> matching products
            </span>
            <span className="text-[10px] text-gray-400">
              Matches name, SKU, part no, OEM & custom specs in any order
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area: List View or Compact Industrial Grid View */}
      {viewMode === 'LIST' ? (
        <DataTable
          columns={columns}
          data={filteredItems}
          keyField="sku"
          searchable={false}
          onRowClick={(item) => setSelectedItem(item)}
          selectedRowKey={selectedItem?.sku}
          actionsHeader="Actions"
          renderRowActions={(item) => (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStockCardItem(item);
                }}
                className="p-1 px-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-amber-400 border border-slate-700 cursor-pointer font-mono font-bold"
                title="View Item Stock Card Ledger"
              >
                📊 Card
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingItem(item);
                  setIsProductMasterOpen(true);
                }}
                className="p-1 px-1.5 text-xs bg-gray-100 hover:bg-[#FF6B00] hover:text-white text-gray-700 border border-gray-300 cursor-pointer font-mono"
                title="Edit Product Master"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setManualAdjustmentTargetItem(item);
                  setIsManualAdjustmentOpen(true);
                }}
                className="p-1 px-1.5 text-xs bg-gray-100 hover:bg-[#FF6B00] hover:text-white text-gray-700 border border-gray-300 cursor-pointer font-mono"
                title="Controlled Stock Adjustment / Damage Write-off"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBarcodeTargetItem(item);
                  setIsBarcodeModalOpen(true);
                }}
                className="p-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 border border-gray-300 cursor-pointer font-mono"
                title="Print Barcode Shelf Tag"
              >
                <BarcodeIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateItem(item);
                }}
                className="p-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 border border-gray-300 cursor-pointer font-mono"
                title="Duplicate Item"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      ) : (
        /* Compact Industrial Grid View (NOT giant e-commerce cards!) */
        <div>
          {filteredItems.length === 0 ? (
            <div className="bg-white p-12 border border-gray-300 text-center text-gray-500">
              <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="font-bold text-sm text-gray-800">No matching inventory items found</p>
              <p className="text-xs text-gray-500 mt-1">Try relaxing filters or search query terms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const isOut = item.stockOnHand <= 0;
                const isLow = item.stockOnHand <= item.reorderLevel && !isOut;

                return (
                  <div
                    key={item.sku}
                    onClick={() => setSelectedItem(item)}
                    className={`bg-white border p-3 flex flex-col justify-between transition-shadow hover:shadow-sm cursor-pointer ${
                      selectedItem?.sku === item.sku
                        ? 'border-[#FF6B00] ring-1 ring-[#FF6B00]'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div>
                      {/* Top Bar: SKU & Status */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 mb-2">
                        <span className="font-mono font-bold text-xs text-gray-900">
                          {item.sku}
                        </span>
                        <StatusBadge status={item.status} size="sm" />
                      </div>

                      {/* Item Name & Specs */}
                      <div className="font-bold text-xs text-gray-900 line-clamp-2 leading-snug mb-1">
                        {item.name || item.description}
                      </div>

                      <div className="text-[10px] font-mono text-gray-500 mb-2">
                        <span className="text-[#FF6B00] font-semibold">{item.department}</span>
                        {item.partNumber && <span> • PN: {item.partNumber}</span>}
                        {item.location && <span> • {item.location}</span>}
                      </div>
                    </div>

                    {/* Pricing & Stock Footer */}
                    <div className="pt-2 border-t border-gray-200 mt-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">SOH</span>
                          <span className={`font-mono font-black text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                            {item.stockOnHand} {item.unitOfMeasure?.split(' ')[0] || 'ea'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">RETAIL</span>
                          <span className="font-mono font-black text-base text-gray-900">
                            ${item.retailPrice > 0 ? item.retailPrice.toFixed(2) : '---'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Action Strip */}
                      <div className="flex items-center justify-between gap-1 pt-2 mt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStockCardItem(item);
                          }}
                          className="px-1.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-900 text-amber-400 border border-slate-700 font-mono"
                          title="View Item Stock Card Ledger"
                        >
                          📊 Card
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                            setIsProductMasterOpen(true);
                          }}
                          className="px-2 py-1 text-[11px] font-bold bg-gray-100 hover:bg-[#FF6B00] hover:text-white text-gray-700 border border-gray-300 flex-1 text-center font-mono"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManualAdjustmentTargetItem(item);
                            setIsManualAdjustmentOpen(true);
                          }}
                          className="px-2 py-1 text-[11px] font-bold bg-gray-100 hover:bg-[#FF6B00] hover:text-white text-gray-700 border border-gray-300 flex-1 text-center font-mono"
                        >
                          Stock
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBarcodeTargetItem(item);
                            setIsBarcodeModalOpen(true);
                          }}
                          className="p-1 bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-700 border border-gray-300 font-mono"
                          title="Print Tag"
                        >
                          <BarcodeIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Product Master Modal (Add / Edit) */}
      <ProductMasterModal
        isOpen={isProductMasterOpen}
        onClose={() => setIsProductMasterOpen(false)}
        itemToEdit={editingItem}
        onSaveItem={handleSaveProductMaster}
        customFieldDefs={customFieldDefs}
        onOpenFieldManager={(industry) => {
          setFieldManagerIndustry(industry);
          setIsFieldManagerOpen(true);
        }}
      />

      {/* Custom Fields Manager Modal */}
      <CustomFieldsManagerModal
        isOpen={isFieldManagerOpen}
        onClose={() => setIsFieldManagerOpen(false)}
        customFieldDefs={customFieldDefs}
        onSaveCustomFieldDefs={(defs) => {
          setCustomFieldDefs(defs);
          showNotification('Custom field definitions updated.');
        }}
        currentIndustry={fieldManagerIndustry}
      />

      {/* Barcode Thermal Label Modal */}
      <BarcodeLabelModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        item={barcodeTargetItem}
      />

      {/* Quick Price Update Modal */}
      <QuickPriceUpdateModal
        isOpen={isQuickPriceModalOpen}
        onClose={() => setIsQuickPriceModalOpen(false)}
        item={quickPriceItem}
        onSave={handleSaveQuickPrice}
      />

      {/* Item Stock Card Modal */}
      {stockCardItem && (
        <ItemStockCardModal
          isOpen={!!stockCardItem}
          onClose={() => setStockCardItem(null)}
          item={stockCardItem}
          movements={movements}
          currentStaff={currentStaff}
        />
      )}

      {/* Controlled Manual Stock Adjustment Modal */}
      <ManualStockAdjustmentModal
        isOpen={isManualAdjustmentOpen}
        onClose={() => {
          setIsManualAdjustmentOpen(false);
          setManualAdjustmentTargetItem(null);
        }}
        items={items}
        defaultItem={manualAdjustmentTargetItem}
        currentStaff={currentStaff}
        onPostAdjustment={(movement, updatedItem) => {
          setMovements((prev) => [movement, ...prev]);
          setItems((prev) => prev.map((itm) => (itm.sku === updatedItem.sku ? updatedItem : itm)));
          if (onRecordMovement) {
            onRecordMovement(movement);
          }
          showNotification(`Audited stock movement [${movement.id}] recorded: ${movement.quantity > 0 ? '+' : ''}${movement.quantity} ${movement.sku}.`);
          apiPost(`/inventory/items/${encodeURIComponent(movement.sku)}/adjust`, { movement }).catch((err) =>
            console.error('Failed to persist stock adjustment', err)
          );
        }}
        onRequestApproval={onRequestApproval}
      />
    </div>
  );
};
