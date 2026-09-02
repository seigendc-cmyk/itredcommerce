import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Check, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { StaffMember } from '../../types';
import { apiPost, ApiClientError } from '../../api/client';
import {
  BusinessProfileFormState,
  emptyProfileFormState,
  LegalRegistrationFields,
  ContactBranchFields,
  BrandingFields,
  FinancialSetupFields,
} from '../business-profile/ProfileFormSections';
import { validateLatLng } from '../business-profile/validation';
import { businessTypeLabel } from '../../data/businessTypes';
import { countryName } from '../../data/countries';

export interface OnboardingWizardProps {
  activationCode: string;
  onAuthenticated: (staff: StaffMember) => void;
  onBack: () => void;
}

const STEP_LABELS = ['Legal & Registration', 'Contact & Branch', 'Branding', 'Financial Setup', 'Owner Account', 'Review & Confirm'];

interface AdminState {
  name: string;
  pin: string;
  confirmPin: string;
  contactPhone: string;
  contactEmail: string;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ activationCode, onAuthenticated, onBack }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BusinessProfileFormState>(emptyProfileFormState);
  const [admin, setAdmin] = useState<AdminState>({ name: '', pin: '', confirmPin: '', contactPhone: '', contactEmail: '' });
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patchForm = (patch: Partial<BusinessProfileFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  function stepError(): string | null {
    if (step === 1) {
      if (!form.legalName.trim()) return 'Legal business name is required.';
      if (!form.country) return 'Country of operation is required.';
      if (form.vatRegistered && !form.vatNumber.trim()) return 'VAT number is required when VAT registered.';
      return null;
    }
    if (step === 2) {
      if (!form.branchName.trim()) return 'Primary branch name is required.';
      return validateLatLng(form.branchLatitude, form.branchLongitude) ?? null;
    }
    if (step === 4) {
      if (!form.baseCurrency.trim()) return 'Base currency is required.';
      return null;
    }
    if (step === 5) {
      if (!admin.name.trim()) return 'Owner/admin name is required.';
      if (!/^\d{4,6}$/.test(admin.pin)) return 'PIN must be 4-6 digits.';
      if (admin.pin !== admin.confirmPin) return 'PIN and confirmation do not match.';
      return null;
    }
    return null;
  }

  const handleNext = () => {
    const err = stepError();
    setPinError(err);
    if (err) return;
    setPinError(null);
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBackStep = () => {
    if (step === 1) {
      onBack();
      return;
    }
    setStep((s) => s - 1);
  };

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await apiPost<{
        tenant: { id: string; legalName: string; displayName: string; country: string; baseCurrency: string; pairingCode: string };
        staff: { id: string; name: string };
      }>('/onboarding/complete', {
        legalName: form.legalName,
        displayName: form.displayName || undefined,
        registrationNumber: form.registrationNumber || undefined,
        tin: form.tin || undefined,
        vatRegistered: form.vatRegistered,
        vatNumber: form.vatRegistered ? form.vatNumber : undefined,
        country: form.country,
        businessType: form.businessType || undefined,
        registeredAddress: form.registeredAddress || undefined,
        businessPhone: form.businessPhone || undefined,
        businessEmail: form.businessEmail || undefined,
        whatsappBusinessNumber: form.whatsappBusinessNumber || undefined,
        website: form.website || undefined,
        logoDataUrl: form.logoDataUrl || undefined,
        brandColor: form.brandColor || undefined,
        baseCurrency: form.baseCurrency,
        multiCurrencyEnabled: form.multiCurrencyEnabled,
        fiscalYearStartMonth: form.fiscalYearStartMonth,
        branch: { name: form.branchName, address: form.branchAddress || undefined, latitude: form.branchLatitude, longitude: form.branchLongitude },
        admin: { name: admin.name, pin: admin.pin, contactPhone: admin.contactPhone || undefined, contactEmail: admin.contactEmail || undefined },
        activationCode,
      });

      setPairingCode(result.tenant.pairingCode);

      const { staff } = await apiPost<{ staff: StaffMember }>('/auth/login', { staffId: result.staff.id, pin: admin.pin });
      // Give the admin a moment to see the pairing code before entering the app.
      setTimeout(() => onAuthenticated(staff), 50);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Something went wrong completing setup. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  if (pairingCode) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-gray-300 shadow-xl p-6 space-y-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Business Profile Created</h2>
          <p className="text-xs text-gray-600">
            Save this Pairing Code — you'll need it to set up any additional branch till or head-office desk for this business.
          </p>
          <div className="flex items-center justify-center gap-2 bg-slate-900 text-white p-3 font-mono text-lg tracking-widest">
            {pairingCode}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(pairingCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-slate-300 hover:text-white"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">You can always find this again later on the Business Profile page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex flex-col">
      <header className="h-12 bg-[#FF6B00] text-white px-4 flex items-center shrink-0">
        <div className="font-black text-xl tracking-tighter italic select-none">
          iTred<span className="font-light not-italic">Commerce</span>
        </div>
        <span className="ml-3 text-xs font-semibold uppercase tracking-widest text-white/90">Business Profile Setup</span>
      </header>

      {/* Progress indicator */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-1">
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === step;
            const isDone = stepNum < step;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-full border-2 ${
                      isDone ? 'bg-emerald-600 border-emerald-600 text-white' : isActive ? 'bg-[#FF6B00] border-[#FF6B00] text-white' : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : stepNum}
                  </div>
                  <span className={`text-[9px] uppercase font-bold tracking-wide text-center hidden sm:block ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                </div>
                {stepNum < STEP_LABELS.length && <div className={`h-0.5 flex-1 -mt-4 ${isDone ? 'bg-emerald-600' : 'bg-gray-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto bg-white border border-gray-200 shadow-xs p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Legal &amp; Registration</h2>
              <LegalRegistrationFields value={form} onChange={patchForm} />
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Contact &amp; Primary Branch</h2>
              <ContactBranchFields value={form} onChange={patchForm} />
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Branding</h2>
              <BrandingFields value={form} onChange={patchForm} />
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Financial Setup</h2>
              <FinancialSetupFields value={form} onChange={patchForm} />
            </>
          )}
          {step === 5 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Owner / Admin Account</h2>
              <p className="text-xs text-gray-500">This creates the tenant's first staff record, with full head-office access.</p>
              <Input label="Owner / Admin Full Name" required value={admin.name} onChange={(e) => setAdmin((p) => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Admin PIN (4-6 digits)" type="password" maxLength={6} value={admin.pin} onChange={(e) => setAdmin((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} prefixElement={<Lock className="w-3.5 h-3.5" />} isMono />
                <Input label="Confirm PIN" type="password" maxLength={6} value={admin.confirmPin} onChange={(e) => setAdmin((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, '') }))} prefixElement={<Lock className="w-3.5 h-3.5" />} isMono />
              </div>
              <Input label="Admin Contact Phone" value={admin.contactPhone} onChange={(e) => setAdmin((p) => ({ ...p, contactPhone: e.target.value }))} />
              <Input label="Admin Contact Email" type="email" value={admin.contactEmail} onChange={(e) => setAdmin((p) => ({ ...p, contactEmail: e.target.value }))} />
            </>
          )}
          {step === 6 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Review &amp; Confirm</h2>
              <dl className="text-xs space-y-2">
                <SummaryRow label="Legal Name" value={form.legalName} />
                <SummaryRow label="Trading Name" value={form.displayName || form.legalName} />
                <SummaryRow label="Country" value={countryName(form.country)} />
                <SummaryRow label="TIN" value={form.tin || '—'} />
                <SummaryRow label="VAT" value={form.vatRegistered ? form.vatNumber : 'Not registered'} />
                <SummaryRow label="Business Type" value={businessTypeLabel(form.businessType)} />
                <SummaryRow label="Primary Branch" value={form.branchName} />
                <SummaryRow label="Base Currency" value={form.baseCurrency} />
                <SummaryRow label="Multi-Currency" value={form.multiCurrencyEnabled ? 'Enabled' : 'Disabled'} />
                <SummaryRow label="Owner / Admin" value={admin.name} />
              </dl>
              {submitError && <Alert type="error" size="sm">{submitError}</Alert>}
            </>
          )}

          {pinError && <Alert type="error" size="sm">{pinError}</Alert>}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <Button type="button" variant="outline" size="sm" onClick={handleBackStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            {step < 6 ? (
              <Button type="button" variant="primary" size="sm" onClick={handleNext} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Next
              </Button>
            ) : (
              <Button type="button" variant="primary" size="md" isLoading={isSubmitting} onClick={handleConfirm} rightIcon={<CheckCircle2 className="w-4 h-4" />}>
                Confirm &amp; Create Business
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
      <dt className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}
