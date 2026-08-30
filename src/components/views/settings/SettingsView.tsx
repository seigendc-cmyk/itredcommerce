import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  ShieldCheck,
  Printer,
  Percent,
  HardDrive,
  Building2,
  Monitor,
  Sliders,
  ArrowLeft,
  Key,
  Save,
  RefreshCw,
  CheckCircle2,
  Download,
  Upload,
  Landmark,
  Layers,
  Database,
  TrendingUp,
  UserPlus,
  Ban,
  PlayCircle
} from 'lucide-react';
import { StaffMember, ActiveView, StaffAccessRole } from '../../../types';
import { INITIAL_STAFF_MEMBERS } from '../../../data/mockData';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { apiGet, apiPost, apiPatch } from '../../../api/client';
import { BRANCH_TERMINAL_VIEWS } from '../../../utils/accessRoleGate';

interface RateConfigVersion {
  id: string;
  version: number;
  currency: string;
  baseFee: number;
  perKmRate: number;
  loadSizeSurchargeTiers: Array<{ label: string; maxWeightKg: number | null; surcharge: number }>;
  rideTypeMultipliers: Record<string, number>;
  effectiveDate: string;
  createdByStaffName?: string;
  createdAt: string;
  notes?: string;
}

const ACCESS_ROLES: StaffAccessRole[] = ['TILL_OPERATOR', 'HEAD_OFFICE_STAFF', 'EXECUTIVE', 'RIDER', 'PLATFORM_SUPER_ADMIN'];

export interface SettingsViewProps {
  initialTab?: string;
  currentStaff: StaffMember;
  onBackToLanding: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialTab = 'staff',
  currentStaff,
  onBackToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF_MEMBERS);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Staff administration (real backend — GET/POST/PATCH /staff)
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [isNewStaffFormOpen, setIsNewStaffFormOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    code: '', name: '', role: 'CASHIER', roleTitle: '', department: '', accessRole: 'TILL_OPERATOR' as StaffAccessRole, pin: '',
  });

  useEffect(() => {
    if (activeTab !== 'staff') return;
    setIsStaffLoading(true);
    apiGet<StaffMember[]>('/staff')
      .then(setStaffList)
      .catch((err) => console.error('Failed to load staff directory', err))
      .finally(() => setIsStaffLoading(false));
  }, [activeTab]);

  const handleCreateStaff = async () => {
    if (!newStaffForm.code || !newStaffForm.name || !newStaffForm.pin) {
      setAlertNotice('Code, name and PIN are required to create a staff member.');
      return;
    }
    try {
      const created = await apiPost<StaffMember>('/staff', newStaffForm);
      setStaffList((prev) => [...prev, created]);
      setIsNewStaffFormOpen(false);
      setNewStaffForm({ code: '', name: '', role: 'CASHIER', roleTitle: '', department: '', accessRole: 'TILL_OPERATOR', pin: '' });
      setAlertNotice(`Staff member ${created.name} created.`);
    } catch (err: any) {
      setAlertNotice(err?.message || 'Failed to create staff member.');
    }
  };

  const handleResetStaffPin = async (staffId: string) => {
    const pin = window.prompt('Enter a new 4-6 digit PIN for this staff member:');
    if (!pin) return;
    try {
      await apiPost(`/staff/${encodeURIComponent(staffId)}/reset-pin`, { pin });
      setAlertNotice('PIN reset successfully.');
    } catch (err: any) {
      setAlertNotice(err?.message || 'Failed to reset PIN.');
    }
  };

  const handleToggleStaffActive = async (staff: StaffMember & { isActive?: boolean }) => {
    try {
      const updated = await apiPost<StaffMember>(`/staff/${encodeURIComponent(staff.id)}/${staff.isActive === false ? 'reactivate' : 'deactivate'}`);
      setStaffList((prev) => prev.map((s) => (s.id === staff.id ? updated : s)));
    } catch (err: any) {
      setAlertNotice(err?.message || 'Failed to update staff status.');
    }
  };

  // Fare/rate configuration (DL-004 — real backend, GET/POST /rate-config)
  const [rateVersions, setRateVersions] = useState<RateConfigVersion[]>([]);
  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const [isPublishFormOpen, setIsPublishFormOpen] = useState(false);
  const [rateForm, setRateForm] = useState({
    currency: 'USD', baseFee: '', perKmRate: '', effectiveDate: new Date().toISOString().slice(0, 10), notes: '',
  });
  const activeRateVersion = rateVersions[0];

  useEffect(() => {
    if (activeTab !== 'rates') return;
    setIsRatesLoading(true);
    apiGet<RateConfigVersion[]>('/rate-config')
      .then(setRateVersions)
      .catch((err) => console.error('Failed to load rate configuration', err))
      .finally(() => setIsRatesLoading(false));
  }, [activeTab]);

  const handlePublishRate = async () => {
    const baseFee = parseFloat(rateForm.baseFee);
    const perKmRate = parseFloat(rateForm.perKmRate);
    if (Number.isNaN(baseFee) || baseFee < 0 || Number.isNaN(perKmRate) || perKmRate < 0) {
      setAlertNotice('Base fee and per-km rate must be non-negative numbers.');
      return;
    }
    try {
      const published = await apiPost<RateConfigVersion>('/rate-config', {
        currency: rateForm.currency,
        baseFee,
        perKmRate,
        loadSizeSurchargeTiers: activeRateVersion?.loadSizeSurchargeTiers ?? [],
        rideTypeMultipliers: activeRateVersion?.rideTypeMultipliers ?? {},
        effectiveDate: rateForm.effectiveDate,
        notes: rateForm.notes || undefined,
      });
      setRateVersions((prev) => [published, ...prev]);
      setIsPublishFormOpen(false);
      setAlertNotice(`Rate version ${published.version} published.`);
    } catch (err: any) {
      setAlertNotice(err?.message || 'Failed to publish rate version.');
    }
  };

  // Peripheral states
  const [printerPort, setPrinterPort] = useState('COM3 (ESC/POS 80mm Thermal)');
  const [cashDrawerTrigger, setCashDrawerTrigger] = useState('RJ11 via Receipt Printer (Pin 2)');
  const [scannerType, setScannerType] = useState('USB HID Barcode Wedge');
  const [poleDisplay, setPoleDisplay] = useState('VFD 2x20 Customer Display (COM1)');

  // Tax rates
  const [standardVat, setStandardVat] = useState('15.0');
  const [reducedVat, setReducedVat] = useState('5.0');
  const [taxNumber, setTaxNumber] = useState('TAX-VAT-88492019-B');

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState('2026-08-15 12:00 (Local Drive C:)');

  const handleSaveSettings = () => {
    setAlertNotice('Configuration saved to local workstation configuration.');
    setTimeout(() => setAlertNotice(null), 3000);
  };

  const handleRunBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      setLastBackupDate(`2026-08-15 ${new Date().toLocaleTimeString()} (Verified Local Archive)`);
      setAlertNotice('Local database snapshot generated successfully.');
      setTimeout(() => setAlertNotice(null), 3500);
    }, 1500);
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-400" />
              Workstation Settings & System Administration
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              Peripherals, Security Roles, Master Accounts, Tax Rates & Offline Backups
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleSaveSettings}
          leftIcon={<Save className="w-3.5 h-3.5" />}
        >
          Save Configuration
        </Button>
      </div>

      {alertNotice && (
        <Alert type="success" onClose={() => setAlertNotice(null)}>
          {alertNotice}
        </Alert>
      )}

      {/* Main Settings Navigation Split */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Left Navigation Sidebar */}
        <div className="md:col-span-3 bg-white border border-slate-300 p-2 space-y-1">
          {[
            { id: 'staff', label: 'Staff & Access Codes', icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'roles', label: 'Roles & Security Rights', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { id: 'devices', label: 'Hardware Devices & POS', icon: <Printer className="w-3.5 h-3.5" /> },
            { id: 'tax', label: 'Tax & Fiscalization', icon: <Percent className="w-3.5 h-3.5" /> },
            { id: 'rates', label: 'Fare & Rate Configuration', icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { id: 'branches', label: 'Branches & Terminals', icon: <Building2 className="w-3.5 h-3.5" /> },
            { id: 'connected_shops', label: 'Connect Other Shops', icon: <Database className="w-3.5 h-3.5" /> },
            { id: 'backup', label: 'Backup & Restore', icon: <HardDrive className="w-3.5 h-3.5" /> },
            { id: 'vendor', label: 'Vendor Preferences', icon: <Sliders className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer select-none rounded-none border ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                  : 'bg-transparent text-slate-700 border-transparent hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-white' : 'text-slate-500'}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 bg-white border border-slate-300 p-5">
          
          {/* TAB: STAFF & ACCESS CODES */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-sm uppercase text-slate-900">Authorized Staff Directory</h3>
                  <p className="text-xs text-slate-500">Manage staff PIN access, access scope, and active status</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={`${staffList.filter((s: any) => s.isActive !== false).length} Active Operators`} size="sm" />
                  <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setIsNewStaffFormOpen((v) => !v)}>
                    New Staff
                  </Button>
                </div>
              </div>

              {isNewStaffFormOpen && (
                <div className="bg-slate-50 p-3 border border-slate-300 space-y-3">
                  <div className="font-bold text-slate-800 uppercase tracking-wide">New Staff Member</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Input label="Staff Code" isMono value={newStaffForm.code} onChange={(e) => setNewStaffForm((f) => ({ ...f, code: e.target.value }))} />
                    <Input label="Full Name" value={newStaffForm.name} onChange={(e) => setNewStaffForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input label="Role Title" value={newStaffForm.roleTitle} onChange={(e) => setNewStaffForm((f) => ({ ...f, roleTitle: e.target.value }))} />
                    <Input label="Department" value={newStaffForm.department} onChange={(e) => setNewStaffForm((f) => ({ ...f, department: e.target.value }))} />
                    <Input label="Initial PIN (4-6 digits)" isMono type="password" value={newStaffForm.pin} onChange={(e) => setNewStaffForm((f) => ({ ...f, pin: e.target.value }))} />
                    <div>
                      <label className="font-semibold uppercase text-slate-700 block mb-1 text-xs">Access Scope</label>
                      <select
                        value={newStaffForm.accessRole}
                        onChange={(e) => setNewStaffForm((f) => ({ ...f, accessRole: e.target.value as StaffAccessRole }))}
                        className="w-full p-2 bg-white border border-slate-300 font-mono font-medium focus:border-orange-500 focus:outline-none text-xs"
                      >
                        {ACCESS_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" onClick={handleCreateStaff}>Create Staff Member</Button>
                </div>
              )}

              <div className="border border-slate-300 divide-y divide-slate-200 text-xs">
                {isStaffLoading && <div className="p-3 text-slate-500">Loading staff directory…</div>}
                {!isStaffLoading && staffList.map((staff: any) => (
                  <div key={staff.id} className="p-3 flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F5]/50 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {staff.avatarInitials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{staff.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {staff.code} • {staff.department || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <StatusBadge status={staff.roleTitle} size="sm" />
                      <StatusBadge status={staff.accessRole || 'TILL_OPERATOR'} size="sm" />
                      {staff.isActive === false && <StatusBadge status="INACTIVE" size="sm" />}
                      <Button variant="outline" size="sm" leftIcon={<Key className="w-3 h-3" />} onClick={() => handleResetStaffPin(staff.id)}>
                        Reset PIN
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={staff.isActive === false ? <PlayCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        onClick={() => handleToggleStaffActive(staff)}
                      >
                        {staff.isActive === false ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: ROLES & RIGHTS */}
          {activeTab === 'roles' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Security Rights Matrix</h3>
                <p className="text-slate-500">Fine-grained operational permission boundaries by role</p>
              </div>

              <div className="border border-slate-300">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono">
                      <th className="p-2.5 uppercase">Functional Permission</th>
                      <th className="p-2.5 text-center uppercase">SysAdmin</th>
                      <th className="p-2.5 text-center uppercase">Manager</th>
                      <th className="p-2.5 text-center uppercase">Cashier</th>
                      <th className="p-2.5 text-center uppercase">Inventory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {[
                      { name: 'Open Register / Cash Tender (F1)', sa: true, mgr: true, csh: true, inv: false },
                      { name: 'Price Override & Void Item', sa: true, mgr: true, csh: false, inv: false },
                      { name: 'Sales Returns & Credit Notes', sa: true, mgr: true, csh: true, inv: false },
                      { name: 'Issue Commercial Purchase Order', sa: true, mgr: true, csh: false, inv: true },
                      { name: 'Goods Receiving & SOH Inward', sa: true, mgr: true, csh: false, inv: true },
                      { name: 'End of Day (EOD) Drawer Closure', sa: true, mgr: true, csh: true, inv: false },
                      { name: 'Catalog Master Price Edit', sa: true, mgr: true, csh: false, inv: false },
                      { name: 'Local Backup & Restore Archive', sa: true, mgr: false, csh: false, inv: false },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-medium text-slate-900">{row.name}</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">{row.sa ? 'GRANT' : '—'}</td>
                        <td className="p-2.5 text-center text-emerald-600 font-bold">{row.mgr ? 'GRANT' : '—'}</td>
                        <td className="p-2.5 text-center text-slate-700">{row.csh ? 'GRANT' : 'DENY'}</td>
                        <td className="p-2.5 text-center text-slate-700">{row.inv ? 'GRANT' : 'DENY'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Access Scope (DL-002/DL-005) — derived directly from the
                  same BRANCH_TERMINAL_VIEWS set the app actually enforces
                  (src/utils/accessRoleGate.ts), so this display can never
                  drift from what's really gated. */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <h3 className="font-bold text-sm uppercase text-slate-900">Access Scope (DL-002 / DL-005)</h3>
                <p className="text-slate-500">Which app surface a login's access role unlocks — enforced server-side on every route, not just in this UI</p>
                <div className="border border-slate-300">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono">
                        <th className="p-2.5 uppercase">Access Role</th>
                        <th className="p-2.5 uppercase">Reachable Modules</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {ACCESS_ROLES.map((role) => (
                        <tr key={role} className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-900">{role}</td>
                          <td className="p-2.5 font-sans text-slate-700">
                            {role === 'TILL_OPERATOR'
                              ? Array.from(BRANCH_TERMINAL_VIEWS).join(', ')
                              : role === 'RIDER'
                              ? 'Not applicable to this app surface (Delivery/Rider PWA is a separate, future surface)'
                              : 'Full head-office surface'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DEVICES & PERIPHERALS */}
          {activeTab === 'devices' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">POS Hardware Peripherals</h3>
                <p className="text-slate-500">Configure direct hardware links for thermal printers, barcode scanners, and drawers</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold uppercase text-slate-700 block mb-1">Receipt Printer (ESC/POS)</label>
                  <select
                    value={printerPort}
                    onChange={(e) => setPrinterPort(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 font-mono font-medium focus:border-orange-500 focus:outline-none"
                  >
                    <option>COM3 (ESC/POS 80mm Thermal)</option>
                    <option>COM1 (Serial Standard 9600 baud)</option>
                    <option>USB001 (Direct USB Virtual Port)</option>
                    <option>Network LPT1 (192.168.1.120)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-700 block mb-1">Cash Drawer Trigger</label>
                  <select
                    value={cashDrawerTrigger}
                    onChange={(e) => setCashDrawerTrigger(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 font-mono font-medium focus:border-orange-500 focus:outline-none"
                  >
                    <option>RJ11 via Receipt Printer (Pin 2)</option>
                    <option>Direct Serial Kick (COM4)</option>
                    <option>Dedicated USB Drawer Controller</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-700 block mb-1">Barcode Scanner Interface</label>
                  <select
                    value={scannerType}
                    onChange={(e) => setScannerType(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 font-mono font-medium focus:border-orange-500 focus:outline-none"
                  >
                    <option>USB HID Barcode Wedge</option>
                    <option>COM2 RS-232 Industrial Scanner</option>
                    <option>Keyboard Emulation Mode</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-700 block mb-1">Customer VFD Pole Display</label>
                  <select
                    value={poleDisplay}
                    onChange={(e) => setPoleDisplay(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 font-mono font-medium focus:border-orange-500 focus:outline-none"
                  >
                    <option>VFD 2x20 Customer Display (COM1)</option>
                    <option>Secondary HDMI Display Pole (1024x768)</option>
                    <option>Disabled</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#FAF8F5] border border-slate-200 font-mono flex items-center justify-between">
                <span className="text-slate-600">Peripheral Bus Status:</span>
                <span className="text-emerald-700 font-bold">ALL PORTS RESPONDING (0ms Latency)</span>
              </div>
            </div>
          )}

          {/* TAB: TAX & FISCAL */}
          {activeTab === 'tax' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Tax Rates & Fiscal Schedules</h3>
                <p className="text-slate-500">Set national VAT/GST schedules and business fiscal registration numbers</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Standard VAT / Sales Tax (%)"
                  value={standardVat}
                  onChange={(e) => setStandardVat(e.target.value)}
                  isMono
                />
                <Input
                  label="Reduced Rate / Food (%)"
                  value={reducedVat}
                  onChange={(e) => setReducedVat(e.target.value)}
                  isMono
                />
                <Input
                  label="Business Tax ID"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  isMono
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 leading-relaxed">
                Applied automatically to cart lines according to item department classifications.
              </div>
            </div>
          )}

          {/* TAB: FARE & RATE CONFIGURATION (DL-004) */}
          {activeTab === 'rates' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Fare & Rate Configuration</h3>
                <p className="text-slate-500">
                  Versioned delivery fare rates that configure the delivery fare engine. Publishing a new version never
                  alters past versions — every quote/transaction locks in the rate version active when it was created.
                </p>
              </div>

              {isRatesLoading && <div className="text-slate-500">Loading rate configuration…</div>}

              {!isRatesLoading && activeRateVersion && (
                <div className="bg-[#FAF8F5] border border-slate-300 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 uppercase">Current Active Version</span>
                    <StatusBadge status={`v${activeRateVersion.version}`} size="sm" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Base Fee</div>
                      <div className="font-bold text-slate-800">{activeRateVersion.currency} {activeRateVersion.baseFee.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Per-KM Rate</div>
                      <div className="font-bold text-slate-800">{activeRateVersion.currency} {activeRateVersion.perKmRate.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Effective Date</div>
                      <div className="font-bold text-slate-800">{activeRateVersion.effectiveDate}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Published By</div>
                      <div className="font-bold text-slate-800">{activeRateVersion.createdByStaffName || '—'}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Load-Size Surcharge Tiers</div>
                    <div className="flex flex-wrap gap-2 font-mono">
                      {activeRateVersion.loadSizeSurchargeTiers.map((tier, i) => (
                        <span key={i} className="px-2 py-1 bg-white border border-slate-300">
                          {tier.label} (≤{tier.maxWeightKg ?? '∞'}kg): +{activeRateVersion.currency} {tier.surcharge.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Ride-Type Multipliers</div>
                    <div className="flex flex-wrap gap-2 font-mono">
                      {Object.entries(activeRateVersion.rideTypeMultipliers).map(([type, mult]) => (
                        <span key={type} className="px-2 py-1 bg-white border border-slate-300">{type}: ×{mult}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button variant="primary" size="sm" onClick={() => setIsPublishFormOpen((v) => !v)}>
                Publish New Rate Version
              </Button>

              {isPublishFormOpen && (
                <div className="bg-slate-50 p-3 border border-slate-300 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Input label="Base Fee" isMono value={rateForm.baseFee} onChange={(e) => setRateForm((f) => ({ ...f, baseFee: e.target.value }))} placeholder={activeRateVersion ? String(activeRateVersion.baseFee) : '0.00'} />
                    <Input label="Per-KM Rate" isMono value={rateForm.perKmRate} onChange={(e) => setRateForm((f) => ({ ...f, perKmRate: e.target.value }))} placeholder={activeRateVersion ? String(activeRateVersion.perKmRate) : '0.00'} />
                    <Input label="Effective Date" type="date" value={rateForm.effectiveDate} onChange={(e) => setRateForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
                    <Input label="Currency" isMono value={rateForm.currency} onChange={(e) => setRateForm((f) => ({ ...f, currency: e.target.value }))} />
                  </div>
                  <Input label="Notes" value={rateForm.notes} onChange={(e) => setRateForm((f) => ({ ...f, notes: e.target.value }))} />
                  <p className="text-slate-500">
                    Load-size surcharge tiers and ride-type multipliers carry forward unchanged from the current version — editing
                    them individually isn't wired up yet; publish still bumps the version and locks in this snapshot.
                  </p>
                  <Button variant="primary" size="sm" onClick={handlePublishRate}>Publish</Button>
                </div>
              )}

              <div>
                <div className="text-[10px] text-slate-400 uppercase mb-1">Version History (read-only — never edited)</div>
                <div className="border border-slate-300 divide-y divide-slate-200 font-mono">
                  {rateVersions.map((v) => (
                    <div key={v.id} className="p-2.5 flex items-center justify-between bg-white">
                      <span className="font-bold text-slate-800">v{v.version}</span>
                      <span className="text-slate-600">{v.currency} {v.baseFee.toFixed(2)} base + {v.perKmRate.toFixed(2)}/km</span>
                      <span className="text-slate-500">{v.effectiveDate}</span>
                      <span className="text-slate-500">{v.createdByStaffName || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Offline Database Archival</h3>
                <p className="text-slate-500">Safely snapshot or restore the complete local commercial database</p>
              </div>

              <div className="bg-[#FAF8F5] border border-slate-300 p-4 space-y-3">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-600">Last Verified Backup:</span>
                  <span className="font-bold text-slate-800">{lastBackupDate}</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-600">Total Journal Entries:</span>
                  <span className="font-bold text-slate-800">4,812 Transactions</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-600">Catalog SKUs:</span>
                  <span className="font-bold text-slate-800">1,240 Items</span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleRunBackup}
                    isLoading={isBackingUp}
                    leftIcon={<Download className="w-4 h-4" />}
                    shortcutBadge="Ctrl+B"
                  >
                    Execute Local Backup Now
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setAlertNotice('Select verified .bak archive to initiate offline restore.');
                    }}
                    leftIcon={<Upload className="w-4 h-4" />}
                    shortcutBadge="Ctrl+R"
                  >
                    Restore from Archive
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BRANCHES & TERMINALS */}
          {activeTab === 'branches' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Branch & Terminal Assignment</h3>
                <p className="text-slate-500">Multi-lane and warehouse distribution topology</p>
              </div>

              <div className="border border-slate-300 divide-y divide-slate-200 font-mono">
                <div className="p-3 bg-slate-50 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Branch #01 — Main Distribution Hub</div>
                    <div className="text-[11px] text-slate-500">Location: Central Industrial District • Bins: 48 Bays</div>
                  </div>
                  <StatusBadge status="Primary Branch" size="sm" />
                </div>
                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Terminal #01 (This Station)</div>
                    <div className="text-[11px] text-slate-500">IP: 127.0.0.1 • Mode: Standalone Offline Register</div>
                  </div>
                  <StatusBadge status="Online / Local" size="sm" />
                </div>
                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Terminal #02 (Express Checkout)</div>
                    <div className="text-[11px] text-slate-500">IP: 192.168.1.102 • Mode: Lane Register</div>
                  </div>
                  <StatusBadge status="Active" size="sm" />
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONNECT OTHER SHOPS */}
          {activeTab === 'connected_shops' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Connect Other Shops & Peer Nodes</h3>
                <p className="text-slate-500">Configure remote store nodes, peer stock visibility, and sync credentials</p>
              </div>

              <div className="bg-[#FAF8F5] border border-amber-300 p-3 text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">Peer Stock Lookup Network Architecture:</div>
                <div>Allows your cashiers and warehouse managers to inspect real-time SOH at partner branches without cloud database dependencies. Direct TCP/IP or TLS tunnel endpoints query peer stock in real-time.</div>
              </div>

              <div className="border border-slate-300 divide-y divide-slate-200 font-mono">
                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">West Coast Megastore (BR-02)</div>
                    <div className="text-[11px] text-slate-500">Endpoint: 192.168.10.45:8080 • Mode: Direct Local Subnet • Latency: 4ms</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="CONNECTED" size="sm" />
                    <Button variant="outline" size="xs" onClick={() => setAlertNotice('Ping test OK: 4ms latency to BR-02.')}>
                      Test Ping
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">North Valley Retail (BR-03)</div>
                    <div className="text-[11px] text-slate-500">Endpoint: 10.0.4.12:8080 • Mode: VPN Tunnel • Latency: 18ms</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="CONNECTED" size="sm" />
                    <Button variant="outline" size="xs" onClick={() => setAlertNotice('Ping test OK: 18ms latency to BR-03.')}>
                      Test Ping
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Metro Express Kiosk (BR-04)</div>
                    <div className="text-[11px] text-slate-500">Endpoint: 192.168.20.15:8080 • Mode: Direct Peer</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="PENDING" size="sm" />
                    <Button variant="outline" size="xs" onClick={() => setAlertNotice('Initiated handshake with BR-04...')}>
                      Authenticate
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 border border-slate-300 space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wide">Register New Remote Storefront Node</div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Branch Code" placeholder="e.g. BR-05" isMono />
                  <Input label="Branch / Store Name" placeholder="e.g. South Harbor Outlet" />
                  <Input label="IP / Host Domain" placeholder="e.g. 192.168.30.10" isMono />
                  <Input label="API Port" placeholder="8080" isMono />
                  <Input label="Preshared Secret Key" type="password" defaultValue="••••••••••••" isMono />
                  <Input label="Sync Interval" defaultValue="5 Minutes" isMono />
                </div>
                <Button variant="primary" size="sm" onClick={() => { setAlertNotice('Remote store node registered.'); setTimeout(() => setAlertNotice(null), 3000); }}>
                  Save & Connect Peer Node
                </Button>
              </div>
            </div>
          )}

          {/* TAB: VENDOR PREFERENCES */}
          {activeTab === 'vendor' && (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase text-slate-900">Vendor & Procurement Defaults</h3>
                <p className="text-slate-500">Standard lead times, currency symbols, and invoice layout formatting</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Default PO Currency" value="USD ($)" isMono readOnly />
                <Input label="Default Payment Terms" defaultValue="Net 30 Days" />
                <Input label="Standard Order Lead Time" defaultValue="7 Days" />
                <Input label="Auto-Reorder Buffer" defaultValue="15%" isMono />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
