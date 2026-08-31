import { supabase } from './supabaseClient';
import { env } from './env';
import type { DeliveryOrder } from '@shared/types';

function rowToDeliveryOrder(row: any): DeliveryOrder {
  return {
    id: row.id,
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    pickupBranchId: row.pickup_branch_id,
    pickupBranchName: row.pickup_branch_name,
    deliveryAddressLine: row.delivery_address_line,
    deliveryCity: row.delivery_city,
    deliveryLandmark: row.delivery_landmark,
    deliveryLatitude: row.delivery_latitude,
    deliveryLongitude: row.delivery_longitude,
    deliveryContactName: row.delivery_contact_name,
    deliveryContactPhone: row.delivery_contact_phone,
    loadSizeTier: row.load_size_tier,
    rideTypeRequirement: row.ride_type_requirement,
    distanceKm: row.distance_km,
    routeClass: row.route_class,
    fareAmount: row.fare_amount,
    fareCurrency: row.fare_currency,
    fareRateConfigVersion: row.fare_rate_config_version,
    status: row.status,
    confirmationCode: row.confirmation_code,
    confirmationCodeExpiresAt: row.confirmation_code_expires_at,
    confirmationCodeAttemptCount: row.confirmation_code_attempt_count,
    riderId: row.rider_id,
    createdByStaffId: row.created_by_staff_id,
    createdByStaffName: row.created_by_staff_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // pickup_latitude/pickup_longitude exist on the row but aren't part of
    // the shared DeliveryOrder type (Prompt 7 kept them server-internal) —
    // exposed separately by fetchPostedOrders for the proximity filter.
  } as DeliveryOrder;
}

export interface PostedOrderWithPickup extends DeliveryOrder {
  pickupLatitude: number;
  pickupLongitude: number;
}

/** The rider's own riders-table row id, not their staff id — resolved once at sign-in. */
export async function fetchOwnRiderId(staffId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('riders')
    .select('id')
    .eq('tenant_id', env.tenantId)
    .eq('staff_id', staffId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function fetchPostedOrders(): Promise<PostedOrderWithPickup[]> {
  const { data, error } = await supabase
    .from('delivery_orders')
    .select('*')
    .eq('tenant_id', env.tenantId)
    .eq('status', 'posted')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...rowToDeliveryOrder(row), pickupLatitude: row.pickup_latitude, pickupLongitude: row.pickup_longitude }));
}

/** The rider's own currently in-progress order, if any (accepted/in_transit/under_investigation). */
export async function fetchActiveOrder(riderId: string): Promise<DeliveryOrder | null> {
  const { data, error } = await supabase
    .from('delivery_orders')
    .select('*')
    .eq('tenant_id', env.tenantId)
    .eq('rider_id', riderId)
    .in('status', ['accepted', 'in_transit', 'under_investigation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDeliveryOrder(data) : null;
}

export type AcceptOutcome = { outcome: 'ACCEPTED'; order: DeliveryOrder } | { outcome: 'ALREADY_TAKEN' };

/**
 * Conditional update — RLS (delivery_orders_rider_accept) only allows this
 * to succeed when the row is still status='posted' and unclaimed at the
 * moment the UPDATE actually runs; an empty result means another rider won
 * the race (classic optimistic-concurrency pattern, no explicit locking
 * needed client-side).
 */
export async function acceptOrder(orderId: string, riderId: string): Promise<AcceptOutcome> {
  const { data, error } = await supabase
    .from('delivery_orders')
    .update({ status: 'accepted', rider_id: riderId })
    .eq('tenant_id', env.tenantId)
    .eq('id', orderId)
    .eq('status', 'posted')
    .is('rider_id', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return { outcome: 'ALREADY_TAKEN' };
  return { outcome: 'ACCEPTED', order: rowToDeliveryOrder(data) };
}

export async function markInTransit(orderId: string, riderId: string): Promise<DeliveryOrder> {
  const { data, error } = await supabase
    .from('delivery_orders')
    .update({ status: 'in_transit' })
    .eq('tenant_id', env.tenantId)
    .eq('id', orderId)
    .eq('status', 'accepted')
    .eq('rider_id', riderId)
    .select()
    .single();
  if (error) throw error;
  return rowToDeliveryOrder(data);
}

export interface VerifyCodeResult {
  status: 'OK' | 'INVALID' | 'LOCKED_OUT' | 'EXPIRED' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATE';
  message: string;
  attemptsRemaining: number | null;
}

/** The one place a confirmation code is ever compared — see the RPC's own
 * header comment in supabase/migrations/20260831140000_rider_pwa.sql. */
export async function verifyDeliveryCode(orderId: string, code: string): Promise<VerifyCodeResult> {
  const { data, error } = await supabase.rpc('verify_delivery_code', {
    p_tenant_id: env.tenantId,
    p_order_id: orderId,
    p_code: code,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { status: row.status, message: row.message, attemptsRemaining: row.attempts_remaining };
}

export async function updateAvailability(riderId: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase
    .from('riders')
    .update({ is_available: isAvailable })
    .eq('tenant_id', env.tenantId)
    .eq('id', riderId);
  if (error) throw error;
}

export async function updateLocation(riderId: string, lat: number, lon: number): Promise<void> {
  const { error } = await supabase
    .from('riders')
    .update({ current_latitude: lat, current_longitude: lon, location_updated_at: new Date().toISOString() })
    .eq('tenant_id', env.tenantId)
    .eq('id', riderId);
  if (error) throw error;
}
