import React from 'react';

export type PeriodPreset = '7d' | '30d' | '90d' | 'thisMonth' | 'lastMonth';

export interface PeriodRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
}

export function resolvePeriod(preset: PeriodPreset): PeriodRange {
  const today = new Date();
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case '7d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from: toStr(from), to: toStr(today), label: 'Last 7 days' };
    }
    case '30d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { from: toStr(from), to: toStr(today), label: 'Last 30 days' };
    }
    case '90d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 90);
      return { from: toStr(from), to: toStr(today), label: 'Last 90 days' };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toStr(from), to: toStr(today), label: 'This month' };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toStr(from), to: toStr(to), label: 'Last month' };
    }
  }
}

/** The immediately-preceding period of equal length, for period-over-period comparison. */
export function priorPeriod(range: PeriodRange): PeriodRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const spanMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const priorFrom = new Date(priorTo.getTime() - spanMs);
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toStr(priorFrom), to: toStr(priorTo), label: `Prior period (${toStr(priorFrom)} – ${toStr(priorTo)})` };
}

export interface PeriodFilterProps {
  value: PeriodPreset;
  onChange: (preset: PeriodPreset) => void;
  showComparison?: boolean;
  compareEnabled?: boolean;
  onCompareToggle?: (enabled: boolean) => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
];

export const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange, showComparison, compareEnabled, onCompareToggle }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex bg-slate-900 border border-slate-700 p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              value === p.value ? 'bg-[#FF6B00] text-white' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showComparison && (
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!compareEnabled}
            onChange={(e) => onCompareToggle?.(e.target.checked)}
            className="accent-[#FF6B00]"
          />
          Compare to prior period
        </label>
      )}
    </div>
  );
};
