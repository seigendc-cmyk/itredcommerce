import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Building2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { apiPost, ApiClientError } from '../../api/client';
import { ResolvedTenant } from './ActivationScreen';
import { validateLatLng } from '../business-profile/validation';
import { countryName } from '../../data/countries';

export interface JoinTenantConfirmProps {
  activationCode: string;
  pairingCode: string;
  resolved: ResolvedTenant;
  onJoined: () => void;
  onBack: () => void;
}

// Option (a)'s lightweight path: this install's tenant-level data already
// exists (resolved via the pairing code) — only branch/terminal-specific
// fields are asked for here.
export const JoinTenantConfirm: React.FC<JoinTenantConfirmProps> = ({ activationCode, pairingCode, resolved, onJoined, onBack }) => {
  const [branchChoice, setBranchChoice] = useState<string>(resolved.branches[0]?.id ?? '__new__');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchLat, setNewBranchLat] = useState<number | undefined>(undefined);
  const [newBranchLng, setNewBranchLng] = useState<number | undefined>(undefined);
  const [terminalName, setTerminalName] = useState('');
  const [appSurface, setAppSurface] = useState<'BRANCH_TERMINAL' | 'HEAD_OFFICE'>('BRANCH_TERMINAL');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isNewBranch = branchChoice === '__new__';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!terminalName.trim()) {
      setError('Terminal name is required.');
      return;
    }
    let branchPayload: { existingBranchId: string } | { new: { name: string; address?: string; latitude: number; longitude: number } };
    if (isNewBranch) {
      if (!newBranchName.trim()) {
        setError('New branch name is required.');
        return;
      }
      const latLngError = validateLatLng(newBranchLat, newBranchLng);
      if (latLngError) {
        setError(latLngError);
        return;
      }
      branchPayload = { new: { name: newBranchName, address: newBranchAddress || undefined, latitude: newBranchLat!, longitude: newBranchLng! } };
    } else {
      branchPayload = { existingBranchId: branchChoice };
    }

    setIsSubmitting(true);
    try {
      await apiPost('/onboarding/join-tenant', {
        pairingCode,
        branch: branchPayload,
        terminalName,
        appSurface,
        activationCode,
      });
      onJoined();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not complete setup. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="max-w-lg w-full bg-white border border-gray-300 shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          {resolved.tenant.logoDataUrl ? (
            <img src={resolved.tenant.logoDataUrl} alt="" className="w-10 h-10 object-contain border border-gray-200" />
          ) : (
            <Building2 className="w-8 h-8 text-[#FF6B00]" />
          )}
          <div>
            <div className="text-sm font-bold text-gray-900">{resolved.tenant.displayName}</div>
            <div className="text-[11px] text-gray-500">{countryName(resolved.tenant.country)} · {resolved.tenant.baseCurrency}</div>
          </div>
        </div>

        <p className="text-xs text-gray-600">Confirm which branch and what this terminal will be used for. This business's other details are already set up.</p>

        <div className="w-full flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Branch</label>
          <select
            className="w-full py-2 px-3 text-sm text-slate-900 bg-white border border-slate-300 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C]"
            value={branchChoice}
            onChange={(e) => setBranchChoice(e.target.value)}
          >
            {resolved.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
            ))}
            <option value="__new__">+ Add a new branch</option>
          </select>
        </div>

        {isNewBranch && (
          <div className="space-y-3 pl-3 border-l-2 border-orange-200">
            <Input label="New Branch Name" required value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} />
            <Input label="Branch Address" value={newBranchAddress} onChange={(e) => setNewBranchAddress(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Latitude" required type="number" step="any" value={newBranchLat ?? ''} onChange={(e) => setNewBranchLat(e.target.value === '' ? undefined : Number(e.target.value))} />
              <Input label="Longitude" required type="number" step="any" value={newBranchLng ?? ''} onChange={(e) => setNewBranchLng(e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
          </div>
        )}

        <Input label="Terminal Name" required value={terminalName} onChange={(e) => setTerminalName(e.target.value)} placeholder="e.g. Till 2 or Back Office Desk" />

        <div className="w-full flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">This Install Is A…</label>
          <div className="flex gap-2">
            {(['BRANCH_TERMINAL', 'HEAD_OFFICE'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => setAppSurface(surface)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide border ${
                  appSurface === surface ? 'bg-[#FF6B00] text-white border-[#FF6B00]' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {surface === 'BRANCH_TERMINAL' ? 'Branch Till' : 'Head Office Desk'}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert type="error" size="sm">{error}</Alert>}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <Button type="button" variant="outline" size="sm" onClick={onBack} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>Back</Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting} rightIcon={<CheckCircle2 className="w-4 h-4" />}>
            Confirm Setup
          </Button>
        </div>
      </form>
    </div>
  );
};
