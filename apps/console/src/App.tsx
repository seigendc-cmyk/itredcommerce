import React, { useState } from 'react';
import { Inbox, Receipt, Package, LogOut, ShieldCheck } from 'lucide-react';
import { ActivationRequestsPage } from './pages/ActivationRequestsPage';
import { BillingOverviewPage } from './pages/BillingOverviewPage';
import { PlanComponentsPage } from './pages/PlanComponentsPage';
import { TokenReconciliationPage } from './pages/TokenReconciliationPage';
import { SignInPage } from './pages/SignInPage';
import { ConsoleAuthProvider, useConsoleAuth } from './lib/consoleAuth';

// Manual page-key state rather than a router — mirrors the pattern already
// established by the main app (src/App.tsx) and executive-pwa/src/App.tsx
// rather than introducing a new routing dependency/convention for this
// surface alone.
type PageKey = 'ACTIVATION_REQUESTS' | 'BILLING_OVERVIEW' | 'PLAN_COMPONENTS' | 'TOKEN_RECONCILIATION';

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ACTIVATION_REQUESTS', label: 'Activation Requests', icon: Inbox },
  { key: 'BILLING_OVERVIEW', label: 'Billing Overview', icon: Receipt },
  { key: 'PLAN_COMPONENTS', label: 'Plan Components', icon: Package },
  { key: 'TOKEN_RECONCILIATION', label: 'Token Reconciliation', icon: ShieldCheck },
];

function ConsoleShellApp() {
  const [activePage, setActivePage] = useState<PageKey>('ACTIVATION_REQUESTS');
  const { operatorEmail, signOut } = useConsoleAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <nav className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <div className="font-black text-lg tracking-tighter italic">
            iTred<span className="font-light not-italic">Console</span>
          </div>
        </div>
        <div className="p-2 space-y-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  isActive ? 'bg-[#FF6B00] text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t border-slate-800">
          <p className="px-3 py-1 text-xs text-slate-500 truncate">{operatorEmail}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        {activePage === 'ACTIVATION_REQUESTS' && <ActivationRequestsPage />}
        {activePage === 'BILLING_OVERVIEW' && <BillingOverviewPage />}
        {activePage === 'PLAN_COMPONENTS' && <PlanComponentsPage />}
        {activePage === 'TOKEN_RECONCILIATION' && <TokenReconciliationPage />}
      </div>
    </div>
  );
}

// Real console-operator sign-in (DL-045) gates everything below it — a
// session that isn't a console operator never sees the dashboard, only
// SignInPage with an "unauthorized" notice.
function Gate() {
  const { status } = useConsoleAuth();

  if (status === 'loading') {
    return <div className="min-h-screen bg-slate-950" />;
  }
  if (status === 'authorized') {
    return <ConsoleShellApp />;
  }
  return <SignInPage unauthorized={status === 'unauthorized'} />;
}

export default function App() {
  return (
    <ConsoleAuthProvider>
      <Gate />
    </ConsoleAuthProvider>
  );
}
