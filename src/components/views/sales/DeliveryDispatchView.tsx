import React, { useEffect, useState } from 'react';
import {
  Truck,
  ArrowLeft,
  Search,
  Plus,
  CheckCircle2,
  Wifi,
  WifiOff,
  MapPin,
  Copy,
} from 'lucide-react';
import { Branch, DeliveryOrder, DeliveryLoadSizeTier, DeliveryRideType, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Alert } from '../../ui/Alert';
import { apiGet, apiPost, ApiClientError } from '../../../api/client';
import { useConnectivity } from '../../../hooks/useConnectivity';

export interface DeliveryDispatchViewProps {
  deliveryOrders: DeliveryOrder[];
  activeBranch: Branch;
  currentStaff: StaffMember;
  onCreateDeliveryOrder: (newOrder: DeliveryOrder) => void;
  onUpdateDeliveryOrder: (updatedOrder: DeliveryOrder) => void;
  onBackToLanding: () => void;
  /** Deep-linked from the receipt screen (Prompt 7) — opens straight into the create flow, pre-filled and looked up. */
  initialSaleNumber?: string;
}

const LOAD_SIZE_OPTIONS: { value: DeliveryLoadSizeTier; label: string }[] = [
  { value: 'small', label: 'Small — fits a backpack/pannier' },
  { value: 'medium', label: 'Medium — fits a car boot' },
  { value: 'large', label: 'Large — needs a van' },
];

const RIDE_TYPE_OPTIONS: { value: DeliveryRideType; label: string }[] = [
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  posted: 'bg-amber-100 text-amber-900 border-amber-300',
  accepted: 'bg-sky-100 text-sky-900 border-sky-300',
  in_transit: 'bg-blue-100 text-blue-900 border-blue-300',
  delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  failed: 'bg-rose-100 text-rose-900 border-rose-300',
  under_investigation: 'bg-purple-100 text-purple-900 border-purple-300',
  cancelled: 'bg-gray-200 text-gray-700 border-gray-300',
};

export const DeliveryDispatchView: React.FC<DeliveryDispatchViewProps> = ({
  deliveryOrders = [],
  activeBranch,
  currentStaff,
  onCreateDeliveryOrder,
  onUpdateDeliveryOrder,
  onBackToLanding,
  initialSaleNumber,
}) => {
  const connectivity = useConnectivity();
  const isOnline = connectivity === 'ONLINE';

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [justCreated, setJustCreated] = useState<DeliveryOrder | null>(null);
  const [justReissued, setJustReissued] = useState<DeliveryOrder | null>(null);
  const [reissuingOrderId, setReissuingOrderId] = useState<string | null>(null);

  const [saleNumber, setSaleNumber] = useState('');
  const [isLookingUpSale, setIsLookingUpSale] = useState(false);
  const [saleLookupStatus, setSaleLookupStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const [deliveryAddressLine, setDeliveryAddressLine] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryLandmark, setDeliveryLandmark] = useState('');
  const [deliveryLatitude, setDeliveryLatitude] = useState('');
  const [deliveryLongitude, setDeliveryLongitude] = useState('');
  const [deliveryContactName, setDeliveryContactName] = useState('');
  const [deliveryContactPhone, setDeliveryContactPhone] = useState('');
  const [loadSizeTier, setLoadSizeTier] = useState<DeliveryLoadSizeTier>('small');
  const [rideTypeRequirement, setRideTypeRequirement] = useState<DeliveryRideType>('motorbike');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const branchHasCoordinates = typeof activeBranch?.latitude === 'number' && typeof activeBranch?.longitude === 'number';

  const resetForm = () => {
    setSaleNumber('');
    setSaleLookupStatus(null);
    setDeliveryAddressLine('');
    setDeliveryCity('');
    setDeliveryLandmark('');
    setDeliveryLatitude('');
    setDeliveryLongitude('');
    setDeliveryContactName('');
    setDeliveryContactPhone('');
    setLoadSizeTier('small');
    setRideTypeRequirement('motorbike');
  };

  const handleLookupSale = async (overrideSaleNumber?: string) => {
    const trimmed = (overrideSaleNumber ?? saleNumber).trim();
    if (!trimmed) return;
    setIsLookingUpSale(true);
    setSaleLookupStatus(null);
    try {
      const found = await apiGet<{
        saleNumber: string;
        customerName: string | null;
        branchName: string | null;
        hasActiveDelivery: boolean;
      }>(`/delivery-orders/sale/${encodeURIComponent(trimmed)}`);

      if (found.hasActiveDelivery) {
        setSaleLookupStatus({ message: `Sale ${found.saleNumber} already has an active delivery dispatch.`, type: 'warning' });
      } else {
        setSaleLookupStatus({
          message: `Found sale ${found.saleNumber}${found.customerName ? ` for ${found.customerName}` : ''} — ready to dispatch.`,
          type: 'success',
        });
      }
    } catch (err) {
      setSaleLookupStatus({
        message:
          err instanceof ApiClientError && err.status === 404
            ? `No sale found matching "${trimmed}".`
            : err instanceof ApiClientError
              ? err.message
              : 'Could not look up that sale.',
        type: 'error',
      });
    } finally {
      setIsLookingUpSale(false);
    }
  };

  // Deep-linked from the receipt screen (ReceiptModal's "Create Delivery
  // Dispatch" button, via SalesView -> App.tsx's navigationParams) — jump
  // straight into the create flow with the just-completed sale already
  // looked up, instead of making staff retype a sale number they were just
  // looking at.
  useEffect(() => {
    if (!initialSaleNumber) return;
    setSaleNumber(initialSaleNumber);
    setIsCreateModalOpen(true);
    void handleLookupSale(initialSaleNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSaleNumber]);

  const filteredOrders = deliveryOrders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      o.saleNumber.toLowerCase().includes(q) ||
      o.deliveryAddressLine.toLowerCase().includes(q) ||
      o.confirmationCode.toLowerCase().includes(q)
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setActionAlert({ message: 'Delivery dispatch requires an active connection.', type: 'error' });
      return;
    }
    if (!branchHasCoordinates) {
      setActionAlert({ message: `${activeBranch?.name || 'This branch'} has no geocoded pickup coordinates configured.`, type: 'error' });
      return;
    }
    const lat = parseFloat(deliveryLatitude);
    const lon = parseFloat(deliveryLongitude);
    if (!deliveryAddressLine.trim() || Number.isNaN(lat) || Number.isNaN(lon)) {
      setActionAlert({ message: 'Delivery address and a valid latitude/longitude are required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiPost<DeliveryOrder>('/delivery-orders', {
        saleNumber: saleNumber.trim(),
        deliveryAddressLine: deliveryAddressLine.trim(),
        deliveryCity: deliveryCity.trim() || undefined,
        deliveryLandmark: deliveryLandmark.trim() || undefined,
        deliveryLatitude: lat,
        deliveryLongitude: lon,
        deliveryContactName: deliveryContactName.trim() || undefined,
        deliveryContactPhone: deliveryContactPhone.trim() || undefined,
        loadSizeTier,
        rideTypeRequirement,
        pickupLatitude: activeBranch.latitude,
        pickupLongitude: activeBranch.longitude,
      });

      onCreateDeliveryOrder(created);
      setIsCreateModalOpen(false);
      resetForm();
      setJustCreated(created);
    } catch (err) {
      setActionAlert({
        message: err instanceof ApiClientError ? `Delivery dispatch not created: ${err.message}` : 'Could not reach the backend to create this delivery dispatch.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Code-recovery path (confirmed decision (a)): dispatch manually reissues
  // a fresh code and the same order reopens — see
  // server/routes/deliveryOrders.ts's /:id/reissue-code.
  const handleReissueCode = async (order: DeliveryOrder) => {
    if (!isOnline) {
      setActionAlert({ message: 'Reissuing a code requires an active connection.', type: 'error' });
      return;
    }
    setReissuingOrderId(order.id);
    try {
      const updated = await apiPost<DeliveryOrder>(`/delivery-orders/${encodeURIComponent(order.id)}/reissue-code`);
      onUpdateDeliveryOrder(updated);
      setJustReissued(updated);
    } catch (err) {
      setActionAlert({
        message: err instanceof ApiClientError ? `Code not reissued: ${err.message}` : 'Could not reach the backend to reissue this code.',
        type: 'error',
      });
    } finally {
      setReissuingOrderId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Landing
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-400" />
                Delivery Dispatch
              </h2>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-mono">
                {deliveryOrders.length} Dispatched
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Create rider dispatches from completed sales. Fare calculation and rider assignment are handled elsewhere.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-mono font-bold uppercase ${
              isOnline ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
            title={isOnline ? 'Connected — dispatch creation is available' : 'Offline — dispatch creation is disabled until connectivity returns'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            disabled={!isOnline}
            title={isOnline ? undefined : 'Delivery dispatches can never be queued offline — reconnect to create one'}
          >
            Create Delivery Dispatch
          </Button>
        </div>
      </div>

      {!isOnline && (
        <Alert type="warning" size="sm">
          This terminal is offline. Delivery dispatch creation is disabled — dispatches are never queued for later
          creation, since a rider can't be sent to a stale offline order. Try again once connectivity is restored.
        </Alert>
      )}

      {actionAlert && (
        <Alert type={actionAlert.type} onClose={() => setActionAlert(null)} size="sm">
          {actionAlert.message}
        </Alert>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 border border-slate-300">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by dispatch #, sale #, address, confirmation code..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
        <div className="text-xs font-mono text-gray-500">
          Showing {filteredOrders.length} of {deliveryOrders.length} dispatches
        </div>
      </div>

      {/* Dispatch Table */}
      <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono select-none">
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Dispatch #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-32">Sale #</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Delivery Address</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-24">Route</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Distance</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-24">Fare</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-28">Load / Ride</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center w-32">Status</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold w-24">Code Expires</th>
                <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-right w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-mono">
                    No delivery dispatches yet. Click "Create Delivery Dispatch" to send one from a completed sale.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{o.id}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-700 text-[11px]">{o.saleNumber}</td>
                    <td className="py-2.5 px-3 text-gray-800">
                      {o.deliveryAddressLine}
                      {o.deliveryCity ? `, ${o.deliveryCity}` : ''}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-bold uppercase text-gray-700">{o.routeClass}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-700">{o.distanceKm.toFixed(1)} km</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                      {o.fareAmount != null ? `${o.fareCurrency ?? ''} ${o.fareAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] uppercase text-gray-600">
                      {o.loadSizeTier} / {o.rideTypeRequirement}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className={`px-2 py-0.5 border font-bold text-[10px] uppercase ${STATUS_BADGE_CLASS[o.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-gray-500">
                      {new Date(o.confirmationCodeExpiresAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {o.status === 'under_investigation' && (
                        <button
                          type="button"
                          onClick={() => handleReissueCode(o)}
                          disabled={!isOnline || reissuingOrderId === o.id}
                          className="p-1 px-2 text-[11px] font-mono border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isOnline ? 'Issue a fresh confirmation code and reopen this order' : 'Requires an active connection'}
                        >
                          {reissuingOrderId === o.id ? 'Reissuing…' : 'Reissue Code'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dispatch Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Delivery Dispatch"
          subtitle={`Pickup from ${activeBranch?.name || 'this branch'}`}
          maxWidth="lg"
          headerColor="orange"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSubmit}
                isLoading={isSubmitting}
                disabled={isSubmitting || !isOnline}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold"
              >
                Create Dispatch
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs select-none">
            {!branchHasCoordinates && (
              <Alert type="warning" size="sm">
                {activeBranch?.name || 'This branch'} has no geocoded pickup coordinates configured — distance and
                route classification can't be calculated until it does.
              </Alert>
            )}

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Completed Sale # *
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={saleNumber}
                  onChange={(e) => {
                    setSaleNumber(e.target.value);
                    setSaleLookupStatus(null);
                  }}
                  placeholder="e.g. INV-20260815-001"
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => handleLookupSale()} isLoading={isLookingUpSale} disabled={!saleNumber.trim() || isLookingUpSale}>
                  Look Up
                </Button>
              </div>
              {saleLookupStatus && (
                <p
                  className={`text-[10px] mt-1 font-mono ${
                    saleLookupStatus.type === 'success' ? 'text-emerald-700' : saleLookupStatus.type === 'warning' ? 'text-amber-700' : 'text-rose-600'
                  }`}
                >
                  {saleLookupStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Delivery Address *
                </label>
                <input
                  type="text"
                  value={deliveryAddressLine}
                  onChange={(e) => setDeliveryAddressLine(e.target.value)}
                  placeholder="Street address / unit"
                  className="w-full p-2 bg-white border border-gray-300 text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">City</label>
                <input
                  type="text"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">Landmark</label>
                <input
                  type="text"
                  value={deliveryLandmark}
                  onChange={(e) => setDeliveryLandmark(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={deliveryLatitude}
                  onChange={(e) => setDeliveryLatitude(e.target.value)}
                  placeholder="-90 to 90"
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={deliveryLongitude}
                  onChange={(e) => setDeliveryLongitude(e.target.value)}
                  placeholder="-180 to 180"
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">Contact Name</label>
                <input
                  type="text"
                  value={deliveryContactName}
                  onChange={(e) => setDeliveryContactName(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={deliveryContactPhone}
                  onChange={(e) => setDeliveryContactPhone(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">Load Size Tier *</label>
                <select
                  value={loadSizeTier}
                  onChange={(e) => setLoadSizeTier(e.target.value as DeliveryLoadSizeTier)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                >
                  {LOAD_SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">Ride Type Required *</label>
                <select
                  value={rideTypeRequirement}
                  onChange={(e) => setRideTypeRequirement(e.target.value as DeliveryRideType)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                >
                  {RIDE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Alert type="info" size="sm">
              Route distance and local/intercity classification are calculated automatically from branch and delivery
              coordinates. A confirmation code is generated on creation — read it aloud to the customer/rider once
              the dispatch is created.
            </Alert>
          </form>
        </Modal>
      )}

      {/* Post-Creation Confirmation Code Modal */}
      {justCreated && (
        <Modal
          isOpen={true}
          onClose={() => setJustCreated(null)}
          title={`Dispatch ${justCreated.id} Created`}
          subtitle={`${justCreated.routeClass === 'local' ? 'Local' : 'Intercity'} route — ${justCreated.distanceKm.toFixed(1)} km`}
          maxWidth="sm"
          headerColor="orange"
          footer={
            <Button variant="primary" size="sm" onClick={() => setJustCreated(null)}>
              Done
            </Button>
          }
        >
          <div className="space-y-3 text-xs select-none text-center">
            <p className="text-gray-600">Read this confirmation code aloud to the customer/rider on delivery:</p>
            <div className="p-4 bg-slate-900 text-white flex items-center justify-center gap-3">
              <span className="font-mono font-black text-3xl tracking-[0.3em]">{justCreated.confirmationCode}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(justCreated.confirmationCode)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Copy code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] font-mono text-gray-500">
              Expires {new Date(justCreated.confirmationCodeExpiresAt).toLocaleString()}
            </p>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between font-mono">
              <span className="text-gray-500">Calculated Fare:</span>
              <span className="font-bold text-gray-900">
                {justCreated.fareAmount != null
                  ? `${justCreated.fareCurrency ?? ''} ${justCreated.fareAmount.toFixed(2)}`
                  : 'Not available — no rate configuration published yet'}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Post-Reissue Confirmation Code Modal */}
      {justReissued && (
        <Modal
          isOpen={true}
          onClose={() => setJustReissued(null)}
          title={`Dispatch ${justReissued.id} Reopened`}
          subtitle="A fresh confirmation code has been issued — the same rider stays assigned"
          maxWidth="sm"
          headerColor="orange"
          footer={
            <Button variant="primary" size="sm" onClick={() => setJustReissued(null)}>
              Done
            </Button>
          }
        >
          <div className="space-y-3 text-xs select-none text-center">
            <p className="text-gray-600">Read this new confirmation code aloud to the customer/rider on delivery:</p>
            <div className="p-4 bg-slate-900 text-white flex items-center justify-center gap-3">
              <span className="font-mono font-black text-3xl tracking-[0.3em]">{justReissued.confirmationCode}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(justReissued.confirmationCode)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Copy code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] font-mono text-gray-500">
              Expires {new Date(justReissued.confirmationCodeExpiresAt).toLocaleString()}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
