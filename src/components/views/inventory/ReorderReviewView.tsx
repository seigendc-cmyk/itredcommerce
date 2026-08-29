import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  Search, 
  Filter, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Plus, 
  HelpCircle, 
  Info, 
  ShoppingBag, 
  ArrowUpRight, 
  Building2, 
  Tag, 
  Layers, 
  Calendar, 
  Check, 
  X, 
  Truck, 
  DollarSign, 
  ChevronRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { 
  ReorderRecommendation, 
  ReorderRecommendationStatus, 
  InventoryItem, 
  StaffMember, 
  PurchaseMemo, 
  PurchaseOrder,
  ActivityEvent 
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';

export interface ReorderReviewViewProps {
  currentStaff: StaffMember;
  recommendations?: ReorderRecommendation[];
  inventoryItems?: InventoryItem[];
  onBackToLanding: () => void;
  onUpdateRecommendationStatus: (id: string, status: ReorderRecommendationStatus, notes?: string) => void;
  onCreatePurchaseMemoFromReorder?: (selectedRecs: ReorderRecommendation[]) => void;
  onCreateDraftPOFromReorder?: (selectedRecs: ReorderRecommendation[]) => void;
  onCreatePurchaseMemo?: (selectedRecs: ReorderRecommendation[]) => void;
  onCreatePurchaseOrder?: (selectedRecs: ReorderRecommendation[]) => void;
  onNavigateToPOList?: () => void;
  onNavigateToMemos?: () => void;
  onRecordActivityEvent?: (event: ActivityEvent) => void;
}

export const ReorderReviewView: React.FC<ReorderReviewViewProps> = ({
  currentStaff,
  recommendations = [],
  inventoryItems = [],
  onBackToLanding,
  onUpdateRecommendationStatus,
  onCreatePurchaseMemoFromReorder,
  onCreateDraftPOFromReorder,
  onCreatePurchaseMemo,
  onCreatePurchaseOrder,
  onNavigateToPOList,
  onNavigateToMemos,
  onRecordActivityEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  
  // Modals
  const [selectedRecForDetail, setSelectedRecForDetail] = useState<ReorderRecommendation | null>(null);
  const [isIgnoreModalOpen, setIsIgnoreModalOpen] = useState(false);
  const [recToIgnore, setRecToIgnore] = useState<ReorderRecommendation | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    recommendations.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [recommendations]);

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      const matchesSearch = 
        r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.preferredSupplierName && r.preferredSupplierName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesDept = departmentFilter === 'ALL' || r.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [recommendations, searchTerm, statusFilter, departmentFilter]);

  // Summary Metrics
  const totalSuggestedUnits = filteredRecs.reduce((sum, r) => sum + r.suggestedReorderQty, 0);
  const totalEstimatedCost = filteredRecs.reduce((sum, r) => sum + r.estimatedCostTotal, 0);
  const pendingCount = recommendations.filter((r) => r.status === 'NEW').length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecIds(filteredRecs.map((r) => r.id));
    } else {
      setSelectedRecIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedRecIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAccept = (rec: ReorderRecommendation) => {
    onUpdateRecommendationStatus(rec.id, 'ACCEPTED');
    
    if (onRecordActivityEvent) {
      const evt: ActivityEvent = {
        id: `EVT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        eventType: 'REORDER_RECOMMENDATION_ACCEPTED',
        description: `Reorder recommendation accepted for ${rec.sku} (${rec.suggestedReorderQty} units at est. $${rec.estimatedCostTotal.toFixed(2)}).`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        branchId: 'BR-01',
        branchName: 'Main Store',
        referenceDocument: rec.id,
        amount: rec.estimatedCostTotal,
        quantity: rec.suggestedReorderQty,
      };
      onRecordActivityEvent(evt);
    }

    setSuccessBanner(`Accepted recommendation for ${rec.sku}. Ready for Purchase Memo or PO generation.`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleOpenIgnoreModal = (rec: ReorderRecommendation) => {
    setRecToIgnore(rec);
    setIgnoreReason('');
    setIsIgnoreModalOpen(true);
  };

  const handleConfirmIgnore = () => {
    if (!recToIgnore) return;
    onUpdateRecommendationStatus(recToIgnore.id, 'IGNORED', ignoreReason || 'Operational deferral by manager');

    if (onRecordActivityEvent) {
      const evt: ActivityEvent = {
        id: `EVT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        eventType: 'REORDER_RECOMMENDATION_IGNORED',
        description: `Reorder recommendation deferred/ignored for ${recToIgnore.sku}. Reason: ${ignoreReason || 'Operational deferral'}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        branchId: 'BR-01',
        branchName: 'Main Store',
        referenceDocument: recToIgnore.id,
      };
      onRecordActivityEvent(evt);
    }

    setIsIgnoreModalOpen(false);
    setRecToIgnore(null);
    setSuccessBanner(`Reorder recommendation for ${recToIgnore.sku} marked as IGNORED with audit record.`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleBulkCreateMemo = () => {
    const selected = recommendations.filter((r) => selectedRecIds.includes(r.id));
    if (selected.length === 0) return;

    selected.forEach((r) => {
      onUpdateRecommendationStatus(r.id, 'CONVERTED', 'Converted to Purchase Memo');
      if (onRecordActivityEvent) {
        onRecordActivityEvent({
          id: `EVT-${Date.now()}-${r.sku}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          eventType: 'REORDER_RECOMMENDATION_CONVERTED',
          description: `Reorder recommendation for ${r.sku} converted into Purchase Memo.`,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          branchId: 'BR-01',
          branchName: 'Main Store',
          referenceDocument: r.id,
          quantity: r.suggestedReorderQty,
          amount: r.estimatedCostTotal,
        });
      }
    });

    if (onCreatePurchaseMemoFromReorder) {
      onCreatePurchaseMemoFromReorder(selected);
    } else if (onCreatePurchaseMemo) {
      onCreatePurchaseMemo(selected);
    }
  };

  const handleBulkCreateDraftPO = () => {
    const selected = recommendations.filter((r) => selectedRecIds.includes(r.id));
    if (selected.length === 0) return;

    selected.forEach((r) => {
      onUpdateRecommendationStatus(r.id, 'CONVERTED', 'Converted to Draft PO');
      if (onRecordActivityEvent) {
        onRecordActivityEvent({
          id: `EVT-${Date.now()}-${r.sku}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          eventType: 'REORDER_RECOMMENDATION_CONVERTED',
          description: `Reorder recommendation for ${r.sku} converted into Draft Purchase Order.`,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          branchId: 'BR-01',
          branchName: 'Main Store',
          referenceDocument: r.id,
          quantity: r.suggestedReorderQty,
          amount: r.estimatedCostTotal,
        });
      }
    });

    if (onCreateDraftPOFromReorder) {
      onCreateDraftPOFromReorder(selected);
    } else if (onCreatePurchaseOrder) {
      onCreatePurchaseOrder(selected);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] text-[#1c1d22]">
      {/* Top Header */}
      <div className="bg-white border-b border-[#e1e4ea] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="p-1.5 hover:bg-[#f1f3f7] rounded-md">
            <ArrowLeft className="w-4 h-4 text-[#555a68]" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1c1d22]">Deterministic Reorder Review</h1>
              <span className="bg-[#fff3eb] text-[#e05e00] border border-[#fbd6b8] text-xs font-semibold px-2 py-0.5 rounded">
                Rule Engine v1.0
              </span>
            </div>
            <p className="text-xs text-[#6e7485] mt-0.5">
              Explainable inventory replenishment recommendations calculated from reorder buffers, vendor lead times, and sales velocity.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {selectedRecIds.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkCreateMemo}
                className="border-[#e05e00] text-[#e05e00] hover:bg-[#fff5ee] font-medium"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Create Purchase Memo ({selectedRecIds.length})
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleBulkCreateDraftPO}
                className="bg-[#e05e00] hover:bg-[#c95400] text-white font-medium"
              >
                <Truck className="w-3.5 h-3.5 mr-1.5" />
                Create Draft PO ({selectedRecIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-[#ecfdf5] border-b border-[#a7f3d0] px-6 py-2.5 flex items-center justify-between text-sm text-[#065f46]">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-[#059669] hover:text-[#065f46]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4">
        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Active Recommendations</div>
            <div className="text-2xl font-bold text-[#1c1d22] mt-0.5">{recommendations.length}</div>
            <div className="text-[11px] text-[#e05e00] font-medium mt-0.5">{pendingCount} pending review</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#fff5ee] flex items-center justify-center text-[#e05e00]">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Suggested Reorder Units</div>
            <div className="text-2xl font-bold text-[#1c1d22] mt-0.5">{totalSuggestedUnits.toLocaleString()}</div>
            <div className="text-[11px] text-[#6e7485] mt-0.5">Across {filteredRecs.length} filtered items</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Estimated Cost Total</div>
            <div className="text-2xl font-bold text-[#1c1d22] mt-0.5">${totalEstimatedCost.toFixed(2)}</div>
            <div className="text-[11px] text-[#10b981] font-medium mt-0.5">Based on last approved cost basis</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#ecfdf5] flex items-center justify-center text-[#059669]">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e1e4ea] rounded-lg p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#6e7485] uppercase tracking-wider font-semibold">Purchasing Governance</div>
            <div className="text-sm font-semibold text-[#1c1d22] mt-1">Non-Bypassing Control</div>
            <div className="text-[11px] text-[#6e7485] mt-0.5">Requires standard manager sign-off</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
            <ShieldCheck className="w-5 h-5" />
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
              placeholder="Search by SKU, item description, or preferred supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#d2d6e0] rounded-md focus:outline-hidden focus:border-[#e05e00]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-[#d2d6e0] text-xs rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-[#e05e00]"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New Recommendations</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IGNORED">Ignored / Deferred</option>
              <option value="CONVERTED">Converted to PO/Memo</option>
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
          Showing <span className="font-semibold text-[#1c1d22]">{filteredRecs.length}</span> of {recommendations.length} items
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
                    checked={selectedRecIds.length === filteredRecs.length && filteredRecs.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#d2d6e0] text-[#e05e00] focus:ring-[#e05e00]"
                  />
                </th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Location</th>
                <th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Reorder Level</th>
                <th className="p-3 text-right">Suggested Qty</th>
                <th className="p-3">Preferred Supplier</th>
                <th className="p-3 text-right">Est. Unit Cost</th>
                <th className="p-3 text-right">Total Est. Cost</th>
                <th className="p-3">Deterministic Evidence</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f7]">
              {filteredRecs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-[#8c92a4]">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-[#10b981] mb-2 opacity-80" />
                    <p className="font-medium text-[#1c1d22]">No Reorder Recommendations Pending</p>
                    <p className="text-xs mt-1">All active inventory items have sufficient sellable stock above configured reorder levels.</p>
                  </td>
                </tr>
              ) : (
                filteredRecs.map((rec) => {
                  const isSelected = selectedRecIds.includes(rec.id);
                  const isBelowZero = rec.availableStock <= 0;

                  return (
                    <tr 
                      key={rec.id} 
                      className={`hover:bg-[#fbfcfd] transition-colors ${isSelected ? 'bg-[#fffaf6]' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(rec.id)}
                          className="rounded border-[#d2d6e0] text-[#e05e00] focus:ring-[#e05e00]"
                        />
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-[#1c1d22]">{rec.itemName}</div>
                        <div className="font-mono text-[11px] text-[#6e7485]">{rec.sku} • {rec.department}</div>
                      </td>

                      <td className="p-3 text-[#555a68]">
                        {rec.locationName}
                      </td>

                      <td className="p-3 text-right font-medium">
                        <span className={isBelowZero ? 'text-[#ef4444] font-bold' : 'text-[#f59e0b] font-bold'}>
                          {rec.availableStock} Units
                        </span>
                      </td>

                      <td className="p-3 text-right text-[#555a68]">
                        {rec.reorderLevel} Units
                      </td>

                      <td className="p-3 text-right font-bold text-[#e05e00]">
                        +{rec.suggestedReorderQty}
                      </td>

                      <td className="p-3">
                        <div className="text-[#1c1d22] font-medium">{rec.preferredSupplierName || 'Distributor'}</div>
                        <div className="text-[11px] text-[#8c92a4]">{rec.preferredSupplierCode || 'SUP-GEN'}</div>
                      </td>

                      <td className="p-3 text-right text-[#555a68]">
                        ${rec.lastCost.toFixed(2)}
                      </td>

                      <td className="p-3 text-right font-semibold text-[#1c1d22]">
                        ${rec.estimatedCostTotal.toFixed(2)}
                      </td>

                      <td className="p-3 max-w-[280px]">
                        <p className="text-[11px] text-[#555a68] truncate" title={rec.reason}>
                          {rec.reason}
                        </p>
                      </td>

                      <td className="p-3 text-center">
                        {rec.status === 'NEW' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]">
                            New
                          </span>
                        )}
                        {rec.status === 'ACCEPTED' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                            Accepted
                          </span>
                        )}
                        {rec.status === 'IGNORED' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb]">
                            Ignored
                          </span>
                        )}
                        {rec.status === 'CONVERTED' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa]">
                            In Memo/PO
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecForDetail(rec)}
                          className="px-2 py-1 text-[11px] rounded bg-[#f1f3f7] hover:bg-[#e4e7ee] text-[#3b4050] font-medium"
                          title="View Deterministic Calculation"
                        >
                          <Info className="w-3 h-3 inline mr-1" />
                          Evidence
                        </button>

                        {rec.status === 'NEW' && (
                          <>
                            <button
                              onClick={() => handleAccept(rec)}
                              className="px-2 py-1 text-[11px] rounded bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#059669] font-medium"
                              title="Accept Recommendation"
                            >
                              <Check className="w-3 h-3 inline mr-1" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleOpenIgnoreModal(rec)}
                              className="px-2 py-1 text-[11px] rounded bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] font-medium"
                              title="Ignore / Defer"
                            >
                              <X className="w-3 h-3 inline mr-1" />
                              Ignore
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence & Details Modal */}
      {selectedRecForDetail && (
        <Modal 
          isOpen={true} 
          onClose={() => setSelectedRecForDetail(null)} 
          title={`Reorder Evidence: ${selectedRecForDetail.sku}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#f8f9fa] border border-[#e1e4ea] rounded p-3">
              <div className="font-semibold text-sm text-[#1c1d22]">{selectedRecForDetail.itemName}</div>
              <div className="font-mono text-[#6e7485] mt-0.5">SKU: {selectedRecForDetail.sku} • Department: {selectedRecForDetail.department}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#e1e4ea] rounded p-3 bg-white">
                <div className="text-[#6e7485] text-[11px] uppercase tracking-wider font-semibold">Stock Position</div>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span>Available Stock:</span>
                    <span className="font-bold text-[#e05e00]">{selectedRecForDetail.availableStock} Units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Configured Reorder Level:</span>
                    <span className="font-semibold text-[#1c1d22]">{selectedRecForDetail.reorderLevel} Units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Computed Target Stock:</span>
                    <span className="font-semibold text-[#1c1d22]">{selectedRecForDetail.targetStock} Units</span>
                  </div>
                </div>
              </div>

              <div className="border border-[#e1e4ea] rounded p-3 bg-white">
                <div className="text-[#6e7485] text-[11px] uppercase tracking-wider font-semibold">Demand & Supply Math</div>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span>Avg. Daily Sales:</span>
                    <span className="font-semibold text-[#1c1d22]">~{selectedRecForDetail.averageDailySales} units/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendor Lead Time:</span>
                    <span className="font-semibold text-[#1c1d22]">{selectedRecForDetail.supplierLeadTimeDays || 7} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suggested Order Qty:</span>
                    <span className="font-bold text-[#059669]">+{selectedRecForDetail.suggestedReorderQty} Units</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#fffaf6] border border-[#fbd6b8] rounded p-3">
              <div className="text-[#e05e00] font-semibold mb-1 flex items-center">
                <Info className="w-3.5 h-3.5 mr-1" />
                Deterministic Recommendation Reasoning (Rule v{selectedRecForDetail.ruleVersion}.0)
              </div>
              <p className="text-[#555a68] leading-relaxed">
                {selectedRecForDetail.reason}
              </p>
            </div>

            <div className="border-t border-[#e1e4ea] pt-3 flex justify-between items-center">
              <div className="text-[#6e7485]">
                Preferred Supplier: <span className="font-semibold text-[#1c1d22]">{selectedRecForDetail.preferredSupplierName}</span>
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRecForDetail(null)}>
                  Close
                </Button>
                {selectedRecForDetail.status === 'NEW' && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => {
                      handleAccept(selectedRecForDetail);
                      setSelectedRecForDetail(null);
                    }}
                    className="bg-[#e05e00] hover:bg-[#c95400] text-white"
                  >
                    Accept Recommendation
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Ignore Reason Modal */}
      {isIgnoreModalOpen && recToIgnore && (
        <Modal 
          isOpen={true} 
          onClose={() => setIsIgnoreModalOpen(false)} 
          title={`Ignore Reorder for ${recToIgnore.sku}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-[#555a68]">
              Please provide a business justification for deferring replenishment of <span className="font-semibold text-[#1c1d22]">{recToIgnore.itemName}</span>. This will be preserved in the audit trail.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1c1d22] mb-1">Audit Justification / Note</label>
              <textarea
                rows={3}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="e.g., Seasonal drop in demand, alternative replacement in stock, vendor renegotiation in progress..."
                className="w-full p-2.5 border border-[#d2d6e0] rounded-md text-xs focus:outline-hidden focus:border-[#e05e00]"
              />
            </div>

            <div className="border-t border-[#e1e4ea] pt-3 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setIsIgnoreModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleConfirmIgnore}
                className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
              >
                Confirm Ignore
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
