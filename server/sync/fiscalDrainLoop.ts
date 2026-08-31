import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { attemptSubmission } from '../lib/fiscalization/fiscalSubmissionService';

// Fiscal-specific drain loop (Prompt 11) — deliberately separate from, and
// on a much tighter cadence than, both the general outbox drain (DL-006)
// and the WhatsApp notification drain (30s here vs. that one's 1 minute).
// A fiscal submission is a compliance obligation with no fixed attempt
// cap (see fiscalSubmissionService.ts's header comment) — the user's own
// confirmed design explicitly rejected assuming the general outbox's
// retry/backoff semantics are sufficient for this.
const FISCAL_DRAIN_INTERVAL_MS = 30 * 1000;
const BATCH_SIZE = 20;

interface PendingRow {
  id: string;
}

async function drainOnce(): Promise<void> {
  if (connectivityMonitor.getState() !== 'ONLINE') return;

  const rows = db
    .prepare(`SELECT id FROM fiscal_submissions WHERE status = 'PENDING' AND non_retryable = 0 ORDER BY created_at ASC LIMIT ?`)
    .all(BATCH_SIZE) as any as PendingRow[];

  for (const row of rows) {
    try {
      await attemptSubmission(row.id);
    } catch (err) {
      console.error(`[fiscalDrainLoop] unexpected error draining submission ${row.id}:`, err);
    }
  }
}

export function startFiscalDrainLoop(intervalMs: number = FISCAL_DRAIN_INTERVAL_MS): void {
  setInterval(() => void drainOnce(), intervalMs);
}
