import React, { useState } from 'react';
import { Inbox, Receipt, Package } from 'lucide-react';
import { ActivationRequestsPage } from './pages/ActivationRequestsPage';
import { BillingOverviewPage } from './pages/BillingOverviewPage';
import { PlanComponentsPage } from './pages/PlanComponentsPage';

// Manual page-key state rather than a router — mirrors the pattern already
// established by the main app (src/App.tsx) and executive-pwa/src/App.tsx
// rather than introducing a new routing dependency/convention for this
// surface alone.
type PageKey = 'ACTIVATION_REQUESTS' | 'BILLING_OVERVIEW' | 'PLAN_COMPONENTS';

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ACTIVATION_REQUESTS', label: 'Activation Requests', icon: Inbox },
  { key: 'BILLING_OVERVIEW', label: 'Billing Overview', icon: Receipt },
  { key: 'PLAN_COMPONENTS', label: 'Plan Components', icon: Package },
];

// No sign-in gate here — deliberately. Console-operator authentication has
// no defined mechanism yet (see the schema migration's header comment:
// app_is_super_admin() is hardcoded false pending a dedicated addendum), so
// building a login flow here would be exactly the "business logic" this
// prompt's scope excludes. This shell is reachable directly for now.
export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('ACTIVATION_REQUESTS');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <nav className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 min-h-screen">
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <div className="font-black text-lg tracking-tighter italic">
            iTred<span className="font-light not-italic">Console</span>
          </div>
        </div>
        <div className="p-2 space-y-1">
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
      </nav>

      <div className="flex-1 min-w-0">
        {activePage === 'ACTIVATION_REQUESTS' && <ActivationRequestsPage />}
        {activePage === 'BILLING_OVERVIEW' && <BillingOverviewPage />}
        {activePage === 'PLAN_COMPONENTS' && <PlanComponentsPage />}
      </div>
    </div>
  );
}
