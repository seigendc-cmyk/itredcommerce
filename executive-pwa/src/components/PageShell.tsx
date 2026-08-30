import React from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

export interface PageShellProps {
  title: string;
  asOf?: string | null;
  onBack: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

function formatAsOf(iso: string | null | undefined): string {
  if (!iso) return 'no data synced yet';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Every page in this PWA is read-only and pulls from a rollup that's only
// as fresh as its last cron refresh — the prompt explicitly requires this
// label everywhere rather than implying live data (consolidated cross-
// branch figures are only as current as each branch's last sync).
export const PageShell: React.FC<PageShellProps> = ({ title, asOf, onBack, children, actions }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold uppercase tracking-wide text-slate-100 truncate">{title}</h1>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                <Clock className="w-3 h-3" />
                <span>As of {formatAsOf(asOf)}</span>
              </div>
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
};
