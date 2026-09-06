import React, { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';
import { fetchReserves, fetchReserveTransfers, type ReserveRow, type ReserveTransferRow } from '../lib/directQueries';

export interface ReservesPageProps {
  onBack: () => void;
}

interface CachedShape {
  reserves: ReserveRow[];
  transfers: ReserveTransferRow[];
}

const CACHE_KEY = 'reserves';

export const ReservesPage: React.FC<ReservesPageProps> = ({ onBack }) => {
  const [reserves, setReserves] = useState<ReserveRow[]>([]);
  const [transfers, setTransfers] = useState<ReserveTransferRow[]>([]);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchReserves(), fetchReserveTransfers()])
      .then(([r, t]) => {
        setReserves(r);
        setTransfers(t);
        writeCache<CachedShape>(CACHE_KEY, { reserves: r, transfers: t });
      })
      .catch((err) => {
        const cached = readCache<CachedShape>(CACHE_KEY);
        if (cached) {
          setReserves(cached.data.reserves);
          setTransfers(cached.data.transfers);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load reserves');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const reserveColumns: Column<ReserveRow>[] = [
    { key: 'name', header: 'Reserve' },
    { key: 'category', header: 'Category' },
    { key: 'current_funded_balance', header: 'Funded', align: 'right', isMono: true, render: (r) => `$${Number(r.current_funded_balance).toLocaleString()}` },
    { key: 'target_amount', header: 'Target', align: 'right', isMono: true, render: (r) => `$${Number(r.target_amount).toLocaleString()}` },
    {
      key: 'funded_pct',
      header: 'Funded %',
      align: 'right',
      isMono: true,
      render: (r) => {
        const pct = r.target_amount > 0 ? (r.current_funded_balance / r.target_amount) * 100 : 0;
        return (
          <span className={pct >= 80 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400'}>{pct.toFixed(0)}%</span>
        );
      },
    },
    { key: 'status', header: 'Status' },
  ];

  const transferColumns: Column<ReserveTransferRow>[] = [
    { key: 'date_time', header: 'Date', isMono: true },
    { key: 'reserve_name', header: 'Reserve' },
    { key: 'type', header: 'Type' },
    { key: 'amount', header: 'Amount', align: 'right', isMono: true, render: (r) => `$${Number(r.amount).toLocaleString()}` },
  ];

  const totalFunded = reserves.reduce((s, r) => s + Number(r.current_funded_balance), 0);
  const totalTarget = reserves.reduce((s, r) => s + Number(r.target_amount), 0);

  return (
    <PageShell title="Reserves Overview & Projections" onBack={onBack}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Total Funded</div>
          <div className="text-xl font-bold font-exec-mono">${totalFunded.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-700 p-3">
          <div className="text-[10px] uppercase text-slate-500 font-mono">Total Target (Projection)</div>
          <div className="text-xl font-bold font-exec-mono">${totalTarget.toLocaleString()}</div>
        </div>
      </div>

      {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Reserve Accounts (Funded vs. Projected Target)</h3>
            <DataTable columns={reserveColumns} data={reserves} keyField="id" pageSize={10} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Recent Transfers</h3>
            <DataTable columns={transferColumns} data={transfers} keyField="id" pageSize={10} searchable searchPlaceholder="Search transfers…" />
          </div>
        </>
      )}
    </PageShell>
  );
};
