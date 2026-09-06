import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { PeriodFilter, resolvePeriod, type PeriodPreset } from '../components/PeriodFilter';
import { fetchDailySales, fetchExpenseRollup } from '../lib/rollups';
import { fetchCashBankAccounts } from '../lib/directQueries';
import { supabase } from '../lib/supabaseClient';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';

export interface FinancialStatementsPageProps {
  onBack: () => void;
}

const BALANCE_SHEET_CACHE_KEY = 'financial-statements:balance-sheet';

// Approximated from existing transaction aggregates, NOT derived from a
// real double-entry general ledger (no posting engine exists in this
// system — see the Chart of Accounts page and governance doc DL-013).
export const FinancialStatementsPage: React.FC<FinancialStatementsPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<'PNL' | 'BALANCE_SHEET'>('PNL');
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [pnl, setPnl] = useState<{ revenue: number; cogs: number; expenses: number } | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<{ cash: number; inventory: number; debtors: number; creditors: number } | null>(null);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [balanceSheetStaleAsOf, setBalanceSheetStaleAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => resolvePeriod(preset), [preset]);
  const pnlCacheKey = `financial-statements:pnl:${period.from}:${period.to}`;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setStaleAsOf(null);
    Promise.all([fetchDailySales(period.from, period.to), fetchExpenseRollup(period.from, period.to)])
      .then(([sales, expenses]) => {
        const revenue = sales.reduce((s, r) => s + Number(r.net_revenue || 0), 0);
        const cogs = sales.reduce((s, r) => s + Number(r.cost_basis || 0), 0);
        const expenseTotal = expenses.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        const value = { revenue, cogs, expenses: expenseTotal };
        setPnl(value);
        writeCache(pnlCacheKey, value);
      })
      .catch((err) => {
        const cached = readCache<{ revenue: number; cogs: number; expenses: number }>(pnlCacheKey);
        if (cached) {
          setPnl(cached.data);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load P&L');
        }
      })
      .finally(() => setIsLoading(false));
  }, [period.from, period.to]);

  useEffect(() => {
    Promise.all([fetchCashBankAccounts(), supabase.from('v_inventory_valuation').select('valuation_at_cost'), supabase.from('v_debtor_aging').select('total_outstanding'), supabase.from('v_creditor_aging').select('total_outstanding')])
      .then(([accounts, inv, debtors, creditors]) => {
        const cash = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
        const inventory = (inv.data ?? []).reduce((s: number, r: any) => s + Number(r.valuation_at_cost || 0), 0);
        const debtorsTotal = (debtors.data ?? []).reduce((s: number, r: any) => s + Number(r.total_outstanding || 0), 0);
        const creditorsTotal = (creditors.data ?? []).reduce((s: number, r: any) => s + Number(r.total_outstanding || 0), 0);
        const value = { cash, inventory, debtors: debtorsTotal, creditors: creditorsTotal };
        setBalanceSheet(value);
        writeCache(BALANCE_SHEET_CACHE_KEY, value);
      })
      .catch(() => {
        const cached = readCache<{ cash: number; inventory: number; debtors: number; creditors: number }>(BALANCE_SHEET_CACHE_KEY);
        if (cached) {
          setBalanceSheet(cached.data);
          setBalanceSheetStaleAsOf(cached.cachedAt);
        }
      });
  }, []);

  const net = pnl ? pnl.revenue - pnl.cogs - pnl.expenses : 0;
  const totalAssets = balanceSheet ? balanceSheet.cash + balanceSheet.inventory + balanceSheet.debtors : 0;
  const totalLiabilities = balanceSheet ? balanceSheet.creditors : 0;
  const equity = totalAssets - totalLiabilities;

  return (
    <PageShell title="P&L and Balance Sheet" onBack={onBack}>
      <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-800 text-amber-300 text-[11px]">
        Approximated from transaction aggregates — not a substitute for a full general ledger. See Bank &amp; Cash page
        for the Chart of Accounts this will refine once GL linkage is populated.
      </div>

      <div className="flex bg-slate-900 border border-slate-700 p-0.5 mb-4 w-fit">
        <button type="button" onClick={() => setTab('PNL')} className={`px-3 py-1.5 text-xs font-semibold uppercase ${tab === 'PNL' ? 'bg-[#FF6B00] text-white' : 'text-slate-400'}`}>
          Profit &amp; Loss
        </button>
        <button type="button" onClick={() => setTab('BALANCE_SHEET')} className={`px-3 py-1.5 text-xs font-semibold uppercase ${tab === 'BALANCE_SHEET' ? 'bg-[#FF6B00] text-white' : 'text-slate-400'}`}>
          Balance Sheet
        </button>
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}

      {tab === 'PNL' && (
        <>
          <PeriodFilter value={preset} onChange={setPreset} />
          {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
          {isLoading || !pnl ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <div className="bg-slate-900 border border-slate-700 divide-y divide-slate-800">
              <Row label="Revenue" value={pnl.revenue} />
              <Row label="Cost of Goods Sold" value={-pnl.cogs} />
              <Row label="Operating Expenses" value={-pnl.expenses} />
              <Row label="Net Profit / (Loss)" value={net} bold highlight />
            </div>
          )}
        </>
      )}

      {tab === 'BALANCE_SHEET' && (
        <>
          {balanceSheetStaleAsOf && <StaleDataBanner cachedAt={balanceSheetStaleAsOf} />}
          {!balanceSheet ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-700 divide-y divide-slate-800">
                <SectionHeader>Assets</SectionHeader>
                <Row label="Cash & Bank" value={balanceSheet.cash} />
                <Row label="Inventory (at cost)" value={balanceSheet.inventory} />
                <Row label="Debtors (AR)" value={balanceSheet.debtors} />
                <Row label="Total Assets" value={totalAssets} bold />
              </div>
              <div className="bg-slate-900 border border-slate-700 divide-y divide-slate-800">
                <SectionHeader>Liabilities</SectionHeader>
                <Row label="Creditors (AP)" value={balanceSheet.creditors} />
                <Row label="Total Liabilities" value={totalLiabilities} bold />
              </div>
              <div className="bg-slate-900 border border-slate-700 divide-y divide-slate-800">
                <SectionHeader>Equity</SectionHeader>
                <Row label="Equity (computed plug)" value={equity} bold highlight />
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{children}</div>
);

const Row: React.FC<{ label: string; value: number; bold?: boolean; highlight?: boolean }> = ({ label, value, bold, highlight }) => (
  <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${highlight ? 'bg-slate-800/60' : ''}`}>
    <span className={bold ? 'font-bold text-slate-100' : 'text-slate-300'}>{label}</span>
    <span className={`font-exec-mono ${bold ? 'font-bold' : ''} ${value < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
      {value < 0 ? '-' : ''}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
    </span>
  </div>
);
