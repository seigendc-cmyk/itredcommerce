import React from 'react';

export interface CTATileProps {
  id?: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  variant?: 'primary' | 'standard' | 'highlight' | 'subtle';
  badge?: string;
  disabled?: boolean;
  className?: string;
}

export const CTATile: React.FC<CTATileProps> = ({
  id,
  title,
  description,
  icon,
  shortcut,
  onClick,
  variant = 'standard',
  badge,
  disabled = false,
  className = '',
}) => {
  const variantStyles = {
    standard: 'bg-white hover:bg-orange-50/50 border-gray-300 hover:border-orange-400 text-gray-800',
    primary: 'bg-[#FF6B00] hover:bg-orange-500 border-transparent text-white shadow-xs',
    highlight: 'bg-gray-800 hover:bg-black border-gray-900 text-white shadow-xs',
    subtle: 'bg-[#F9F8F5] hover:bg-white border-gray-300 hover:border-orange-400 text-gray-700',
  };

  const isPrimary = variant === 'primary';
  const isHighlight = variant === 'highlight';

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start p-3 text-left border rounded-none transition-colors duration-150 cursor-pointer select-none focus-pos active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation min-h-[68px] ${variantStyles[variant]} ${className}`}
    >
      <div className="w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 flex items-center justify-center border transition-colors ${
            isPrimary 
              ? 'bg-white/20 text-white border-white/30 group-hover:bg-white/30' 
              : isHighlight
              ? 'bg-white/10 text-white border-white/20 group-hover:bg-white/20'
              : 'bg-gray-100 group-hover:bg-orange-100 group-hover:text-[#FF6B00] text-gray-700 border-gray-200'
          }`}>
            {icon}
          </div>
          <div className={`font-bold text-xs uppercase tracking-wider leading-tight transition-colors ${
            isPrimary || isHighlight ? 'text-white' : 'text-gray-900 group-hover:text-[#FF6B00]'
          }`}>
            {title}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge && (
            <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${
              isPrimary
                ? 'bg-black/20 text-white border-white/30'
                : 'bg-orange-100 text-[#FF6B00] border-orange-200'
            }`}>
              {badge}
            </span>
          )}
          {shortcut && (
            <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight border ${
              isPrimary
                ? 'bg-black/20 text-white border-white/30'
                : 'bg-gray-100 text-gray-600 border-gray-200 group-hover:border-orange-300 group-hover:text-[#FF6B00]'
            }`}>
              {shortcut}
            </span>
          )}
        </div>
      </div>

      {description && (
        <p className={`mt-1.5 text-[11px] line-clamp-1 leading-snug ${
          isPrimary ? 'text-white/85' : isHighlight ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-700'
        }`}>
          {description}
        </p>
      )}
    </button>
  );
};
