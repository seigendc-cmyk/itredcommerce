import React, { useState } from 'react';
import { 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Building2, 
  Users, 
  Gift, 
  ArrowLeft, 
  Check, 
  Settings, 
  ShieldCheck, 
  Lock, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  HardDrive,
  Info,
  DollarSign
} from 'lucide-react';
import { PaymentMethodConfig, PaymentMethodType, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

interface PaymentMethodsConfigViewProps {
  configs: PaymentMethodConfig[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateConfig: (updated: PaymentMethodConfig) => void;
}

export const PaymentMethodsConfigView: React.FC<PaymentMethodsConfigViewProps> = ({
  configs = [],
  currentStaff,
  onBackToLanding,
  onUpdateConfig,
}) => {
  const [editingConfig, setEditingConfig] = useState<PaymentMethodConfig | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Form states for modal
  const [name, setName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [requiresReference, setRequiresReference] = useState(false);
  const [referenceLabel, setReferenceLabel] = useState('');
  const [openCashDrawer, setOpenCashDrawer] = useState(false);
  const [allowSplit, setAllowSplit] = useState(true);
  const [providerName, setProviderName] = useState('');
  const [merchantOrPaybill, setMerchantOrPaybill] = useState('');
  const [stkPush, setStkPush] = useState(false);
  const [autoPromptTerminal, setAutoPromptTerminal] = useState(false);
  const [allowOfflineCapture, setAllowOfflineCapture] = useState(false);
  const [managerApproval, setManagerApproval] = useState(false);
  const [notes, setNotes] = useState('');

  const getMethodIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'CASH':
        return <Banknote className="w-4 h-4 text-emerald-600" />;
      case 'MOBILE_MONEY':
        return <Smartphone className="w-4 h-4 text-orange-600" />;
      case 'BANK_TRANSFER':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'DEBIT_CARD':
      case 'OTHER':
        return <CreditCard className="w-4 h-4 text-purple-600" />;
      case 'CUSTOMER_CREDIT':
        return <Users className="w-4 h-4 text-indigo-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleOpenEdit = (cfg: PaymentMethodConfig) => {
    setEditingConfig(cfg);
    setName(cfg.name);
    setIsEnabled(cfg.isEnabled);
    setRequiresReference(cfg.requiresReference);
    setReferenceLabel(cfg.referenceLabel || '');
    setOpenCashDrawer(cfg.openCashDrawerOnTender);
    setAllowSplit(cfg.allowSplitPayment);
    setProviderName(cfg.providerName || '');
    setMerchantOrPaybill(cfg.merchantOrPaybillNumber || '');
    setStkPush(cfg.stkPushEnabled || false);
    setAutoPromptTerminal(cfg.autoPromptTerminal || false);
    setAllowOfflineCapture(cfg.allowOfflineCapture || false);
    setManagerApproval(cfg.requireManagerApprovalIfOverLimit || false);
    setNotes(cfg.notes || '');
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    const updated: PaymentMethodConfig = {
      ...editingConfig,
      name,
      isEnabled,
      requiresReference,
      referenceLabel: requiresReference ? referenceLabel : undefined,
      openCashDrawerOnTender: openCashDrawer,
      allowSplitPayment: allowSplit,
      providerName: providerName || undefined,
      merchantOrPaybillNumber: merchantOrPaybill || undefined,
      stkPushEnabled: stkPush,
      autoPromptTerminal,
      allowOfflineCapture,
      requireManagerApprovalIfOverLimit: managerApproval,
      notes: notes || undefined,
    };

    onUpdateConfig(updated);
    setEditingConfig(null);
    setSaveNotice(`Payment configuration for "${name}" updated successfully.`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleQuickToggle = (cfg: PaymentMethodConfig) => {
    const updated: PaymentMethodConfig = {
      ...cfg,
      isEnabled: !cfg.isEnabled,
    };
    onUpdateConfig(updated);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header */}
      <div className="bg-slate-900 text-white p-3.5 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
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
            <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-400" />
              Payment Tender Channels & Integration Settings
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Cash Float Kickout, Mobile Money STK, Interbank EFT, Debtor Credit Terms & EMV Terminals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-slate-800 text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            Zero Raw Card Data Stored
          </span>
        </div>
      </div>

      {saveNotice && (
        <Alert variant="success" title="Saved">
          {saveNotice}
        </Alert>
      )}

      {/* PCI-DSS / Data Security Banner */}
      <div className="bg-slate-100 border border-slate-200 p-3 rounded flex items-start gap-3 text-slate-700 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-slate-800">
            Secure Payment Architecture & Non-Sensitive Storage
          </div>
          <div className="text-[11px] text-slate-600">
            iTred Commerce handles payment triggers via external PINPad protocols, QR codes, and reference verification. Sensitive primary account numbers (PAN) and CVV codes are never ingested, transmitted to unencrypted logs, or stored locally.
          </div>
        </div>
      </div>

      {/* Payment Methods Table/Cards */}
      <div className="space-y-3">
        {configs.map((cfg) => (
          <div
            key={cfg.id}
            className={`bg-white border p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition ${
              cfg.isEnabled ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-100 rounded shrink-0">
                {getMethodIcon(cfg.methodType)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">{cfg.name}</h3>
                  {cfg.isDefault && (
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-orange-100 text-orange-800 rounded">
                      Default Tender
                    </span>
                  )}
                  <StatusBadge
                    status={cfg.isEnabled ? 'ACTIVE' : 'VOIDED'}
                    customLabel={cfg.isEnabled ? 'ENABLED' : 'DISABLED'}
                  />
                </div>

                <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-3">
                  <span>Type: {cfg.methodType}</span>
                  {cfg.linkedSettlementAccountName && (
                    <span>• GL Settle: {cfg.linkedSettlementAccountName}</span>
                  )}
                  {cfg.providerName && <span>• Provider: {cfg.providerName}</span>}
                </div>

                {/* Badges / Options summary */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {cfg.openCashDrawerOnTender && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                      Drawer Kickout Enabled
                    </span>
                  )}
                  {cfg.requiresReference && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      Ref Required: {cfg.referenceLabel || 'Code'}
                    </span>
                  )}
                  {cfg.stkPushEnabled && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                      STK Push Prompt
                    </span>
                  )}
                  {cfg.autoPromptTerminal && (
                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                      Auto-Prompt PINPad
                    </span>
                  )}
                  {cfg.allowOfflineCapture && (
                    <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                      Offline Capture Allowed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <Button
                variant={cfg.isEnabled ? 'outline' : 'primary'}
                size="sm"
                onClick={() => handleQuickToggle(cfg)}
                className={cfg.isEnabled ? 'text-slate-700' : ''}
              >
                {cfg.isEnabled ? 'Disable' : 'Enable Tender'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenEdit(cfg)}
                leftIcon={<Settings className="w-3.5 h-3.5" />}
              >
                Configure
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Edit Payment Method Config */}
      <Modal
        isOpen={!!editingConfig}
        onClose={() => setEditingConfig(null)}
        title={`Configure Tender: ${editingConfig?.name || ''}`}
        size="lg"
      >
        <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Display Name on POS Cart
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Tender Status
              </label>
              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <span className="font-bold text-slate-800">Enabled on Cashier Terminals</span>
                </label>
              </div>
            </div>
          </div>

          {/* Operational Switches */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-2.5">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Terminal Behavior & Drawer Triggers
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={openCashDrawer}
                  onChange={(e) => setOpenCashDrawer(e.target.checked)}
                  className="mt-0.5 text-orange-600 rounded"
                />
                <div>
                  <div className="font-bold">Open Cash Drawer on Finalize</div>
                  <div className="text-[10px] text-slate-500">Triggers RJ11 kick pulse upon payment completion.</div>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={allowSplit}
                  onChange={(e) => setAllowSplit(e.target.checked)}
                  className="mt-0.5 text-orange-600 rounded"
                />
                <div>
                  <div className="font-bold">Allow Split Tender Participation</div>
                  <div className="text-[10px] text-slate-500">Permits combined checkout with other tenders.</div>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={requiresReference}
                  onChange={(e) => setRequiresReference(e.target.checked)}
                  className="mt-0.5 text-orange-600 rounded"
                />
                <div>
                  <div className="font-bold">Require Reference / Auth Code</div>
                  <div className="text-[10px] text-slate-500">Prompts cashier for transaction verification ID.</div>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={managerApproval}
                  onChange={(e) => setManagerApproval(e.target.checked)}
                  className="mt-0.5 text-orange-600 rounded"
                />
                <div>
                  <div className="font-bold">Manager Override Threshold</div>
                  <div className="text-[10px] text-slate-500">Requires supervisor PIN if amount exceeds limit.</div>
                </div>
              </label>
            </div>

            {requiresReference && (
              <div className="pt-2 border-t border-slate-200">
                <label className="text-[11px] font-bold text-slate-700">
                  Custom Reference Field Prompt
                </label>
                <Input
                  value={referenceLabel}
                  onChange={(e) => setReferenceLabel(e.target.value)}
                  placeholder="e.g. M-Pesa Transaction Code / UTR Number"
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Provider / Gateway Metadata (For Card/Momo) */}
          {(editingConfig?.methodType === 'MOBILE_MONEY' || editingConfig?.methodType === 'DEBIT_CARD') && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-3">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Gateway & Terminal Integration Parameters
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">Provider Service Profile</label>
                  <Input
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="e.g. Safaricom M-Pesa / EMV Card Terminal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">Merchant / Paybill Number</label>
                  <Input
                    value={merchantOrPaybill}
                    onChange={(e) => setMerchantOrPaybill(e.target.value)}
                    placeholder="e.g. 542901"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-slate-700">
                {editingConfig.methodType === 'MOBILE_MONEY' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stkPush}
                      onChange={(e) => setStkPush(e.target.checked)}
                      className="text-orange-600 rounded"
                    />
                    <span className="font-bold text-[11px]">Enable STK Push Customer Prompt</span>
                  </label>
                )}

                {editingConfig.methodType === 'DEBIT_CARD' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPromptTerminal}
                      onChange={(e) => setAutoPromptTerminal(e.target.checked)}
                      className="text-orange-600 rounded"
                    />
                    <span className="font-bold text-[11px]">Auto-Prompt PINPad Terminal</span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOfflineCapture}
                    onChange={(e) => setAllowOfflineCapture(e.target.checked)}
                    className="text-orange-600 rounded"
                  />
                  <span className="font-bold text-[11px]">Allow Offline Buffer Capture</span>
                </label>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Operational Instructions / Policy Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verify customer ID for bank transfers exceeding $1,000"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingConfig(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
