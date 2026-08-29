import React from 'react';
import { Search, LayoutGrid, List, Filter, Plus, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ToolbarControlsProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  addShortcut?: string;
  filterOptions?: Array<{ label: string; value: string }>;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  rightActions?: React.ReactNode;
  className?: string;
}

export const ToolbarControls: React.FC<ToolbarControlsProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Quick search...',
  viewMode,
  onViewModeChange,
  onRefresh,
  onAdd,
  addLabel = 'New Entry',
  addShortcut,
  filterOptions,
  activeFilter,
  onFilterChange,
  rightActions,
  className = '',
}) => {
  return (
    <div className={`p-2.5 bg-[#FAF8F5] border border-slate-300 flex flex-wrap items-center justify-between gap-2.5 select-none ${className}`}>
      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C]"
            />
          </div>
        )}

        {filterOptions && onFilterChange && (
          <div className="flex items-center gap-1 border border-slate-300 bg-white p-0.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            <select
              value={activeFilter || ''}
              onChange={(e) => onFilterChange(e.target.value)}
              className="text-xs bg-transparent pr-2 py-1 text-slate-700 focus:outline-none cursor-pointer font-medium"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} title="Reload Data">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}

        {viewMode && onViewModeChange && (
          <div className="flex border border-slate-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-1 text-xs cursor-pointer ${
                viewMode === 'table' ? 'bg-orange-100 text-orange-800' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={`p-1 text-xs cursor-pointer ${
                viewMode === 'cards' ? 'bg-orange-100 text-orange-800' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {rightActions}

        {onAdd && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAdd}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            shortcutBadge={addShortcut}
          >
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
