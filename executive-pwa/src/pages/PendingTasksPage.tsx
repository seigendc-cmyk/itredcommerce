import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';
import { fetchPendingTasks, type PendingTaskEntry } from '../lib/directQueries';

export interface PendingTasksPageProps {
  onBack: () => void;
}

const CACHE_KEY = 'pending-tasks';
const KIND_FILTERS = ['ALL', 'APPROVAL', 'PURCHASE_ORDER'] as const;

export const PendingTasksPage: React.FC<PendingTasksPageProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<PendingTaskEntry[]>([]);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingTasks()
      .then((data) => {
        setEntries(data);
        writeCache<PendingTaskEntry[]>(CACHE_KEY, data);
      })
      .catch((err) => {
        const cached = readCache<PendingTaskEntry[]>(CACHE_KEY);
        if (cached) {
          setEntries(cached.data);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load pending tasks');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => (kindFilter === 'ALL' ? entries : entries.filter((e) => e.kind === kindFilter)), [entries, kindFilter]);
  const totalCommitted = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  const columns: Column<PendingTaskEntry>[] = [
    { key: 'kind', header: 'Type', render: (r) => (r.kind === 'APPROVAL' ? 'Pending Approval' : 'Open Purchase Order') },
    { key: 'refNumber', header: 'Ref #', isMono: true },
    { key: 'title', header: 'Title' },
    { key: 'amount', header: 'Amount', align: 'right', isMono: true, render: (r) => (r.amount != null ? `$${Number(r.amount).toLocaleString()}` : '—') },
    { key: 'status', header: 'Status' },
    { key: 'dateTime', header: 'Date', isMono: true, render: (r) => new Date(r.dateTime).toLocaleDateString() },
  ];

  return (
    <PageShell title="Pending Tasks & Financial Commitments" onBack={onBack}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-slate-900 border border-slate-700 p-0.5">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`px-2.5 py-1.5 text-xs font-semibold uppercase ${kindFilter === k ? 'bg-[#FF6B00] text-white' : 'text-slate-400 hover:text-slate-100'}`}
            >
              {k.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="bg-slate-900 border border-slate-700 px-3 py-1.5">
          <span className="text-[10px] uppercase text-slate-500 font-mono mr-2">Total Committed</span>
          <span className="text-sm font-bold font-exec-mono">${totalCommitted.toLocaleString()}</span>
        </div>
      </div>

      {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyField={(r) => `${r.kind}-${r.refNumber}`} pageSize={20} searchable />
      )}
    </PageShell>
  );
};
