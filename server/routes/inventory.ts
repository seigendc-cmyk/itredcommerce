import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth';

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
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM inventory_items WHERE is_active = 1 ORDER BY name ASC').all() as any[];
    res.json(rows.map(rowToInventoryItem));
  })
);

export default router;
