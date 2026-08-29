import React, { useState } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  isMono?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string);
  onRowClick?: (row: T) => void;
  selectedRowKey?: string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  actionsHeader?: string;
  renderRowActions?: (row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns = [],
  data = [],
  keyField,
  onRowClick,
  selectedRowKey,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = 'Search records...',
  emptyTitle = 'No records found',
  emptyDescription = 'There are no active records matching your criteria.',
  className = '',
  actionsHeader,
  renderRowActions,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const getKey = (row: T): string => {
    if (typeof keyField === 'function') {
      return keyField(row);
    }
    return String(row[keyField]);
  };

  const safeData = Array.isArray(data) ? data : [];

  // Filter
  const filteredData = safeData.filter((row) => {
    if (!row) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((val) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(q);
    });
  });

  // Sort
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const strA = String(aVal).toLowerCase();
    const strB = String(bVal).toLowerCase();
    return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`flex flex-col border border-gray-200 bg-white rounded-none shadow-xs ${className}`}>
      {searchable && (
        <div className="p-2.5 border-b border-gray-200 bg-[#F9F8F5] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
            />
          </div>
          <div className="text-xs text-gray-600 font-mono">
            {filteredData.length} records
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key)}
                  className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-gray-100 transition-colors ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                    {col.header}
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
              ))}
              {renderRowActions && (
                <th className="py-2 px-3 font-bold uppercase tracking-wider text-[11px] text-right w-24">
                  {actionsHeader || 'Actions'}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderRowActions ? 1 : 0)} className="p-8">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const key = getKey(row);
                const isSelected = selectedRowKey === key;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'bg-orange-50/80 font-medium'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-orange-50/30'
                        : 'bg-[#F9F8F5]/60 hover:bg-orange-50/30'
                    }`}
                  >
                    {columns.map((col) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`py-2 px-3 text-gray-800 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${col.isMono ? 'font-pos-mono' : ''}`}
                        >
                          {col.render ? col.render(row, startIndex + idx) : val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                    {renderRowActions && (
                      <td className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {renderRowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-[#F9F8F5] text-xs text-gray-600">
          <div>
            Showing <span className="font-mono font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-mono font-medium">{Math.min(startIndex + pageSize, sortedData.length)}</span> of{' '}
            <span className="font-mono font-medium">{sortedData.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
