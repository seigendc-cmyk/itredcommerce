import React from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import { NotWiredYet } from '../components/NotWiredYet';

// Placeholder for the tenant billing overview (DL-043) — a per-tenant view
// of billing_invoices and tenant_subscriptions across the platform. Billing
// calculation, proration, and feature add-on scope are all still open
// decisions per the governance doc's addendum — no calculation logic
// belongs here until those are resolved.
export const BillingOverviewPage: React.FC = () => {
  return (
    <ConsoleShell title="Billing Overview" description="Cross-tenant view of invoices and active plan subscriptions.">
      <NotWiredYet note="This will surface billing_invoices and tenant_subscriptions once a console-operator auth mechanism exists and the still-open billing decisions (feature add-on scope, proration) are resolved. No data is fetched by this page yet." />
    </ConsoleShell>
  );
};
