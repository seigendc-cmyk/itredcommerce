import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { queueSaleForFiscalization, loadSaleForFiscalization } from '../lib/fiscalization/fiscalSubmissionService';

// The fiscal-submission backfill sweep the governance doc flagged as an
// open item: a COMPLETED sale on an actively-fiscalized branch that never
// got a fiscal_submissions row at all (queueSaleForFiscalization threw
// before inserting, or a branch's registration was activated after some
// sales had already completed) is otherwise never caught by anything —
// fiscalDrainLoop.ts only re-attempts rows that already exist. This is a
// safety net for a rare gap, not a normal code path, so it runs on a much
// coarser cadence than either fiscal drain loop (30s) — no reason to scan
// for a gap that shouldn't exist every few seconds.
const BACKFILL_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const BACKFILL_BATCH_SIZE = 20;

interface OrphanedSaleRow {
  sale_id: string;
  branch_id: string;
}

// Exported for direct testing — the meaningful logic here is the SQL
// query itself, not the setInterval/connectivity-gated wrapper around it.
export function findOrphanedCompletedSales(): OrphanedSaleRow[] {
  return db
    .prepare(
      `SELECT st.sale_id, st.branch_id
       FROM sales_transactions st
       JOIN fiscal_registration_cache frc ON frc.branch_id = st.branch_id AND frc.status = 'ACTIVE'
       LEFT JOIN fiscal_submissions fs ON fs.sale_id = st.sale_id
       WHERE st.status = 'COMPLETED' AND fs.id IS NULL
       ORDER BY st.date_time ASC
       LIMIT ?`
    )
    .all(BACKFILL_BATCH_SIZE) as any as OrphanedSaleRow[];
}

async function sweepOnce(): Promise<void> {
  if (connectivityMonitor.getState() !== 'ONLINE') return;

  const orphans = findOrphanedCompletedSales();
  for (const orphan of orphans) {
    try {
      const sale = loadSaleForFiscalization(orphan.sale_id, orphan.branch_id);
      if (!sale) continue; // shouldn't happen — the row that produced orphan.sale_id came from this same table
      queueSaleForFiscalization(sale);
    } catch (err) {
      console.error(`[fiscalBackfillSweep] unexpected error backfilling sale ${orphan.sale_id}:`, err);
    }
  }
}

export function startFiscalBackfillSweep(intervalMs: number = BACKFILL_SWEEP_INTERVAL_MS): void {
  setInterval(() => void sweepOnce(), intervalMs);
}
