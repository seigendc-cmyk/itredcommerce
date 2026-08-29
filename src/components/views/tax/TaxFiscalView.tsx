import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  ArrowLeft, 
  Plus, 
  Save, 
  Percent, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  Layers, 
  Users, 
  Settings, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Printer
} from 'lucide-react';
import { 
  TaxFiscalConfig, 
  TaxCategory, 
  StaffMember, 
  Customer 
} from '../../../types';
import { isManager } from '../../../utils/roles';
import { Button } from '../../ui/Button';

export interface TaxFiscalViewProps {
  currentStaff: StaffMember;
  taxConfig?: TaxFiscalConfig;
  customers?: Customer[];
  onUpdateTaxConfig: (config: TaxFiscalConfig) => void;
  onBackToLanding: () => void;
}

export const TaxFiscalView: React.FC<TaxFiscalViewProps> = ({
  currentStaff,
  taxConfig,
  customers = [],
  onUpdateTaxConfig,
  onBackToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'RATES' | 'CLASSIFICATION' | 'EXEMPTIONS'>('SYSTEM');
  
  // Local state for configuration
  const [taxSystemName, setTaxSystemName] = useState(taxConfig?.taxSystemName || 'Standard Value Added Tax (VAT)');
  const [taxRegNo, setTaxRegNo] = useState(taxConfig?.taxRegistrationNumber || 'TAX-998822-ZW');
  const [fiscalDeviceNo, setFiscalDeviceNo] = useState(taxConfig?.fiscalDeviceSerialNumber || 'FISC-ESD-88219');
  const [taxInclusivePricing, setTaxInclusivePricing] = useState(taxConfig?.taxInclusivePricing ?? true);
  const [headerDisclaimer, setHeaderDisclaimer] = useState(taxConfig?.taxInvoiceHeaderDisclaimer || 'FISCAL TAX INVOICE - REVENUE AUTHORITY CERTIFIED');
  const [footerDisclaimer, setFooterDisclaimer] = useState(taxConfig?.taxInvoiceFooterDisclaimer || 'Thank you for your business. Valid tax invoice.');

  // Rate Categories
  const [categories, setCategories] = useState<TaxCategory[]>(taxConfig?.categories || []);
  const [editingCategory, setEditingCategory] = useState<TaxCategory | null>(null);
  const [isAddRateModalOpen, setIsAddRateModalOpen] = useState<boolean>(false);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatRate, setNewCatRate] = useState<number>(15.0);
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatFiscalCode, setNewCatFiscalCode] = useState('A');
  const [newCatIsZero, setNewCatIsZero] = useState(false);
  const [newCatIsExempt, setNewCatIsExempt] = useState(false);

  const isManagement = isManager(currentStaff);

  const safeCustomers = Array.isArray(customers) ? customers : [];

  const taxRegisteredCustomers = useMemo(() => {
    return safeCustomers.filter(c => c.taxNumber);
  }, [safeCustomers]);

  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TaxFiscalConfig = {
      ...taxConfig,
      taxSystemName,
      taxRegistrationNumber: taxRegNo,
      fiscalDeviceSerialNumber: fiscalDeviceNo,
      taxInclusivePricing,
      taxInvoiceHeaderDisclaimer: headerDisclaimer,
      taxInvoiceFooterDisclaimer: footerDisclaimer,
      categories,
    };

    onUpdateTaxConfig(updated);
    alert('Fiscal VAT settings saved successfully.');
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: TaxCategory = {
      id: `TAX-CAT-${Date.now()}`,
      code: newCatCode || `VAT-${Math.floor(10 + Math.random() * 90)}`,
      name: newCatName,
      standardRate: newCatRate,
      isCompound: false,
      isExempt: newCatIsExempt,
      isZeroRated: newCatIsZero,
      description: newCatDesc || 'General tax category rate',
      active: true,
      fiscalCode: newCatFiscalCode,
    };

    const updatedList = [...categories, newCat];
    setCategories(updatedList);
    onUpdateTaxConfig({
      ...taxConfig,
      categories: updatedList,
    });

    setIsAddRateModalOpen(false);
    setNewCatName('');
    setNewCatCode('');
    setNewCatRate(15);
    setNewCatDesc('');
  };

  const handleToggleCategoryActive = (id: string) => {
    const updated = categories.map(c => c.id === id ? { ...c, active: !c.active } : c);
    setCategories(updated);
    onUpdateTaxConfig({ ...taxConfig, categories: updated });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBackToLanding}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">VAT & Fiscal Tax Governance</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Fiscal Compliance Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Value Added Tax rates, fiscal memory device integration, category mapping & customer tax exemptions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSaveSystemSettings}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('SYSTEM')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'SYSTEM'
              ? 'border-amber-500 text-amber-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Fiscal Authority Setup
        </button>

        <button
          onClick={() => setActiveTab('RATES')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'RATES'
              ? 'border-amber-500 text-amber-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          Tax Categories & Rates ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('CLASSIFICATION')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'CLASSIFICATION'
              ? 'border-amber-500 text-amber-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Catalog Department Classifications
        </button>

        <button
          onClick={() => setActiveTab('EXEMPTIONS')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'EXEMPTIONS'
              ? 'border-amber-500 text-amber-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Tax Numbers & Exemptions ({taxRegisteredCustomers.length})
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================
            TAB 1: FISCAL SYSTEM SETUP
            ======================================================== */}
        {activeTab === 'SYSTEM' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <form onSubmit={handleSaveSystemSettings} className="p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Fiscal Device & Registration Parameters</h3>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Hardware Connected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tax System Name</label>
                  <input
                    type="text"
                    required
                    value={taxSystemName}
                    onChange={(e) => setTaxSystemName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Business Tax Registration Number (TRN / VAT #)</label>
                  <input
                    type="text"
                    required
                    value={taxRegNo}
                    onChange={(e) => setTaxRegNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fiscal Memory Device Serial Number</label>
                  <input
                    type="text"
                    required
                    value={fiscalDeviceNo}
                    onChange={(e) => setFiscalDeviceNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 p-2 bg-slate-950 rounded-lg border border-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={taxInclusivePricing}
                      onChange={(e) => setTaxInclusivePricing(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <div>
                      <span className="text-white font-medium block">Tax-Inclusive Shelf Pricing</span>
                      <span className="text-[10px] text-slate-400">Displayed prices already include VAT</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-3 text-xs pt-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Official Tax Invoice Header Notice</label>
                  <input
                    type="text"
                    value={headerDisclaimer}
                    onChange={(e) => setHeaderDisclaimer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receipt Footer Legal Disclaimer</label>
                  <input
                    type="text"
                    value={footerDisclaimer}
                    onChange={(e) => setFooterDisclaimer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                  <Save className="w-4 h-4 mr-2" />
                  Save Fiscal Parameters
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB 2: TAX CATEGORIES & RATES
            ======================================================== */}
        {activeTab === 'RATES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Statutory VAT Tax Categories</h3>
                <p className="text-xs text-slate-400">Government designated tax bands with physical fiscal device codes</p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddRateModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Tax Category
              </Button>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Category Name</th>
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5 text-center">Fiscal Band</th>
                    <th className="px-4 py-3.5 text-right">Standard Rate (%)</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3.5 font-medium text-white">
                        {cat.name}
                        {cat.isZeroRated && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Zero-Rated</span>}
                        {cat.isExempt && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Exempt</span>}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-amber-300">{cat.code}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs">
                          {cat.fiscalCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-white">
                        {cat.standardRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 max-w-sm">{cat.description}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          cat.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {cat.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleCategoryActive(cat.id)}
                          className="text-xs text-slate-300 hover:text-white px-2 py-1 h-auto"
                        >
                          {cat.active ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: DEPARTMENT CLASSIFICATIONS
            ======================================================== */}
        {activeTab === 'CLASSIFICATION' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Department Tax Mappings</h3>
              <p className="text-xs text-slate-400">Inventory departments automatically linked to statutory tax rates</p>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Department / Product Category</th>
                    <th className="px-4 py-3.5">Tax Category</th>
                    <th className="px-4 py-3.5 text-right">Tax Rate</th>
                    <th className="px-4 py-3.5 text-right">Associated Products</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {taxConfig.classifications.map((cls, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3.5 font-medium text-white">{cls.departmentOrCategory}</td>
                      <td className="px-4 py-3.5 text-slate-300">{cls.taxCategoryName}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-400">{cls.taxRate.toFixed(1)}%</td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-400">{cls.itemCount} SKUs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: CUSTOMER TAX NUMBERS & EXEMPTIONS
            ======================================================== */}
        {activeTab === 'EXEMPTIONS' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Customer VAT Numbers & Exemption Registry</h3>
              <p className="text-xs text-slate-400">Commercial enterprise clients eligible for corporate tax invoicing and zero-rating</p>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Customer Name</th>
                    <th className="px-4 py-3.5">Account #</th>
                    <th className="px-4 py-3.5">Company Name</th>
                    <th className="px-4 py-3.5">Tax / VAT Identification #</th>
                    <th className="px-4 py-3.5 text-center">Fiscal Invoice Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {taxRegisteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-sans font-medium text-white">{cust.name}</td>
                      <td className="px-4 py-3 text-indigo-300">{cust.accountNumber}</td>
                      <td className="px-4 py-3 font-sans text-slate-300">{cust.companyName || '—'}</td>
                      <td className="px-4 py-3 text-amber-300 font-bold">{cust.taxNumber}</td>
                      <td className="px-4 py-3 text-center font-sans">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
                          Corporate Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: ADD TAX CATEGORY
          ======================================================== */}
      {isAddRateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Add Tax Category</h3>
              </div>
              <button 
                onClick={() => setIsAddRateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Luxury Goods Surcharge (20.0%)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="VAT-LUX"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newCatRate}
                    onChange={(e) => setNewCatRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fiscal Code</label>
                  <input
                    type="text"
                    maxLength={1}
                    value={newCatFiscalCode}
                    onChange={(e) => setNewCatFiscalCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newCatIsZero}
                    onChange={(e) => setNewCatIsZero(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500"
                  />
                  <span>Zero-Rated</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newCatIsExempt}
                    onChange={(e) => setNewCatIsExempt(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500"
                  />
                  <span>Exempt Supply</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Statutory goods classification notes..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddRateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                  Add Tax Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
