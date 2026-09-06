import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';
import { fetchDecisionFlows, BI_ENGINE_LABELS, type DecisionFlowEntry, type BiEngineCategory } from '../lib/directQueries';

export interface DecisionFlowsPageProps {
  onBack: () => void;
}

const CACHE_KEY = 'decision-flows';
const KIND_FILTERS = ['ALL', 'EXCEPTION', 'APPROVAL'] as const;
const ENGINE_FILTERS = ['ALL', ...(Object.keys(BI_ENGINE_LABELS) as BiEngineCategory[])] as const;
const PERIOD_DAYS_OPTIONS = [7, 30, 90, 365];

// Three sources, unioned: operational_exceptions + approval_requests (the
// original scope) plus BI Brain engine output as a third source (your
// confirmed decision) — the latter is just approval_requests rows of
// type = 'BI_RULE_REDIRECT', so no schema change was needed, only the
// `engine` field resolved in directQueries.ts. Still read-only — no
// decide/resolve actions here, those stay in the back-office apps.
export const DecisionFlowsPage: React.FC<DecisionFlowsPageProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<DecisionFlowEntry[]>([]);
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>('ALL');
  const [engineFilter, setEngineFilter] = useState<(typeof ENGINE_FILTERS)[number]>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [periodDays, setPeriodDays] = useState(30);
  const [search, setSearch] = useState('');
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDecisionFlows()
      .then((data) => {
        setEntries(data);
        writeCache<DecisionFlowEntry[]>(CACHE_KEY, data);
      })
      .catch((err) => {
        const cached = readCache<DecisionFlowEntry[]>(CACHE_KEY);
        if (cached) {
          setEntries(cached.data);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load decision flows');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const branchOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.branchName).filter((b): b is string => !!b))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    return entries.filter((e) => {
      if (kindFilter !== 'ALL' && e.kind !== kindFilter) return false;
      if (engineFilter !== 'ALL' && e.engine !== engineFilter) return false;
      if (branchFilter !== 'ALL' && e.branchName !== branchFilter) return false;
      if (new Date(e.dateTime) < cutoff) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${e.refNumber} ${e.title} ${e.category} ${e.branchName ?? ''} ${e.status}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, kindFilter, engineFilter, branchFilter, periodDays, search]);

  const columns: Column<DecisionFlowEntry>[] = [
    {
      key: 'kind',
      header: 'Type',
      render: (r) => (r.engine ? `🧠 ${BI_ENGINE_LABELS[r.engine]}` : r.kind === 'EXCEPTION' ? '⚠ Exception' : '✓ Approval'),
    },
    { key: 'refNumber', header: 'Ref #', isMono: true },
    { key: 'title', header: 'Title' },
    { key: 'category', header: 'Category' },
    { key: 'branchName', header: 'Location', render: (r) => r.branchName || '—' },
    { key: 'severity', header: 'Severity/Priority' },
    { key: 'status', header: 'Status' },
    {
      key: 'decidedBy',
      header: 'Accepted/Dismissed By',
      render: (r) => (r.decidedBy ? `${r.decidedBy}${r.decidedAt ? ` — ${new Date(r.decidedAt).toLocaleDateString()}` : ''}` : '—'),
    },
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
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value as (typeof ENGINE_FILTERS)[number])}
          className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2 py-1.5"
        >
          <option value="ALL">All engines/categories</option>
          {ENGINE_FILTERS.slice(1).map((eng) => (
            <option key={eng} value={eng}>{BI_ENGINE_LABELS[eng]}</option>
          ))}
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2 py-1.5"
        >
          <option value="ALL">All branches</option>
          {branchOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
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

      {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyField={(r) => `${r.kind}-${r.id}`} pageSize={20} />
      )}
    </PageShell>
  );
};
