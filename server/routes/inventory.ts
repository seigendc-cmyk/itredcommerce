import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId, nowIso } from '../lib/ids';
import { applyWithOutbox, applyBatchWithOutbox, type BatchEntry } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);

function rowToInventoryItem(row: any) {
  return {
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    department: row.department,
    category: row.category,
    unitOfMeasure: row.unit_of_measure,
    stockOnHand: row.stock_on_hand,
    reorderLevel: row.reorder_level,
    unitCost: row.unit_cost,
    retailPrice: row.retail_price,
    preferredSupplier: row.preferred_supplier,
    isActive: !!row.is_active,
    imageUrl: row.image_url,
    taxRate: row.tax_rate,
    status: row.status,
    location: row.location,
    partNumber: row.part_number,
    oemNumber: row.oem_number,
    customFields: JSON.parse(row.custom_fields || '{}'),
    lastUpdated: row.last_updated,
  };
}

// Read-only catalog for the sell/cart screen — "view products" per the
// branch-terminal app's restricted scope. Inventory management (CRUD,
// stocktake, transfers) belongs to the head-office app, not here.
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    // includeInactive: the head-office item-management view needs to see
    // and reactivate inactive/discontinued items; the till's sell screen
    // never should, so it omits the flag and gets the active-only default.
    const includeInactive = req.query.includeInactive === 'true';
    const rows = (
      includeInactive
        ? db.prepare('SELECT * FROM inventory_items ORDER BY name ASC').all()
        : db.prepare('SELECT * FROM inventory_items WHERE is_active = 1 ORDER BY name ASC').all()
    ) as any[];
    res.json(rows.map(rowToInventoryItem));
  })
);

router.get(
  '/items/:sku/movements',
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT * FROM inventory_movements WHERE sku = ? ORDER BY timestamp DESC LIMIT 500').all(req.params.sku) as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        movementType: r.movement_type,
        sku: r.sku,
        itemName: r.item_name,
        quantity: r.quantity,
        unitCost: r.unit_cost,
        totalValue: r.total_value,
        sourceLocationId: r.source_location_id,
        sourceLocationName: r.source_location_name,
        destinationLocationId: r.destination_location_id,
        destinationLocationName: r.destination_location_name,
        referenceDocument: r.reference_document,
        staffId: r.staff_id,
        staffName: r.staff_name,
        reasonCode: r.reason_code,
        notes: r.notes,
      }))
    );
  })
);

interface ItemBody {
  sku: string;
  barcode?: string;
  name?: string;
  description?: string;
  department?: string;
  category?: string;
  unitOfMeasure?: string;
  stockOnHand?: number;
  reorderLevel?: number;
  unitCost?: number;
  retailPrice?: number;
  preferredSupplier?: string;
  isActive?: boolean;
  imageUrl?: string;
  taxRate?: number;
  status?: string;
  location?: string;
  partNumber?: string;
  oemNumber?: string;
  customFields?: Record<string, unknown>;
}

function deriveStatus(stockOnHand: number, reorderLevel: number): string {
  return stockOnHand <= 0 ? 'Out of Stock' : stockOnHand <= reorderLevel ? 'Low Stock' : 'In Stock';
}

// Create (ProductMasterModal's "add new item" mode).
router.post(
  '/items',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const item = req.body as ItemBody;
    if (!item?.sku) throw new ApiError(400, 'sku is required');

    const lastUpdated = nowIso();
    applyWithOutbox({
      db,
      tenantId: null,
      table: 'inventory_items',
      pkColumn: 'sku',
      pk: item.sku,
      operation: 'INSERT',
      payload: item as unknown as Record<string, unknown>,
      apply: () => {
        db.prepare(
          `INSERT INTO inventory_items (sku, barcode, name, description, department, category, unit_of_measure, stock_on_hand, reorder_level, unit_cost, retail_price, preferred_supplier, is_active, image_url, tax_rate, status, location, part_number, oem_number, custom_fields, last_updated)
           VALUES (@sku, @barcode, @name, @description, @department, @category, @unitOfMeasure, @stockOnHand, @reorderLevel, @unitCost, @retailPrice, @preferredSupplier, @isActive, @imageUrl, @taxRate, @status, @location, @partNumber, @oemNumber, @customFields, @lastUpdated)`
        ).run({
          sku: item.sku,
          barcode: item.barcode ?? null,
          name: item.name ?? null,
          description: item.description ?? null,
          department: item.department ?? null,
          category: item.category ?? null,
          unitOfMeasure: item.unitOfMeasure ?? null,
          stockOnHand: item.stockOnHand ?? 0,
          reorderLevel: item.reorderLevel ?? 0,
          unitCost: item.unitCost ?? 0,
          retailPrice: item.retailPrice ?? 0,
          preferredSupplier: item.preferredSupplier ?? null,
          isActive: item.isActive === false ? 0 : 1,
          imageUrl: item.imageUrl ?? null,
          taxRate: item.taxRate ?? 0,
          status: item.status ?? deriveStatus(item.stockOnHand ?? 0, item.reorderLevel ?? 0),
          location: item.location ?? null,
          partNumber: item.partNumber ?? null,
          oemNumber: item.oemNumber ?? null,
          customFields: JSON.stringify(item.customFields ?? {}),
          lastUpdated,
        });
      },
    });

    const row = db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(item.sku);
    res.status(201).json(rowToInventoryItem(row));
  })
);

// Update (ProductMasterModal's edit mode, QuickPriceUpdateModal, toggle-active).
router.patch(
  '/items/:sku',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(req.params.sku) as any;
    if (!existing) throw new ApiError(404, 'Item not found');
    const item = req.body as Partial<ItemBody>;
    const lastUpdated = nowIso();

    const merged = {
      barcode: item.barcode ?? existing.barcode,
      name: item.name ?? existing.name,
      description: item.description ?? existing.description,
      department: item.department ?? existing.department,
      category: item.category ?? existing.category,
      unitOfMeasure: item.unitOfMeasure ?? existing.unit_of_measure,
      stockOnHand: item.stockOnHand ?? existing.stock_on_hand,
      reorderLevel: item.reorderLevel ?? existing.reorder_level,
      unitCost: item.unitCost ?? existing.unit_cost,
      retailPrice: item.retailPrice ?? existing.retail_price,
      preferredSupplier: item.preferredSupplier ?? existing.preferred_supplier,
      isActive: item.isActive === undefined ? !!existing.is_active : item.isActive,
      imageUrl: item.imageUrl ?? existing.image_url,
      taxRate: item.taxRate ?? existing.tax_rate,
      location: item.location ?? existing.location,
      partNumber: item.partNumber ?? existing.part_number,
      oemNumber: item.oemNumber ?? existing.oem_number,
      customFields: item.customFields ?? JSON.parse(existing.custom_fields || '{}'),
    };
    const status = item.status ?? deriveStatus(merged.stockOnHand, merged.reorderLevel);

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'inventory_items',
      pkColumn: 'sku',
      pk: existing.sku,
      operation: 'UPDATE',
      payload: { sku: existing.sku, ...merged, status },
      apply: () => {
        db.prepare(
          `UPDATE inventory_items SET barcode = @barcode, name = @name, description = @description, department = @department, category = @category, unit_of_measure = @unitOfMeasure, stock_on_hand = @stockOnHand, reorder_level = @reorderLevel, unit_cost = @unitCost, retail_price = @retailPrice, preferred_supplier = @preferredSupplier, is_active = @isActive, image_url = @imageUrl, tax_rate = @taxRate, status = @status, location = @location, part_number = @partNumber, oem_number = @oemNumber, custom_fields = @customFields, last_updated = @lastUpdated
           WHERE sku = @sku`
        ).run({
          sku: existing.sku,
          barcode: merged.barcode,
          name: merged.name,
          description: merged.description,
          department: merged.department,
          category: merged.category,
          unitOfMeasure: merged.unitOfMeasure,
          stockOnHand: merged.stockOnHand,
          reorderLevel: merged.reorderLevel,
          unitCost: merged.unitCost,
          retailPrice: merged.retailPrice,
          preferredSupplier: merged.preferredSupplier,
          isActive: merged.isActive ? 1 : 0,
          imageUrl: merged.imageUrl,
          taxRate: merged.taxRate,
          status,
          location: merged.location,
          partNumber: merged.partNumber,
          oemNumber: merged.oemNumber,
          customFields: JSON.stringify(merged.customFields),
          lastUpdated,
        });
      },
    });

    const row = db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(existing.sku);
    res.json(rowToInventoryItem(row));
  })
);

interface AdjustBody {
  movement: {
    id?: string;
    timestamp?: string;
    movementType: string;
    quantity: number;
    unitCost?: number;
    totalValue?: number;
    sourceLocationId?: string;
    sourceLocationName?: string;
    destinationLocationId?: string;
    destinationLocationName?: string;
    referenceDocument?: string;
    staffId?: string;
    staffName?: string;
    reasonCode?: string;
    reason?: string;
    notes?: string;
  };
}

// Manual stock adjustment (ManualStockAdjustmentModal.onPostAdjustment) —
// trusts the client-built InventoryMovement (same precedent as sales.ts),
// and additionally writes the stock_adjustments ledger row and updates the
// item's stock_on_hand/status atomically with it.
router.post(
  '/items/:sku/adjust',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(req.params.sku) as any;
    if (!existing) throw new ApiError(404, 'Item not found');
    const { movement } = req.body as AdjustBody;
    if (!movement || typeof movement.quantity !== 'number') {
      throw new ApiError(400, 'movement.quantity is required');
    }

    const staff = req.currentStaff!;
    const timestamp = movement.timestamp || nowIso();
    const movId = movement.id || generateId('MOV');
    const newSoh = Math.max(0, existing.stock_on_hand + movement.quantity);
    const newStatus = deriveStatus(newSoh, existing.reorder_level);

    applyBatchWithOutbox({
      db,
      tenantId: null,
      apply: () => {
        const entries: BatchEntry[] = [];

        db.prepare(
          `INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name, reason_code, notes)
           VALUES (@id, @timestamp, @movementType, @sku, @itemName, @quantity, @unitCost, @totalValue, @sourceLocationId, @sourceLocationName, @destinationLocationId, @destinationLocationName, @referenceDocument, @staffId, @staffName, @reasonCode, @notes)`
        ).run({
          id: movId,
          timestamp,
          movementType: movement.movementType,
          sku: existing.sku,
          itemName: existing.name,
          quantity: movement.quantity,
          unitCost: movement.unitCost ?? existing.unit_cost,
          totalValue: movement.totalValue ?? Math.abs(movement.quantity * (movement.unitCost ?? existing.unit_cost)),
          sourceLocationId: movement.sourceLocationId ?? null,
          sourceLocationName: movement.sourceLocationName ?? null,
          destinationLocationId: movement.destinationLocationId ?? null,
          destinationLocationName: movement.destinationLocationName ?? null,
          referenceDocument: movement.referenceDocument ?? null,
          staffId: movement.staffId ?? staff.id,
          staffName: movement.staffName ?? staff.name,
          reasonCode: movement.reasonCode ?? null,
          notes: movement.notes ?? movement.reason ?? null,
        });
        entries.push({ table: 'inventory_movements', pkColumn: 'id', pk: movId, operation: 'INSERT', payload: { id: movId, sku: existing.sku, quantity: movement.quantity } });

        const adjId = generateId('ADJ');
        db.prepare(
          `INSERT INTO stock_adjustments (id, adjustment_number, sku, item_name, adjustment_type, quantity_delta, unit_cost, total_delta_value, staff_name, date, reason)
           VALUES (@id, @adjustmentNumber, @sku, @itemName, @adjustmentType, @quantityDelta, @unitCost, @totalDeltaValue, @staffName, @date, @reason)`
        ).run({
          id: adjId,
          adjustmentNumber: movement.referenceDocument ?? adjId,
          sku: existing.sku,
          itemName: existing.name,
          adjustmentType: movement.movementType,
          quantityDelta: movement.quantity,
          unitCost: movement.unitCost ?? existing.unit_cost,
          totalDeltaValue: movement.totalValue ?? Math.abs(movement.quantity * (movement.unitCost ?? existing.unit_cost)),
          staffName: movement.staffName ?? staff.name,
          date: timestamp,
          reason: movement.reason ?? movement.reasonCode ?? null,
        });
        entries.push({ table: 'stock_adjustments', pkColumn: 'id', pk: adjId, operation: 'INSERT', payload: { id: adjId } });

        db.prepare('UPDATE inventory_items SET stock_on_hand = ?, status = ?, last_updated = ? WHERE sku = ?').run(newSoh, newStatus, timestamp, existing.sku);
        entries.push({ table: 'inventory_items', pkColumn: 'sku', pk: existing.sku, operation: 'UPDATE', payload: { sku: existing.sku, stockOnHand: newSoh, status: newStatus } });

        return { result: undefined, entries };
      },
    });

    const row = db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(existing.sku);
    res.json(rowToInventoryItem(row));
  })
);

interface ReorderRecPatchBody {
  recommendation: {
    id: string;
    sku: string;
    itemName: string;
    department?: string;
    locationId?: string;
    locationName?: string;
    stockOnHand?: number;
    availableStock?: number;
    reorderLevel?: number;
    targetStock?: number;
    averageDailySales?: number;
    supplierLeadTimeDays?: number;
    suggestedReorderQty?: number;
    preferredSupplierCode?: string;
    preferredSupplierName?: string;
    lastCost?: number;
    estimatedCostTotal?: number;
    reason?: string;
    ruleVersion?: number;
    createdAt?: string;
  };
  status: string;
  decisionNotes?: string;
}

// Reorder recommendations are computed client-side by
// deterministicRulesEngine.ts (never persisted until a decision is made on
// one) — this route both durably records the review decision and, if the
// row doesn't exist yet, persists the recommendation itself, trusting the
// client-computed fields the same way sales.ts trusts checkout totals.
router.patch(
  '/reorder-recommendations/:id',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const { recommendation, status, decisionNotes } = req.body as ReorderRecPatchBody;
    if (!recommendation?.id || !status) throw new ApiError(400, 'recommendation and status are required');

    const staff = req.currentStaff!;
    const reviewedAt = nowIso();
    const existing = db.prepare('SELECT id FROM reorder_recommendations WHERE id = ?').get(recommendation.id);

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'reorder_recommendations',
      pkColumn: 'id',
      pk: recommendation.id,
      operation: existing ? 'UPDATE' : 'INSERT',
      payload: { ...recommendation, status, decisionNotes },
      apply: () => {
        if (existing) {
          db.prepare(
            `UPDATE reorder_recommendations SET status = ?, decision_notes = ?, reviewed_by_staff_name = ?, reviewed_at = ? WHERE id = ?`
          ).run(status, decisionNotes ?? null, staff.name, reviewedAt, recommendation.id);
        } else {
          db.prepare(
            `INSERT INTO reorder_recommendations (id, sku, item_name, department, location_id, location_name, stock_on_hand, available_stock, reorder_level, target_stock, average_daily_sales, supplier_lead_time_days, suggested_reorder_qty, preferred_supplier_code, preferred_supplier_name, last_cost, estimated_cost_total, reason, status, rule_version, created_at, reviewed_by_staff_name, reviewed_at, decision_notes)
             VALUES (@id, @sku, @itemName, @department, @locationId, @locationName, @stockOnHand, @availableStock, @reorderLevel, @targetStock, @averageDailySales, @supplierLeadTimeDays, @suggestedReorderQty, @preferredSupplierCode, @preferredSupplierName, @lastCost, @estimatedCostTotal, @reason, @status, @ruleVersion, @createdAt, @reviewedByStaffName, @reviewedAt, @decisionNotes)`
          ).run({
            id: recommendation.id,
            sku: recommendation.sku,
            itemName: recommendation.itemName,
            department: recommendation.department ?? null,
            locationId: recommendation.locationId ?? null,
            locationName: recommendation.locationName ?? null,
            stockOnHand: recommendation.stockOnHand ?? 0,
            availableStock: recommendation.availableStock ?? 0,
            reorderLevel: recommendation.reorderLevel ?? 0,
            targetStock: recommendation.targetStock ?? 0,
            averageDailySales: recommendation.averageDailySales ?? 0,
            supplierLeadTimeDays: recommendation.supplierLeadTimeDays ?? null,
            suggestedReorderQty: recommendation.suggestedReorderQty ?? 0,
            preferredSupplierCode: recommendation.preferredSupplierCode ?? null,
            preferredSupplierName: recommendation.preferredSupplierName ?? null,
            lastCost: recommendation.lastCost ?? 0,
            estimatedCostTotal: recommendation.estimatedCostTotal ?? 0,
            reason: recommendation.reason ?? null,
            status,
            ruleVersion: recommendation.ruleVersion ?? 1,
            createdAt: recommendation.createdAt ?? reviewedAt,
            reviewedByStaffName: staff.name,
            reviewedAt,
            decisionNotes: decisionNotes ?? null,
          });
        }
      },
    });

    const row = db.prepare('SELECT * FROM reorder_recommendations WHERE id = ?').get(recommendation.id) as any;
    res.json({
      id: row.id,
      sku: row.sku,
      itemName: row.item_name,
      status: row.status,
      reviewedByStaffName: row.reviewed_by_staff_name,
      reviewedAt: row.reviewed_at,
      decisionNotes: row.decision_notes,
    });
  })
);

export default router;
