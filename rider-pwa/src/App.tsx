import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Wifi, WifiOff, MapPin, Truck, Package, RefreshCw, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Alert } from '@shared/components/ui/Alert';
import type { DeliveryOrder } from '@shared/types';
import { supabase } from './lib/supabaseClient';
import { enforceSessionCeiling, recordSignIn, clearSignInRecord } from './lib/session';
import { RiderSignInScreen } from './components/RiderSignInScreen';
import { fetchRiderRoster, type RosterEntry, type RiderSignInResult } from './lib/authApi';
import { haversineDistanceKm } from './lib/geo';
import {
  fetchOwnRiderId,
  fetchPostedOrders,
  fetchActiveOrder,
  acceptOrder,
  markInTransit,
  verifyDeliveryCode,
  updateAvailability,
  updateLocation,
  type PostedOrderWithPickup,
  type VerifyCodeResult,
} from './lib/riderApi';

const DEFAULT_RADIUS_KM = 5; // Confirmed default (Prompt 9) — rider-adjustable from here.
const RADIUS_STORAGE_KEY = 'itred-rider-radius-km';
const BOARD_POLL_MS = 12_000;
const ACTIVE_ORDER_POLL_MS = 8_000;
const LOCATION_PUSH_MIN_INTERVAL_MS = 15_000;

function loadStoredRadius(): number {
  const raw = localStorage.getItem(RADIUS_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RADIUS_KM;
}

const STATUS_LABEL: Record<string, string> = {
  posted: 'Posted',
  accepted: 'Accepted',
  in_transit: 'In Transit',
  under_investigation: 'Under Investigation',
};

export default function App() {
  const [staff, setStaff] = useState<RosterEntry | null>(null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [isAvailable, setIsAvailable] = useState(false);
  const [radiusKm, setRadiusKm] = useState(loadStoredRadius);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const lastLocationPushRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  const [offers, setOffers] = useState<PostedOrderWithPickup[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const [activeOrder, setActiveOrder] = useState<DeliveryOrder | null>(null);
  const [isMarkingTransit, setIsMarkingTransit] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyCodeResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  // --- Session restore ---
  useEffect(() => {
    (async () => {
      const overCeiling = await enforceSessionCeiling();
      if (!overCeiling) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const meta = data.session.user.user_metadata as { staff_id?: string };
          const roster = await fetchRiderRoster().catch(() => []);
          const matched = roster.find((r) => r.id === meta.staff_id);
          const restoredStaff = matched ?? { id: meta.staff_id ?? '', name: '', avatarInitials: '', roleTitle: '' };
          setStaff(restoredStaff);
          if (restoredStaff.id) {
            fetchOwnRiderId(restoredStaff.id).then(setRiderId).catch(() => setRiderId(null));
          }
        }
      }
      setIsCheckingSession(false);
    })();

    const interval = setInterval(() => void enforceSessionCeiling().then((over) => over && setStaff(null)), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void enforceSessionCeiling().then((over) => over && setStaff(null));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleAuthenticated = useCallback(async (result: RiderSignInResult) => {
    await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
    recordSignIn();
    setStaff(result.staff);
    setRiderId(result.riderId);
  }, []);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    stopLocationWatch();
    if (riderId) void updateAvailability(riderId, false).catch(() => {});
    clearSignInRecord();
    await supabase.auth.signOut();
    setStaff(null);
    setRiderId(null);
    setIsAvailable(false);
    setOffers([]);
    setActiveOrder(null);
  }, [riderId, stopLocationWatch]);

  // --- Availability + live location ---
  const handleToggleAvailability = useCallback(async () => {
    if (!riderId) return;
    const next = !isAvailable;
    setActionError(null);
    try {
      await updateAvailability(riderId, next);
      setIsAvailable(next);
      if (next) {
        if (!navigator.geolocation) {
          setActionError('This device does not support location sharing — required to appear on the broadcast board.');
          return;
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setPosition({ lat, lon });
            const now = Date.now();
            if (now - lastLocationPushRef.current >= LOCATION_PUSH_MIN_INTERVAL_MS) {
              lastLocationPushRef.current = now;
              void updateLocation(riderId, lat, lon).catch(() => {});
            }
          },
          () => setActionError('Could not read your device location. Enable location permissions and try again.'),
          { enableHighAccuracy: true, maximumAge: 10_000 }
        );
      } else {
        stopLocationWatch();
      }
    } catch {
      setActionError('Failed to update availability.');
    }
  }, [isAvailable, riderId, stopLocationWatch]);

  useEffect(() => stopLocationWatch, [stopLocationWatch]);

  // --- Broadcast board polling (only while available, no active job) ---
  useEffect(() => {
    if (!riderId || !isAvailable || activeOrder) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchPostedOrders();
        if (!cancelled) setOffers(rows);
      } catch {
        // Transient network hiccups shouldn't blank the board — keep showing the last good list.
      }
    };
    void load();
    const interval = setInterval(load, BOARD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [riderId, isAvailable, activeOrder]);

  // --- Active order polling (detects delivered/reissue/under_investigation externally) ---
  useEffect(() => {
    if (!riderId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const order = await fetchActiveOrder(riderId);
        if (!cancelled) {
          setActiveOrder(order);
          if (!order) {
            setCodeInput('');
            setVerifyResult(null);
          }
        }
      } catch {
        // keep last known state on transient failure
      }
    };
    void load();
    const interval = setInterval(load, ACTIVE_ORDER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [riderId]);

  const visibleOffers = (position
    ? offers
        .map((o) => ({ ...o, distanceFromRiderKm: haversineDistanceKm(position.lat, position.lon, o.pickupLatitude, o.pickupLongitude) }))
        .filter((o) => o.distanceFromRiderKm <= radiusKm)
        .sort((a, b) => a.distanceFromRiderKm - b.distanceFromRiderKm)
    : []
  ).filter((o) => !dismissedIds.has(o.id));

  const handleAccept = async (order: PostedOrderWithPickup) => {
    if (!riderId) return;
    setAcceptingId(order.id);
    setActionError(null);
    try {
      const outcome = await acceptOrder(order.id, riderId);
      if (outcome.outcome === 'ALREADY_TAKEN') {
        setActionError(`Dispatch ${order.id} was just accepted by another rider.`);
        setOffers((prev) => prev.filter((o) => o.id !== order.id));
      } else {
        setActiveOrder(outcome.order);
        setOffers([]);
      }
    } catch {
      setActionError('Failed to accept this dispatch. Try again.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = (orderId: string) => {
    setDismissedIds((prev) => new Set(prev).add(orderId));
  };

  const handleMarkInTransit = async () => {
    if (!activeOrder || !riderId) return;
    setIsMarkingTransit(true);
    setActionError(null);
    try {
      const updated = await markInTransit(activeOrder.id, riderId);
      setActiveOrder(updated);
    } catch {
      setActionError('Failed to update status. Try again.');
    } finally {
      setIsMarkingTransit(false);
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !codeInput.trim() || isVerifying) return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyDeliveryCode(activeOrder.id, codeInput.trim().toUpperCase());
      setVerifyResult(result);
      if (result.status === 'OK') {
        setActiveOrder(null);
        setCodeInput('');
      } else if (result.status === 'LOCKED_OUT' || result.status === 'EXPIRED') {
        // Refresh so the panel reflects under_investigation immediately.
        const refreshed = await fetchActiveOrder(riderId!);
        setActiveOrder(refreshed);
      }
      setCodeInput('');
    } catch {
      setActionError('Failed to verify the code. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isCheckingSession) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!staff) {
    return <RiderSignInScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-[#FF6B00] text-white px-4 py-3 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div>
          <div className="font-black text-lg tracking-tighter italic leading-none">
            iTred<span className="font-light not-italic">Rider</span>
          </div>
          <div className="text-[11px] font-mono text-white/80 mt-0.5">{staff.name || 'Rider'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleAvailability}
            disabled={!riderId}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase border ${
              isAvailable ? 'bg-emerald-500/20 border-emerald-300 text-emerald-50' : 'bg-black/20 border-white/30 text-white/90'
            }`}
          >
            {isAvailable ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isAvailable ? 'Online' : 'Offline'}
          </button>
          <button type="button" onClick={handleSignOut} className="p-2 hover:bg-black/20" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3">
        {actionError && (
          <Alert type="error" onClose={() => setActionError(null)} size="sm">
            {actionError}
          </Alert>
        )}

        {!activeOrder && !isAvailable && (
          <Alert type="info" size="sm">
            Go online to share your location and see delivery jobs near you.
          </Alert>
        )}

        {!activeOrder && isAvailable && !position && (
          <Alert type="warning" size="sm">
            Waiting for your device location — the broadcast board needs it to find nearby jobs.
          </Alert>
        )}

        {!activeOrder && isAvailable && (
          <div className="bg-slate-900 border border-slate-800 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <MapPin className="w-4 h-4 text-[#FF6B00]" />
              <span>Radius</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={50}
                value={radiusKm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRadiusKm(v);
                  localStorage.setItem(RADIUS_STORAGE_KEY, String(v));
                }}
                className="w-32"
              />
              <span className="font-mono text-sm font-bold text-white w-14 text-right">{radiusKm} km</span>
            </div>
          </div>
        )}

        {/* Active job */}
        {activeOrder && (
          <div className="bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-200">Active Job — {activeOrder.id}</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  activeOrder.status === 'under_investigation'
                    ? 'bg-purple-500/20 text-purple-200 border-purple-400'
                    : 'bg-sky-500/20 text-sky-200 border-sky-400'
                }`}
              >
                {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
              </span>
            </div>
            <div className="p-3 space-y-3 text-sm">
              <div>
                <div className="text-[10px] uppercase text-slate-500 font-mono">Deliver To</div>
                <div className="font-bold text-slate-100">
                  {activeOrder.deliveryAddressLine}
                  {activeOrder.deliveryCity ? `, ${activeOrder.deliveryCity}` : ''}
                </div>
                {activeOrder.deliveryLandmark && <div className="text-xs text-slate-400">Landmark: {activeOrder.deliveryLandmark}</div>}
                {activeOrder.deliveryContactName && (
                  <div className="text-xs text-slate-400 mt-1">
                    Contact: {activeOrder.deliveryContactName} {activeOrder.deliveryContactPhone ? `(${activeOrder.deliveryContactPhone})` : ''}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between font-mono text-xs bg-slate-950 border border-slate-800 p-2">
                <span className="text-slate-500">Fare</span>
                <span className="font-bold text-emerald-400">
                  {activeOrder.fareAmount != null ? `${activeOrder.fareCurrency ?? ''} ${activeOrder.fareAmount.toFixed(2)}` : 'Not yet available'}
                </span>
              </div>

              {activeOrder.status === 'accepted' && (
                <Button variant="primary" size="sm" className="w-full" onClick={handleMarkInTransit} isLoading={isMarkingTransit}>
                  Mark In Transit
                </Button>
              )}

              {(activeOrder.status === 'accepted' || activeOrder.status === 'in_transit') && (
                <form onSubmit={handleSubmitCode} className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[10px] uppercase text-slate-500 font-mono flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Confirmation Code (from customer)
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. A3F9K2"
                      className="flex-1 p-2.5 bg-slate-950 border border-slate-700 font-mono text-center tracking-[0.3em] text-lg text-white focus:outline-none focus:border-[#FF6B00]"
                    />
                    <Button type="submit" variant="primary" isLoading={isVerifying} disabled={!codeInput.trim()}>
                      Confirm
                    </Button>
                  </div>
                  {verifyResult && verifyResult.status !== 'OK' && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {verifyResult.message}
                        {verifyResult.attemptsRemaining != null && verifyResult.attemptsRemaining > 0 ? ` (${verifyResult.attemptsRemaining} attempt(s) left)` : ''}
                      </span>
                    </div>
                  )}
                </form>
              )}

              {activeOrder.status === 'under_investigation' && (
                <Alert type="warning" size="sm">
                  This order is under investigation after too many failed code attempts. Dispatch has been notified
                  and must reissue a new code before you can continue — this screen refreshes automatically.
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Broadcast board */}
        {!activeOrder && isAvailable && position && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Nearby Jobs ({visibleOffers.length})</div>
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            </div>

            {visibleOffers.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800">
                <Package className="w-6 h-6 mx-auto mb-2 text-slate-700" />
                No jobs within {radiusKm}km right now.
              </div>
            )}

            {visibleOffers.map((o) => (
              <div key={o.id} className="bg-slate-900 border border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-300">{o.id}</span>
                  <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {(o as any).distanceFromRiderKm.toFixed(1)} km away
                  </span>
                </div>
                <div className="text-sm text-slate-100">
                  <Truck className="w-3.5 h-3.5 inline mr-1 text-[#FF6B00]" />
                  Pickup: <span className="font-bold">{o.pickupBranchName}</span>
                </div>
                <div className="text-sm text-slate-300">
                  Deliver to: {o.deliveryCity || o.deliveryAddressLine}
                  {o.deliveryLandmark ? ` (${o.deliveryLandmark})` : ''}
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="uppercase">{o.loadSizeTier} / {o.rideTypeRequirement}</span>
                  <span className="uppercase">{o.routeClass} • {o.distanceKm.toFixed(1)}km route</span>
                </div>
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 font-mono">
                  <span className="text-[10px] text-slate-500 uppercase">Fare</span>
                  <span className="font-bold text-emerald-400">
                    {o.fareAmount != null ? `${o.fareCurrency ?? ''} ${o.fareAmount.toFixed(2)}` : 'Not yet available'}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAccept(o)}
                    isLoading={acceptingId === o.id}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Accept
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReject(o.id)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
