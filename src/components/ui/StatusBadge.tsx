import React from 'react';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const normalized = status.toLowerCase();

  let colorClasses = 'bg-gray-100 text-gray-800 border-gray-300';

  if (['completed', 'in stock', 'active', 'online', 'approved', 'paid', 'ready'].includes(normalized)) {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  } else if (['open', 'pending', 'new', 'draft'].includes(normalized)) {
    colorClasses = 'bg-orange-50 text-[#FF6B00] border-orange-200';
  } else if (['part received', 'low stock', 'held', 'warning', 'layaway', 'offline'].includes(normalized)) {
    colorClasses = 'bg-amber-50 text-amber-900 border-amber-300';
  } else if (['rejected', 'cancelled', 'out of stock', 'voided', 'error', 'locked'].includes(normalized)) {
    colorClasses = 'bg-rose-50 text-rose-800 border-rose-300';
  } else if (['sys_admin', 'store_manager', 'admin'].includes(normalized)) {
    colorClasses = 'bg-orange-100 text-[#FF6B00] border-orange-300 font-bold';
  }

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.2 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider border rounded-none select-none whitespace-nowrap ${colorClasses} ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-90" />
      {status}
    </span>
  );
};
