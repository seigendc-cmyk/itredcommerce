import React from 'react';
import { WifiOff } from 'lucide-react';

export const StaleDataBanner: React.FC<{ cachedAt: string }> = ({ cachedAt }) => (
  <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-800 text-amber-300 text-[11px] flex items-center gap-2">
    <WifiOff className="w-3.5 h-3.5 shrink-0" />
    <span>
      Offline — showing the last data successfully loaded, as of{' '}
      {new Date(cachedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
    </span>
  </div>
);
