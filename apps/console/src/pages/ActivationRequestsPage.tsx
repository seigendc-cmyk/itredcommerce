import React from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import { NotWiredYet } from '../components/NotWiredYet';

// Placeholder for the activation_requests queue (DL-041) — console staff
// will use this to see incoming WhatsApp "Request TerminalActivationToken"
// requests and manually issue a new signed token against the specific
// tenant/terminal. Issuance/signature logic is explicitly Prompt 14+ scope.
export const ActivationRequestsPage: React.FC = () => {
  return (
    <ConsoleShell
      title="Activation Requests"
      description="Incoming TerminalActivationToken requests, queued for manual fulfillment."
    >
      <NotWiredYet note="This will list activation_requests rows (tenant, terminal if known, requested_at, fulfillment_status) once a console-operator auth mechanism and the issuance flow exist. No data is fetched by this page yet." />
    </ConsoleShell>
  );
};
