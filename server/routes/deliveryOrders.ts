import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { generateId } from '../lib/ids';
import { haversineDistanceKm, classifyRoute, isValidCoordinate } from '../lib/geo';
import { generateConfirmationCode, confirmationCodeExpiryHours } from '../lib/deliveryCode';
import { calculateFare, type FareRateConfig } from '../lib/fareEngine';
import { connectivityMonitor } from '../sync/connectivityInstance';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { isSupabaseConfigured, env } from '../env';

const router = Router();
router.use(requireAuth);

const LOAD_SIZE_TIERS = ['small', 'medium', 'large'] as const;
const RIDE_TYPES = ['bicycle', 'motorbike', 'car', 'van'] as const;

// A dispatch that already reached one of these has genuinely finished its
// lifecycle; only an order in none of these states counts as "already has
// an active delivery" for the one-active-dispatch-per-sale guard below.
const TERMINAL_DELIVERY_STATUSES = ['delivered', 'failed', 'cancelled'];

// Reads the current active rate_config version straight from local SQLite
// (Prompt 4's DL-007 category-1 ledger, already synced via the normal
// outbox path) — the fare engine never reads "the current rate" implicitly
// itself, so this is the one place that selection happens, right before
// the version it picked gets locked onto the new dispatch.
function loadActiveRateConfig(): FareRateConfig | null {
  const row = db.prepare('SELECT * FROM rate_config ORDER BY version DESC LIMIT 1').get() as any;
  if (!row) return null;
  return {
    version: row.version,
    currency: row.currency,
    baseFee: row.base_fee,
    perKmRate: row.per_km_rate,
    useSeparateIntercityRate: !!row.use_separate_intercity_rate,
    perKmRateIntercity: row.per_km_rate_intercity,
    loadSizeSurcharges: JSON.parse(row.load_size_surcharge_tiers || '{}'),
    rideTypeMultipliers: JSON.parse(row.ride_type_multipliers || '{}'),
    isMultiCurrency: !!row.is_multi_currency,
    settlementCurrency: row.settlement_currency,
    exchangeRateToSettlement: row.exchange_rate_to_settlement,
  };
}

function rowToDeliveryOrder(row: any) {
  return {
    id: row.id,
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    pickupBranchId: row.pickup_branch_id,
    pickupBranchName: row.pickup_branch_name,
    pickupLatitude: row.pickup_latitude,
    pickupLongitude: row.pickup_longitude,
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
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM delivery_orders ORDER BY created_at DESC').all() as any[];
    res.json(rows.map(rowToDeliveryOrder));
  })
);

// Lookup for the dispatch-creation form: confirms the sale exists, is
// completed, and isn't already covered by an active delivery order.
router.get(
  '/sale/:saleNumber',
  asyncHandler(async (req, res) => {
    const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_number = ?').get(req.params.saleNumber) as any;
    if (!saleRow) throw new ApiError(404, 'Sale not found');
    if (saleRow.status !== 'COMPLETED') {
      throw new ApiError(400, 'Delivery dispatch can only be created for a completed sale', 'SALE_NOT_COMPLETED');
    }

    const existing = db
      .prepare('SELECT id, status FROM delivery_orders WHERE sale_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(saleRow.sale_id) as { id: string; status: string } | undefined;
    const hasActiveDelivery = !!existing && !TERMINAL_DELIVERY_STATUSES.includes(existing.status);

    res.json({
      saleId: saleRow.sale_id,
      saleNumber: saleRow.sale_number,
      customerName: saleRow.customer_name,
      branchId: saleRow.branch_id,
      branchName: saleRow.branch_name,
      grandTotal: saleRow.grand_total,
      existingDeliveryOrderId: existing?.id ?? null,
      hasActiveDelivery,
    });
  })
);

interface CreateDeliveryOrderBody {
  saleNumber?: string;
  deliveryAddressLine?: string;
  deliveryCity?: string;
  deliveryLandmark?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  loadSizeTier?: string;
  rideTypeRequirement?: string;
  // Pickup coordinates travel with the client's Branch record rather than
  // being looked up server-side — branches have no persisted geocoded row
  // in this codebase yet (see the migration's header comment).
  pickupLatitude?: number;
  pickupLongitude?: number;
}

router.post(
  '/',
  requireAccessRole('TILL_OPERATOR', 'HEAD_OFFICE_STAFF', 'PLATFORM_SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateDeliveryOrderBody;
    const staff = req.currentStaff!;

    const saleNumber = body.saleNumber?.trim();
    if (!saleNumber) throw new ApiError(400, 'saleNumber is required');
    if (!body.deliveryAddressLine?.trim()) throw new ApiError(400, 'deliveryAddressLine is required');
    if (!body.loadSizeTier || !LOAD_SIZE_TIERS.includes(body.loadSizeTier as any)) {
      throw new ApiError(400, `loadSizeTier must be one of: ${LOAD_SIZE_TIERS.join(', ')}`);
    }
    if (!body.rideTypeRequirement || !RIDE_TYPES.includes(body.rideTypeRequirement as any)) {
      throw new ApiError(400, `rideTypeRequirement must be one of: ${RIDE_TYPES.join(', ')}`);
    }
    if (!isValidCoordinate(body.deliveryLatitude, body.deliveryLongitude)) {
      throw new ApiError(400, 'A valid deliveryLatitude/deliveryLongitude is required to calculate the delivery route');
    }
    if (!isValidCoordinate(body.pickupLatitude, body.pickupLongitude)) {
      throw new ApiError(
        400,
        'This branch has no geocoded pickup coordinates configured — set them before creating a delivery dispatch',
        'PICKUP_COORDINATES_MISSING'
      );
    }

    // DL-008: delivery orders are never queued in the outbox for later
    // creation — the "create delivery" CTA is disabled client-side while
    // offline, and this is the server-side backstop for that same rule.
    // Re-probed live here rather than trusting the last poll, since the
    // decision is irreversible once a confirmation code is issued.
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, 'Delivery dispatch requires a configured connection to the central system', 'OFFLINE');
    }
    const connectivityState = await connectivityMonitor.checkNow();
    if (connectivityState !== 'ONLINE') {
      throw new ApiError(503, 'Delivery dispatch requires an active connection — try again once connectivity is restored', 'OFFLINE');
    }

    const saleRow = db.prepare('SELECT * FROM sales_transactions WHERE sale_number = ?').get(saleNumber) as any;
    if (!saleRow) throw new ApiError(404, 'Sale not found');
    if (saleRow.status !== 'COMPLETED') {
      throw new ApiError(400, 'Delivery dispatch can only be created for a completed sale', 'SALE_NOT_COMPLETED');
    }

    const existing = db
      .prepare('SELECT id, status FROM delivery_orders WHERE sale_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(saleRow.sale_id) as { id: string; status: string } | undefined;
    if (existing && !TERMINAL_DELIVERY_STATUSES.includes(existing.status)) {
      throw new ApiError(409, `Sale ${saleNumber} already has an active delivery order (${existing.id})`, 'DELIVERY_ALREADY_EXISTS');
    }

    const distanceKm = haversineDistanceKm(
      body.pickupLatitude as number,
      body.pickupLongitude as number,
      body.deliveryLatitude as number,
      body.deliveryLongitude as number
    );
    const routeClass = classifyRoute(distanceKm);
    const expiryHours = confirmationCodeExpiryHours(routeClass);

    // Graceful degradation, not a hard block: a fresh install with no
    // published rate_config yet (see server/db/seed.ts's placeholder v1
    // row for the normal case) shouldn't be unable to dispatch deliveries
    // at all — it just means fareAmount stays null until a vendor
    // publishes rates in Settings, exactly like Prompt 7 already allowed.
    const activeRateConfig = loadActiveRateConfig();
    const fareResult = activeRateConfig
      ? calculateFare(activeRateConfig, {
          distanceKm,
          routeClass,
          // Already validated against LOAD_SIZE_TIERS/RIDE_TYPES above.
          loadSizeTier: body.loadSizeTier as any,
          rideTypeRequirement: body.rideTypeRequirement as any,
        })
      : null;

    const id = generateId('DO');
    const now = new Date();
    const nowIsoTimestamp = now.toISOString();
    const confirmationCode = generateConfirmationCode();
    const confirmationCodeExpiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();

    const supabasePayload = {
      id,
      tenant_id: env.tenantId,
      sale_id: saleRow.sale_id,
      sale_number: saleRow.sale_number,
      pickup_branch_id: saleRow.branch_id,
      pickup_branch_name: saleRow.branch_name,
      pickup_latitude: body.pickupLatitude,
      pickup_longitude: body.pickupLongitude,
      delivery_address_line: body.deliveryAddressLine.trim(),
      delivery_city: body.deliveryCity?.trim() || null,
      delivery_landmark: body.deliveryLandmark?.trim() || null,
      delivery_latitude: body.deliveryLatitude,
      delivery_longitude: body.deliveryLongitude,
      delivery_contact_name: body.deliveryContactName?.trim() || null,
      delivery_contact_phone: body.deliveryContactPhone?.trim() || null,
      load_size_tier: body.loadSizeTier,
      ride_type_requirement: body.rideTypeRequirement,
      distance_km: distanceKm,
      route_class: routeClass,
      fare_amount: fareResult?.fareAmount ?? null,
      fare_currency: fareResult?.fareCurrency ?? null,
      fare_rate_config_version: fareResult?.rateConfigVersion ?? null,
      status: 'posted',
      confirmation_code: confirmationCode,
      confirmation_code_expires_at: confirmationCodeExpiresAt,
      confirmation_code_attempt_count: 0,
      created_by_staff_id: staff.id,
      created_by_staff_name: staff.name,
    };

    // Direct, synchronous write to Supabase (service-role client) — this
    // table is deliberately not routed through applyWithOutbox (see
    // server/db/migrations/006_delivery_orders.sql's header comment).
    const supabase = getSupabaseAdmin()!;
    const { error: supabaseError } = await supabase.from('delivery_orders').insert(supabasePayload);
    if (supabaseError) {
      console.error('[deliveryOrders] Supabase insert failed:', supabaseError);
      throw new ApiError(502, 'Failed to create delivery dispatch in the central system — nothing was saved locally', 'DISPATCH_SYNC_FAILED');
    }

    // Local mirror, written only after the Supabase write already
    // succeeded — a failure here is a display-cache problem, not a
    // correctness one, since Supabase is the source of truth for dispatch.
    try {
      db.prepare(
        `INSERT INTO delivery_orders (
          id, sale_id, sale_number, pickup_branch_id, pickup_branch_name, pickup_latitude, pickup_longitude,
          delivery_address_line, delivery_city, delivery_landmark, delivery_latitude, delivery_longitude,
          delivery_contact_name, delivery_contact_phone, load_size_tier, ride_type_requirement,
          distance_km, route_class, fare_amount, fare_currency, fare_rate_config_version, status,
          confirmation_code, confirmation_code_expires_at, confirmation_code_attempt_count, rider_id,
          created_by_staff_id, created_by_staff_name, origin_terminal_id, created_at, updated_at
        ) VALUES (
          @id, @saleId, @saleNumber, @pickupBranchId, @pickupBranchName, @pickupLatitude, @pickupLongitude,
          @deliveryAddressLine, @deliveryCity, @deliveryLandmark, @deliveryLatitude, @deliveryLongitude,
          @deliveryContactName, @deliveryContactPhone, @loadSizeTier, @rideTypeRequirement,
          @distanceKm, @routeClass, @fareAmount, @fareCurrency, @fareRateConfigVersion, @status,
          @confirmationCode, @confirmationCodeExpiresAt, 0, NULL,
          @createdByStaffId, @createdByStaffName, NULL, @createdAt, @updatedAt
        )`
      ).run({
        id,
        saleId: saleRow.sale_id,
        saleNumber: saleRow.sale_number,
        pickupBranchId: saleRow.branch_id,
        pickupBranchName: saleRow.branch_name,
        pickupLatitude: body.pickupLatitude,
        pickupLongitude: body.pickupLongitude,
        deliveryAddressLine: body.deliveryAddressLine.trim(),
        deliveryCity: body.deliveryCity?.trim() || null,
        deliveryLandmark: body.deliveryLandmark?.trim() || null,
        deliveryLatitude: body.deliveryLatitude,
        deliveryLongitude: body.deliveryLongitude,
        deliveryContactName: body.deliveryContactName?.trim() || null,
        deliveryContactPhone: body.deliveryContactPhone?.trim() || null,
        loadSizeTier: body.loadSizeTier,
        rideTypeRequirement: body.rideTypeRequirement,
        distanceKm,
        routeClass,
        fareAmount: fareResult?.fareAmount ?? null,
        fareCurrency: fareResult?.fareCurrency ?? null,
        fareRateConfigVersion: fareResult?.rateConfigVersion ?? null,
        status: 'posted',
        confirmationCode,
        confirmationCodeExpiresAt,
        createdByStaffId: staff.id,
        createdByStaffName: staff.name,
        createdAt: nowIsoTimestamp,
        updatedAt: nowIsoTimestamp,
      });
    } catch (localErr) {
      console.error('[deliveryOrders] local mirror write failed after successful Supabase insert:', localErr);
    }

    res.status(201).json({
      id,
      saleId: saleRow.sale_id,
      saleNumber: saleRow.sale_number,
      pickupBranchId: saleRow.branch_id,
      pickupBranchName: saleRow.branch_name,
      deliveryAddressLine: body.deliveryAddressLine.trim(),
      deliveryCity: body.deliveryCity?.trim() || null,
      deliveryLandmark: body.deliveryLandmark?.trim() || null,
      deliveryLatitude: body.deliveryLatitude,
      deliveryLongitude: body.deliveryLongitude,
      deliveryContactName: body.deliveryContactName?.trim() || null,
      deliveryContactPhone: body.deliveryContactPhone?.trim() || null,
      loadSizeTier: body.loadSizeTier,
      rideTypeRequirement: body.rideTypeRequirement,
      distanceKm,
      routeClass,
      fareAmount: fareResult?.fareAmount ?? null,
      fareCurrency: fareResult?.fareCurrency ?? null,
      fareRateConfigVersion: fareResult?.rateConfigVersion ?? null,
      status: 'posted',
      confirmationCode,
      confirmationCodeExpiresAt,
      confirmationCodeAttemptCount: 0,
      riderId: null,
      createdByStaffId: staff.id,
      createdByStaffName: staff.name,
      createdAt: nowIsoTimestamp,
    });
  })
);

// Code-recovery path (Prompt 9's confirmed decision (a)): when a
// confirmation code is invalidated after 3 failed attempts
// (verify_delivery_code, supabase/migrations/20260831140000_rider_pwa.sql,
// flips the order to under_investigation), dispatch staff manually reissue
// a fresh code here and the same order reopens — same rider, same sale,
// new code/expiry, attempt count reset. It is NOT cancelled and does not
// go back to the broadcast board as a new job.
router.post(
  '/:id/reissue-code',
  requireAccessRole('TILL_OPERATOR', 'HEAD_OFFICE_STAFF', 'PLATFORM_SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id;
    const row = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(orderId) as any;
    if (!row) throw new ApiError(404, 'Delivery order not found');
    if (row.status !== 'under_investigation') {
      throw new ApiError(400, 'Only an order under investigation can have its code reissued', 'NOT_UNDER_INVESTIGATION');
    }

    // Same "never queue, must be live" reasoning as creation (DL-008/
    // DL-015) — reopening a delivery order the rider is still holding is
    // just as time-sensitive as creating one.
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, 'Reissuing a code requires a configured connection to the central system', 'OFFLINE');
    }
    const connectivityState = await connectivityMonitor.checkNow();
    if (connectivityState !== 'ONLINE') {
      throw new ApiError(503, 'Reissuing a code requires an active connection — try again once connectivity is restored', 'OFFLINE');
    }

    const now = new Date();
    const nowIsoTimestamp = now.toISOString();
    const newCode = generateConfirmationCode();
    const expiryHours = confirmationCodeExpiryHours(row.route_class);
    const newExpiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();

    const supabase = getSupabaseAdmin()!;
    const { error: supabaseError } = await supabase
      .from('delivery_orders')
      .update({
        status: 'accepted',
        confirmation_code: newCode,
        confirmation_code_expires_at: newExpiresAt,
        confirmation_code_attempt_count: 0,
        updated_at: nowIsoTimestamp,
      })
      .eq('id', orderId);
    if (supabaseError) {
      console.error('[deliveryOrders] reissue-code Supabase update failed:', supabaseError);
      throw new ApiError(502, 'Failed to reissue the code in the central system — nothing was changed locally', 'DISPATCH_SYNC_FAILED');
    }

    try {
      db.prepare(
        `UPDATE delivery_orders SET status = 'accepted', confirmation_code = ?, confirmation_code_expires_at = ?, confirmation_code_attempt_count = 0, updated_at = ? WHERE id = ?`
      ).run(newCode, newExpiresAt, nowIsoTimestamp, orderId);
    } catch (localErr) {
      console.error('[deliveryOrders] reissue-code local mirror write failed after successful Supabase update:', localErr);
    }

    res.json(rowToDeliveryOrder({ ...row, status: 'accepted', confirmation_code: newCode, confirmation_code_expires_at: newExpiresAt, confirmation_code_attempt_count: 0 }));
  })
);

export default router;
