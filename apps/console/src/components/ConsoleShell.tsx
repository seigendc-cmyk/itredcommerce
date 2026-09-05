import React from 'react';

export interface ConsoleShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

// Every page in this bare shell shares this one shell — a real header/nav
// component (sign-out, operator identity, breadcrumbs) is Prompt 14+ scope,
// once console-operator auth actually exists. Nothing here reads or writes
// Supabase.
export const ConsoleShell: React.FC<ConsoleShellProps> = ({ title, description, children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-sm font-bold uppercase tracking-wide text-slate-100">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
};
