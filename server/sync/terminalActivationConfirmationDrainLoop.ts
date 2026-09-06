import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

// DL-057's push side, same shape as fiscalDrainLoop.ts (Prompt 11) —
// deliberately its own small dedicated loop rather than routed through the
// general outbox (server/sync/drainLoop.ts/entityRules.ts), for the same
// reason fiscal submissions are: this is a narrow, insert-only audit trail
// whose only failure mode is "retry later," not a row subject to the
// general outbox's conflict-resolution/immutability rules.
const DRAIN_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 50;

interface PendingRow {
  id: number;
  tenant_id: string;
  terminal_id: string;
  token_issued_at: string;
  event_type: string;
  confirmed_at: string;
}

async function drainOnce(): Promise<void> {
  if (connectivityMonitor.getState() !== 'ONLINE') return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const rows = db
    .prepare(
      `SELECT id, tenant_id, terminal_id, token_issued_at, event_type, confirmed_at
       FROM terminal_activation_confirmations
       WHERE status = 'PENDING'
       ORDER BY id ASC LIMIT ?`
    )
    .all(BATCH_SIZE) as unknown as PendingRow[];

  for (const row of rows) {
    try {
      const { error } = await supabase.from('terminal_activation_confirmations').insert({
        tenant_id: row.tenant_id,
        terminal_id: row.terminal_id,
        token_issued_at: row.token_issued_at,
        event_type: row.event_type,
        confirmed_at: row.confirmed_at,
      });
      if (error) throw error;

      db.prepare(`UPDATE terminal_activation_confirmations SET status = 'SYNCED', synced_at = ? WHERE id = ?`).run(
        new Date().toISOString(),
        row.id
      );
    } catch (err) {
      console.error(`[terminalActivationConfirmationDrainLoop] failed to push confirmation ${row.id}, will retry next tick:`, err);
    }
  }
}

export function startTerminalActivationConfirmationDrainLoop(intervalMs: number = DRAIN_INTERVAL_MS): void {
  setInterval(() => void drainOnce(), intervalMs);
}
