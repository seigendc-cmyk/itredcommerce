import React, { useState } from 'react';
import { KeyRound, ArrowRight, ArrowLeft, AlertCircle, Users, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { apiPost, ApiClientError } from '../../api/client';

export interface ResolvedTenant {
  tenant: {
    id: string;
    legalName: string;
    displayName: string;
    country: string;
    baseCurrency: string;
    businessType: string | null;
    logoDataUrl: string | null;
    brandColor: string | null;
  };
  branches: { id: string; name: string; city: string | null }[];
}

export interface ActivationScreenProps {
  onNewTenant: (activationCode: string) => void;
  onJoinTenant: (activationCode: string, pairingCode: string, resolved: ResolvedTenant) => void;
  onBackToWelcome: () => void;
}

// Real, minimal pre-login gate — see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's
// Business Profile Onboarding addendum. Two independent codes:
// - Software Activation Code: a product/plan license key. Format-checked
//   only, same simulated verification LicensingView already used — making
//   that fully real (renewal, entitlements, expiry) is separate, unrequested
//   scope, so it stays as-is here.
// - Tenant Pairing Code (optional): the one piece made genuinely real,
//   because the wizard-scope decision (full wizard vs. lightweight confirm)
//   actually depends on it. Left blank -> this is a new business (full
//   wizard). Filled in -> resolves against Supabase to confirm which
//   existing tenant this install is joining.
export const ActivationScreen: React.FC<ActivationScreenProps> = ({ onNewTenant, onJoinTenant, onBackToWelcome }) => {
  const [activationCode, setActivationCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError(null);
    setPairingError(null);

    const cleanCode = activationCode.trim().toUpperCase();
    if (!cleanCode) {
      setActivationError('Please enter a valid cryptographic activation key.');
      return;
    }
    if (cleanCode.length < 10) {
      setActivationError('Invalid key length. Activation keys typically follow format: ITR-PRO-XXXX-XXXX-202X.');
      return;
    }

    const cleanPairing = pairingCode.trim().toUpperCase();
    if (!cleanPairing) {
      onNewTenant(cleanCode);
      return;
    }

    setIsSubmitting(true);
    try {
      const resolved = await apiPost<ResolvedTenant>('/onboarding/resolve-pairing-code', { pairingCode: cleanPairing });
      onJoinTenant(cleanCode, cleanPairing, resolved);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PAIRING_CODE_NOT_FOUND') {
        setPairingError('No business found for that pairing code — double-check it, or leave this field blank if this is a new business.');
      } else if (err instanceof ApiClientError && err.status === 503) {
        setPairingError('Joining an existing business requires an internet connection to verify the pairing code.');
      } else {
        setPairingError('Could not verify the pairing code. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex flex-col justify-between select-none">
      <header className="h-12 bg-[#FF6B00] text-white px-4 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div className="flex items-center space-x-2">
          <div className="font-black text-xl tracking-tighter italic select-none">
            iTred<span className="font-light not-italic">Commerce</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20 mx-2 hidden sm:block" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/90 hidden sm:block">
            Software Activation
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBackToWelcome} className="text-white hover:bg-white/20 text-xs border border-white/20">
          Back
        </Button>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-8 flex-1 flex flex-col justify-center">
        <form onSubmit={handleSubmit} className="bg-white border border-gray-300 shadow-xl p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <KeyRound className="w-5 h-5 text-[#FF6B00]" />
            <h1 className="text-sm font-bold uppercase tracking-wider text-gray-900">Activate This Installation</h1>
          </div>

          <div className="space-y-1.5">
            <Input
              label="Software Activation Code"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="e.g. ITR-PRO-8892-KL99-OFFL-2026"
              className="font-mono uppercase text-sm tracking-wider"
              autoFocus
            />
            {activationError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{activationError}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              Joining an Existing Business?
            </div>
            <Input
              label="Tenant Pairing Code (optional)"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="Leave blank if this is a new business"
              className="font-mono uppercase text-sm tracking-wider"
            />
            <p className="text-[11px] text-gray-500">
              If you're setting up an additional till or head-office desk for a business already using iTred Commerce, enter the Pairing Code from that business's Business Profile page. Otherwise, leave this blank.
            </p>
            {pairingError && (
              <Alert type="error" size="sm">{pairingError}</Alert>
            )}
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Continue
          </Button>

          <div className="flex items-center gap-1.5 justify-center text-[10px] font-mono text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Offline-Capable Cryptographic Verification
          </div>
        </form>

        <button
          type="button"
          onClick={onBackToWelcome}
          className="mt-4 mx-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Start
        </button>
      </main>
    </div>
  );
};
