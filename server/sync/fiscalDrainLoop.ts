import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { attemptSubmission, resetSubmissionForRetry } from '../lib/fiscalization/fiscalSubmissionService';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env } from '../env';

// Fiscal-specific drain loop (Prompt 11) — deliberately separate from, and
// on a much tighter cadence than, both the general outbox drain (DL-006)
// and the WhatsApp notification drain (30s here vs. that one's 1 minute).
// A fiscal submission is a compliance obligation with no fixed attempt
// cap (see fiscalSubmissionService.ts's header comment) — the user's own
// confirmed design explicitly rejected assuming the general outbox's
// retry/backoff semantics are sufficient for this.
const FISCAL_DRAIN_INTERVAL_MS = 30 * 1000;
const BATCH_SIZE = 20;
const REMOTE_RETRY_BATCH_SIZE = 50;

interface PendingRow {
  id: string;
}

// DL-037: consumes cross-terminal retry requests (server/routes/fiscalization.ts's
// POST /submissions/:id/retry, when the submission isn't on this terminal's
// own local queue) via a mailbox flag on Supabase's fiscal_submissions
// mirror. Every online terminal for this tenant polls the same tenant-wide
// flag set on every drain tick; only the one that actually finds the row in
// its own local SQLite acts on it (resets it to PENDING, letting the
// PENDING scan below pick it up this same tick) and clears the flag — every
// other terminal's check is a cheap local-lookup no-op, so no coordination
// between terminals is needed to decide who owns a given row.
async function applyRemoteRetryRequests(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('fiscal_submissions')
    .select('id')
    .eq('tenant_id', env.tenantId)
    .not('retry_requested_at', 'is', null)
    .limit(REMOTE_RETRY_BATCH_SIZE);
  if (error || !data || data.length === 0) return;

  for (const remote of data) {
    const local = db.prepare('SELECT id FROM fiscal_submissions WHERE id = ?').get(remote.id);
    if (!local) continue; // owned by a different terminal — leave the flag for it to consume

    resetSubmissionForRetry(remote.id);
    try {
      const { error: clearErr } = await supabase
        .from('fiscal_submissions')
        .update({ retry_requested_at: null })
        .eq('tenant_id', env.tenantId)
        .eq('id', remote.id);
      if (clearErr) throw clearErr;
    } catch (err) {
      // Worst case the flag survives and this same terminal re-applies the
      // (already-idempotent) reset on the next tick — never a correctness
      // problem, just a redundant retry attempt.
      console.error(`[fiscalDrainLoop] failed to clear remote retry flag for ${remote.id}:`, err);
    }
  }
}

async function drainOnce(): Promise<void> {
  if (connectivityMonitor.getState() !== 'ONLINE') return;

  await applyRemoteRetryRequests();

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
