import React from 'react';
import { Construction } from 'lucide-react';

export interface NotWiredYetProps {
  note: string;
}

// Shared placeholder body for every bare-shell page in this prompt — no
// page in apps/console/ queries Supabase yet (schema/RLS review comes
// first, per this prompt's explicit instruction; real data-fetching and
// issuance/billing logic are Prompt 14+ scope).
export const NotWiredYet: React.FC<NotWiredYetProps> = ({ note }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-700 bg-slate-900">
      <Construction className="w-8 h-8 text-amber-500 mb-3" />
      <h3 className="text-sm font-bold text-slate-200">Not wired yet</h3>
      <p className="text-xs text-slate-500 mt-2 max-w-md">{note}</p>
    </div>
  );
};
