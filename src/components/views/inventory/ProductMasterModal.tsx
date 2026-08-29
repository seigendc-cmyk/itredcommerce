import React, { useState, useEffect, useRef } from 'react';
import { 
  Boxes, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Barcode, 
  DollarSign, 
  Calculator, 
  MapPin, 
  Building2, 
  Sparkles,
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { InventoryItem, CustomFieldDefinition } from '../../../types';
import { INITIAL_DEPARTMENTS, INITIAL_UNITS_OF_MEASURE, INITIAL_SUPPLIERS } from '../../../data/mockData';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface ProductMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit: InventoryItem | null;
  onSaveItem: (item: InventoryItem) => void;
  customFieldDefs: CustomFieldDefinition[];
  onOpenFieldManager: (industry: string) => void;
}

export const ProductMasterModal: React.FC<ProductMasterModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  onSaveItem,
  customFieldDefs,
  onOpenFieldManager,
}) => {
  // Active Form Tab
  const [activeTab, setActiveTab] = useState<'STANDARD' | 'ADDITIONAL' | 'IMAGE'>('STANDARD');

  // Standard Fields State
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('Motor Spares');
  const [category, setCategory] = useState('General');
  const [unitOfMeasure, setUnitOfMeasure] = useState('Each (ea)');
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('10');
  const [stockOnHand, setStockOnHand] = useState<string>('0');
  const [preferredSupplier, setPreferredSupplier] = useState('');
  const [location, setLocation] = useState('Bay A-01');
  const [taxRate, setTaxRate] = useState<string>('15.0');
  const [isActive, setIsActive] = useState(true);

  // Custom Configurable Fields State (Key -> Value)
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Image State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<'ready' | 'optimizing' | 'none'>('none');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Validation & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form when modal opens or itemToEdit changes
  useEffect(() => {
    if (itemToEdit) {
      setSku(itemToEdit.sku);
      setBarcode(itemToEdit.barcode || '');
      setName(itemToEdit.name || itemToEdit.description);
      setDescription(itemToEdit.description || '');
      setDepartment(itemToEdit.department || 'Motor Spares');
      setCategory(itemToEdit.category || 'General');
      setUnitOfMeasure(itemToEdit.unitOfMeasure || 'Each (ea)');
      setCostPrice(itemToEdit.unitCost !== undefined ? String(itemToEdit.unitCost) : '0.00');
      setSellingPrice(itemToEdit.retailPrice !== undefined ? String(itemToEdit.retailPrice) : '0.00');
      setReorderLevel(String(itemToEdit.reorderLevel ?? 10));
      setStockOnHand(String(itemToEdit.stockOnHand ?? 0));
      setPreferredSupplier(itemToEdit.preferredSupplier || INITIAL_SUPPLIERS?.[0]?.name || 'Standard Supplier');
      setLocation(itemToEdit.location || 'Bay A-01');
      setTaxRate(String(itemToEdit.taxRate ?? 15.0));
      setIsActive(itemToEdit.isActive ?? true);
      setCustomFields(itemToEdit.customFields || {});
      setImagePreview(itemToEdit.imageUrl || null);
      setImageStatus(itemToEdit.imageStatus || (itemToEdit.imageUrl ? 'ready' : 'none'));
    } else {
      // Auto-generate fresh identifiers
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      setSku(`ITM-${randomCode}`);
      setBarcode(`600980${randomCode}`);
      setName('');
      setDescription('');
      setDepartment('Motor Spares');
      setCategory('General');
      setUnitOfMeasure('Each (ea)');
      setCostPrice('');
      setSellingPrice('');
      setReorderLevel('10');
      setStockOnHand('50');
      setPreferredSupplier(INITIAL_SUPPLIERS?.[0]?.name || 'Standard Supplier');
      setLocation('Bay M-01');
      setTaxRate('15.0');
      setIsActive(true);
      setCustomFields({});
      setImagePreview(null);
      setImageStatus('none');
    }
    setErrorMessage(null);
  }, [itemToEdit, isOpen]);

  // Derived margin and markup calculations
  const parsedCost = parseFloat(costPrice) || 0;
  const parsedPrice = parseFloat(sellingPrice) || 0;
  const grossProfit = Math.max(0, parsedPrice - parsedCost);
  const marginPercent = parsedPrice > 0 ? ((grossProfit / parsedPrice) * 100).toFixed(1) : '0.0';
  const markupPercent = parsedCost > 0 ? ((grossProfit / parsedCost) * 100).toFixed(1) : '0.0';

  // Filter custom field definitions applicable to current department
  const applicableFieldDefs = customFieldDefs.filter(
    (f) => f.industry === department || f.industry === 'Universal'
  );

  // Auto-generate SKU
  const handleAutoGenerateSku = () => {
    const prefix = department.slice(0, 2).toUpperCase();
    const rand = Math.floor(10000 + Math.random() * 90000);
    setSku(`ITM-${prefix}-${rand}`);
  };

  // Auto-generate Barcode
  const handleAutoGenerateBarcode = () => {
    const rand = Math.floor(100000000000 + Math.random() * 900000000000);
    setBarcode(String(rand));
  };

  // Image Upload Handling
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageStatus('optimizing');
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      // Simulate industrial WebP processing completion
      setTimeout(() => {
        setImageStatus('ready');
      }, 400);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageStatus('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Custom field update handler
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFields((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Form Save Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() && !description.trim()) {
      setErrorMessage('Item Name or Description is required.');
      setActiveTab('STANDARD');
      return;
    }

    if (!sku.trim()) {
      setErrorMessage('SKU Identifier is required.');
      setActiveTab('STANDARD');
      return;
    }

    // Check required custom fields
    for (const fieldDef of applicableFieldDefs) {
      if (fieldDef.isRequired) {
        const val = customFields[fieldDef.id];
        if (val === undefined || val === null || val === '') {
          setErrorMessage(`Required Specification Field "${fieldDef.label}" is missing.`);
          setActiveTab('ADDITIONAL');
          return;
        }
      }
    }

    const parsedSoh = parseInt(stockOnHand) || 0;
    const parsedReorder = parseInt(reorderLevel) || 0;

    const finalItem: InventoryItem = {
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim(),
      name: name.trim() || description.trim(),
      description: description.trim() || name.trim(),
      department,
      category,
      unitOfMeasure,
      stockOnHand: Math.max(0, parsedSoh),
      reorderLevel: Math.max(0, parsedReorder),
      unitCost: parsedCost,
      retailPrice: parsedPrice,
      preferredSupplier,
      isActive,
      imageUrl: imagePreview,
      imageStatus,
      taxRate: parseFloat(taxRate) || 15.0,
      status: parsedSoh <= 0 ? 'Out of Stock' : parsedSoh <= parsedReorder ? 'Low Stock' : 'In Stock',
      location: location.trim(),
      partNumber: customFields.partNumber || customFields.partNo,
      oemNumber: customFields.oemNumber || customFields.oemNo,
      customFields,
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    onSaveItem(finalItem);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={itemToEdit ? `Edit Catalog Item: ${itemToEdit.sku}` : 'Register New Catalog Item'}
      subtitle="Master Product Definition & Industrial Specification Records"
      maxWidth="2xl"
      headerColor="orange"
      footer={
        <>
          <div className="flex items-center gap-2 mr-auto text-xs font-mono text-gray-500">
            <span>Status:</span>
            <span className={`px-2 py-0.5 font-bold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
              {isActive ? 'ACTIVE IN CATALOG' : 'INACTIVE / ARCHIVED'}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            Save Catalog Record
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {errorMessage && (
          <Alert type="error" size="sm" onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 -mt-2 -mx-4 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('STANDARD')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'STANDARD'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Standard Product Fields
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ADDITIONAL')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ADDITIONAL'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Additional Item Fields ({applicableFieldDefs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('IMAGE')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'IMAGE'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Product Image {imagePreview && '• [1]'}
          </button>
        </div>

        {/* TAB 1: Standard Product Fields */}
        {activeTab === 'STANDARD' && (
          <div className="space-y-3.5 pt-1">
            {/* Primary Identification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    SKU / Item Code *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[10px] text-[#FF6B00] hover:underline font-mono"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-gray-900 focus:outline-none focus:border-[#FF6B00]"
                  placeholder="e.g. ITM-MS-101"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Barcode / EAN / UPC
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateBarcode}
                    className="text-[10px] text-[#FF6B00] hover:underline font-mono"
                  >
                    Generate Barcode
                  </button>
                </div>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-gray-900 focus:outline-none focus:border-[#FF6B00]"
                  placeholder="e.g. 600980012301"
                />
              </div>
            </div>

            {/* Item Name & Full Description */}
            <div className="space-y-3">
              <Input
                label="Item Display Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Honda Fit Ball Joint Front Lower Left"
                required
              />

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Full Catalog Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                  placeholder="Detailed technical specifications, part dimensions, packaging, and manufacturer notes..."
                />
              </div>
            </div>

            {/* Department, Category & Unit of Measure */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Department / Sector *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-semibold text-gray-900 focus:outline-none focus:border-[#FF6B00]"
                >
                  {INITIAL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Unit of Measure (UOM)
                </label>
                <select
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium focus:outline-none focus:border-[#FF6B00]"
                >
                  {INITIAL_UNITS_OF_MEASURE.map((uom) => (
                    <option key={uom} value={uom}>
                      {uom}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Warehouse Location / Bay"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bay M-01, Shelf 3"
              />
            </div>

            {/* Financials: Cost, Selling Price, Margin Calculation */}
            <div className="p-3 bg-[#FAF8F5] border border-gray-300 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="font-bold text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#FF6B00]" />
                  Pricing & Commercial Valuation
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  Auto-calculated Gross Margin: <strong className="text-emerald-700">{marginPercent}%</strong> | Markup: <strong className="text-blue-700">{markupPercent}%</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Cost Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className={`w-full p-2 bg-white border font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00] ${
                      parsedCost <= 0 ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className={`w-full p-2 bg-white border font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00] ${
                      parsedPrice <= 0 ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300 text-gray-900'
                    }`}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Initial SOH (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockOnHand}
                    onChange={(e) => setStockOnHand(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 font-mono font-bold text-sm focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 font-mono text-sm focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>
            </div>

            {/* Supplier & Active Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Preferred Supplier / Vendor
                </label>
                <select
                  value={preferredSupplier}
                  onChange={(e) => setPreferredSupplier(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium focus:outline-none focus:border-[#FF6B00]"
                >
                  {INITIAL_SUPPLIERS.map((sup) => (
                    <option key={sup.code} value={sup.name}>
                      {sup.name} ({sup.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Catalog Active Status
                </label>
                <div className="flex items-center gap-4 p-2 bg-white border border-gray-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="activeStatus"
                      checked={isActive}
                      onChange={() => setIsActive(true)}
                      className="accent-[#FF6B00]"
                    />
                    <span className="font-bold text-emerald-800">Active (Sellable)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="activeStatus"
                      checked={!isActive}
                      onChange={() => setIsActive(false)}
                      className="accent-[#FF6B00]"
                    />
                    <span className="font-bold text-gray-600">Inactive (Disabled)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Configurable Product Fields ("Additional Item Fields") */}
        {activeTab === 'ADDITIONAL' && (
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between bg-gray-50 p-2.5 border border-gray-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-900 block">
                  Sector Template: {department}
                </span>
                <p className="text-[11px] text-gray-500 font-mono">
                  Configured custom specifications will be indexed for tolerant search and list filtering.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenFieldManager(department)}
                leftIcon={<Sliders className="w-3.5 h-3.5 text-[#FF6B00]" />}
              >
                Manage Fields
              </Button>
            </div>

            {applicableFieldDefs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-300 bg-gray-50 text-gray-500">
                No custom specification fields configured for <strong>{department}</strong>.
                <div className="mt-2">
                  <Button variant="primary" size="sm" onClick={() => onOpenFieldManager(department)}>
                    Define Custom Fields for {department}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-white border border-gray-200">
                {applicableFieldDefs.map((field) => {
                  const val = customFields[field.id] ?? '';

                  return (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1">
                          {field.label}
                          {field.isRequired && <span className="text-rose-600 font-bold">*</span>}
                        </label>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">
                          {field.type}
                        </span>
                      </div>

                      {/* Field Type Renderers */}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label}...`}
                          className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                          required={field.isRequired}
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || '0'}
                          className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                          required={field.isRequired}
                        />
                      )}

                      {field.type === 'decimal' && (
                        <input
                          type="number"
                          step="0.01"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || '0.00'}
                          className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                          required={field.isRequired}
                        />
                      )}

                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                          required={field.isRequired}
                        />
                      )}

                      {field.type === 'boolean' && (
                        <div className="flex items-center gap-3 p-1.5 bg-gray-50 border border-gray-300">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`custom_${field.id}`}
                              checked={val === true}
                              onChange={() => handleCustomFieldChange(field.id, true)}
                              className="accent-[#FF6B00]"
                            />
                            <span className="font-semibold text-gray-900">Yes</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`custom_${field.id}`}
                              checked={val === false || val === ''}
                              onChange={() => handleCustomFieldChange(field.id, false)}
                              className="accent-[#FF6B00]"
                            />
                            <span className="font-semibold text-gray-700">No</span>
                          </label>
                        </div>
                      )}

                      {field.type === 'select' && (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                          required={field.isRequired}
                        >
                          <option value="">-- Select {field.label} --</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === 'multi-select' && (
                        <div className="p-2 bg-gray-50 border border-gray-300 flex flex-wrap gap-1.5">
                          {field.options?.map((opt) => {
                            const selectedArray: string[] = Array.isArray(val) ? val : [];
                            const isSelected = selectedArray.includes(opt);

                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    handleCustomFieldChange(
                                      field.id,
                                      selectedArray.filter((x) => x !== opt)
                                    );
                                  } else {
                                    handleCustomFieldChange(field.id, [...selectedArray, opt]);
                                  }
                                }}
                                className={`px-2 py-0.5 text-[11px] font-mono border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#FF6B00] text-white border-[#E05E00]'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Product Image Handling */}
        {activeTab === 'IMAGE' && (
          <div className="space-y-4 pt-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFileChange}
              accept="image/*"
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
              {/* Preview Box */}
              <div className="sm:col-span-5 bg-[#FAF8F5] border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center min-h-[220px] text-center">
                {imagePreview ? (
                  <div className="space-y-2 w-full flex flex-col items-center">
                    <img
                      src={imagePreview}
                      alt="Product Master Preview"
                      className="max-h-40 max-w-full object-contain border border-gray-300 bg-white p-1"
                    />
                    <div className="text-[11px] font-mono text-gray-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Optimized WebP Master Format</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 space-y-2">
                    <ImageIcon className="w-12 h-12 mx-auto text-gray-300" />
                    <p className="text-xs font-medium text-gray-500">No Image Uploaded</p>
                    <p className="text-[10px] text-gray-400">Accepts PNG, JPG, GIF, WebP</p>
                  </div>
                )}
              </div>

              {/* Upload Controls & Processing Status */}
              <div className="sm:col-span-7 space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 block">
                    Product Image Actions
                  </span>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Import catalog photo or part diagram. Images are automatically prepared and formatted for zero-latency POS rendering.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                    >
                      {imagePreview ? 'Replace Image' : 'Choose Image From Device'}
                    </Button>

                    {imagePreview && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveImage}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                        className="text-rose-700 hover:bg-rose-50 border-rose-200"
                      >
                        Remove Image
                      </Button>
                    )}
                  </div>
                </div>

                {/* Image Processing Status Indicator */}
                <div className="p-3 bg-white border border-gray-200 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Optimization Pipeline:</span>
                    <span className="font-bold text-gray-900">
                      {imageStatus === 'optimizing' ? (
                        <span className="text-[#FF6B00] animate-pulse">Processing (WebP)...</span>
                      ) : imageStatus === 'ready' ? (
                        <span className="text-emerald-700">Ready (100% Prepared)</span>
                      ) : (
                        <span className="text-gray-400">No File</span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700">
                    <span>Aspect Ratio:</span>
                    <span>1:1 Square Standardized</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700">
                    <span>POS Thumbnail Cache:</span>
                    <span className="text-emerald-700">Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
