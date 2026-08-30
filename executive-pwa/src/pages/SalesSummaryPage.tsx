import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { PeriodFilter, resolvePeriod, type PeriodPreset } from '../components/PeriodFilter';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchDailySales, fetchLastRefreshed, type DailySalesRow } from '../lib/rollups';

export interface SalesSummaryPageProps {
  onBack: () => void;
}

export const SalesSummaryPage: React.FC<SalesSummaryPageProps> = ({ onBack }) => {
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [rows, setRows] = useState<DailySalesRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => resolvePeriod(preset), [preset]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([fetchDailySales(period.from, period.to), fetchLastRefreshed('mv_daily_sales_summary')])
      .then(([sales, refreshed]) => {
        setRows(sales);
        setAsOf(refreshed);
      })
      .catch((err) => setError(err.message || 'Failed to load sales summary'))
      .finally(() => setIsLoading(false));
  }, [period.from, period.to]);

  const totals = rows.reduce(
    (acc, r) => ({
      transactions: acc.transactions + r.transaction_count,
      grossRevenue: acc.grossRevenue + Number(r.gross_revenue || 0),
      netRevenue: acc.netRevenue + Number(r.net_revenue || 0),
    }),
    { transactions: 0, grossRevenue: 0, netRevenue: 0 }
  );

  const columns: Column<DailySalesRow>[] = [
    { key: 'sale_date', header: 'Date', isMono: true },
    { key: 'branch_id', header: 'Branch', render: (r) => r.branch_id || 'All Branches' },
    { key: 'transaction_count', header: 'Transactions', align: 'right', isMono: true },
    { key: 'gross_revenue', header: 'Gross Revenue', align: 'right', isMono: true, render: (r) => `$${Number(r.gross_revenue).toFixed(2)}` },
    { key: 'net_revenue', header: 'Net Revenue', align: 'right', isMono: true, render: (r) => `$${Number(r.net_revenue).toFixed(2)}` },
    { key: 'gross_margin_percent', header: 'Margin %', align: 'right', isMono: true, render: (r) => `${Number(r.gross_margin_percent).toFixed(1)}%` },
  ];

  return (
    <PageShell title="Sales Summary by Day" asOf={asOf} onBack={onBack}>
      <PeriodFilter value={preset} onChange={setPreset} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Transactions</div>
          <div className="text-xl font-bold font-exec-mono">{totals.transactions.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Gross Revenue</div>
          <div className="text-xl font-bold font-exec-mono">${totals.grossRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Net Revenue</div>
          <div className="text-xl font-bold font-exec-mono">${totals.netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={rows} keyField={(r) => `${r.sale_date}-${r.branch_id}`} pageSize={15} />
      )}
    </PageShell>
  );
};
