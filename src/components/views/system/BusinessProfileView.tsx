import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Copy, Check, Save, AlertCircle } from 'lucide-react';
import { StaffMember, BusinessProfile } from '../../../types';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { LoadingState } from '../../ui/LoadingState';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { apiGet, apiPut, ApiClientError } from '../../../api/client';
import {
  BusinessProfileFormState,
  emptyProfileFormState,
  FieldKey,
  LegalRegistrationFields,
  ContactBranchFields,
  BrandingFields,
  FinancialSetupFields,
  ChangeSensitiveFieldNotice,
} from '../../business-profile/ProfileFormSections';

interface BusinessProfileViewProps {
  currentStaff: StaffMember;
  onBackToLanding: () => void;
}

const SENSITIVE_FIELDS: FieldKey[] = ['tin', 'vatNumber', 'registrationNumber', 'country', 'baseCurrency'];

function profileToFormState(p: BusinessProfile): BusinessProfileFormState {
  return {
    legalName: p.legalName,
    displayName: p.displayName,
    registrationNumber: p.registrationNumber ?? '',
    tin: p.tin ?? '',
    vatRegistered: p.vatRegistered,
    vatNumber: p.vatNumber ?? '',
    country: p.country,
    businessType: (p.businessType as any) ?? '',
    registeredAddress: p.registeredAddress ?? '',
    businessPhone: p.businessPhone ?? '',
    businessEmail: p.businessEmail ?? '',
    whatsappBusinessNumber: p.whatsappBusinessNumber ?? '',
    website: p.website ?? '',
    logoDataUrl: p.logoDataUrl ?? '',
    brandColor: p.brandColor ?? '',
    baseCurrency: p.baseCurrency,
    multiCurrencyEnabled: p.multiCurrencyEnabled,
    fiscalYearStartMonth: p.fiscalYearStartMonth,
    branchName: p.primaryBranch?.name ?? '',
    branchAddress: p.primaryBranch?.address ?? '',
    branchLatitude: p.primaryBranch?.latitude,
    branchLongitude: p.primaryBranch?.longitude,
  };
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({ currentStaff, onBackToLanding }) => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<BusinessProfileFormState>(emptyProfileFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lockedFields, setLockedFields] = useState<Set<FieldKey>>(new Set(SENSITIVE_FIELDS));
  const [unlockRequest, setUnlockRequest] = useState<FieldKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiGet<BusinessProfile>('/business-profile')
      .then((p) => {
        setProfile(p);
        setForm(profileToFormState(p));
      })
      .catch(() => setLoadError('Unable to load the business profile. Confirm the backend is reachable.'))
      .finally(() => setIsLoading(false));
  }, []);

  const patchForm = (patch: Partial<BusinessProfileFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const updated = await apiPut<BusinessProfile>('/business-profile', {
        displayName: form.displayName || form.legalName,
        registrationNumber: form.registrationNumber || null,
        tin: form.tin || null,
        vatRegistered: form.vatRegistered,
        vatNumber: form.vatRegistered ? form.vatNumber : null,
        country: form.country,
        businessType: form.businessType || null,
        registeredAddress: form.registeredAddress || null,
        businessPhone: form.businessPhone || null,
        businessEmail: form.businessEmail || null,
        whatsappBusinessNumber: form.whatsappBusinessNumber || null,
        website: form.website || null,
        logoDataUrl: form.logoDataUrl || null,
        brandColor: form.brandColor || null,
        baseCurrency: form.baseCurrency,
        multiCurrencyEnabled: form.multiCurrencyEnabled,
        fiscalYearStartMonth: form.fiscalYearStartMonth,
        primaryBranch: {
          name: form.branchName,
          address: form.branchAddress || null,
          latitude: form.branchLatitude,
          longitude: form.branchLongitude,
        },
      });
      setProfile(updated);
      setForm(profileToFormState(updated));
      setLockedFields(new Set(SENSITIVE_FIELDS));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading business profile…" />;
  }

  if (loadError || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert type="error" title="Could Not Load Business Profile">{loadError}</Alert>
        <Button variant="outline" size="sm" className="mt-4" onClick={onBackToLanding} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>Back</Button>
      </div>
    );
  }

  const sectionProps = { value: form, onChange: patchForm, lockedFields, onRequestUnlock: (field: FieldKey) => setUnlockRequest(field) };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-4">
      <div className="bg-slate-900 text-white p-3.5 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBackToLanding} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700">
            Landing
          </Button>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-400" />
              Business Profile
            </h1>
            <p className="text-[10px] font-mono text-slate-400">Legal, contact, branding &amp; financial configuration for this tenant</p>
          </div>
        </div>
        <Button variant="primary" size="sm" isLoading={isSaving} onClick={handleSave} leftIcon={<Save className="w-3.5 h-3.5" />}>
          Save Changes
        </Button>
      </div>

      {saveSuccess && <Alert type="success" size="sm">Business profile updated.</Alert>}
      {saveError && <Alert type="error" size="sm" icon={<AlertCircle className="w-4 h-4" />}>{saveError}</Alert>}

      <div className="bg-white border border-orange-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tenant Pairing Code</div>
          <div className="text-xs text-slate-600">Give this to whoever sets up your next branch till or head-office desk.</div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 font-mono text-sm tracking-widest">
          {profile.pairingCode}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(profile.pairingCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-slate-300 hover:text-white"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Legal &amp; Registration</h2>
          <LegalRegistrationFields {...sectionProps} />
        </div>

        <div className="bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Contact &amp; Primary Branch</h2>
          <ContactBranchFields {...sectionProps} />
        </div>

        <div className="bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Branding</h2>
          <BrandingFields {...sectionProps} />
        </div>

        <div className="bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Financial Setup</h2>
          <FinancialSetupFields {...sectionProps} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={unlockRequest !== null}
        onClose={() => setUnlockRequest(null)}
        onConfirm={() => {
          if (unlockRequest) setLockedFields((prev) => { const next = new Set(prev); next.delete(unlockRequest); return next; });
          setUnlockRequest(null);
        }}
        title="Change a Sensitive Field?"
        message="This field is tied to fiscal submissions, pricing, or compliance elsewhere in the system. Changing it doesn't alter any past record — only what's used going forward. Proceed only if you're sure this correction is needed."
        confirmText="Yes, Let Me Edit It"
      />
      {unlockRequest && (
        <div className="max-w-5xl mx-auto"><ChangeSensitiveFieldNotice /></div>
      )}
    </div>
  );
};
