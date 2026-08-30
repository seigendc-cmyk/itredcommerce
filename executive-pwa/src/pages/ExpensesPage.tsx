import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageShell } from '../components/PageShell';
import { PeriodFilter, resolvePeriod, priorPeriod, type PeriodPreset } from '../components/PeriodFilter';
import { fetchExpenseRollup, fetchLastRefreshed, type ExpenseRollupRow } from '../lib/rollups';

export interface ExpensesPageProps {
  onBack: () => void;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onBack }) => {
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [rows, setRows] = useState<ExpenseRollupRow[]>([]);
  const [priorTotal, setPriorTotal] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => resolvePeriod(preset), [preset]);
  const prior = useMemo(() => priorPeriod(period), [period]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const calls: Promise<any>[] = [fetchExpenseRollup(period.from, period.to), fetchLastRefreshed('mv_expense_rollup')];
    if (compareEnabled) calls.push(fetchExpenseRollup(prior.from, prior.to));

    Promise.all(calls)
      .then(([current, refreshed, priorRows]) => {
        setRows(current);
        setAsOf(refreshed);
        setPriorTotal(priorRows ? priorRows.reduce((s: number, r: ExpenseRollupRow) => s + Number(r.total_amount), 0) : null);
      })
      .catch((err) => setError(err.message || 'Failed to load expenses'))
      .finally(() => setIsLoading(false));
  }, [period.from, period.to, compareEnabled, prior.from, prior.to]);

  const byType = Object.values(
    rows.reduce((acc: Record<string, { movement_type: string; total: number }>, r) => {
      acc[r.movement_type] = acc[r.movement_type] || { movement_type: r.movement_type, total: 0 };
      acc[r.movement_type].total += Number(r.total_amount);
      return acc;
    }, {})
  );
  const cumulativeTotal = byType.reduce((s, r) => s + r.total, 0);
  const delta = priorTotal !== null && priorTotal > 0 ? ((cumulativeTotal - priorTotal) / priorTotal) * 100 : null;

  return (
    <PageShell title="Cumulative Expenses" asOf={asOf} onBack={onBack}>
      <PeriodFilter value={preset} onChange={setPreset} showComparison compareEnabled={compareEnabled} onCompareToggle={setCompareEnabled} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Cumulative Expenses</div>
          <div className="text-xl font-bold font-exec-mono">${cumulativeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        {delta !== null && (
          <div className="bg-slate-900 border border-slate-700 p-3">
            <div className="text-[10px] uppercase text-slate-500 font-mono">vs. Prior Period</div>
            <div className={`text-xl font-bold font-exec-mono ${delta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mb-3">
        Approximated from cash/bank outflows (withdrawals, payouts, card settlements) — not derived from a full general
        ledger. See Chart of Accounts / P&amp;L page for the GL-linked view.
      </p>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 p-4" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="movement_type" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #334155', fontSize: 12 }} />
              <Bar dataKey="total" fill="#FF6B00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PageShell>
  );
};
