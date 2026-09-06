import { db } from '../db/connection';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getInstallationConfig } from '../lib/installationConfig';
import { resolveParameterValues, type BiRuleParameterDef } from '../lib/biRuleEngine';

interface RemoteBiRuleRow {
  rule_id: string;
  version: number;
  category: string;
  description: string;
  conditions: unknown;
  event: unknown;
  parameters: BiRuleParameterDef[];
  created_at: string;
}

interface RemoteTenantBiRuleSettingsRow {
  rule_id: string;
  rule_version: number;
  enabled: boolean;
  parameter_values: Record<string, unknown>;
  orphaned_parameters: string[];
}

interface LocalSettingsRow {
  rule_version: number;
  enabled: number;
  parameter_values: string;
  orphaned_parameters: string;
}

// DL-060/DL-063: pull-cache refresh for the BI Brain rule catalog + this
// tenant's settings, same pull-cache shape DL-012 established for `staff`.
// Runs the DL-060 migration-reconciliation step inline: when a rule's
// latest pulled version is newer than what this tenant's local settings
// were last reconciled against, new parameters default in and any
// parameter the new version dropped is flagged (kept, not deleted) in
// orphaned_parameters — never silently dropped. A row changed by
// reconciliation is marked dirty so server/sync/biRuleSettingsPush.ts
// pushes the reconciled state back to Supabase.
export async function pullBiRulesFromSupabase(): Promise<void> {
  const installation = getInstallationConfig();
  const supabase = getSupabaseAdmin();
  if (!supabase || !installation?.tenantId) return;

  const { data: ruleRows, error: rulesError } = await supabase
    .from('bi_rules')
    .select('rule_id, version, category, description, conditions, event, parameters, created_at')
    .order('rule_id', { ascending: true })
    .order('version', { ascending: false });
  if (rulesError) {
    console.error('[biRulesPull] failed to pull bi_rules:', rulesError);
    return;
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('tenant_bi_rule_settings')
    .select('rule_id, rule_version, enabled, parameter_values, orphaned_parameters')
    .eq('tenant_id', installation.tenantId);
  if (settingsError) {
    console.error('[biRulesPull] failed to pull tenant_bi_rule_settings:', settingsError);
    return;
  }

  const remoteSettingsByRuleId = new Map<string, RemoteTenantBiRuleSettingsRow>(
    ((settingsRows ?? []) as RemoteTenantBiRuleSettingsRow[]).map((r) => [r.rule_id, r])
  );

  // Latest version per rule_id — ruleRows is already ordered version DESC
  // within each rule_id, so the first occurrence wins.
  const latestByRuleId = new Map<string, RemoteBiRuleRow>();
  for (const row of (ruleRows ?? []) as RemoteBiRuleRow[]) {
    if (!latestByRuleId.has(row.rule_id)) latestByRuleId.set(row.rule_id, row);

    db.prepare(
      `INSERT INTO bi_rules_cache (rule_id, version, category, description, conditions, event, parameters, created_at)
       VALUES (@rule_id, @version, @category, @description, @conditions, @event, @parameters, @created_at)
       ON CONFLICT(rule_id, version) DO UPDATE SET
         category = excluded.category, description = excluded.description,
         conditions = excluded.conditions, event = excluded.event,
         parameters = excluded.parameters, created_at = excluded.created_at`
    ).run({
      rule_id: row.rule_id,
      version: row.version,
      category: row.category,
      description: row.description,
      conditions: JSON.stringify(row.conditions),
      event: JSON.stringify(row.event),
      parameters: JSON.stringify(row.parameters),
      created_at: row.created_at,
    });
  }

  for (const [ruleId, latest] of latestByRuleId) {
    reconcileTenantSettings(ruleId, latest, remoteSettingsByRuleId.get(ruleId) ?? null);
  }
}

// Local is treated as authoritative for "current tenant intent" whenever a
// local row already exists — never overwritten by a plain refresh, only
// ever reconciled forward when a genuinely newer rule version shows up.
// This avoids a race where a pull lands between a BI Config page save and
// that save's own push-drain tick, which would otherwise clobber a pending
// local edit with the (still-stale) remote copy.
function reconcileTenantSettings(
  ruleId: string,
  latestRule: RemoteBiRuleRow,
  remote: RemoteTenantBiRuleSettingsRow | null
): void {
  const local = db
    .prepare(`SELECT rule_version, enabled, parameter_values, orphaned_parameters FROM tenant_bi_rule_settings WHERE rule_id = ?`)
    .get(ruleId) as unknown as LocalSettingsRow | undefined;

  if (!local) {
    // Fresh install / never-touched-locally rule: bootstrap from Supabase
    // if a settings row already exists there; otherwise leave unset —
    // loadActiveRule() falls back to platform defaults for a rule with no
    // settings row at all.
    if (!remote) return;
    upsertLocal(
      ruleId,
      {
        ruleVersion: remote.rule_version,
        enabled: remote.enabled,
        parameterValues: remote.parameter_values,
        orphanedParameters: remote.orphaned_parameters,
      },
      false
    );
    return;
  }

  if (local.rule_version >= latestRule.version) return; // nothing to reconcile

  const localParameterValues = JSON.parse(local.parameter_values) as Record<string, unknown>;
  const localOrphaned = JSON.parse(local.orphaned_parameters) as string[];

  const currentParamNames = new Set(latestRule.parameters.map((p) => p.name));
  const newlyOrphaned = Object.keys(localParameterValues).filter((name) => !currentParamNames.has(name));
  const orphanedParameters = Array.from(new Set([...localOrphaned, ...newlyOrphaned]));
  const parameterValues = resolveParameterValues(latestRule.parameters, localParameterValues);

  upsertLocal(
    ruleId,
    { ruleVersion: latestRule.version, enabled: !!local.enabled, parameterValues, orphanedParameters },
    true
  );
}

function upsertLocal(
  ruleId: string,
  settings: { ruleVersion: number; enabled: boolean; parameterValues: Record<string, unknown>; orphanedParameters: string[] },
  dirty: boolean
): void {
  db.prepare(
    `INSERT INTO tenant_bi_rule_settings (rule_id, rule_version, enabled, parameter_values, orphaned_parameters, dirty)
     VALUES (@rule_id, @rule_version, @enabled, @parameter_values, @orphaned_parameters, @dirty)
     ON CONFLICT(rule_id) DO UPDATE SET
       rule_version = excluded.rule_version, enabled = excluded.enabled,
       parameter_values = excluded.parameter_values, orphaned_parameters = excluded.orphaned_parameters,
       dirty = excluded.dirty`
  ).run({
    rule_id: ruleId,
    rule_version: settings.ruleVersion,
    enabled: settings.enabled ? 1 : 0,
    parameter_values: JSON.stringify(settings.parameterValues),
    orphaned_parameters: JSON.stringify(settings.orphanedParameters),
    dirty: dirty ? 1 : 0,
  });
}
