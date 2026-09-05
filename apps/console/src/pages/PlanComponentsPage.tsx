import React from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import { NotWiredYet } from '../components/NotWiredYet';

// Placeholder for plan_components management (DL-043) — the platform-wide
// billable-item catalog (base fee, per-branch, per-terminal, feature
// add-ons). billing_unit's exact semantics are an open decision (tenant-wide
// flat vs. per-branch/per-terminal) — this page must not assume one when it
// is eventually built.
export const PlanComponentsPage: React.FC = () => {
  return (
    <ConsoleShell title="Plan Components" description="The platform-wide billable-item catalog.">
      <NotWiredYet note="This will manage plan_components rows once a console-operator auth mechanism exists — and only once DL-043's open decision on billing_unit's exact semantics is resolved. No data is fetched by this page yet." />
    </ConsoleShell>
  );
};
