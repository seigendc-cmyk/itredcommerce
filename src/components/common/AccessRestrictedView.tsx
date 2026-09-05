import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export interface AccessRestrictedViewProps {
  onBackToLanding: () => void;
  // DL-040/DL-048: 'MODULE_LOCK' reframes the message for a licensing lock
  // rather than a role restriction — telling a cashier to "contact a
  // head-office administrator" about their own role would be actively
  // wrong when the real cause is an expired TerminalActivationToken.
  reason?: 'ROLE' | 'MODULE_LOCK';
}

// Defense-in-depth fallback for App.tsx's renderActiveView — reached only if
// activeView somehow points at a view the current session can't access
// (e.g. a stale navigation param), since handleNavigate and HeaderNav's
// menu filtering already prevent this in the normal flow for both the
// role gate and the module lock. See src/utils/accessRoleGate.ts.
export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({ onBackToLanding, reason = 'ROLE' }) => {
  const isModuleLock = reason === 'MODULE_LOCK';
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-dashed border-slate-300 max-w-lg mx-auto mt-12">
      <div className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-500 mb-4 border border-rose-200">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
        {isModuleLock ? 'Sales & Purchasing Locked' : 'Module Not Available'}
      </h4>
      <p className="text-xs text-slate-500 mt-2 max-w-sm">
        {isModuleLock
          ? "This terminal's license has expired and its grace period has ended. Contact a head-office administrator to request a new activation token."
          : "This module isn't available for your current access role. Contact a head-office administrator if you believe this is incorrect."}
      </p>
      <div className="mt-5">
        <Button variant="outline" onClick={onBackToLanding}>
          Back to Landing
        </Button>
      </div>
    </div>
  );
};
