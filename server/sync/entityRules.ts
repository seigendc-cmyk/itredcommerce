// Per-entity sync rules: which of the four DL-007 categories each table
// falls into, and which tables have a terminal-state immutability guard
// (DL-006). This is the single place that classification lives — the
// outbox writer and the conflict resolver both read it, so a table only
// needs to be slotted in once.

import type { EntityCategory } from './types';

const LEDGER_TABLES = [
  'sales_transactions',
  'sale_line_items',
  'sale_payments',
  'inventory_movements',
  'debtor_transactions',
  'creditor_transactions',
  'cash_bank_transactions',
  'cash_movements',
  'activity_events',
  'stock_adjustments',
  'credit_notes',
  'credit_note_items',
  'reorder_recommendations',
  'stocktake_lines',
  'backups',
  'reserve_transfers',
  // DL-004 versioned rate config (Prompt 4) — insert-only, never updated;
  // "current" is always MAX(version). See server/db/migrations/005_rate_config.sql.
  'rate_config',
] as const;

const CACHED_AGGREGATE_TABLES = [
  'inventory_items',
  'customers',
  'suppliers',
  'cash_bank_accounts',
  'business_reserves',
] as const;

const SINGLE_OWNER_WORKFLOW_TABLES = [
  'shifts',
  'held_sales',
  'held_sale_items',
  'held_receipts',
  'held_receipt_items',
  'layaway_orders',
  'layaway_items',
  'layaway_payments',
  'stocktake_sessions',
  'stocktakes',
  'purchase_memos',
  'purchase_memo_items',
  'purchase_orders',
  'purchase_order_items',
  'goods_receipt_notes',
  'goods_receipt_note_items',
  'stock_transfers',
  'stock_transfer_items',
  'approval_requests',
  'operational_exceptions',
  'eod_reports',
  'eod_reconciliation_entries',
] as const;

const CONFIG_TABLES = [
  'branches',
  'terminals',
  'warehouses',
  'connected_shops',
  'staff',
  'tax_config',
  'tax_categories',
  'tax_classifications',
  'generic_records',
  'bi_alerts',
] as const;

const CATEGORY_BY_TABLE: Record<string, EntityCategory> = Object.fromEntries([
  ...LEDGER_TABLES.map((t) => [t, 'LEDGER' as const]),
  ...CACHED_AGGREGATE_TABLES.map((t) => [t, 'CACHED_AGGREGATE' as const]),
  ...SINGLE_OWNER_WORKFLOW_TABLES.map((t) => [t, 'SINGLE_OWNER_WORKFLOW' as const]),
  ...CONFIG_TABLES.map((t) => [t, 'CONFIG' as const]),
]);

export function categoryForTable(table: string): EntityCategory {
  const category = CATEGORY_BY_TABLE[table];
  if (!category) {
    // delivery_orders (Prompt 7) is deliberately absent from
    // CATEGORY_BY_TABLE — DL-008 requires it never be queued in the
    // outbox for later creation, so it's written directly to Supabase,
    // synchronously, by server/routes/deliveryOrders.ts, and never goes
    // through applyWithOutbox/applyBatchWithOutbox at all. If you hit this
    // error for "delivery_orders", that's a sign something is trying to
    // route it through the outbox — fix the caller, don't add it here.
    throw new Error(
      `No sync category registered for table "${table}" — add it to server/sync/entityRules.ts (DL-007) before syncing it.`
    );
  }
  return category;
}

/**
 * Tables whose rows, once in one of the listed terminal statuses, must
 * never be pushed as an UPDATE again (DL-006's immutability guard). Keyed
 * by table name; value is the set of statuses that lock the row, read from
 * the field named by `statusField`.
 */
const IMMUTABILITY_GUARDS: Record<string, { statusField: string; lockedStatuses: string[] }> = {
  sales_transactions: { statusField: 'status', lockedStatuses: ['COMPLETED'] },
  shifts: { statusField: 'status', lockedStatuses: ['CLOSED'] },
  eod_reports: { statusField: 'status', lockedStatuses: ['FINALIZED', 'APPROVED'] },
};

/**
 * Returns true if this UPDATE should be rejected outright because the row
 * (per its payload's status field) has already reached a locked state.
 * INSERT and DELETE are never guarded here — only UPDATEs can violate
 * "don't mutate history."
 */
export function violatesImmutabilityGuard(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  currentRow: Record<string, unknown> | undefined
): boolean {
  if (operation !== 'UPDATE') return false;
  const guard = IMMUTABILITY_GUARDS[table];
  if (!guard || !currentRow) return false;
  const currentStatus = currentRow[guard.statusField];
  return typeof currentStatus === 'string' && guard.lockedStatuses.includes(currentStatus);
}
