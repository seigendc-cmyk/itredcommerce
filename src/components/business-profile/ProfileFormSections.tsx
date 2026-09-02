import React from 'react';
import { MapPin, Upload, Info } from 'lucide-react';
import { BusinessType } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { BUSINESS_TYPE_OPTIONS } from '../../data/businessTypes';
import { COUNTRY_OPTIONS, defaultCurrencyForCountry } from '../../data/countries';
import { validateTin, validateEmail, validatePhone, validateHexColor } from './validation';

// Shared draft shape + field-group components used by BOTH the onboarding
// wizard (steps 1-4) and the permanent Business Profile settings page —
// per this prompt's explicit "not two separate systems" instruction.
export interface BusinessProfileFormState {
  legalName: string;
  displayName: string;
  registrationNumber: string;
  tin: string;
  vatRegistered: boolean;
  vatNumber: string;
  country: string;
  businessType: BusinessType | '';
  registeredAddress: string;
  businessPhone: string;
  businessEmail: string;
  whatsappBusinessNumber: string;
  website: string;
  logoDataUrl: string;
  brandColor: string;
  baseCurrency: string;
  multiCurrencyEnabled: boolean;
  fiscalYearStartMonth: number;
  branchName: string;
  branchAddress: string;
  branchLatitude?: number;
  branchLongitude?: number;
}

export function emptyProfileFormState(): BusinessProfileFormState {
  return {
    legalName: '', displayName: '', registrationNumber: '', tin: '', vatRegistered: false, vatNumber: '',
    country: '', businessType: '', registeredAddress: '', businessPhone: '', businessEmail: '',
    whatsappBusinessNumber: '', website: '', logoDataUrl: '', brandColor: '',
    baseCurrency: '', multiCurrencyEnabled: false, fiscalYearStartMonth: 1,
    branchName: '', branchAddress: '', branchLatitude: undefined, branchLongitude: undefined,
  };
}

type Patch = Partial<BusinessProfileFormState>;
export type FieldKey = keyof BusinessProfileFormState;

interface SectionProps {
  value: BusinessProfileFormState;
  onChange: (patch: Patch) => void;
  /** Fields rendered read-only with a "Change" trigger — the settings page's confirm-to-change set. */
  lockedFields?: Set<FieldKey>;
  onRequestUnlock?: (field: FieldKey) => void;
}

function LockedField({ label, value, onRequestUnlock, field }: { label: string; value: string; onRequestUnlock?: (f: FieldKey) => void; field: FieldKey }) {
  return (
    <div className="w-full flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">{label}</label>
      <div className="relative flex items-center justify-between bg-slate-50 border border-slate-200 py-2 px-3">
        <span className="text-sm text-slate-700 font-mono">{value || '—'}</span>
        {onRequestUnlock && (
          <button
            type="button"
            onClick={() => onRequestUnlock(field)}
            className="text-[10px] font-bold uppercase tracking-wider text-orange-600 hover:text-orange-700"
          >
            Change
          </button>
        )}
      </div>
    </div>
  );
}

export const LegalRegistrationFields: React.FC<SectionProps> = ({ value, onChange, lockedFields, onRequestUnlock }) => {
  const tinError = validateTin(value.country, value.tin);
  return (
    <div className="space-y-4">
      <Input label="Legal Business Name" required value={value.legalName} onChange={(e) => onChange({ legalName: e.target.value })} placeholder="e.g. Nyamutsamba Trading (Pvt) Ltd" />
      <Input
        label="Trading / Brand Name"
        helperText="Leave blank to use the legal name"
        value={value.displayName}
        onChange={(e) => onChange({ displayName: e.target.value })}
        placeholder="e.g. Nyamutsamba Stores"
      />
      <Input label="Business Registration Number" value={value.registrationNumber} onChange={(e) => onChange({ registrationNumber: e.target.value })} />

      {lockedFields?.has('country') ? (
        <LockedField label="Country of Operation" value={COUNTRY_OPTIONS.find((c) => c.code === value.country)?.name ?? value.country} field="country" onRequestUnlock={onRequestUnlock} />
      ) : (
        <div className="w-full flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">Country of Operation</label>
          <select
            className="w-full py-2 px-3 text-sm text-slate-900 bg-white border border-slate-300 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C]"
            value={value.country}
            onChange={(e) => {
              const country = e.target.value;
              const suggestedCurrency = defaultCurrencyForCountry(country);
              onChange({ country, ...(suggestedCurrency && !value.baseCurrency ? { baseCurrency: suggestedCurrency } : {}) });
            }}
          >
            <option value="">Select a country…</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {lockedFields?.has('tin') ? (
        <LockedField label="Tax Identification Number (TIN)" value={value.tin} field="tin" onRequestUnlock={onRequestUnlock} />
      ) : (
        <Input
          label="Tax Identification Number (TIN)"
          value={value.tin}
          onChange={(e) => onChange({ tin: e.target.value })}
          error={tinError}
          helperText="This is what fiscalization submissions are tied to — get it right"
        />
      )}

      <div className="flex items-center gap-2">
        <input id="vatRegistered" type="checkbox" checked={value.vatRegistered} onChange={(e) => onChange({ vatRegistered: e.target.checked, vatNumber: e.target.checked ? value.vatNumber : '' })} className="w-4 h-4 accent-[#FF6B00]" />
        <label htmlFor="vatRegistered" className="text-xs font-semibold text-slate-700">VAT Registered</label>
      </div>
      {value.vatRegistered && (
        lockedFields?.has('vatNumber') ? (
          <LockedField label="VAT Number" value={value.vatNumber} field="vatNumber" onRequestUnlock={onRequestUnlock} />
        ) : (
          <Input label="VAT Number" required value={value.vatNumber} onChange={(e) => onChange({ vatNumber: e.target.value })} />
        )
      )}

      <div className="w-full flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">Business Type / Industry</label>
        <select
          className="w-full py-2 px-3 text-sm text-slate-900 bg-white border border-slate-300 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C]"
          value={value.businessType}
          onChange={(e) => onChange({ businessType: e.target.value as BusinessType })}
        >
          <option value="">Select…</option>
          {BUSINESS_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export const ContactBranchFields: React.FC<SectionProps> = ({ value, onChange }) => {
  const [locating, setLocating] = React.useState(false);
  const [locateError, setLocateError] = React.useState<string | null>(null);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not available on this device — enter coordinates manually.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ branchLatitude: pos.coords.latitude, branchLongitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocateError('Could not get your location — enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
      <Input label="Registered / Head Office Address" value={value.registeredAddress} onChange={(e) => onChange({ registeredAddress: e.target.value })} />

      <div className="border-t border-slate-200 pt-3 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800">Primary Branch</div>
        <Input label="Branch Name" required value={value.branchName} onChange={(e) => onChange({ branchName: e.target.value })} placeholder="e.g. Main Store" />
        <Input label="Branch Address" value={value.branchAddress} onChange={(e) => onChange({ branchAddress: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" required type="number" step="any" value={value.branchLatitude ?? ''} onChange={(e) => onChange({ branchLatitude: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <Input label="Longitude" required type="number" step="any" value={value.branchLongitude ?? ''} onChange={(e) => onChange({ branchLongitude: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
        <Button type="button" variant="outline" size="sm" isLoading={locating} leftIcon={<MapPin className="w-3.5 h-3.5" />} onClick={handleLocateMe}>
          Locate Me
        </Button>
        {locateError && <p className="text-xs text-rose-600">{locateError}</p>}
        <p className="text-[11px] text-slate-500">
          These coordinates become the pickup-location reference for delivery distance calculation.
        </p>
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-3">
        <Input label="Business Phone Number" value={value.businessPhone} onChange={(e) => onChange({ businessPhone: e.target.value })} error={validatePhone(value.businessPhone)} />
        <Input label="Business Email" type="email" value={value.businessEmail} onChange={(e) => onChange({ businessEmail: e.target.value })} error={validateEmail(value.businessEmail)} />
        <Input
          label="WhatsApp Business Number"
          value={value.whatsappBusinessNumber}
          onChange={(e) => onChange({ whatsappBusinessNumber: e.target.value })}
          error={validatePhone(value.whatsappBusinessNumber)}
          helperText="This is the number delivery notifications are sent from"
        />
        <Input label="Website (optional)" value={value.website} onChange={(e) => onChange({ website: e.target.value })} />
      </div>
    </div>
  );
};

export const BrandingFields: React.FC<SectionProps> = ({ value, onChange }) => {
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const MAX_BYTES = 300_000;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file');
      return;
    }
    if (file.size > MAX_BYTES) {
      setLogoError('Image is too large — please use a file under 300KB');
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => onChange({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="w-full flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">Logo</label>
        <div className="flex items-center gap-3">
          {value.logoDataUrl ? (
            <img src={value.logoDataUrl} alt="Business logo" className="w-16 h-16 object-contain border border-slate-200 bg-white" />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center border border-dashed border-slate-300 text-slate-400">
              <Upload className="w-5 h-5" />
            </div>
          )}
          <div className="space-y-1">
            <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="text-xs" />
            <p className="text-[11px] text-slate-500">Used on printed/digital receipts and the executive/rider apps. Max 300KB.</p>
            {logoError && <p className="text-xs text-rose-600">{logoError}</p>}
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">Primary Brand Color (optional)</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value.brandColor || '#FF6B00'}
            onChange={(e) => onChange({ brandColor: e.target.value })}
            className="w-10 h-9 border border-slate-300 cursor-pointer"
          />
          <Input value={value.brandColor} onChange={(e) => onChange({ brandColor: e.target.value })} error={validateHexColor(value.brandColor)} placeholder="#FF6B00" isMono />
        </div>
      </div>
    </div>
  );
};

export const FinancialSetupFields: React.FC<SectionProps> = ({ value, onChange, lockedFields, onRequestUnlock }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (
    <div className="space-y-4">
      {lockedFields?.has('baseCurrency') ? (
        <LockedField label="Base Currency" value={value.baseCurrency} field="baseCurrency" onRequestUnlock={onRequestUnlock} />
      ) : (
        <Input label="Base Currency" required value={value.baseCurrency} onChange={(e) => onChange({ baseCurrency: e.target.value.toUpperCase() })} placeholder="e.g. USD" helperText="ISO 4217 code — drives the fare/pricing engine and all transaction currency" isMono maxLength={3} />
      )}

      <div className="flex items-center gap-2">
        <input id="multiCurrency" type="checkbox" checked={value.multiCurrencyEnabled} onChange={(e) => onChange({ multiCurrencyEnabled: e.target.checked })} className="w-4 h-4 accent-[#FF6B00]" />
        <label htmlFor="multiCurrency" className="text-xs font-semibold text-slate-700">Multi-Currency Enabled</label>
      </div>

      <div className="w-full flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">Fiscal Year Start Month</label>
        <select
          className="w-full py-2 px-3 text-sm text-slate-900 bg-white border border-slate-300 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C]"
          value={value.fiscalYearStartMonth}
          onChange={(e) => onChange({ fiscalYearStartMonth: Number(e.target.value) })}
        >
          {months.map((m, idx) => (
            <option key={m} value={idx + 1}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export function ChangeSensitiveFieldNotice() {
  return (
    <Alert type="warning" size="sm" icon={<Info className="w-4 h-4 shrink-0" />}>
      Changing this field doesn't affect fiscal submissions or transactions already made under the old value — those stay locked to whatever was true at the time. It only affects what's used going forward.
    </Alert>
  );
}
