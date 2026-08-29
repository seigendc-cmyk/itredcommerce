import React from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records available',
  description = 'There are no entries currently in this view.',
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white border border-dashed border-slate-300 ${className}`}>
      <div className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-400 mb-3 border border-slate-200">
        {icon || <PackageOpen className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">{title}</h4>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
