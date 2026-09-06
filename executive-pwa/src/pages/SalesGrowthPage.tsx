import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageShell } from '../components/PageShell';
import { PeriodFilter, resolvePeriod, priorPeriod, type PeriodPreset } from '../components/PeriodFilter';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';
import { fetchDailySales, fetchLastRefreshed } from '../lib/rollups';

export interface SalesGrowthPageProps {
  onBack: () => void;
}

interface ChartPoint {
  day: number;
  current: number;
  prior?: number;
}

interface CachedShape {
  chartData: ChartPoint[];
  asOf: string | null;
  growthPercent: number | null;
}

export const SalesGrowthPage: React.FC<SalesGrowthPageProps> = ({ onBack }) => {
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [growthPercent, setGrowthPercent] = useState<number | null>(null);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => resolvePeriod(preset), [preset]);
  const prior = useMemo(() => priorPeriod(period), [period]);
  const cacheKey = `sales-growth:${period.from}:${period.to}:${compareEnabled}`;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setStaleAsOf(null);
    const calls: Promise<any>[] = [fetchDailySales(period.from, period.to), fetchLastRefreshed('mv_daily_sales_summary')];
    if (compareEnabled) calls.push(fetchDailySales(prior.from, prior.to));

    Promise.all(calls)
      .then(([current, refreshed, priorRows]) => {
        setAsOf(refreshed);
        const currentByDay = new Map<number, number>();
        current.forEach((r: any, i: number) => currentByDay.set(i, (currentByDay.get(i) || 0) + Number(r.net_revenue || 0)));
        const currentTotal = current.reduce((s: number, r: any) => s + Number(r.net_revenue || 0), 0);

        const points: ChartPoint[] = current.map((r: any, i: number) => ({ day: i + 1, current: Number(r.net_revenue || 0) }));

        let growth: number | null = null;
        if (priorRows) {
          const priorTotal = priorRows.reduce((s: number, r: any) => s + Number(r.net_revenue || 0), 0);
          growth = priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : null;
          priorRows.forEach((r: any, i: number) => {
            if (points[i]) points[i].prior = Number(r.net_revenue || 0);
            else points.push({ day: i + 1, current: 0, prior: Number(r.net_revenue || 0) });
          });
        }
        setGrowthPercent(growth);
        setChartData(points);
        writeCache<CachedShape>(cacheKey, { chartData: points, asOf: refreshed, growthPercent: growth });
      })
      .catch((err) => {
        const cached = readCache<CachedShape>(cacheKey);
        if (cached) {
          setChartData(cached.data.chartData);
          setAsOf(cached.data.asOf);
          setGrowthPercent(cached.data.growthPercent);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load sales growth data');
        }
      })
      .finally(() => setIsLoading(false));
  }, [period.from, period.to, compareEnabled, prior.from, prior.to]);

  return (
    <PageShell title="Sales Growth Graphs" asOf={asOf} onBack={onBack}>
      <PeriodFilter value={preset} onChange={setPreset} showComparison compareEnabled={compareEnabled} onCompareToggle={setCompareEnabled} />

      {growthPercent !== null && (
        <div className="mb-4 bg-slate-900 border border-slate-700 p-3 inline-block">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Growth vs. Prior Period</div>
          <div className={`text-xl font-bold font-exec-mono ${growthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {growthPercent >= 0 ? '+' : ''}
            {growthPercent.toFixed(1)}%
          </div>
        </div>
      )}

      {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 p-4" style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} label={{ value: 'Day of period', position: 'insideBottom', offset: -5, fill: '#64748B', fontSize: 11 }} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #334155', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="current" name={period.label} stroke="#FF6B00" strokeWidth={2} dot={false} />
              {compareEnabled && <Line type="monotone" dataKey="prior" name="Prior period" stroke="#64748B" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </PageShell>
  );
};
