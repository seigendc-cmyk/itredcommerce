import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchInventoryTurnover, fetchLastRefreshed, type InventoryTurnoverRow } from '../lib/rollups';

export interface InventoryTurnoverPageProps {
  onBack: () => void;
}

const CLASS_FILTERS = ['ALL', 'FAST', 'NORMAL', 'SLOW', 'DEAD'] as const;

export const InventoryTurnoverPage: React.FC<InventoryTurnoverPageProps> = ({ onBack }) => {
  const [rows, setRows] = useState<InventoryTurnoverRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<(typeof CLASS_FILTERS)[number]>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchInventoryTurnover(), fetchLastRefreshed('mv_inventory_turnover')])
      .then(([t, refreshed]) => {
        setRows(t);
        setAsOf(refreshed);
      })
      .catch((err) => setError(err.message || 'Failed to load inventory turnover'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => (classFilter === 'ALL' ? rows : rows.filter((r) => r.movement_class === classFilter)), [rows, classFilter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { FAST: 0, NORMAL: 0, SLOW: 0, DEAD: 0 };
    rows.forEach((r) => (c[r.movement_class] = (c[r.movement_class] || 0) + 1));
    return c;
  }, [rows]);

  const classBadgeClasses: Record<string, string> = {
    FAST: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    NORMAL: 'bg-sky-50 text-sky-800 border-sky-300',
    SLOW: 'bg-amber-50 text-amber-900 border-amber-300',
    DEAD: 'bg-rose-50 text-rose-800 border-rose-300',
  };

  const columns: Column<InventoryTurnoverRow>[] = [
    { key: 'sku', header: 'SKU', isMono: true },
    { key: 'name', header: 'Item' },
    { key: 'stock_on_hand', header: 'SOH', align: 'right', isMono: true },
    { key: 'units_sold_30d', header: 'Sold (30d)', align: 'right', isMono: true },
    { key: 'avg_daily_velocity', header: 'Avg/Day', align: 'right', isMono: true },
    { key: 'days_of_supply', header: 'Days of Supply', align: 'right', isMono: true, render: (r) => (r.days_of_supply ?? '—') },
    {
      key: 'movement_class',
      header: 'Class',
      align: 'center',
      render: (r) => (
        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${classBadgeClasses[r.movement_class]}`}>
          {r.movement_class}
        </span>
      ),
    },
  ];

  return (
    <PageShell title="Inventory Turnover" asOf={asOf} onBack={onBack}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {CLASS_FILTERS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setClassFilter(c)}
            className={`px-2.5 py-1.5 text-xs font-semibold uppercase border transition-colors ${
              classFilter === c ? 'bg-[#FF6B00] border-[#FF6B00] text-white' : 'border-slate-700 text-slate-400 hover:text-slate-100'
            }`}
          >
            {c} {c !== 'ALL' && `(${counts[c] ?? 0})`}
          </button>
        ))}
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyField="sku" pageSize={20} searchable searchPlaceholder="Search SKU or item…" />
      )}
    </PageShell>
  );
};
