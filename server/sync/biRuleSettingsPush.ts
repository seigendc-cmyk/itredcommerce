import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getInstallationConfig } from '../lib/installationConfig';

// Push side of the BI Config page's local-first save (DL-063): pushes any
// locally `dirty` tenant_bi_rule_settings row — a BI Config page edit, or a
// migration-reconciliation change from biRulesPull.ts — up to Supabase.
// Same "own small dedicated loop, not the general outbox" reasoning as
// fiscalDrainLoop.ts and terminalActivationConfirmationDrainLoop.ts (the
// general outbox has no live caller anywhere, see DL-057's Open Items).
const DRAIN_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 50;

interface DirtyRow {
  rule_id: string;
  rule_version: number;
  enabled: number;
  parameter_values: string;
  orphaned_parameters: string;
}

async function drainOnce(): Promise<void> {
  if (connectivityMonitor.getState() !== 'ONLINE') return;

  const installation = getInstallationConfig();
  const supabase = getSupabaseAdmin();
  if (!supabase || !installation?.tenantId) return;

  const rows = db
    .prepare(
      `SELECT rule_id, rule_version, enabled, parameter_values, orphaned_parameters
       FROM tenant_bi_rule_settings WHERE dirty = 1 LIMIT ?`
    )
    .all(BATCH_SIZE) as unknown as DirtyRow[];

  for (const row of rows) {
    try {
      const { error } = await supabase.from('tenant_bi_rule_settings').upsert({
        tenant_id: installation.tenantId,
        rule_id: row.rule_id,
        rule_version: row.rule_version,
        enabled: !!row.enabled,
        parameter_values: JSON.parse(row.parameter_values),
        orphaned_parameters: JSON.parse(row.orphaned_parameters),
      });
      if (error) throw error;

      db.prepare(`UPDATE tenant_bi_rule_settings SET dirty = 0 WHERE rule_id = ?`).run(row.rule_id);
    } catch (err) {
      console.error(`[biRuleSettingsPush] failed to push settings for ${row.rule_id}, will retry next tick:`, err);
    }
  }
}

export function startBiRuleSettingsPush(intervalMs: number = DRAIN_INTERVAL_MS): void {
  setInterval(() => void drainOnce(), intervalMs);
}
