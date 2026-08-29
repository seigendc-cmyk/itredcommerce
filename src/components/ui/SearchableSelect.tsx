import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  error,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((opt) => opt.value === value);

  const filteredOptions = safeOptions.filter(
    (opt) =>
      (opt?.label || '').toLowerCase().includes(query.toLowerCase()) ||
      (opt?.subLabel && opt.subLabel.toLowerCase().includes(query.toLowerCase())) ||
      (opt?.value || '').toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`w-full flex flex-col gap-1 relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 select-none">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between py-2 px-3 bg-white border text-left text-sm transition-all cursor-pointer select-none rounded-none ${
          error ? 'border-rose-600' : 'border-slate-300'
        } ${isOpen ? 'border-[#EA580C] ring-1 ring-[#EA580C]' : 'hover:border-slate-400'} disabled:bg-slate-100 disabled:cursor-not-allowed`}
      >
        <span className={selectedOption ? 'text-slate-900 font-medium' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 text-slate-500">
          {selectedOption && (
            <button
              type="button"
              className="p-0.5 hover:text-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-orange-600' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-300 shadow-lg z-50 rounded-none max-h-60 flex flex-col">
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
              placeholder="Type to filter..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">No matching options</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-orange-50 ${
                    opt.value === value ? 'bg-orange-50 text-orange-950 font-semibold' : 'text-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-900">{opt.label}</div>
                    {opt.subLabel && <div className="text-[11px] text-slate-500">{opt.subLabel}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {opt.badge && (
                      <span className="px-1 py-0.5 text-[9px] font-mono uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {opt.badge}
                      </span>
                    )}
                    {opt.value === value && <Check className="w-4 h-4 text-orange-600" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <span className="text-xs font-medium text-rose-600 mt-0.5">{error}</span>}
    </div>
  );
};
