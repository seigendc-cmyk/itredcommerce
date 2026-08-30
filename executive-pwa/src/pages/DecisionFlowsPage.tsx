import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchDecisionFlows, type DecisionFlowEntry } from '../lib/directQueries';

export interface DecisionFlowsPageProps {
  onBack: () => void;
}

const KIND_FILTERS = ['ALL', 'EXCEPTION', 'APPROVAL'] as const;
const PERIOD_DAYS_OPTIONS = [7, 30, 90, 365];

// Option (a) per your answer: read-only union of operational_exceptions +
// approval_requests, no decide/resolve actions — those stay in the
// back-office apps. Generalizes ExceptionLedgerView/ApprovalsView's
// existing filter pattern (category/severity/status/search).
export const DecisionFlowsPage: React.FC<DecisionFlowsPageProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<DecisionFlowEntry[]>([]);
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>('ALL');
  const [periodDays, setPeriodDays] = useState(30);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDecisionFlows()
      .then(setEntries)
      .catch((err) => setError(err.message || 'Failed to load decision flows'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    return entries.filter((e) => {
      if (kindFilter !== 'ALL' && e.kind !== kindFilter) return false;
      if (new Date(e.dateTime) < cutoff) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${e.refNumber} ${e.title} ${e.category} ${e.branchName ?? ''} ${e.status}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, kindFilter, periodDays, search]);

  const columns: Column<DecisionFlowEntry>[] = [
    { key: 'kind', header: 'Type', render: (r) => (r.kind === 'EXCEPTION' ? '⚠ Exception' : '✓ Approval') },
    { key: 'refNumber', header: 'Ref #', isMono: true },
    { key: 'title', header: 'Title' },
    { key: 'category', header: 'Category' },
    { key: 'branchName', header: 'Location', render: (r) => r.branchName || '—' },
    { key: 'severity', header: 'Severity/Priority' },
    { key: 'status', header: 'Status' },
    { key: 'dateTime', header: 'Date', isMono: true, render: (r) => new Date(r.dateTime).toLocaleString() },
  ];

  return (
    <PageShell title="Decision Flows" onBack={onBack}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-slate-900 border border-slate-700 p-0.5">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`px-2.5 py-1.5 text-xs font-semibold uppercase ${kindFilter === k ? 'bg-[#FF6B00] text-white' : 'text-slate-400 hover:text-slate-100'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <select
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2 py-1.5"
        >
          {PERIOD_DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>Last {d} days</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Free-form search — ref, title, category, location, status…"
          className="flex-1 min-w-[220px] bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2.5 py-1.5 placeholder:text-slate-500"
        />
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyField={(r) => `${r.kind}-${r.id}`} pageSize={20} />
      )}
    </PageShell>
  );
};
