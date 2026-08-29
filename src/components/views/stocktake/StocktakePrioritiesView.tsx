import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Calendar, 
  DollarSign, 
  Plus, 
  Info, 
  RefreshCw, 
  SlidersHorizontal,
  ChevronRight,
  TrendingDown,
  ArrowUpRight,
  ClipboardList,
  Flame,
  Clock,
  Building2
} from 'lucide-react';
import { 
  StocktakeRiskSignal, 
  StocktakeRiskLevel, 
  InventoryItem, 
  StaffMember, 
  StocktakeSession,
  ActivityEvent 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';

export interface StocktakePrioritiesViewProps {
  currentStaff: StaffMember;
  riskSignals: StocktakeRiskSignal[];
  onBackToLanding: () => void;
  onInitiateStocktakeForItems: (selectedSkus: string[]) => void;
  onRecordActivityEvent?: (event: ActivityEvent) => void;
}

export const StocktakePrioritiesView: React.FC<StocktakePrioritiesViewProps> = ({
  currentStaff,
  riskSignals,
  onBackToLanding,
  onInitiateStocktakeForItems,
  onRecordActivityEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedSignalForDetail, setSelectedSignalForDetail] = useState<StocktakeRiskSignal | null>(null);

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    riskSignals.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [riskSignals]);

  // Filtered Signals
  const filteredSignals = useMemo(() => {
    return riskSignals.filter((signal) => {
      const matchesSearch = 
        signal.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.locationName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRisk = riskLevelFilter === 'ALL' || signal.riskLevel === riskLevelFilter;
      const matchesDept = departmentFilter === 'ALL' || signal.department === departmentFilter;

      return matchesSearch && matchesRisk && matchesDept;
    });
  }, [riskSignals, searchTerm, riskLevelFilter, departmentFilter]);

  // Metric summaries
  const urgentCount = riskSignals.filter((s) => s.riskLevel === 'Urgent Count').length;
  const priorityCount = riskSignals.filter((s) => s.riskLevel === 'Priority Count').length;
  const reviewCount = riskSignals.filter((s) => s.riskLevel === 'Review').length;
  const routineCount = riskSignals.filter((s) => s.riskLevel === 'Routine').length;

  const totalAtRiskValuation = riskSignals
    .filter((s) => s.riskLevel === 'Urgent Count' || s.riskLevel === 'Priority Count')
    .reduce((sum, s) => sum + s.currentValuation, 0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSkus(filteredSignals.map((s) => s.sku));
    } else {
      setSelectedSkus([]);
    }
  };

  const handleToggleSelect = (sku: string) => {
    setSelectedSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  const handleInitiateBatch = () => {
    if (selectedSkus.length === 0) return;
    
    if (onRecordActivityEvent) {
      onRecordActivityEvent({
        id: `EVT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        eventType: 'STOCKTAKE_STARTED',
        description: `Initiated risk-prioritized stocktake batch for ${selectedSkus.length} items (${selectedSkus.join(', ')}).`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        branchId: 'BR-01',
        branchName: 'Main Store',
      });
    }

    onInitiateStocktakeForItems(selectedSkus);
  };

  const renderRiskBadge = (level: StocktakeRiskLevel) => {
    switch (level) {
      case 'Urgent Count':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5] flex items-center w-fit">
            <Flame className="w-3 h-3 mr-1 text-[#dc2626]" />
            Urgent Count
          </span>
        );
      case 'Priority Count':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa] flex items-center w-fit">
            <AlertTriangle className="w-3 h-3 mr-1 text-[#ea580c]" />
            Priority Count
          </span>
        );
      case 'Review':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] flex items-center w-fit">
            <Clock className="w-3 h-3 mr-1 text-[#2563eb]" />
            Review
          </span>
        );
      case 'Routine':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb] flex items-center w-fit">
            <CheckCircle2 className="w-3 h-3 mr-1 text-[#9ca3af]" />
            Routine
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] text-[#1c1d22]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e4ea] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="p-1.5 hover:bg-[#f1f3f7] rounded-md">
            <ArrowLeft className="w-4 h-4 text-[#555a68]" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1c1d22]">Risk-Based Stocktake Priorities</h1>
              <span className="bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-xs font-semibold px-2 py-0.5 rounded">
                Rule Engine v1.0
              </span>
            </div>
            <p className="text-xs text-[#6e7485] mt-0.5">
              Deterministic prioritization scoring based on variance history, manual adjustments, transfer discrepancies, and inventory value.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-2">
          {selectedSkus.length > 0 && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleInitiateBatch}
              className="bg-[#e05e00] hover:bg-[#c95400] text-white font-medium"
            >
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              Initiate Priority Stocktake ({selectedSkus.length} Selected)
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4">
        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Urgent Count Items</div>
            <div className="text-2xl font-bold text-[#dc2626] mt-0.5">{urgentCount}</div>
            <div className="text-[11px] text-[#dc2626] font-medium mt-0.5">Score ≥ 6 (High Risk)</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#fef2f2] flex items-center justify-center text-[#dc2626]">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Priority Count Items</div>
            <div className="text-2xl font-bold text-[#ea580c] mt-0.5">{priorityCount}</div>
            <div className="text-[11px] text-[#ea580c] font-medium mt-0.5">Score 4–5 (Moderate Risk)</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#fff7ed] flex items-center justify-center text-[#ea580c]">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Review & Routine</div>
            <div className="text-2xl font-bold text-[#1c1d22] mt-0.5">{reviewCount + routineCount}</div>
            <div className="text-[11px] text-[#6e7485] mt-0.5">{reviewCount} in review, {routineCount} routine</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">At-Risk Valuation</div>
            <div className="text-2xl font-bold text-[#1c1d22] mt-0.5">${totalAtRiskValuation.toFixed(2)}</div>
            <div className="text-[11px] text-[#6e7485] mt-0.5">Urgent & Priority categories</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8c92a4] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SKU, product title, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#d2d6e0] rounded-md focus:outline-hidden focus:border-[#e05e00]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={riskLevelFilter}
              onChange={(e) => setRiskLevelFilter(e.target.value)}
              className="bg-white border border-[#d2d6e0] text-xs rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-[#e05e00]"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="Urgent Count">Urgent Count (Score ≥ 6)</option>
              <option value="Priority Count">Priority Count (Score 4–5)</option>
              <option value="Review">Review (Score 2–3)</option>
              <option value="Routine">Routine (Score &lt; 2)</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white border border-[#d2d6e0] text-xs rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-[#e05e00]"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-[#6e7485]">
          Showing <span className="font-semibold text-[#1c1d22]">{filteredSignals.length}</span> of {riskSignals.length} catalog items
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8f9fa] border-b border-[#e1e4ea] sticky top-0 z-10 text-[#555a68] font-semibold">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedSkus.length === filteredSignals.length && filteredSignals.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#d2d6e0] text-[#e05e00] focus:ring-[#e05e00]"
                  />
                </th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Priority Level</th>
                <th className="p-3 text-center">Risk Score</th>
                <th className="p-3">Last Count Date</th>
                <th className="p-3 text-right">Stock On Hand</th>
                <th className="p-3 text-right">Holding Value</th>
                <th className="p-3">Operational Risk Signals</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7]">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8c92a4]">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-[#10b981] mb-2 opacity-80" />
                    <p className="font-medium text-[#1c1d22]">No High-Risk Items Matched Filter</p>
                    <p className="text-xs mt-1">Adjust search parameters to review other catalog inventory items.</p>
                  </td>
                </tr>
              ) : (
                filteredSignals.map((sig) => {
                  const isSelected = selectedSkus.includes(sig.sku);

                  return (
                    <tr 
                      key={sig.id} 
                      className={`hover:bg-[#fbfcfd] transition-colors ${isSelected ? 'bg-[#fffaf6]' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(sig.sku)}
                          className="rounded border-[#d2d6e0] text-[#e05e00] focus:ring-[#e05e00]"
                        />
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-[#1c1d22]">{sig.itemName}</div>
                        <div className="font-mono text-[11px] text-[#6e7485]">{sig.sku} • {sig.department}</div>
                      </td>

                      <td className="p-3">
                        {renderRiskBadge(sig.riskLevel)}
                      </td>

                      <td className="p-3 text-center">
                        <span className="font-mono font-bold text-sm text-[#1c1d22] bg-[#f1f3f7] px-2 py-0.5 rounded">
                          {sig.riskScore}
                        </span>
                      </td>

                      <td className="p-3 text-[#555a68]">
                        <div>{sig.lastStocktakeDate}</div>
                        <div className="text-[11px] text-[#8c92a4]">{sig.daysSinceLastCount} days ago</div>
                      </td>

                      <td className="p-3 text-right font-medium text-[#1c1d22]">
                        {sig.stockOnHand} Units
                      </td>

                      <td className="p-3 text-right font-semibold text-[#1c1d22]">
                        ${sig.currentValuation.toFixed(2)}
                      </td>

                      <td className="p-3 max-w-[320px]">
                        <ul className="list-disc list-inside text-[11px] text-[#555a68] space-y-0.5">
                          {sig.reasons.slice(0, 2).map((r, i) => (
                            <li key={i} className="truncate">{r}</li>
                          ))}
                          {sig.reasons.length > 2 && (
                            <li className="text-[#8c92a4] list-none font-medium text-[10px]">
                              +{sig.reasons.length - 2} more operational signals
                            </li>
                          )}
                        </ul>
                      </td>

                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedSignalForDetail(sig)}
                          className="px-2 py-1 text-[11px] rounded bg-[#f1f3f7] hover:bg-[#e4e7ee] text-[#3b4050] font-medium"
                          title="View Weighted Risk Breakdown"
                        >
                          <Info className="w-3 h-3 inline mr-1" />
                          Breakdown
                        </button>

                        <button
                          onClick={() => {
                            if (onRecordActivityEvent) {
                              onRecordActivityEvent({
                                id: `EVT-${Date.now()}`,
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
                                eventType: 'STOCKTAKE_STARTED',
                                description: `Initiated priority stocktake count for ${sig.sku} (Risk score ${sig.riskScore}).`,
                                staffId: currentStaff.id,
                                staffName: currentStaff.name,
                                branchId: 'BR-01',
                                branchName: 'Main Store',
                              });
                            }
                            onInitiateStocktakeForItems([sig.sku]);
                          }}
                          className="px-2 py-1 text-[11px] rounded bg-[#e05e00] hover:bg-[#c95400] text-white font-medium"
                          title="Count Item Now"
                        >
                          Count Now
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

      {/* Risk Score Breakdown Modal */}
      {selectedSignalForDetail && (
        <Modal 
          isOpen={true} 
          onClose={() => setSelectedSignalForDetail(null)} 
          title={`Stocktake Risk Breakdown: ${selectedSignalForDetail.sku}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#f8f9fa] border border-[#e1e4ea] rounded p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold text-sm text-[#1c1d22]">{selectedSignalForDetail.itemName}</div>
                <div className="font-mono text-[#6e7485] mt-0.5">SKU: {selectedSignalForDetail.sku} • Location: {selectedSignalForDetail.locationName}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#6e7485] font-medium">Risk Score</div>
                <div className="text-2xl font-bold text-[#e05e00] font-mono">{selectedSignalForDetail.riskScore}</div>
              </div>
            </div>

            <div className="border border-[#e1e4ea] rounded p-3 bg-white">
              <div className="text-[#6e7485] text-[11px] uppercase tracking-wider font-semibold mb-2">
                Operational Signals Contributing to Risk Weighting
              </div>
              <ul className="space-y-2">
                {selectedSignalForDetail.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-[#1c1d22]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#e05e00] mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#e1e4ea] rounded p-2.5 bg-[#fbfcfd]">
                <div className="text-[11px] text-[#6e7485]">Recent Manual Adjustments</div>
                <div className="font-semibold text-sm text-[#1c1d22] mt-0.5">{selectedSignalForDetail.recentAdjustmentsCount} posted</div>
              </div>
              <div className="border border-[#e1e4ea] rounded p-2.5 bg-[#fbfcfd]">
                <div className="text-[11px] text-[#6e7485]">Transfer Discrepancies</div>
                <div className="font-semibold text-sm text-[#1c1d22] mt-0.5">{selectedSignalForDetail.recentTransferDiscrepanciesCount} recorded</div>
              </div>
              <div className="border border-[#e1e4ea] rounded p-2.5 bg-[#fbfcfd]">
                <div className="text-[11px] text-[#6e7485]">Inventory Holding Value</div>
                <div className="font-semibold text-sm text-[#1c1d22] mt-0.5">${selectedSignalForDetail.currentValuation.toFixed(2)}</div>
              </div>
              <div className="border border-[#e1e4ea] rounded p-2.5 bg-[#fbfcfd]">
                <div className="text-[11px] text-[#6e7485]">Days Since Last Count</div>
                <div className="font-semibold text-sm text-[#1c1d22] mt-0.5">{selectedSignalForDetail.daysSinceLastCount} days</div>
              </div>
            </div>

            <div className="border-t border-[#e1e4ea] pt-3 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSignalForDetail(null)}>
                Close
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => {
                  if (onRecordActivityEvent) {
                    onRecordActivityEvent({
                      id: `EVT-${Date.now()}`,
                      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
                      eventType: 'STOCKTAKE_STARTED',
                      description: `Initiated priority stocktake count for ${selectedSignalForDetail.sku} (Risk score ${selectedSignalForDetail.riskScore}).`,
                      staffId: currentStaff.id,
                      staffName: currentStaff.name,
                      branchId: 'BR-01',
                      branchName: 'Main Store',
                    });
                  }
                  onInitiateStocktakeForItems([selectedSignalForDetail.sku]);
                  setSelectedSignalForDetail(null);
                }}
                className="bg-[#e05e00] hover:bg-[#c95400] text-white"
              >
                Initiate Physical Count
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
