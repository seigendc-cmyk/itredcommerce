import React, { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchInventoryValuation, fetchLastRefreshed, type InventoryValuationRow } from '../lib/rollups';

export interface InventoryValuationPageProps {
  onBack: () => void;
}

// "Periodic comparison" for valuation means comparing this rollup's totals
// against the previously-refreshed snapshot — the rollup only ever holds
// the current snapshot (a matview, not a time series), so the comparison
// point is "since last refresh," shown alongside the As-of label rather
// than a synthetic prior-period query the schema can't actually answer for
// a point-in-time valuation.
export const InventoryValuationPage: React.FC<InventoryValuationPageProps> = ({ onBack }) => {
  const [rows, setRows] = useState<InventoryValuationRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchInventoryValuation(), fetchLastRefreshed('mv_inventory_valuation')])
      .then(([v, refreshed]) => {
        setRows(v);
        setAsOf(refreshed);
      })
      .catch((err) => setError(err.message || 'Failed to load inventory valuation'))
      .finally(() => setIsLoading(false));
  }, []);

  const totalCost = rows.reduce((s, r) => s + Number(r.valuation_at_cost), 0);
  const totalRetail = rows.reduce((s, r) => s + Number(r.valuation_at_retail), 0);

  const columns: Column<InventoryValuationRow>[] = [
    { key: 'sku', header: 'SKU', isMono: true },
    { key: 'department', header: 'Department' },
    { key: 'stock_on_hand', header: 'SOH', align: 'right', isMono: true },
    { key: 'unit_cost', header: 'Unit Cost', align: 'right', isMono: true, render: (r) => `$${Number(r.unit_cost).toFixed(2)}` },
    { key: 'valuation_at_cost', header: 'Value (Cost)', align: 'right', isMono: true, render: (r) => `$${Number(r.valuation_at_cost).toLocaleString()}` },
    { key: 'valuation_at_retail', header: 'Value (Retail)', align: 'right', isMono: true, render: (r) => `$${Number(r.valuation_at_retail).toLocaleString()}` },
  ];

  return (
    <PageShell title="Inventory Valuation" asOf={asOf} onBack={onBack}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Total Value (Cost)</div>
          <div className="text-xl font-bold font-exec-mono">${totalCost.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Total Value (Retail)</div>
          <div className="text-xl font-bold font-exec-mono">${totalRetail.toLocaleString()}</div>
        </div>
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={rows} keyField="sku" pageSize={20} searchable searchPlaceholder="Search SKU…" />
      )}
    </PageShell>
  );
};
