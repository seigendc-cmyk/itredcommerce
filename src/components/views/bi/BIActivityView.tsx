import React, { useState, useMemo } from 'react';
import { 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  TrendingDown, 
  Sparkles, 
  Eye, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw, 
  X, 
  ChevronRight, 
  Package, 
  Users, 
  DollarSign, 
  Layers, 
  Lock, 
  Calendar, 
  FileText,
  HelpCircle,
  BarChart3,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { 
  BIRuleAlert, 
  BIStatus, 
  BIPriority, 
  BICategory, 
  BIRuleType, 
  StaffMember, 
  ActiveView 
} from '../../../types';
import { Button } from '../../ui/Button';

export interface BIActivityViewProps {
  currentStaff: StaffMember;
  biAlerts: BIRuleAlert[];
  onUpdateAlertStatus: (alertId: string, newStatus: BIStatus, userNotes?: string, actionName?: string) => void;
  onNavigateToRecord: (view: ActiveView, params?: any) => void;
  onBackToLanding: () => void;
}

export const BIActivityView: React.FC<BIActivityViewProps> = ({
  currentStaff,
  biAlerts,
  onUpdateAlertStatus,
  onNavigateToRecord,
  onBackToLanding,
}) => {
  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ACTIVE_ALERTS' | 'ALL_HISTORY' | 'RULES_EXPLANATION'>('ACTIVE_ALERTS');

  // Selected Alert for Details Modal / Action Dialog
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<BIRuleAlert | null>(null);
  const [actionModalType, setActionModalType] = useState<'DETAILS' | 'RESOLVE' | 'APPROVE' | 'REJECT' | 'IGNORE' | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');

  // Categories definition
  const categories: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL', label: 'All Categories', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'INVENTORY', label: 'Inventory & Stock', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'PRICING', label: 'Pricing & Margins', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: 'SALES_CASHIER', label: 'Sales & Registers', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: 'DEBTORS_AR', label: 'Debtors (AR)', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'SHIFT_CASH', label: 'Shift & Till Cash', icon: <Lock className="w-3.5 h-3.5" /> },
    { key: 'PURCHASING', label: 'Purchasing & Vendor', icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { key: 'GOVERNANCE', label: 'Governance & Audits', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  ];

  // Priorities list
  const priorities: BIPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  // Statuses list
  const statuses: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Statuses' },
    { key: 'NEW', label: 'New' },
    { key: 'REVIEWED', label: 'Reviewed' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'RESOLVED', label: 'Resolved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'IGNORED', label: 'Ignored' },
  ];

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return biAlerts.filter((alert) => {
      // Tab filter
      if (activeTab === 'ACTIVE_ALERTS' && (alert.status === 'RESOLVED' || alert.status === 'IGNORED' || alert.status === 'REJECTED')) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && alert.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL' && alert.status !== selectedStatus) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'ALL' && alert.priority !== selectedPriority) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          alert.title.toLowerCase().includes(q) ||
          alert.explanation.toLowerCase().includes(q) ||
          alert.recommendation.toLowerCase().includes(q) ||
          alert.relatedRecord.name.toLowerCase().includes(q) ||
          (alert.relatedRecord.code && alert.relatedRecord.code.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [biAlerts, activeTab, selectedCategory, selectedStatus, selectedPriority, searchQuery]);

  // Statistics
  const totalAlerts = biAlerts.length;
  const activeAlertsCount = biAlerts.filter((a) => a.status === 'NEW' || a.status === 'REVIEWED').length;
  const criticalCount = biAlerts.filter((a) => a.priority === 'CRITICAL' && (a.status === 'NEW' || a.status === 'REVIEWED')).length;
  const resolvedCount = biAlerts.filter((a) => a.status === 'RESOLVED' || a.status === 'APPROVED').length;

  const handleOpenAction = (alert: BIRuleAlert, type: 'DETAILS' | 'RESOLVE' | 'APPROVE' | 'REJECT' | 'IGNORE') => {
    setSelectedAlertForAction(alert);
    setActionModalType(type);
    setActionNotes('');
  };

  const handleConfirmAction = (newStatus: BIStatus, defaultActionText: string) => {
    if (!selectedAlertForAction) return;
    onUpdateAlertStatus(
      selectedAlertForAction.id,
      newStatus,
      actionNotes.trim() ? actionNotes.trim() : `${defaultActionText} by ${currentStaff.name}`,
      defaultActionText
    );
    setActionModalType(null);
    setSelectedAlertForAction(null);
  };

  const getPriorityBadge = (priority: BIPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-100 text-red-800 border border-red-300">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-orange-100 text-orange-800 border border-orange-300">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
            LOW
          </span>
        );
    }
  };

  const getStatusBadge = (status: BIStatus) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
            NEW
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            REVIEWED
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            APPROVED
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            RESOLVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200">
            REJECTED
          </span>
        );
      case 'IGNORED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-gray-100 text-gray-500 border border-gray-200">
            IGNORED
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 select-none font-sans">
      {/* Top Breadcrumb & Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mb-1">
            <button
              type="button"
              onClick={onBackToLanding}
              className="hover:text-[#FF6B00] cursor-pointer"
            >
              Operations Center
            </button>
            <span>/</span>
            <span className="text-gray-900 font-bold">Business Intelligence</span>
            <span>/</span>
            <span className="text-[#FF6B00]">Rule-Based Operational Activity</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-[#FF6B00] text-white">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <span>Desktop Business Intelligence & Operational Activity</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Deterministic rule-based recommendations and anomaly detection evaluated locally against workstation transaction logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onBackToLanding}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* 4 Summary Metric Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono uppercase mb-1">
            <span>Action Required</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">{activeAlertsCount}</div>
          <div className="text-[11px] text-orange-600 font-medium mt-1">
            Unresolved operational recommendations
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono uppercase mb-1">
            <span>Critical Severity</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600 font-mono">{criticalCount}</div>
          <div className="text-[11px] text-red-600 font-medium mt-1">
            Direct financial or margin leakage risks
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono uppercase mb-1">
            <span>Resolved / Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{resolvedCount}</div>
          <div className="text-[11px] text-gray-500 font-medium mt-1">
            Audited & actioned by management
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono uppercase mb-1">
            <span>Desktop BI Mode</span>
            <Lock className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-sm font-bold text-gray-900 font-mono">14 Deterministic Rules</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            100% Offline Local Rule Engine
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-gray-200 shadow-sm">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 px-4 pt-3 flex items-center justify-between flex-wrap gap-2 bg-gray-50">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('ACTIVE_ALERTS')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'ACTIVE_ALERTS'
                  ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Active Recommendations ({activeAlertsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALL_HISTORY')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'ALL_HISTORY'
                  ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Complete BI Activity Log ({totalAlerts})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RULES_EXPLANATION')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'RULES_EXPLANATION'
                  ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Rule Directory & Thresholds (14)
            </button>
          </div>

          <div className="text-xs text-gray-500 font-mono py-1">
            Evaluated against local SQLite datastore
          </div>
        </div>

        {/* Filters Toolbar */}
        {activeTab !== 'RULES_EXPLANATION' && (
          <div className="p-4 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search alert recommendations, SKUs, or customer accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#FF6B00] font-sans"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Select */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs border border-gray-300 px-2.5 py-1.5 bg-white font-medium focus:outline-none focus:border-[#FF6B00]"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Select */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium">Priority:</span>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="text-xs border border-gray-300 px-2.5 py-1.5 bg-white font-medium focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="ALL">All Priorities</option>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-xs border border-gray-300 px-2.5 py-1.5 bg-white font-medium focus:outline-none focus:border-[#FF6B00]"
                >
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1 & 2: BI Activity History & Alert Table */}
        {activeTab !== 'RULES_EXPLANATION' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider font-mono">
                  <th className="p-3 w-32">Date / Time</th>
                  <th className="p-3 w-28">Category</th>
                  <th className="p-3">Recommendation & Operational Alert</th>
                  <th className="p-3 w-48">Related Record</th>
                  <th className="p-3 w-24 text-center">Priority</th>
                  <th className="p-3 w-24 text-center">Status</th>
                  <th className="p-3 w-48">User Response</th>
                  <th className="p-3 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500 font-mono">
                      No operational recommendations match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        alert.priority === 'CRITICAL' && alert.status === 'NEW'
                          ? 'bg-red-50/20'
                          : ''
                      }`}
                    >
                      {/* Date / Time */}
                      <td className="p-3 font-mono text-gray-600 text-[11px] whitespace-nowrap">
                        {alert.dateTime}
                      </td>

                      {/* Category */}
                      <td className="p-3 font-medium text-gray-800">
                        <span className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 border border-gray-200 whitespace-nowrap">
                          {alert.category.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Recommendation & Alert Title */}
                      <td className="p-3">
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                          {alert.priority === 'CRITICAL' && (
                            <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                          )}
                          <span>{alert.title}</span>
                        </div>
                        <p className="text-gray-600 text-[11px] mt-0.5 line-clamp-2">
                          {alert.explanation}
                        </p>
                        <div className="mt-1.5 p-2 bg-amber-50/70 border border-amber-200 text-amber-950 text-[11px] font-medium flex items-start gap-1.5">
                          <span className="font-bold uppercase text-[10px] bg-amber-200 px-1 py-0.2 shrink-0">
                            Action
                          </span>
                          <span>{alert.recommendation}</span>
                        </div>
                      </td>

                      {/* Related Record */}
                      <td className="p-3">
                        <div className="text-xs font-semibold text-gray-900">
                          {alert.relatedRecord.name}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5 flex items-center justify-between">
                          <span>{alert.relatedRecord.type}: {alert.relatedRecord.code || alert.relatedRecord.id}</span>
                          {alert.relatedRecord.targetView && (
                            <button
                              type="button"
                              onClick={() => onNavigateToRecord(alert.relatedRecord.targetView!, alert.relatedRecord.targetParams)}
                              className="text-[#FF6B00] hover:underline inline-flex items-center gap-0.5 font-bold cursor-pointer"
                              title="Go to record module"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        {alert.impactMetric && (
                          <div className="text-[10px] bg-slate-100 px-1.5 py-0.5 text-slate-700 font-mono mt-1 border border-slate-200 inline-block">
                            {alert.impactMetric.label}: <strong>{alert.impactMetric.value}</strong>
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {getPriorityBadge(alert.priority)}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {getStatusBadge(alert.status)}
                      </td>

                      {/* User Response */}
                      <td className="p-3 text-[11px]">
                        {alert.userResponse ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{alert.userResponse.action}</span>
                            </div>
                            {alert.userResponse.notes && (
                              <p className="text-gray-500 italic text-[10px] line-clamp-2">
                                "{alert.userResponse.notes}"
                              </p>
                            )}
                            <div className="text-[9px] text-gray-400 font-mono">
                              {alert.userResponse?.staffName} • {alert.userResponse?.timestamp ? (alert.userResponse.timestamp.includes(' ') ? alert.userResponse.timestamp.split(' ')[0] : alert.userResponse.timestamp.split('T')[0]) : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono italic">No action taken</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAction(alert, 'DETAILS')}
                            className="px-2 py-1 text-[11px]"
                          >
                            Details
                          </Button>
                          
                          {alert.status === 'NEW' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAction(alert, 'RESOLVE')}
                              className="px-2 py-1 text-[11px] bg-[#FF6B00] hover:bg-[#E05E00]"
                            >
                              Action
                            </Button>
                          )}

                          {alert.status === 'REVIEWED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenAction(alert, 'RESOLVE')}
                              className="px-2 py-1 text-[11px] border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Rules Directory & System Principles */}
        {activeTab === 'RULES_EXPLANATION' && (
          <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-900 mb-1">
                  Offline Desktop Business Intelligence Architecture
                </h4>
                <p className="leading-relaxed">
                  The offline Desktop edition uses deterministic rule evaluations against local data tables.
                  It avoids probabilistic or generative hallucinations and provides verifiable operational guidance for stock, margins, credit risk, cash controls, and procurement without requiring cloud connectivity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: '1. Low Stock Rule', category: 'Inventory', condition: 'Stock On Hand <= Configured Reorder Threshold', output: 'Generates purchase order recommendation with calculated lead-time buffer.' },
                { title: '2. Dead Stock Rule', category: 'Inventory', condition: 'Zero sales transactions recorded across >30/45/60 consecutive trading days', output: 'Calculates tied working capital and recommends clearance markdown or promotional bundling.' },
                { title: '3. Products Without Cost', category: 'Pricing', condition: 'Active catalog SKU with Unit Cost == 0.00', output: 'Alerts manager to prevent gross margin distortion on downstream sales.' },
                { title: '4. Products Without Selling Price', category: 'Pricing', condition: 'Active inventory item with Retail Price == 0.00 and Stock On Hand > 0', output: 'Prevents checkout cashier stalls by computing suggested price via department markup formula.' },
                { title: '5. Stocktake Variance Rule', category: 'Inventory', condition: 'Blind physical count delta != Book quantity in active stocktake session', output: 'Highlights positive and negative inventory shrinkages requiring manager sign-off.' },
                { title: '6. Excessive Discounts Rule', category: 'Sales / Cashier', condition: 'Terminal shift line discounts > 5.0% of gross transaction turnover', output: 'Flags potential cashier margin leakage or unrecorded trade concessions.' },
                { title: '7. Frequent Returns Rule', category: 'Sales / Cashier', condition: '>= 3 return/refund notes generated for identical SKU within 7 days', output: 'Triggers batch quarantine and alerts inventory officer to inspect supplier quality.' },
                { title: '8. Overdue Customers Rule', category: 'Debtors (AR)', condition: 'Customer invoice unpaid > payment term days (e.g. >15/30/60 days)', output: 'Recommends automated credit freeze and generates commercial demand notices.' },
                { title: '9. Slow-Paying Customers Rule', category: 'Debtors (AR)', condition: 'Customer Days Sales Outstanding (DSO) exceeds agreed credit terms by >14 days', output: 'Suggests restructuring credit limit downward or requiring upfront trade deposits.' },
                { title: '10. Excessive Held Sales Rule', category: 'Sales / Cashier', condition: 'Parked cart retained in memory > 4 hours without cashier tender settlement', output: 'Releases reserved stock back to active floor inventory to prevent walk-in stockouts.' },
                { title: '11. Shift Variances Rule', category: 'Shift & Cash', condition: 'Physical counted cash delta > $5.00 against terminal expected takings', output: 'Enforces dual-control management review of petty cash receipts and float logs.' },
                { title: '12. Cash Variances Rule', category: 'Shift & Cash', condition: 'Active POS drawer cash accumulator > $500.00 store safety ceiling', output: 'Prompts cashier to execute mid-day Skim Drop to the main branch drop safe.' },
                { title: '13. Purchase Recommendations', category: 'Purchasing', condition: 'Supplier cumulative monthly spend is within 15% of volume rebate tier', output: 'Recommends consolidating open memos into bulk PO to capture vendor rebate margin.' },
                { title: '14. Unusual Price Overrides', category: 'Governance', condition: 'Manual override delta > 20% variance from official catalog master price', output: 'Logs operator audit trail and verifies customer contract trade authorization.' },
              ].map((r, i) => (
                <div key={i} className="border border-gray-200 p-4 bg-[#FAF8F5] shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-gray-900 text-xs">{r.title}</span>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 border border-gray-200 text-gray-600">
                      {r.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-700 font-mono mb-1">
                    <strong className="text-gray-900 font-sans">Trigger:</strong> {r.condition}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <strong className="text-gray-900">Output:</strong> {r.output}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-600 font-mono">
          <div>
            Showing <strong>{filteredAlerts.length}</strong> of <strong>{biAlerts.length}</strong> operational alerts
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Local Evaluation Active • Zero Cloud Latency</span>
          </div>
        </div>
      </div>

      {/* ACTION & DETAILS MODAL */}
      {actionModalType && selectedAlertForAction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-300 w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#FF6B00] text-white">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-gray-900">
                  {actionModalType === 'DETAILS' ? 'Operational Alert & Rule Rationale' : 'Take Operational Action'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionModalType(null);
                  setSelectedAlertForAction(null);
                }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Alert Header */}
              <div className="border border-gray-200 p-3 bg-gray-50">
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono mb-1">
                  <span>{selectedAlertForAction.category.replace('_', ' ')} • {selectedAlertForAction.dateTime}</span>
                  {getPriorityBadge(selectedAlertForAction.priority)}
                </div>
                <h4 className="font-bold text-sm text-gray-900">
                  {selectedAlertForAction.title}
                </h4>
              </div>

              {/* Rationale & Explanation */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Operational Explanation</label>
                <p className="text-gray-700 bg-white p-2.5 border border-gray-200 leading-relaxed">
                  {selectedAlertForAction.explanation}
                </p>
              </div>

              {/* Recommended Action */}
              <div>
                <label className="font-bold text-amber-900 block mb-1">Recommended Response</label>
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-950 font-medium">
                  {selectedAlertForAction.recommendation}
                </div>
              </div>

              {/* Related Record info */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Related Record</span>
                  <span className="font-bold">{selectedAlertForAction.relatedRecord.name}</span>
                  <span className="text-slate-500 font-mono ml-2">({selectedAlertForAction.relatedRecord.type}: {selectedAlertForAction.relatedRecord.code || selectedAlertForAction.relatedRecord.id})</span>
                </div>
                {selectedAlertForAction.relatedRecord.targetView && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const view = selectedAlertForAction.relatedRecord.targetView!;
                      const params = selectedAlertForAction.relatedRecord.targetParams;
                      setActionModalType(null);
                      setSelectedAlertForAction(null);
                      onNavigateToRecord(view, params);
                    }}
                    rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                  >
                    Open Record
                  </Button>
                )}
              </div>

              {/* Action Notes Input if resolving/updating */}
              {actionModalType !== 'DETAILS' && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Manager Resolution Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter notes on corrective action taken, supplier communication, or inventory recount..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 focus:outline-none focus:border-[#FF6B00] bg-white font-sans text-xs"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setActionModalType(null);
                  setSelectedAlertForAction(null);
                }}
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                {actionModalType === 'DETAILS' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleConfirmAction('IGNORED', 'Ignored by user')}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Ignore Rule
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleConfirmAction('REVIEWED', 'Marked Reviewed')}
                      className="border-indigo-300 text-indigo-700 bg-indigo-50"
                    >
                      Mark Reviewed
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleConfirmAction('RESOLVED', 'Action Completed')}
                      className="bg-[#FF6B00] hover:bg-[#E05E00]"
                    >
                      Resolve Alert
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleConfirmAction('REJECTED', 'Recommendation Rejected')}
                      className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleConfirmAction('APPROVED', 'Recommendation Approved')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Approve & Reconcile
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
