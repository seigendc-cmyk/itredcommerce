import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
  isMono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  prefixElement,
  suffixElement,
  isMono = false,
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const generatedId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1">
      {label && (
        <label htmlFor={generatedId} className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">
          {label}
        </label>
      )}
      <div className={`relative flex items-center bg-white border ${error ? 'border-rose-600' : 'border-slate-300'} focus-within:border-[#EA580C] focus-within:ring-1 focus-within:ring-[#EA580C] transition-all`}>
        {prefixElement && (
          <div className="pl-3 pr-1.5 flex items-center text-slate-500 shrink-0 text-sm select-none font-medium">
            {prefixElement}
          </div>
        )}
        <input
          id={generatedId}
          ref={ref}
          disabled={disabled}
          className={`w-full py-2 px-3 text-sm text-slate-900 bg-transparent placeholder-slate-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${isMono ? 'font-pos-mono font-medium' : ''} ${className}`}
          {...props}
        />
        {suffixElement && (
          <div className="pr-3 pl-1.5 flex items-center text-slate-500 shrink-0 text-sm select-none">
            {suffixElement}
          </div>
        )}
      </div>
      {error && (
        <span className="text-xs font-medium text-rose-600 mt-0.5">{error}</span>
      )}
      {helperText && !error && (
        <span className="text-xs text-slate-500 mt-0.5">{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
