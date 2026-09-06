import { randomUUID } from 'node:crypto';
import { db } from '../db/connection';
import { connectivityMonitor } from '../sync/connectivityInstance';
import { getSupabaseAdmin } from './supabaseAdmin';
import { getInstallationConfig } from './installationConfig';
import { evaluateRule, resolveParameterValues, type BiRuleDefinition } from './biRuleEngine';

export interface LoadedRule {
  definition: BiRuleDefinition;
  enabled: boolean;
  parameterValues: Record<string, unknown>;
}

interface BiRuleCacheRow {
  rule_id: string;
  version: number;
  category: string;
  description: string;
  conditions: string;
  event: string;
  parameters: string;
}

interface TenantBiRuleSettingsRow {
  enabled: number;
  parameter_values: string;
}

// Reads the latest locally-cached rule version + this tenant's local
// settings for it — no Supabase round-trip (DL-062: evaluation is fully
// offline). server/sync/biRulesPull.ts keeps bi_rules_cache current.
export function loadActiveRule(ruleId: string): LoadedRule | null {
  const ruleRow = db
    .prepare(`SELECT * FROM bi_rules_cache WHERE rule_id = ? ORDER BY version DESC LIMIT 1`)
    .get(ruleId) as unknown as BiRuleCacheRow | undefined;
  if (!ruleRow) return null;

  const settingsRow = db
    .prepare(`SELECT enabled, parameter_values FROM tenant_bi_rule_settings WHERE rule_id = ?`)
    .get(ruleId) as unknown as TenantBiRuleSettingsRow | undefined;

  const definition: BiRuleDefinition = {
    ruleId: ruleRow.rule_id,
    version: ruleRow.version,
    category: ruleRow.category,
    description: ruleRow.description,
    conditions: JSON.parse(ruleRow.conditions),
    event: JSON.parse(ruleRow.event),
    parameters: JSON.parse(ruleRow.parameters),
  };

  // No settings row yet (never pulled/reconciled) — treat as enabled with
  // every parameter at its platform default, same as a freshly-reconciled
  // row would resolve to.
  const enabled = settingsRow ? !!settingsRow.enabled : true;
  const storedValues = settingsRow ? JSON.parse(settingsRow.parameter_values) : {};
  const parameterValues = resolveParameterValues(definition.parameters, storedValues);

  return { definition, enabled, parameterValues };
}

export type GateOutcome =
  | { outcome: 'PROCEED' }
  | { outcome: 'REDIRECTED_TO_APPROVAL'; approvalRequestId: string }
  | { outcome: 'BLOCKED_OFFLINE'; gatedActionId: string };

export interface GateParams {
  ruleId: string;
  facts: Record<string, unknown>;
  actionType: string;
  payload: unknown;
  referenceId: string;
  referenceType: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
}

// DL-061/DL-062: the one place a REDIRECT_TO_APPROVAL rule's consequence is
// decided. Called synchronously from within the Express route handling the
// originating action (mirrors deliveryOrders.ts's connectivityMonitor.checkNow()
// gate exactly) — never queued in the outbox when offline, per DL-062.
export async function evaluateAndGate(params: GateParams): Promise<GateOutcome> {
  const rule = loadActiveRule(params.ruleId);
  if (!rule || !rule.enabled) return { outcome: 'PROCEED' };
  if (rule.definition.event.type !== 'REDIRECT_TO_APPROVAL') return { outcome: 'PROCEED' };

  const fires = evaluateRule(rule.definition, params.facts, rule.parameterValues);
  if (!fires) return { outcome: 'PROCEED' };

  // Live probe, not the cached poll state — same reasoning as
  // deliveryOrders.ts: a decision this consequential shouldn't act on a
  // connectivity reading that might be stale by up to the poll interval.
  await connectivityMonitor.checkNow();
  if (connectivityMonitor.getState() !== 'ONLINE') {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO bi_rule_gated_actions (id, rule_id, rule_version, action_type, payload, facts_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      rule.definition.ruleId,
      rule.definition.version,
      params.actionType,
      JSON.stringify(params.payload),
      JSON.stringify(params.facts)
    );
    return { outcome: 'BLOCKED_OFFLINE', gatedActionId: id };
  }

  const approvalRequestId = await createApprovalTicket(rule, params);
  return { outcome: 'REDIRECTED_TO_APPROVAL', approvalRequestId };
}

// Written directly to both the local mirror and Supabase, never through
// applyWithOutbox/the general outbox drain (server/sync/drainLoop.ts has no
// live caller anywhere — see DL-057's Open Items) — this path is only ever
// reached once connectivityMonitor has just confirmed ONLINE, so there's no
// offline case here needing outbox durability, the same reasoning already
// applied to delivery_orders and the WhatsApp activation-request log (DL-056).
export async function createApprovalTicket(rule: LoadedRule, params: GateParams): Promise<string> {
  const installation = getInstallationConfig();
  const id = randomUUID();
  const requestedAt = new Date().toISOString();

  // Branch name, not just id — approval_requests.location_name is a freeform
  // display field (no branch_id/FK column on this table), but Decision Flows'
  // branch filter needs something human-readable to filter on, the same way
  // it already works for exceptions (which do have a real branch_id).
  let locationName: string | null = null;
  if (installation?.branchId) {
    const branchRow = db.prepare(`SELECT name FROM branches WHERE id = ?`).get(installation.branchId) as
      | { name: string }
      | undefined;
    locationName = branchRow?.name ?? null;
  }

  const meta = {
    ruleId: rule.definition.ruleId,
    ruleVersion: rule.definition.version,
    parameterValuesSnapshot: rule.parameterValues,
    actionType: params.actionType,
    payload: params.payload,
  };

  db.prepare(
    `INSERT INTO approval_requests (id, type, title, reference_id, reference_type, location_name, requested_by_staff_id, requested_by_staff_name, requested_date_time, status, meta)
     VALUES (@id, @type, @title, @referenceId, @referenceType, @locationName, @requestedByStaffId, @requestedByStaffName, @requestedDateTime, @status, @meta)`
  ).run({
    id,
    type: 'BI_RULE_REDIRECT',
    title: rule.definition.description,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    locationName,
    requestedByStaffId: params.requestedByStaffId,
    requestedByStaffName: params.requestedByStaffName,
    requestedDateTime: requestedAt,
    status: 'PENDING',
    meta: JSON.stringify(meta),
  });

  const supabase = getSupabaseAdmin();
  if (supabase && installation?.tenantId) {
    const { error } = await supabase.from('approval_requests').insert({
      id,
      tenant_id: installation.tenantId,
      type: 'BI_RULE_REDIRECT',
      title: rule.definition.description,
      reference_id: params.referenceId,
      reference_type: params.referenceType,
      location_name: locationName,
      requested_by_staff_id: params.requestedByStaffId,
      requested_by_staff_name: params.requestedByStaffName,
      requested_date_time: requestedAt,
      status: 'PENDING',
      meta,
    });
    if (error) console.error('[biRuleGate] failed to mirror approval ticket to Supabase:', error);
  }

  return id;
}
