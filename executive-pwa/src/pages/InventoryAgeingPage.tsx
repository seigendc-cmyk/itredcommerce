import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchInventoryAgeing, fetchLastRefreshed, type InventoryTurnoverRow } from '../lib/rollups';

export interface InventoryAgeingPageProps {
  onBack: () => void;
}

const TOP_N_OPTIONS = [10, 20, 50, 100];
const MIN_AGE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Any age' },
  { value: 30, label: '30+ days' },
  { value: 60, label: '60+ days' },
  { value: 90, label: '90+ days' },
];

// "Top 20, filterable by number of items and period" — "period" here means
// a minimum-days-since-last-movement threshold (the natural reading for an
// ageing page), not a date range like the sales pages.
export const InventoryAgeingPage: React.FC<InventoryAgeingPageProps> = ({ onBack }) => {
  const [topN, setTopN] = useState(20);
  const [minAge, setMinAge] = useState(0);
  const [rows, setRows] = useState<InventoryTurnoverRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchInventoryAgeing(200), fetchLastRefreshed('mv_inventory_turnover')])
      .then(([t, refreshed]) => {
        setRows(t);
        setAsOf(refreshed);
      })
      .catch((err) => setError(err.message || 'Failed to load inventory ageing'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (r.days_since_last_movement ?? 0) >= minAge).slice(0, topN),
    [rows, minAge, topN]
  );

  const columns: Column<InventoryTurnoverRow>[] = [
    { key: 'sku', header: 'SKU', isMono: true },
    { key: 'name', header: 'Item' },
    { key: 'stock_on_hand', header: 'SOH', align: 'right', isMono: true },
    {
      key: 'days_since_last_movement',
      header: 'Days Since Last Movement',
      align: 'right',
      isMono: true,
      render: (r) => {
        const days = r.days_since_last_movement ?? 0;
        return <span className={days >= 90 ? 'text-rose-500 font-bold' : days >= 60 ? 'text-amber-500' : ''}>{days}</span>;
      },
    },
    { key: 'last_movement_at', header: 'Last Movement', isMono: true, render: (r) => (r.last_movement_at ? new Date(r.last_movement_at).toLocaleDateString() : 'Never') },
  ];

  return (
    <PageShell title="Inventory Ageing (Top 20)" asOf={asOf} onBack={onBack}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-mono block mb-1">Show top</label>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2 py-1.5"
          >
            {TOP_N_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} items</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-mono block mb-1">Minimum age</label>
          <select
            value={minAge}
            onChange={(e) => setMinAge(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2 py-1.5"
          >
            {MIN_AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyField="sku" pageSize={20} />
      )}
    </PageShell>
  );
};
