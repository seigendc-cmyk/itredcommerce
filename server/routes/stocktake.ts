import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToSession(row: any, lineRows: any[]) {
  return {
    id: row.id,
    sessionNumber: row.session_number,
    title: row.title,
    locationId: row.location_id,
    locationType: row.location_type,
    locationName: row.location_name,
    departmentFilter: row.department_filter,
    isBlindCount: !!row.is_blind_count,
    status: row.status,
    createdByStaffId: row.created_by_staff_id,
    createdByStaffName: row.created_by_staff_name,
    createdDateTime: row.created_date_time,
    completedDateTime: row.completed_date_time,
    totalExpectedUnits: row.total_expected_units,
    totalCountedUnits: row.total_counted_units,
    totalVarianceUnits: row.total_variance_units,
    totalVarianceValuation: row.total_variance_valuation,
    approvalRequired: !!row.approval_required,
    approvedByStaffName: row.approved_by_staff_name,
    approvedDateTime: row.approved_date_time,
    approvalNotes: row.approval_notes,
    notes: row.notes,
    items: lineRows.map((r) => ({
      sku: r.sku,
      barcode: r.barcode,
      name: r.name,
      category: r.category,
      binLocation: r.bin_location,
      unitCost: r.unit_cost,
      retailPrice: r.retail_price,
      bookQty: r.book_qty,
      countedQty: r.counted_qty,
      varianceQty: r.variance_qty,
      varianceValuation: r.variance_valuation,
      reasonCode: r.reason_code,
      notes: r.notes,
      lastCountedTimestamp: r.last_counted_timestamp,
      countedByStaffName: r.counted_by_staff_name,
      exceptionId: r.exception_id,
    })),
  };
}

function loadSession(id: string) {
  const row = db.prepare('SELECT * FROM stocktake_sessions WHERE id = ?').get(id) as any;
  if (!row) return null;
  const lines = db.prepare('SELECT * FROM stocktake_lines WHERE session_id = ?').all(id) as any[];
  return rowToSession(row, lines);
}

router.get(
  '/sessions',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM stocktake_sessions ORDER BY created_date_time DESC').all() as any[];
    const lines = db.prepare('SELECT * FROM stocktake_lines').all() as any[];
    const linesBySession = new Map<string, any[]>();
    for (const l of lines) {
      if (!linesBySession.has(l.session_id)) linesBySession.set(l.session_id, []);
      linesBySession.get(l.session_id)!.push(l);
    }
    res.json(rows.map((r) => rowToSession(r, linesBySession.get(r.id) ?? [])));
  })
);

interface SessionBody {
  id: string;
  sessionNumber?: string;
  title: string;
  locationId?: string;
  locationType?: string;
  locationName?: string;
  departmentFilter?: string;
  isBlindCount?: boolean;
  status?: string;
  approvalRequired?: boolean;
  notes?: string;
  items: Array<{ sku: string; barcode?: string; name: string; category?: string; unitCost: number; retailPrice: number; bookQty: number }>;
}

// Trusts client-generated id, same precedent as sales.ts's checkout.
router.post(
  '/sessions',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const session = req.body as SessionBody;
    if (!session?.id || !Array.isArray(session.items) || session.items.length === 0) {
      throw new ApiError(400, 'id and a non-empty items array are required');
    }

    const staff = req.currentStaff!;
    const createdDateTime = nowIso();
    const totalExpectedUnits = session.items.reduce((sum, i) => sum + i.bookQty, 0);

    try {
      applyBatchWithOutbox({
        db,
        tenantId: null,
        apply: () => {
          const entries: BatchEntry[] = [];
          db.prepare(
            `INSERT INTO stocktake_sessions (id, session_number, title, location_id, location_type, location_name, department_filter, is_blind_count, status, created_by_staff_id, created_by_staff_name, created_date_time, total_expected_units, approval_required, notes)
             VALUES (@id, @sessionNumber, @title, @locationId, @locationType, @locationName, @departmentFilter, @isBlindCount, 'COUNTING', @staffId, @staffName, @createdDateTime, @totalExpectedUnits, @approvalRequired, @notes)`
          ).run({
            id: session.id,
            sessionNumber: session.sessionNumber ?? null,
            title: session.title,
            locationId: session.locationId ?? null,
            locationType: session.locationType ?? null,
            locationName: session.locationName ?? null,
            departmentFilter: session.departmentFilter ?? null,
            isBlindCount: session.isBlindCount ? 1 : 0,
            staffId: staff.id,
            staffName: staff.name,
            createdDateTime,
            totalExpectedUnits,
            approvalRequired: session.approvalRequired ? 1 : 0,
            notes: session.notes ?? null,
          });
          entries.push({ table: 'stocktake_sessions', pkColumn: 'id', pk: session.id, operation: 'INSERT', payload: session as unknown as Record<string, unknown> });

          const lineStmt = db.prepare(
            `INSERT INTO stocktake_lines (session_id, sku, barcode, name, category, unit_cost, retail_price, book_qty, counted_qty, variance_qty)
             VALUES (@sessionId, @sku, @barcode, @name, @category, @unitCost, @retailPrice, @bookQty, NULL, 0)`
          );
          for (const item of session.items) {
            lineStmt.run({
              sessionId: session.id,
              sku: item.sku,
              barcode: item.barcode ?? null,
              name: item.name,
              category: item.category ?? null,
              unitCost: item.unitCost,
              retailPrice: item.retailPrice,
              bookQty: item.bookQty,
            });
            const lineId = String(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
            entries.push({ table: 'stocktake_lines', pkColumn: 'id', pk: lineId, operation: 'INSERT', payload: { ...item, sessionId: session.id } });
          }

          const evtId = generateId('EVT');
          db.prepare(
            `INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, reference_document, quantity)
             VALUES (@id, 'STOCKTAKE_STARTED', @timestamp, @description, @staffId, @staffName, @referenceDocument, @quantity)`
          ).run({
            id: evtId,
            timestamp: createdDateTime,
            description: `Stocktake session #${session.sessionNumber ?? session.id} initiated for ${session.items.length} items by ${staff.name}.`,
            staffId: staff.id,
            staffName: staff.name,
            referenceDocument: session.sessionNumber ?? session.id,
            quantity: session.items.length,
          });
          entries.push({ table: 'activity_events', pkColumn: 'id', pk: evtId, operation: 'INSERT', payload: { id: evtId } });

          return { result: undefined, entries };
        },
      });
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('stocktake_sessions')) {
        res.status(200).json(loadSession(session.id));
        return;
      }
      throw err;
    }

    res.status(201).json(loadSession(session.id));
  })
);

interface SessionSaveBody {
  status: string;
  approvedByStaffName?: string;
  approvedDateTime?: string;
  approvalNotes?: string;
  notes?: string;
  items: Array<{
    sku: string;
    countedQty: number | null;
    varianceQty?: number;
    varianceValuation?: number;
    reasonCode?: string;
    notes?: string;
    countedByStaffName?: string;
  }>;
}

// One "save the whole session" endpoint, mirroring StocktakeView's
// onSaveSession callback: it's invoked after every count entry and every
// non-POSTED status transition (COUNTING -> VARIANCE_REVIEW -> APPROVED ->
// CLOSED), always with the component's full recomputed session+items. This
// route persists count/variance/status fields wholesale rather than
// exposing granular per-line PATCH endpoints the component doesn't call.
// POSTED (the transition that actually mutates inventory) goes through
// /sessions/:id/post-adjustments instead, since that one needs its own
// atomic inventory-movement side effects.
router.put(
  '/sessions/:id',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const sessionRow = db.prepare('SELECT * FROM stocktake_sessions WHERE id = ?').get(req.params.id) as any;
    if (!sessionRow) throw new ApiError(404, 'Stocktake session not found');
    const body = req.body as SessionSaveBody;
    if (body.status === 'POSTED') {
      throw new ApiError(400, 'Use /sessions/:id/post-adjustments to transition a session to POSTED', 'USE_POST_ADJUSTMENTS');
    }

    const totalCountedUnits = body.items.reduce((sum, i) => sum + (i.countedQty ?? 0), 0);
    const totalVarianceUnits = body.items.reduce((sum, i) => sum + (i.varianceQty ?? 0), 0);
    const totalVarianceValuation = body.items.reduce((sum, i) => sum + (i.varianceValuation ?? 0), 0);

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `UPDATE stocktake_sessions SET status = ?, approved_by_staff_name = ?, approved_date_time = ?, approval_notes = ?, notes = ?, total_counted_units = ?, total_variance_units = ?, total_variance_valuation = ? WHERE id = ?`
        ).run(
          body.status,
          body.approvedByStaffName ?? sessionRow.approved_by_staff_name,
          body.approvedDateTime ?? sessionRow.approved_date_time,
          body.approvalNotes ?? sessionRow.approval_notes,
          body.notes ?? sessionRow.notes,
          totalCountedUnits,
          totalVarianceUnits,
          totalVarianceValuation,
          sessionRow.id
        );
        entries.push({ table: 'stocktake_sessions', pkColumn: 'id', pk: sessionRow.id, operation: 'UPDATE', payload: { id: sessionRow.id, status: body.status } });

        const lineStmt = db.prepare(
          `UPDATE stocktake_lines SET counted_qty = ?, variance_qty = ?, variance_valuation = ?, reason_code = ?, notes = ?, last_counted_timestamp = ?, counted_by_staff_name = ? WHERE session_id = ? AND sku = ?`
        );
        const now = nowIso();
        for (const item of body.items) {
          lineStmt.run(
            item.countedQty,
            item.varianceQty ?? 0,
            item.varianceValuation ?? 0,
            item.reasonCode ?? null,
            item.notes ?? null,
            item.countedQty !== null ? now : null,
            item.countedByStaffName ?? null,
            sessionRow.id,
            item.sku
          );
          entries.push({
            table: 'stocktake_lines',
            pkColumn: 'session_id',
            pk: `${sessionRow.id}:${item.sku}`,
            operation: 'UPDATE',
            payload: { sessionId: sessionRow.id, sku: item.sku, countedQty: item.countedQty },
          });
        }

        return { result: undefined, entries };
      },
    });

    res.json(loadSession(sessionRow.id));
  })
);

// Terminal transition: posts variance adjustments to real inventory
// (stock_on_hand + inventory_movements), atomically with marking the
// session POSTED — mirrors StocktakeView.onPostAdjustments /
// App.tsx's former handlePostStocktakeAdjustments.
router.post(
  '/sessions/:id/post-adjustments',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const sessionRow = db.prepare('SELECT * FROM stocktake_sessions WHERE id = ?').get(req.params.id) as any;
    if (!sessionRow) throw new ApiError(404, 'Stocktake session not found');
    if (sessionRow.status === 'POSTED' || sessionRow.status === 'CLOSED') {
      throw new ApiError(409, 'Session has already been posted', 'ALREADY_POSTED');
    }

    const lines = db.prepare('SELECT * FROM stocktake_lines WHERE session_id = ?').all(sessionRow.id) as any[];
    const staff = req.currentStaff!;
    const postTime = nowIso();

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `UPDATE stocktake_sessions SET status = 'POSTED', approved_by_staff_name = COALESCE(approved_by_staff_name, ?), approved_date_time = COALESCE(approved_date_time, ?), completed_date_time = ? WHERE id = ?`
        ).run(staff.name, postTime, postTime, sessionRow.id);
        entries.push({ table: 'stocktake_sessions', pkColumn: 'id', pk: sessionRow.id, operation: 'UPDATE', payload: { id: sessionRow.id, status: 'POSTED' } });

        const movStmt = db.prepare(
          `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, reference_document, staff_id, staff_name, notes)
           VALUES (@id, @timestamp, 'Stocktake Adjustment', @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @referenceDocument, @staffId, @staffName, @notes)`
        );

        for (const line of lines) {
          if (line.counted_qty === null || line.variance_qty === 0) continue;

          const movId = generateId('MOV');
          movStmt.run({
            id: movId,
            timestamp: postTime,
            sku: line.sku,
            itemName: line.name,
            quantity: line.variance_qty,
            unitCost: line.unit_cost,
            totalValue: line.variance_valuation,
            sourceLocationId: sessionRow.location_id,
            sourceLocationName: sessionRow.location_name,
            referenceDocument: sessionRow.session_number,
            staffId: staff.id,
            staffName: staff.name,
            notes: `Stocktake ${sessionRow.session_number} variance reconciliation.`,
          });
          entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId } });

          const item = db.prepare('SELECT reorder_level FROM inventory_items WHERE sku = ?').get(line.sku) as any;
          const newStatus = !item ? undefined : line.counted_qty <= 0 ? 'Out of Stock' : line.counted_qty <= item.reorder_level ? 'Low Stock' : 'In Stock';
          db.prepare('UPDATE inventory_items SET stock_on_hand = ?, status = COALESCE(?, status), last_updated = ? WHERE sku = ?').run(
            line.counted_qty,
            newStatus ?? null,
            postTime,
            line.sku
          );
          entries.push({ table: 'inventory_items', pkColumn: 'sku', pk: line.sku, operation: 'UPDATE', payload: { sku: line.sku, stockOnHand: line.counted_qty } });
        }

        const evtId = generateId('EVT');
        db.prepare(
          `INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, reference_document, quantity)
           VALUES (@id, 'STOCKTAKE_COMPLETED', @timestamp, @description, @staffId, @staffName, @referenceDocument, @quantity)`
        ).run({
          id: evtId,
          timestamp: postTime,
          description: `Stocktake session #${sessionRow.session_number} posted by ${staff.name}.`,
          staffId: staff.id,
          staffName: staff.name,
          referenceDocument: sessionRow.session_number,
          quantity: sessionRow.total_variance_units,
        });
        entries.push({ table: 'activity_events', pkColumn: 'id', pk: evtId, operation: 'INSERT', payload: { id: evtId } });

        return { result: undefined, entries };
      },
    });

    res.json(loadSession(sessionRow.id));
  })
);

export default router;
