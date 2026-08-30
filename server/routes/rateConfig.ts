import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { applyWithOutbox } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToRate(row: any) {
  return {
    id: row.id,
    version: row.version,
    currency: row.currency,
    baseFee: row.base_fee,
    perKmRate: row.per_km_rate,
    loadSizeSurchargeTiers: JSON.parse(row.load_size_surcharge_tiers || '[]'),
    rideTypeMultipliers: JSON.parse(row.ride_type_multipliers || '{}'),
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
  loadSizeSurchargeTiers: Array<{ label: string; maxWeightKg: number | null; surcharge: number }>;
  rideTypeMultipliers: Record<string, number>;
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
    if (!Array.isArray(body.loadSizeSurchargeTiers)) throw new ApiError(400, 'loadSizeSurchargeTiers must be an array');
    if (typeof body.rideTypeMultipliers !== 'object' || body.rideTypeMultipliers === null || Array.isArray(body.rideTypeMultipliers)) {
      throw new ApiError(400, 'rideTypeMultipliers must be an object');
    }
    if (!body.effectiveDate) throw new ApiError(400, 'effectiveDate is required');

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
          `INSERT INTO rate_config (id, version, currency, base_fee, per_km_rate, load_size_surcharge_tiers, ride_type_multipliers, effective_date, created_by_staff_id, created_by_staff_name, created_at, notes)
           VALUES (@id, @version, @currency, @baseFee, @perKmRate, @loadSizeSurchargeTiers, @rideTypeMultipliers, @effectiveDate, @createdByStaffId, @createdByStaffName, @createdAt, @notes)`
        ).run({
          id,
          version,
          currency: body.currency ?? 'USD',
          baseFee: body.baseFee,
          perKmRate: body.perKmRate,
          loadSizeSurchargeTiers: JSON.stringify(body.loadSizeSurchargeTiers),
          rideTypeMultipliers: JSON.stringify(body.rideTypeMultipliers),
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
