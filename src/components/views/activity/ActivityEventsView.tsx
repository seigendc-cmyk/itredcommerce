import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Building2, 
  User, 
  FileText, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle,
  Coins,
  Boxes,
  Truck,
  ArrowRightLeft,
  KeyRound,
  ShieldAlert,
  WifiOff,
  Wifi,
  CloudUpload,
  Eye,
  X,
  Lock,
  Tag,
  Layers,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { 
  ActivityEvent, 
  ActivityEventType, 
  ActivityEventCategory,
  EventOutcome, 
  StaffMember,
  OperationalException
} from '../../../types';
import { Button } from '../../ui/Button';

export interface ActivityEventsViewProps {
  events?: ActivityEvent[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onViewException?: (exceptionId: string) => void;
}

export const ActivityEventsView: React.FC<ActivityEventsViewProps> = ({
  events = [],
  currentStaff,
  onBackToLanding,
  onViewException,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedExceptionFilter, setSelectedExceptionFilter] = useState<string>('ALL'); // ALL, WITH_EXCEPTION, OFFLINE_ONLY
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, YESTERDAY

  // Detail Modal / Drawer State
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const safeEvents = Array.isArray(events) ? events : [];

  // Derived distinct filter options
  const staffList = useMemo(() => {
    const map = new Map<string, string>();
    safeEvents.forEach(e => {
      if (e.staffId && e.staffName) {
        map.set(e.staffId, e.staffName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [safeEvents]);

  const branchList = useMemo(() => {
    const map = new Map<string, string>();
    safeEvents.forEach(e => {
      if (e.branchId && e.branchName) {
        map.set(e.branchId, e.branchName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [safeEvents]);

  const categories: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Event Domains' },
    { key: 'SHIFT', label: 'Shift & Registers' },
    { key: 'SALES', label: 'Sales & Invoicing' },
    { key: 'PAYMENT', label: 'Tenders & Settlements' },
    { key: 'CUSTOMER', label: 'Customers & Credit' },
    { key: 'INVENTORY', label: 'Inventory & Stocktakes' },
    { key: 'PRICING', label: 'Price Floor & Overrides' },
    { key: 'APPROVAL', label: 'Manager Sign-Offs' },
    { key: 'SECURITY', label: 'Security & Access' },
    { key: 'SYSTEM', label: 'Fiscal & Synchronization' },
  ];

  const outcomes: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All Outcomes' },
    { key: 'COMPLETED', label: 'Completed (Success)' },
    { key: 'APPROVED', label: 'Approved (Manager)' },
    { key: 'BLOCKED', label: 'Blocked (Policy)' },
    { key: 'STARTED', label: 'Started / In Progress' },
    { key: 'FAILED', label: 'Failed' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  // Helper to derive category if not explicitly set
  const getEventCategory = (evt: ActivityEvent): ActivityEventCategory => {
    if (evt.category) return evt.category;
    const type = evt.eventType;
    if (type.startsWith('SHIFT')) return 'SHIFT';
    if (type.startsWith('SALE') || type.startsWith('CREDIT_NOTE')) return 'SALES';
    if (type.startsWith('PAYMENT') || type === 'PAYMENT_RECEIVED') return 'PAYMENT';
    if (type.startsWith('CUSTOMER')) return 'CUSTOMER';
    if (type.startsWith('STOCK') || type.startsWith('STOCKTAKE')) return 'INVENTORY';
    if (type.startsWith('PRICE') || type.startsWith('PRODUCT_MISSING')) return 'PRICING';
    if (type.startsWith('APPROVAL')) return 'APPROVAL';
    if (type.startsWith('STAFF_LOGIN') || type.startsWith('ACCESS') || type.startsWith('PERMISSION')) return 'SECURITY';
    return 'SYSTEM';
  };

  const filteredEvents = useMemo(() => {
    return safeEvents.filter((evt) => {
      const cat = getEventCategory(evt);
      const desc = evt.description || '';
      const staff = evt.staffName || '';
      const ref = evt.referenceDocument || '';
      const branch = evt.branchName || '';
      const reason = evt.reasonCode || '';

      const matchesSearch =
        desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reason.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'ALL' || cat === selectedCategory;
      const matchesOutcome = selectedOutcome === 'ALL' || evt.outcome === selectedOutcome;
      const matchesStaff = selectedStaff === 'ALL' || evt.staffId === selectedStaff;
      const matchesBranch = selectedBranch === 'ALL' || evt.branchId === selectedBranch;

      let matchesException = true;
      if (selectedExceptionFilter === 'WITH_EXCEPTION') {
        matchesException = !!evt.exceptionId || evt.eventType === 'VARIANCE_CREATED' || !!evt.reasonCode?.includes('SHORTAGE') || !!evt.reasonCode?.includes('OVERAGE');
      } else if (selectedExceptionFilter === 'OFFLINE_ONLY') {
        matchesException = evt.offlineEvent === true;
      }

      let matchesDate = true;
      const evtDate = (evt.occurredAt || evt.timestamp || '').slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      if (dateFilter === 'TODAY') {
        matchesDate = evtDate === todayStr || evtDate.startsWith('2026-08-17');
      }

      return matchesSearch && matchesCategory && matchesOutcome && matchesStaff && matchesBranch && matchesException && matchesDate;
    });
  }, [
    events, 
    searchQuery, 
    selectedCategory, 
    selectedOutcome, 
    selectedStaff, 
    selectedBranch, 
    selectedExceptionFilter, 
    dateFilter
  ]);

  // Offline stats
  const offlineCount = useMemo(() => events.filter(e => e.offlineEvent).length, [events]);
  const exceptionLinkedCount = useMemo(() => events.filter(e => e.exceptionId).length, [events]);

  const getEventIcon = (category: ActivityEventCategory, outcome?: EventOutcome) => {
    if (outcome === 'BLOCKED' || outcome === 'FAILED' || outcome === 'REJECTED') {
      return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    }
    switch (category) {
      case 'SHIFT':
        return <Clock className="w-4 h-4 text-purple-600" />;
      case 'SALES':
        return <Coins className="w-4 h-4 text-emerald-600" />;
      case 'PAYMENT':
        return <Coins className="w-4 h-4 text-blue-600" />;
      case 'INVENTORY':
        return <Boxes className="w-4 h-4 text-indigo-600" />;
      case 'PRICING':
      case 'APPROVAL':
        return <ShieldCheck className="w-4 h-4 text-orange-600" />;
      case 'CUSTOMER':
        return <User className="w-4 h-4 text-cyan-600" />;
      case 'SECURITY':
        return <KeyRound className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getOutcomeBadge = (outcome: EventOutcome | undefined) => {
    switch (outcome) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-300">
            <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
            APPROVED
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
            BLOCKED
          </span>
        );
      case 'REJECTED':
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
            {outcome}
          </span>
        );
      case 'STARTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Clock className="w-2.5 h-2.5 text-amber-600" />
            IN PROGRESS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-gray-100 text-gray-700 border border-gray-300">
            {outcome || 'RECORDED'}
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
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              Management Activity History
              <span className="text-xs bg-orange-100 text-[#FF6B00] px-2 py-0.5 font-mono font-bold">
                AUDIT LEDGER
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Immutable operational event stream capturing commercial transactions, shift reconciliations, stock movements & manager decisions
            </p>
          </div>
        </div>

        {/* Audit Status & Immutability Guarantee */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono bg-stone-100 border border-stone-300 px-3 py-1.5 text-stone-800">
            <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Append-Only Immutable</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-900">
            <span>Total Events: <strong>{events.length}</strong></span>
          </div>

          {offlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono bg-amber-50 border border-amber-300 px-3 py-1.5 text-amber-900">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Offline Queued: <strong>{offlineCount}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-300 p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search activity description, staff name, reference document, reason code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 focus:bg-white focus:border-[#FF6B00] focus:outline-none"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedExceptionFilter(prev => prev === 'WITH_EXCEPTION' ? 'ALL' : 'WITH_EXCEPTION')}
              className={`px-3 py-1.5 text-xs font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedExceptionFilter === 'WITH_EXCEPTION'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Exceptions ({exceptionLinkedCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedExceptionFilter(prev => prev === 'OFFLINE_ONLY' ? 'ALL' : 'OFFLINE_ONLY')}
              className={`px-3 py-1.5 text-xs font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedExceptionFilter === 'OFFLINE_ONLY'
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              Offline Events ({offlineCount})
            </button>

            {(searchQuery || selectedCategory !== 'ALL' || selectedOutcome !== 'ALL' || selectedStaff !== 'ALL' || selectedBranch !== 'ALL' || selectedExceptionFilter !== 'ALL' || dateFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedOutcome('ALL');
                  setSelectedStaff('ALL');
                  setSelectedBranch('ALL');
                  setSelectedExceptionFilter('ALL');
                  setDateFilter('ALL');
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

        {/* Structured Multi-Criteria Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 border-t border-gray-100 text-xs font-mono">
          {/* Domain Category Filter */}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Domain</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Outcome</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              {outcomes.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Staff</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Location</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="ALL">All Branch Locations</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Date Period</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 text-gray-800 text-xs focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="TODAY">Today's Shift (2026-08-17)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Activity Table */}
      <div className="bg-white border border-gray-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1E293B] text-white font-mono text-[11px] uppercase tracking-wider border-b border-gray-700">
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Activity & Business Record</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-center">Outcome</th>
                <th className="py-3 px-4 text-center">Audit Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-mono text-xs">
                    No activity events match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const cat = getEventCategory(evt);
                  const isOffline = evt.offlineEvent;
                  const hasException = !!evt.exceptionId;

                  return (
                    <tr 
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Date / Time */}
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap align-top">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{evt.occurredAt || evt.timestamp}</span>
                        </div>
                      </td>

                      {/* Activity Description */}
                      <td className="py-3 px-4 max-w-md align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-gray-100 border border-gray-200 shrink-0">
                              {getEventIcon(cat, evt.outcome)}
                            </span>
                            <span className="font-mono text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 border border-gray-200">
                              {cat}
                            </span>
                            {evt.reasonCode && (
                              <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 border border-amber-200">
                                {evt.reasonCode}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-900 font-medium leading-normal text-xs group-hover:text-[#FF6B00] transition-colors">
                            {evt.description}
                          </p>
                          {evt.amount !== undefined && (
                            <div className="text-[11px] font-mono font-bold text-slate-700">
                              Amount Involved: <span className={evt.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                {evt.amount < 0 ? '-' : '+'}${Math.abs(evt.amount).toFixed(2)} USD
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Staff */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap align-top">
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {evt.staffName || 'System'}
                        </div>
                        {evt.roleTitle && (
                          <div className="text-[10px] text-gray-500 pl-5">
                            {evt.roleTitle}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap align-top">
                        <div className="flex items-center gap-1 text-gray-800 font-medium">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {evt.branchName || 'Main Branch'}
                        </div>
                        {evt.terminalName && (
                          <div className="text-[10px] text-gray-500 pl-4">
                            {evt.terminalName}
                          </div>
                        )}
                      </td>

                      {/* Reference Document */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap align-top">
                        {evt.referenceDocument ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 font-bold border border-gray-300">
                            <FileText className="w-3 h-3 text-gray-500" />
                            {evt.referenceDocument}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Outcome */}
                      <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                        {getOutcomeBadge(evt.outcome)}
                      </td>

                      {/* Audit Status / Exception / Offline */}
                      <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                        <div className="flex flex-col items-center gap-1">
                          {hasException ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              EXC LINKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-400">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          )}

                          {isOffline && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <WifiOff className="w-2.5 h-2.5 text-amber-600" />
                              OFFLINE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(evt);
                          }}
                          className="px-2.5 py-1 text-xs font-mono font-bold text-gray-700 bg-gray-100 hover:bg-[#FF6B00] hover:text-white border border-gray-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business-Readable Audit Detail Modal (No Raw JSON) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border-2 border-gray-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#FF6B00] text-white flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Activity Event Audit Detail
                  </h2>
                  <p className="text-[11px] text-gray-300 font-mono">
                    Immutable Record Reference: {selectedEvent.eventId || selectedEvent.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 hover:bg-gray-700 cursor-pointer text-gray-300 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Structured Business Q&A Format */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-gray-800">
              {/* Event Summary Card */}
              <div className="bg-orange-50/50 border border-orange-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white border border-orange-300 text-[#FF6B00] mt-0.5">
                    {getEventIcon(getEventCategory(selectedEvent), selectedEvent.outcome)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[#1E293B] text-white">
                        {selectedEvent.eventType}
                      </span>
                      {getOutcomeBadge(selectedEvent.outcome)}
                      {selectedEvent.offlineEvent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <WifiOff className="w-3 h-3 text-amber-600" />
                          RECORDED OFFLINE
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 leading-snug">
                      {selectedEvent.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 10 Canonical Audit Questions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Who did it? */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    Who Performed / Authorized?
                  </span>
                  <p className="text-xs font-bold text-gray-900">
                    {selectedEvent.staffName || 'System Automated Agent'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-600">
                    Staff ID: {selectedEvent.staffId || 'N/A'} {selectedEvent.roleTitle ? `• Role: ${selectedEvent.roleTitle}` : ''}
                  </p>
                </div>

                {/* 2. Where did it happen? */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-gray-400" />
                    Where Did It Occur?
                  </span>
                  <p className="text-xs font-bold text-gray-900">
                    {selectedEvent.branchName || 'Main Headquarters'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-600">
                    Terminal: {selectedEvent.terminalName || selectedEvent.terminalId || 'Main Counter'} {selectedEvent.deviceId ? `(${selectedEvent.deviceId})` : ''}
                  </p>
                </div>

                {/* 3. When did it happen? */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    When Did It Occur & Record?
                  </span>
                  <p className="text-xs font-mono font-bold text-gray-900">
                    Occurred: {selectedEvent.occurredAt || selectedEvent.timestamp}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500">
                    Recorded: {selectedEvent.recordedAt || selectedEvent.occurredAt || selectedEvent.timestamp}
                  </p>
                </div>

                {/* 4. What business record was affected? */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-gray-400" />
                    Target Business Entity
                  </span>
                  <p className="text-xs font-mono font-bold text-gray-900">
                    Ref: {selectedEvent.referenceDocument || selectedEvent.entityId || 'None'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-600">
                    Entity Type: {selectedEvent.entityType || 'COMMERCIAL_RECORD'}
                  </p>
                </div>

                {/* 5. Quantity or Amount Involved */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <Coins className="w-3 h-3 text-gray-400" />
                    Financial & Quantity Context
                  </span>
                  <p className="text-xs font-bold text-gray-900">
                    {selectedEvent.amount !== undefined 
                      ? `${selectedEvent.amount < 0 ? '-' : ''}$${Math.abs(selectedEvent.amount).toFixed(2)} ${selectedEvent.currency || 'USD'}` 
                      : 'No direct cash impact'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-600">
                    Quantity Delta: {selectedEvent.quantity !== undefined ? `${selectedEvent.quantity} units` : 'N/A'}
                  </p>
                </div>

                {/* 6. Reason Code & Policy Notes */}
                <div className="bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-gray-400" />
                    Reason Code & Human Notes
                  </span>
                  <p className="text-xs font-mono font-bold text-[#FF6B00]">
                    {selectedEvent.reasonCode || 'STANDARD_COMPLETION'}
                  </p>
                  <p className="text-[11px] text-gray-600 italic">
                    "{selectedEvent.humanNotes || 'Standard operating authorization with no deviations.'}"
                  </p>
                </div>
              </div>

              {/* Exception Linkage Box (if linked) */}
              {selectedEvent.exceptionId && (
                <div className="bg-rose-50 border-2 border-rose-300 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span className="font-bold text-rose-950 uppercase font-mono">
                        Linked Exception Case: {selectedEvent.exceptionId}
                      </span>
                    </div>
                    {onViewException && (
                      <button
                        type="button"
                        onClick={() => {
                          onViewException(selectedEvent.exceptionId!);
                          setSelectedEvent(null);
                        }}
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                      >
                        Open in Exception Ledger →
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-rose-900">
                    This event generated an auditable Operational Exception that is tracked under supervisor review. Resolving or approving the exception will not modify this historical event.
                  </p>
                </div>
              )}

              {/* Offline & Synchronization State */}
              <div className="bg-stone-50 border border-stone-200 p-3 font-mono text-[11px] text-stone-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedEvent.offlineEvent ? (
                    <WifiOff className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Wifi className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    Sync State: <strong>{selectedEvent.syncStatus || (selectedEvent.offlineEvent ? 'LOCAL_ONLY' : 'SYNCED')}</strong> • Version: <strong>v{selectedEvent.eventVersion || 1}</strong>
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  Tenant: {selectedEvent.tenantId || 'TENANT-CMYK-001'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />
                Event records cannot be edited or deleted.
              </span>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedEvent(null)}
              >
                Close Audit Detail
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
