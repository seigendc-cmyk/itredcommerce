import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { applyWithOutbox } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

const LOAD_SIZE_TIERS = ['small', 'medium', 'large'] as const;
const RIDE_TYPES = ['bicycle', 'motorbike', 'car', 'van'] as const;

function rowToRate(row: any) {
  return {
    id: row.id,
    version: row.version,
    currency: row.currency,
    baseFee: row.base_fee,
    perKmRate: row.per_km_rate,
    useSeparateIntercityRate: !!row.use_separate_intercity_rate,
    perKmRateIntercity: row.per_km_rate_intercity,
    // Renamed from the pre-Prompt-7 weight-band array shape to a flat map
    // keyed by the now-confirmed load-size taxonomy (small/medium/large) —
    // the underlying column is unchanged (JSON text), only its shape.
    loadSizeSurcharges: JSON.parse(row.load_size_surcharge_tiers || '{}'),
    rideTypeMultipliers: JSON.parse(row.ride_type_multipliers || '{}'),
    isMultiCurrency: !!row.is_multi_currency,
    settlementCurrency: row.settlement_currency,
    exchangeRateToSettlement: row.exchange_rate_to_settlement,
    effectiveDate: row.effective_date,
    createdByStaffId: row.created_by_staff_id,
    createdByStaffName: row.created_by_staff_name,
    createdAt: row.created_at,
    notes: row.notes,
  };
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM rate_config ORDER BY version DESC').all() as any[];
    res.json(rows.map(rowToRate));
  })
);

router.get(
  '/active',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const row = db.prepare('SELECT * FROM rate_config ORDER BY version DESC LIMIT 1').get() as any;
    res.json(row ? rowToRate(row) : null);
  })
);

interface PublishBody {
  currency?: string;
  baseFee: number;
  perKmRate: number;
  useSeparateIntercityRate?: boolean;
  perKmRateIntercity?: number | null;
  loadSizeSurcharges: Record<string, number>;
  rideTypeMultipliers: Record<string, number>;
  isMultiCurrency?: boolean;
  settlementCurrency?: string | null;
  exchangeRateToSettlement?: number | null;
  effectiveDate: string;
  notes?: string;
}

// Publishes a new rate version — always an INSERT, never an UPDATE (DL-004:
// past versions must never be retroactively mutated). version is computed
// inside the outbox transaction so two concurrent publishes can't race to
// the same version number.
router.post(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const body = req.body as PublishBody;
    if (typeof body?.baseFee !== 'number' || body.baseFee < 0) throw new ApiError(400, 'baseFee must be a non-negative number');
    if (typeof body.perKmRate !== 'number' || body.perKmRate < 0) throw new ApiError(400, 'perKmRate must be a non-negative number');
    if (typeof body.loadSizeSurcharges !== 'object' || body.loadSizeSurcharges === null || Array.isArray(body.loadSizeSurcharges)) {
      throw new ApiError(400, 'loadSizeSurcharges must be an object');
    }
    for (const tier of LOAD_SIZE_TIERS) {
      if (typeof body.loadSizeSurcharges[tier] !== 'number' || body.loadSizeSurcharges[tier] < 0) {
        throw new ApiError(400, `loadSizeSurcharges.${tier} must be a non-negative number`);
      }
    }
    if (typeof body.rideTypeMultipliers !== 'object' || body.rideTypeMultipliers === null || Array.isArray(body.rideTypeMultipliers)) {
      throw new ApiError(400, 'rideTypeMultipliers must be an object');
    }
    for (const type of RIDE_TYPES) {
      if (typeof body.rideTypeMultipliers[type] !== 'number' || body.rideTypeMultipliers[type] < 0) {
        throw new ApiError(400, `rideTypeMultipliers.${type} must be a non-negative number`);
      }
    }
    if (!body.effectiveDate) throw new ApiError(400, 'effectiveDate is required');

    const useSeparateIntercityRate = !!body.useSeparateIntercityRate;
    if (useSeparateIntercityRate && (typeof body.perKmRateIntercity !== 'number' || body.perKmRateIntercity < 0)) {
      throw new ApiError(400, 'perKmRateIntercity must be a non-negative number when useSeparateIntercityRate is enabled');
    }

    const isMultiCurrency = !!body.isMultiCurrency;
    if (isMultiCurrency) {
      if (!body.settlementCurrency?.trim()) throw new ApiError(400, 'settlementCurrency is required when isMultiCurrency is enabled');
      if (typeof body.exchangeRateToSettlement !== 'number' || body.exchangeRateToSettlement <= 0) {
        throw new ApiError(400, 'exchangeRateToSettlement must be a positive number when isMultiCurrency is enabled');
      }
    }

    const staff = req.currentStaff!;
    const id = generateId('RATE');
    const createdAt = nowIso();

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'rate_config',
      pkColumn: 'id',
      pk: id,
      operation: 'INSERT',
      payload: { id, ...body },
      apply: () => {
        const { version } = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM rate_config').get() as { version: number };
        db.prepare(
          `INSERT INTO rate_config (
            id, version, currency, base_fee, per_km_rate, use_separate_intercity_rate, per_km_rate_intercity,
            load_size_surcharge_tiers, ride_type_multipliers, is_multi_currency, settlement_currency,
            exchange_rate_to_settlement, effective_date, created_by_staff_id, created_by_staff_name, created_at, notes
          ) VALUES (
            @id, @version, @currency, @baseFee, @perKmRate, @useSeparateIntercityRate, @perKmRateIntercity,
            @loadSizeSurcharges, @rideTypeMultipliers, @isMultiCurrency, @settlementCurrency,
            @exchangeRateToSettlement, @effectiveDate, @createdByStaffId, @createdByStaffName, @createdAt, @notes
          )`
        ).run({
          id,
          version,
          currency: body.currency ?? 'USD',
          baseFee: body.baseFee,
          perKmRate: body.perKmRate,
          useSeparateIntercityRate: useSeparateIntercityRate ? 1 : 0,
          perKmRateIntercity: useSeparateIntercityRate ? body.perKmRateIntercity : null,
          loadSizeSurcharges: JSON.stringify(body.loadSizeSurcharges),
          rideTypeMultipliers: JSON.stringify(body.rideTypeMultipliers),
          isMultiCurrency: isMultiCurrency ? 1 : 0,
          settlementCurrency: isMultiCurrency ? body.settlementCurrency!.trim() : null,
          exchangeRateToSettlement: isMultiCurrency ? body.exchangeRateToSettlement : null,
          effectiveDate: body.effectiveDate,
          createdByStaffId: staff.id,
          createdByStaffName: staff.name,
          createdAt,
          notes: body.notes ?? null,
        });
      },
    });

    const row = db.prepare('SELECT * FROM rate_config WHERE id = ?').get(id);
    res.status(201).json(rowToRate(row));
  })
);

export default router;
