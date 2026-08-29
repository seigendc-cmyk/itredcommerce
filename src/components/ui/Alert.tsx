import React from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  X,
  Flame,
  ShieldAlert
} from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'orange';
export type AlertVariant = 'subtle' | 'outline' | 'solid' | 'banner';
export type AlertSize = 'sm' | 'md' | 'lg';

export interface AlertProps {
  type?: AlertType;
  variant?: AlertVariant;
  size?: AlertSize;
  title?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  id?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  variant = 'subtle',
  size = 'md',
  title,
  children,
  icon,
  action,
  onClose,
  className = '',
  id,
}) => {
  // Color configuration
  const colorMap = {
    info: {
      subtle: 'bg-blue-50/90 border-blue-200 text-blue-950',
      outline: 'bg-white border-blue-400 text-blue-950',
      solid: 'bg-blue-900 border-blue-950 text-white',
      banner: 'bg-blue-950 border-blue-800 text-blue-100',
      borderLeft: 'border-l-4 border-l-blue-600',
      iconClass: 'text-blue-600',
      closeClass: 'text-blue-600 hover:text-blue-900 hover:bg-blue-100/80',
      defaultIcon: <Info className="w-4 h-4 shrink-0" />,
    },
    success: {
      subtle: 'bg-emerald-50/90 border-emerald-200 text-emerald-950',
      outline: 'bg-white border-emerald-400 text-emerald-950',
      solid: 'bg-emerald-800 border-emerald-900 text-white',
      banner: 'bg-emerald-950 border-emerald-800 text-emerald-100',
      borderLeft: 'border-l-4 border-l-emerald-600',
      iconClass: 'text-emerald-600',
      closeClass: 'text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100/80',
      defaultIcon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    },
    warning: {
      subtle: 'bg-amber-50/90 border-amber-200 text-amber-950',
      outline: 'bg-white border-amber-400 text-amber-950',
      solid: 'bg-amber-700 border-amber-800 text-white',
      banner: 'bg-amber-950 border-amber-800 text-amber-100',
      borderLeft: 'border-l-4 border-l-amber-500',
      iconClass: 'text-amber-600',
      closeClass: 'text-amber-700 hover:text-amber-950 hover:bg-amber-100/80',
      defaultIcon: <AlertTriangle className="w-4 h-4 shrink-0" />,
    },
    error: {
      subtle: 'bg-rose-50/90 border-rose-200 text-rose-950',
      outline: 'bg-white border-rose-400 text-rose-950',
      solid: 'bg-rose-800 border-rose-900 text-white',
      banner: 'bg-rose-950 border-rose-800 text-rose-100',
      borderLeft: 'border-l-4 border-l-rose-600',
      iconClass: 'text-rose-600',
      closeClass: 'text-rose-600 hover:text-rose-950 hover:bg-rose-100/80',
      defaultIcon: <AlertCircle className="w-4 h-4 shrink-0" />,
    },
    orange: {
      subtle: 'bg-orange-50/90 border-orange-200 text-orange-950',
      outline: 'bg-white border-[#FF6B00] text-gray-900',
      solid: 'bg-[#FF6B00] border-[#E05E00] text-white',
      banner: 'bg-[#FF6B00] border-[#D95B00] text-white',
      borderLeft: 'border-l-4 border-l-[#FF6B00]',
      iconClass: 'text-[#FF6B00]',
      closeClass: 'text-[#FF6B00] hover:text-orange-900 hover:bg-orange-100/80',
      defaultIcon: <Flame className="w-4 h-4 shrink-0" />,
    },
  };

  const selected = colorMap[type];

  // Size configuration
  const sizeClasses = {
    sm: 'p-2 text-[11px] gap-2',
    md: 'p-3 text-xs gap-2.5',
    lg: 'p-4 text-sm gap-3',
  };

  const baseVariant = selected[variant] || selected.subtle;
  const leftBar = variant === 'subtle' || variant === 'outline' ? selected.borderLeft : '';

  return (
    <div
      id={id}
      role="alert"
      className={`relative flex items-start justify-between border rounded-none shadow-2xs transition-colors ${baseVariant} ${leftBar} ${sizeClasses[size]} ${className}`}
    >
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className={`mt-0.5 shrink-0 ${variant === 'solid' || variant === 'banner' ? 'text-white' : selected.iconClass}`}>
          {icon || selected.defaultIcon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className={`font-bold tracking-wide uppercase mb-0.5 ${
              variant === 'solid' || variant === 'banner' ? 'text-white' : ''
            }`}>
              {title}
            </div>
          )}
          <div className="leading-relaxed break-words font-medium">
            {children}
          </div>
          {action && (
            <div className="mt-2 pt-1.5 flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className={`p-1 shrink-0 ml-2 border border-transparent rounded-none transition-colors cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-current ${
            variant === 'solid' || variant === 'banner'
              ? 'text-white/80 hover:text-white hover:bg-white/20'
              : selected.closeClass
          }`}
        >
          <X className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      )}
    </div>
  );
};
