import React from 'react';

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading data...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 ${className}`}>
      <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent animate-spin mb-2" />
      <span className="text-xs font-mono uppercase tracking-wider text-slate-600">{label}</span>
    </div>
  );
};
