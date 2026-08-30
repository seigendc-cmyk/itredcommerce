import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { PageShell } from '../components/PageShell';

export interface PendingSignOffPageProps {
  title: string;
  onBack: () => void;
}

// Deliberately not implemented — the prompt that requested this app
// explicitly asked for a proposed methodology to be reviewed and signed
// off before this page gets built (financial/inventory health scoring and
// risk factors, market signals/seasonal demand, staffing scoring). See the
// plan's open items and ITRED_GOVERNANCE_AND_ARCHITECTURE.md's DL-013
// addendum. Shipping a placeholder here rather than a half-built page or a
// missing menu item.
export const PendingSignOffPage: React.FC<PendingSignOffPageProps> = ({ title, onBack }) => {
  return (
    <PageShell title={title} onBack={onBack}>
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-700 bg-slate-900">
        <ShieldAlert className="w-8 h-8 text-amber-500 mb-3" />
        <h3 className="text-sm font-bold text-slate-200">Awaiting methodology sign-off</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-sm">
          This page's approach was proposed for review rather than built directly, per your instruction not to ship a
          scoring/analysis model without explicit sign-off. See the plan for the proposal.
        </p>
      </div>
    </PageShell>
  );
};
