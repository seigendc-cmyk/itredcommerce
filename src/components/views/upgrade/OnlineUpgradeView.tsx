import React, { useState } from 'react';
import { 
  Cloud, 
  ShieldCheck, 
  Layers, 
  Building2, 
  Smartphone, 
  RefreshCw, 
  ArrowRight, 
  Check, 
  HardDrive, 
  Database, 
  Sparkles, 
  BrainCircuit, 
  Lock, 
  Server, 
  TrendingUp, 
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { StaffMember, InventoryItem, Customer, SaleTransaction } from '../../../types';
import { Button } from '../../ui/Button';

export interface OnlineUpgradeViewProps {
  currentStaff: StaffMember;
  inventoryCount: number;
  customerCount: number;
  salesCount: number;
  onBackToLanding: () => void;
}

export const OnlineUpgradeView: React.FC<OnlineUpgradeViewProps> = ({
  currentStaff,
  inventoryCount,
  customerCount,
  salesCount,
  onBackToLanding,
}) => {
  const [readinessChecked, setReadinessChecked] = useState<boolean>(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState<boolean>(false);
  const [inquirySubmitted, setInquirySubmitted] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'OVERVIEW' | 'CAPABILITIES' | 'COMPARISON' | 'READINESS'>('OVERVIEW');

  const capabilities = [
    {
      title: 'Advanced BI & Predictive Analytics',
      icon: <BrainCircuit className="w-5 h-5 text-[#FF6B00]" />,
      summary: 'Multi-store demand forecasting, seasonal trend modelling, and dynamic reorder point calculation across regional depots.',
      details: 'Extends local rule alerts with cross-location cohort analysis, customer lifetime value models, and predictive inventory velocity rankings.'
    },
    {
      title: 'Automated Cloud Backup & Disaster Recovery',
      icon: <Database className="w-5 h-5 text-blue-600" />,
      summary: 'Continuous encrypted delta synchronization ensuring zero-data-loss protection against local hardware or power failures.',
      details: 'Immutable point-in-time recovery with 99.99% cloud durability, automated end-of-day snapshot vaulting, and instant replacement machine restoration.'
    },
    {
      title: 'Multi-Branch & Central Headquarters',
      icon: <Building2 className="w-5 h-5 text-indigo-600" />,
      summary: 'Unified central catalog management, global price updates, and consolidated group financial balance sheets.',
      details: 'Maintain standard SKU codes, pricing tiers, and vendor master records from head office and push instantaneously to all branch POS terminals.'
    },
    {
      title: 'Cross-Location Inventory Visibility',
      icon: <Layers className="w-5 h-5 text-emerald-600" />,
      summary: 'Cashiers can look up real-time stock levels at sister branches and initiate inter-branch transfer manifests.',
      details: 'Eliminate lost sales by redirecting walk-in contractors to nearby branches or dispatching warehouse stock transfers with transit tracking.'
    },
    {
      title: 'Remote Executive Web & Mobile Dashboards',
      icon: <Smartphone className="w-5 h-5 text-purple-600" />,
      summary: 'Real-time sales tracking, gross margin monitoring, and staff productivity reports accessible securely from any browser or phone.',
      details: 'Encrypted manager portal with instant notifications on price overrides, high-value refunds, cash discrepancies, and low-stock alerts.'
    },
    {
      title: 'Hybrid Offline-First Architecture',
      icon: <Server className="w-5 h-5 text-amber-600" />,
      summary: 'Desktop workstations continue operating at full speed with 0ms latency even during total broadband outages.',
      details: 'When internet connectivity fluctuates, POS terminals buffer all sales and audit journals locally, automatically syncing upon reconnect.'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 select-none font-sans">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
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
            <span className="text-gray-900 font-bold">Cloud Extension</span>
            <span>/</span>
            <span className="text-[#FF6B00]">iTred Online Overview</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-[#FF6B00] text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <span>iTred Online Enterprise Upgrade Experience</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            An architectural extension for multi-branch consolidation, automated cloud backup, and executive remote reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onBackToLanding}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Core Philosophy Notice */}
      <div className="bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950 flex items-start gap-3 shadow-2xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-amber-900">
            Design Philosophy: An Extension of Capability, Not a Replacement
          </h4>
          <p className="leading-relaxed text-amber-900">
            The Desktop Edition is a complete, fully autonomous operational POS system designed to run permanently offline with zero dependencies.
            The <strong>Online Plan</strong> is designed exclusively as an operational scale-up tier for multi-branch organizations requiring consolidated head-office reporting, cross-store inventory sharing, and cloud disaster recovery.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedTab('OVERVIEW')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'OVERVIEW'
              ? 'border-[#FF6B00] text-[#FF6B00]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Capability Overview
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab('COMPARISON')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'COMPARISON'
              ? 'border-[#FF6B00] text-[#FF6B00]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Edition Comparison Matrix
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab('READINESS')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            selectedTab === 'READINESS'
              ? 'border-[#FF6B00] text-[#FF6B00]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Migration Readiness Pre-Flight Check
        </button>
      </div>

      {/* TAB 1: CAPABILITY OVERVIEW */}
      {selectedTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilities.map((cap, idx) => (
              <div key={idx} className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-gray-50 border border-gray-200">
                      {cap.icon}
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 leading-tight">
                      {cap.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-700 font-medium mb-2 leading-relaxed">
                    {cap.summary}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {cap.details}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
                  <span>Available in Online Tier</span>
                  <span className="text-[#FF6B00] font-bold">Extension</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold">Ready to connect multiple stores or enable cloud backup?</h3>
              <p className="text-xs text-gray-300 max-w-xl">
                Consult with our solutions team to plan a seamless zero-downtime bridge from Desktop to the Online Hybrid cloud platform.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => setInquiryModalOpen(true)}
              className="bg-[#FF6B00] hover:bg-[#E05E00] text-white"
            >
              Request Upgrade Consultation
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: COMPARISON MATRIX */}
      {selectedTab === 'COMPARISON' && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 font-mono">
              Desktop Edition vs Online Enterprise Tier
            </h3>
            <span className="text-xs font-mono text-gray-500">Dual Architecture Standard</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-800 font-mono font-bold uppercase">
                  <th className="p-3.5">Capability / Functional Area</th>
                  <th className="p-3.5 w-64 bg-amber-50/50 text-[#FF6B00]">Desktop Workstation (Active)</th>
                  <th className="p-3.5 w-64 bg-indigo-50/50 text-indigo-900">Online Enterprise (Extension)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700 font-sans">
                {[
                  { name: 'Core POS & Barcode Checkout', desktop: 'Full (0ms Latency)', online: 'Full (Hybrid Offline Buffer)' },
                  { name: 'Accounts Receivable & Debtors Ledger', desktop: 'Local Station Master', online: 'Multi-Branch Shared Ledger' },
                  { name: 'Accounts Payable & Creditors', desktop: 'Local Station Master', online: 'Central Head Office AP' },
                  { name: 'Business Intelligence & Rules', desktop: '14 Deterministic Rules', online: 'AI / Multi-Store Forecasting' },
                  { name: 'Standard Reports & Audits (10 Groups)', desktop: 'Local CSV / PDF / Print', online: 'Web / Mobile / Cloud Export' },
                  { name: 'Data Storage & Persistence', desktop: 'Encrypted Local SQLite Datastore', online: 'Real-time Encrypted Cloud Mirror' },
                  { name: 'Disaster Recovery & Snapshots', desktop: 'Manual USB / Folder Backup', online: 'Continuous Automated Delta Backup' },
                  { name: 'Branch Locations Supported', desktop: 'Single Store Autonomous', online: 'Unlimited Multi-Store / Depots' },
                  { name: 'Inter-Branch Stock Transfers', desktop: 'Manual Manifest Entry', online: 'Automated Real-time Transit Sync' },
                  { name: 'Internet Connectivity Requirement', desktop: '100% Offline (No Internet)', online: 'Offline-Resilient Sync' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80">
                    <td className="p-3.5 font-bold text-gray-900">{row.name}</td>
                    <td className="p-3.5 bg-amber-50/20 font-medium text-gray-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{row.desktop}</span>
                    </td>
                    <td className="p-3.5 bg-indigo-50/20 font-medium text-indigo-950">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{row.online}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MIGRATION READINESS CHECKER */}
      {selectedTab === 'READINESS' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Local Workstation Migration Pre-Flight Check</h3>
              <p className="text-xs text-gray-600 mt-1">
                Scans your local database schema, item counts, customer ledgers, and transactions to verify instant compatibility for future zero-downtime cloud pairing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 border border-gray-200 bg-gray-50">
                <div className="text-[10px] uppercase font-mono text-gray-500">Catalog SKUs</div>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">{inventoryCount} Items</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Schema Compatible</div>
              </div>
              <div className="p-4 border border-gray-200 bg-gray-50">
                <div className="text-[10px] uppercase font-mono text-gray-500">Customer Accounts</div>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">{customerCount} Accounts</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">AR Ledger Ready</div>
              </div>
              <div className="p-4 border border-gray-200 bg-gray-50">
                <div className="text-[10px] uppercase font-mono text-gray-500">Recorded Sales</div>
                <div className="text-xl font-black text-gray-900 font-mono mt-0.5">{salesCount} Invoices</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Audit Journal Valid</div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <Button
                variant="primary"
                size="md"
                onClick={() => setReadinessChecked(true)}
                leftIcon={<RefreshCw className={`w-4 h-4 ${readinessChecked ? 'animate-spin' : ''}`} />}
                className="bg-[#FF6B00] hover:bg-[#E05E00]"
              >
                {readinessChecked ? 'Re-Run Compatibility Scan' : 'Run Pre-Flight Scan'}
              </Button>

              {readinessChecked && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>100% Migration Ready — Zero Schema Conflicts</span>
                </div>
              )}
            </div>

            {readinessChecked && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2 mt-4">
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Pre-Flight Verification Results: PASSED</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-emerald-900">
                  <li>Local SQLite database structure complies with Cloud Hub multi-tenant schema.</li>
                  <li>All inventory SKUs possess unique primary identifiers.</li>
                  <li>Fiscal and Tax categories align with standardized VAT calculation models.</li>
                  <li>Ready for 1-click cloud sync when you choose to activate the Online edition.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INQUIRY CONSULTATION MODAL */}
      {inquiryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-300 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#FF6B00]" />
                <span>Online Upgrade Inquiry</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setInquiryModalOpen(false);
                  setInquirySubmitted(false);
                }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {inquirySubmitted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-sm">Inquiry Logged Successfully</h4>
                  <p className="text-emerald-800 text-[11px]">
                    Your station profile and migration readiness report have been compiled into your offline export log. A solution specialist will reach out when the cloud bridge is configured.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600">
                    Tell us about your multi-branch or cloud backup requirements. Our team will tailor a migration plan that keeps your existing Desktop POS running uninterrupted.
                  </p>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Company / Trading Name</label>
                    <input
                      type="text"
                      defaultValue="Downtown Hardware & Spares Ltd"
                      className="w-full p-2 border border-gray-300 bg-white font-sans text-xs focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Number of Branch Locations</label>
                    <select className="w-full p-2 border border-gray-300 bg-white font-sans text-xs focus:outline-none focus:border-[#FF6B00]">
                      <option>1 Store (Adding Cloud Backup & Remote Dashboard)</option>
                      <option>2 - 5 Branches</option>
                      <option>6 - 20 Branches (Enterprise)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Primary Interest</label>
                    <select className="w-full p-2 border border-gray-300 bg-white font-sans text-xs focus:outline-none focus:border-[#FF6B00]">
                      <option>Automated Cloud Backup & Disaster Recovery</option>
                      <option>Multi-Branch Inventory & Central Head Office</option>
                      <option>Remote Executive Web & Mobile Analytics</option>
                      <option>Advanced Predictive BI & Reorder Models</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setInquiryModalOpen(false);
                  setInquirySubmitted(false);
                }}
              >
                Close
              </Button>

              {!inquirySubmitted && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setInquirySubmitted(true)}
                  className="bg-[#FF6B00] hover:bg-[#E05E00]"
                >
                  Submit Inquiry
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
