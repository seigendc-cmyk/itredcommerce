import React, { useEffect, useState, useCallback } from 'react';
import { MoreVertical, X, LogOut } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { enforceSessionCeiling, recordSignIn, clearSignInRecord } from './lib/session';
import { ExecutiveSignInScreen } from './components/ExecutiveSignInScreen';
import { fetchExecutiveRoster, type RosterEntry } from './lib/authApi';

import { SalesSummaryPage } from './pages/SalesSummaryPage';
import { SalesGrowthPage } from './pages/SalesGrowthPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReservesPage } from './pages/ReservesPage';
import { BankCashPage } from './pages/BankCashPage';
import { InventoryValuationPage } from './pages/InventoryValuationPage';
import { InventoryTurnoverPage } from './pages/InventoryTurnoverPage';
import { InventoryAgeingPage } from './pages/InventoryAgeingPage';
import { DecisionFlowsPage } from './pages/DecisionFlowsPage';
import { FinancialStatementsPage } from './pages/FinancialStatementsPage';
import { PendingTasksPage } from './pages/PendingTasksPage';
import { DebtorsCreditorsPage } from './pages/DebtorsCreditorsPage';
import { PendingSignOffPage } from './pages/PendingSignOffPage';

type PageKey =
  | 'MENU'
  | 'SALES_SUMMARY'
  | 'SALES_GROWTH'
  | 'EXPENSES'
  | 'RESERVES'
  | 'BANK_CASH'
  | 'INVENTORY_VALUATION'
  | 'INVENTORY_TURNOVER'
  | 'INVENTORY_AGEING'
  | 'MARKET_SIGNALS'
  | 'STAFFING_SCORE'
  | 'DECISION_FLOWS'
  | 'FINANCIAL_STATEMENTS'
  | 'PENDING_TASKS'
  | 'DEBTORS_CREDITORS'
  | 'HEALTH_SCORING';

const MENU_ITEMS: { key: PageKey; label: string; group: string }[] = [
  { key: 'SALES_SUMMARY', label: 'Sales Summary by Day', group: 'Sales' },
  { key: 'SALES_GROWTH', label: 'Sales Growth Graphs', group: 'Sales' },
  { key: 'EXPENSES', label: 'Cumulative Expenses', group: 'Financial' },
  { key: 'RESERVES', label: 'Reserves Overview & Projections', group: 'Financial' },
  { key: 'BANK_CASH', label: 'Bank & Cash Balances', group: 'Financial' },
  { key: 'FINANCIAL_STATEMENTS', label: 'P&L and Balance Sheet', group: 'Financial' },
  { key: 'DEBTORS_CREDITORS', label: 'Debtors & Creditors Ageing', group: 'Financial' },
  { key: 'INVENTORY_VALUATION', label: 'Inventory Valuation', group: 'Inventory' },
  { key: 'INVENTORY_TURNOVER', label: 'Inventory Turnover', group: 'Inventory' },
  { key: 'INVENTORY_AGEING', label: 'Inventory Ageing (Top 20)', group: 'Inventory' },
  { key: 'MARKET_SIGNALS', label: 'Market Signals & Seasonal Demand', group: 'Insights' },
  { key: 'STAFFING_SCORE', label: 'Staffing Scoring', group: 'Insights' },
  { key: 'DECISION_FLOWS', label: 'Decision Flows', group: 'Insights' },
  { key: 'PENDING_TASKS', label: 'Pending Tasks & Commitments', group: 'Insights' },
  { key: 'HEALTH_SCORING', label: 'Health Scoring & Risk Factors', group: 'Insights' },
];

export default function App() {
  const [staff, setStaff] = useState<RosterEntry | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [activePage, setActivePage] = useState<PageKey>('MENU');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const overCeiling = await enforceSessionCeiling();
      if (!overCeiling) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const meta = data.session.user.user_metadata as { staff_id?: string };
          // The session only carries staff_id — re-fetch the roster to
          // restore name/initials/role for display on a page reload rather
          // than showing a blank "Signed in as" line until next sign-in.
          const roster = await fetchExecutiveRoster().catch(() => []);
          const matched = roster.find((r) => r.id === meta.staff_id);
          setStaff(matched ?? { id: meta.staff_id ?? '', name: '', avatarInitials: '', roleTitle: '' });
        }
      }
      setIsCheckingSession(false);
    })();

    // Re-check the absolute ceiling periodically and on tab focus — a
    // technically-still-refreshable Supabase session shouldn't outlive the
    // 12h ceiling just because the tab was left open (DL-013).
    const interval = setInterval(() => void enforceSessionCeiling().then((over) => over && setStaff(null)), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void enforceSessionCeiling().then((over) => over && setStaff(null));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleAuthenticated = useCallback(
    async (result: { accessToken: string; refreshToken: string; staff: RosterEntry }) => {
      await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
      recordSignIn();
      setStaff(result.staff);
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    clearSignInRecord();
    await supabase.auth.signOut();
    setStaff(null);
    setActivePage('MENU');
  }, []);

  const goBack = useCallback(() => setActivePage('MENU'), []);

  if (isCheckingSession) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!staff) {
    return <ExecutiveSignInScreen onAuthenticated={handleAuthenticated} />;
  }

  if (activePage !== 'MENU') {
    const pageProps = { onBack: goBack };
    switch (activePage) {
      case 'SALES_SUMMARY': return <SalesSummaryPage {...pageProps} />;
      case 'SALES_GROWTH': return <SalesGrowthPage {...pageProps} />;
      case 'EXPENSES': return <ExpensesPage {...pageProps} />;
      case 'RESERVES': return <ReservesPage {...pageProps} />;
      case 'BANK_CASH': return <BankCashPage {...pageProps} />;
      case 'INVENTORY_VALUATION': return <InventoryValuationPage {...pageProps} />;
      case 'INVENTORY_TURNOVER': return <InventoryTurnoverPage {...pageProps} />;
      case 'INVENTORY_AGEING': return <InventoryAgeingPage {...pageProps} />;
      case 'DECISION_FLOWS': return <DecisionFlowsPage {...pageProps} />;
      case 'FINANCIAL_STATEMENTS': return <FinancialStatementsPage {...pageProps} />;
      case 'PENDING_TASKS': return <PendingTasksPage {...pageProps} />;
      case 'DEBTORS_CREDITORS': return <DebtorsCreditorsPage {...pageProps} />;
      case 'MARKET_SIGNALS':
        return <PendingSignOffPage {...pageProps} title="Market Signals & Seasonal Demand" />;
      case 'STAFFING_SCORE':
        return <PendingSignOffPage {...pageProps} title="Staffing Scoring" />;
      case 'HEALTH_SCORING':
        return <PendingSignOffPage {...pageProps} title="Health Scoring & Risk Factors" />;
      default:
        return null;
    }
  }

  const groups = Array.from(new Set(MENU_ITEMS.map((m) => m.group)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 bg-[#FF6B00] text-white px-4 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div className="font-black text-lg tracking-tighter italic">
          iTred<span className="font-light not-italic">Executive</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="p-2 hover:bg-black/20"
          aria-label="Open menu"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-lg">
            {staff.avatarInitials || '—'}
          </div>
          <p className="text-slate-400 text-sm">Signed in{staff.name ? ` as ${staff.name}` : ''}</p>
          <p className="text-slate-600 text-xs mt-1">Tap the menu (⋮) to open a dashboard</p>
        </div>
      </main>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsMenuOpen(false)} />
          <div className="relative w-full max-w-sm bg-slate-900 h-full border-l border-slate-800 overflow-y-auto">
            <div className="p-4 flex items-center justify-between border-b border-slate-800 sticky top-0 bg-slate-900">
              <h2 className="text-sm font-bold uppercase tracking-wide">Dashboards</h2>
              <button type="button" onClick={() => setIsMenuOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 space-y-4">
              {groups.map((group) => (
                <div key={group}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 px-1">{group}</div>
                  <div className="space-y-1">
                    {MENU_ITEMS.filter((m) => m.group === group).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActivePage(item.key);
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-950/40"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
