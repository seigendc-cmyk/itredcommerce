import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  ArrowLeft, 
  Tag, 
  Layers, 
  Calculator, 
  TrendingUp, 
  Boxes, 
  Coins, 
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  CheckCircle,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { MetricDefinition, MetricCategory, MetricScope, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';

export interface MetricDictionaryViewProps {
  metrics?: MetricDefinition[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
}

export const MetricDictionaryView: React.FC<MetricDictionaryViewProps> = ({
  metrics = [],
  currentStaff,
  onBackToLanding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');

  const categories = [
    { key: 'ALL', label: 'All Metric Domains' },
    { key: 'SALES_MARGIN', label: 'Sales & Gross Margin' },
    { key: 'INVENTORY_CONTROL', label: 'Inventory & Stocktake Control' },
    { key: 'CASH_ACCOUNTABILITY', label: 'Cash & Shift Accountability' },
    { key: 'OPERATIONAL_EFFICIENCY', label: 'Operational Efficiency' },
  ];

  const scopes: MetricScope[] = [
    'Vendor',
    'Warehouse',
    'Branch',
    'Terminal',
    'Staff',
    'Shift',
    'Item',
    'Department',
    'Period'
  ];

  const filteredMetrics = useMemo(() => {
    const list = Array.isArray(metrics) ? metrics : [];
    return list.filter((m) => {
      const name = m.metricName || m.name || '';
      const code = m.metricKey || m.code || '';
      const def = m.formalDefinition || m.description || '';
      const formula = m.formula || '';
      const context = m.businessContext || '';
      const rules = m.deterministicRules || '';

      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
        context.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rules.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || m.category === selectedCategory;

      let matchesScope = true;
      if (selectedScope !== 'ALL' && m.scope) {
        matchesScope = m.scope.includes(selectedScope as MetricScope);
      }

      return matchesSearch && matchesCat && matchesScope;
    });
  }, [metrics, searchQuery, selectedCategory, selectedScope]);

  const getCategoryBadge = (cat: MetricCategory) => {
    switch (cat) {
      case 'SALES_MARGIN':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono flex items-center gap-1">
            <Coins className="w-2.5 h-2.5 text-emerald-700" />
            SALES & MARGIN
          </span>
        );
      case 'INVENTORY_CONTROL':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-300 font-mono flex items-center gap-1">
            <Boxes className="w-2.5 h-2.5 text-blue-700" />
            INVENTORY CONTROL
          </span>
        );
      case 'CASH_ACCOUNTABILITY':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300 font-mono flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-amber-700" />
            CASH & SHIFT
          </span>
        );
      case 'OPERATIONAL_EFFICIENCY':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300 font-mono flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 text-purple-700" />
            EFFICIENCY
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-800 border border-gray-300 font-mono">
            {cat}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 select-none animate-in fade-in duration-150">
      {/* Top Bar */}
      <div className="bg-white border border-gray-300 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLanding}
            className="p-2 border border-gray-300 hover:bg-gray-100 cursor-pointer text-gray-700 transition-colors"
            title="Back to Landing"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 bg-[#FF6B00] text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              Central Metric Dictionary
              <span className="text-xs bg-orange-100 text-[#FF6B00] px-2 py-0.5 font-mono font-bold">
                CANONICAL STANDARDS
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Deterministic formulas, input dependencies, aggregation scopes & edge-case rules governing commercial operations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-800 bg-stone-100 px-3 py-1.5 border border-stone-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Deterministic Formulas</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-blue-950 bg-blue-50 px-3 py-1.5 border border-blue-200">
            <span>Defined Standards: <strong>{metrics.length} Metrics</strong></span>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-gray-300 p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search metric name, formal definition, formula, rule, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 focus:bg-white focus:border-[#FF6B00] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {(searchQuery || selectedCategory !== 'ALL' || selectedScope !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedScope('ALL');
                }}
                className="px-2.5 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 border border-gray-300 hover:bg-gray-100 cursor-pointer flex items-center gap-1"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Categories and Scopes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs font-mono">
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Domain Classification</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Operational Scope</label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="ALL">All Aggregation Scopes</option>
              {scopes.map((s) => (
                <option key={s} value={s}>
                  Scope: {s} Level
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredMetrics.map((metric) => {
          const name = metric.metricName || metric.name;
          const code = metric.metricKey || metric.code;
          const def = metric.formalDefinition || metric.description;
          const inputs = metric.requiredInputs || [];
          const scope = metric.scope || [];

          return (
            <div
              key={metric.id}
              className="bg-white border-2 border-gray-300 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-[#FF6B00] transition-colors group"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#FF6B00] bg-orange-50 px-2 py-0.5 border border-orange-200">
                        {code}
                      </span>
                      {metric.unit && (
                        <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 border border-gray-200">
                          Unit: {metric.unit}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#FF6B00] transition-colors">
                      {name}
                    </h3>
                  </div>
                  {getCategoryBadge(metric.category)}
                </div>

                {/* Formal Definition */}
                <div className="text-xs text-gray-800 leading-relaxed font-medium">
                  {def}
                </div>

                {/* Mathematical Formula Box */}
                <div className="p-3 bg-stone-50 border border-stone-200 font-mono text-xs text-stone-900 space-y-1.5">
                  <div className="text-[10px] uppercase text-stone-500 font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[#FF6B00]">
                      <Calculator className="w-3.5 h-3.5" />
                      Canonical Calculation Formula
                    </span>
                    {metric.refreshTrigger && (
                      <span className="text-[9px] text-gray-400 font-normal">
                        Trigger: {metric.refreshTrigger}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-stone-950 bg-white p-2 border border-stone-300 text-xs tracking-wide">
                    {metric.formula}
                  </div>
                </div>

                {/* Required Inputs */}
                {inputs.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase font-bold text-gray-500">
                      Required Input Events & Values:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {inputs.map((inp, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200"
                        >
                          • {inp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scopes */}
                {scope.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase font-bold text-gray-500">
                      Calculation Scope Levels:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {scope.map((sc, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200"
                        >
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Example Calculation */}
                {metric.exampleCalculation && (
                  <div className="text-[11px] bg-emerald-50/60 border border-emerald-200 p-2 text-emerald-950 font-mono">
                    <span className="font-bold text-emerald-800 uppercase text-[10px] block mb-0.5">
                      Worked Example:
                    </span>
                    {metric.exampleCalculation}
                  </div>
                )}

                {/* Deterministic Rules & Edge Cases */}
                {metric.deterministicRules && (
                  <div className="text-[11px] bg-amber-50/60 border border-amber-200 p-2 text-amber-950 space-y-0.5">
                    <span className="font-bold text-amber-800 uppercase text-[10px] font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Deterministic Guardrails & Edge Cases:
                    </span>
                    <p className="text-xs text-amber-900 leading-normal">
                      {metric.deterministicRules}
                    </p>
                  </div>
                )}

                {/* Operational Context */}
                {metric.businessContext && (
                  <div className="text-[11px] text-gray-600 space-y-0.5 pt-1">
                    <span className="font-bold text-gray-700">Operational Application: </span>
                    <span>{metric.businessContext}</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-[10px] font-mono text-gray-500">
                <span>Standard ID: <strong>{metric.id}</strong></span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Canonical MVP Standard
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
