import { db } from '../db/connection';
import { connectivityMonitor } from './connectivityInstance';
import { loadActiveRule, createApprovalTicket } from '../lib/biRuleGate';
import { evaluateRule } from '../lib/biRuleEngine';
import { computeSalesSinceLastRequest } from '../lib/biRules/deadStockRestockFacts';
import { insertPurchaseMemoRecord } from '../routes/purchasing/memos';

// DL-062: on reconnect, automatically re-evaluates every action a
// REDIRECT_TO_APPROVAL rule blocked while offline — against CURRENT facts,
// never the stale facts_snapshot taken at block time — and either resumes
// the approval path (rule still fires) or lets the original action proceed
// cleanly (facts have since changed, e.g. a sale happened in the interim).
// Staff never manually retries a blocked action; this is the only place
// that happens. Ships only the one action_type this prompt's example rule
// needs (CREATE_PURCHASE_MEMO) — a second rule/action pairing would extend
// this switch, not invent a parallel mechanism.

interface GatedActionRow {
  id: string;
  rule_id: string;
  action_type: string;
  payload: string;
}

async function reconcileOnce(): Promise<void> {
  const rows = db
    .prepare(`SELECT id, rule_id, action_type, payload FROM bi_rule_gated_actions WHERE status = 'PENDING'`)
    .all() as unknown as GatedActionRow[];

  for (const row of rows) {
    try {
      await reconcileOne(row);
    } catch (err) {
      console.error(`[biRuleGatedActionReconciler] failed to reconcile gated action ${row.id}, will retry next reconnect:`, err);
    }
  }
}

async function reconcileOne(row: GatedActionRow): Promise<void> {
  if (row.action_type !== 'CREATE_PURCHASE_MEMO') {
    console.error(`[biRuleGatedActionReconciler] unknown action_type "${row.action_type}" for gated action ${row.id} — skipping`);
    return;
  }

  const memo = JSON.parse(row.payload);
  const rule = loadActiveRule(row.rule_id);
  if (!rule) {
    console.error(`[biRuleGatedActionReconciler] rule ${row.rule_id} no longer cached locally — leaving gated action ${row.id} pending`);
    return;
  }

  let stillFires = false;
  for (const item of memo.items as Array<{ sku?: string }>) {
    if (!item.sku) continue;
    const facts = { salesSinceLastRequest: computeSalesSinceLastRequest(item.sku) };
    if (rule.enabled && evaluateRule(rule.definition, facts, rule.parameterValues)) {
      stillFires = true;
      break;
    }
  }

  if (stillFires) {
    await createApprovalTicket(rule, {
      ruleId: row.rule_id,
      facts: {},
      actionType: row.action_type,
      payload: memo,
      referenceId: memo.items?.[0]?.sku ?? memo.id,
      referenceType: 'inventory_item',
      requestedByStaffId: memo.requestedByStaffId,
      requestedByStaffName: memo.requestedByStaffName,
    });
    db.prepare(`UPDATE bi_rule_gated_actions SET status = 'APPROVAL_CREATED', resolved_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      row.id
    );
    return;
  }

  insertPurchaseMemoRecord(memo);
  db.prepare(`UPDATE bi_rule_gated_actions SET status = 'COMPLETED', resolved_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    row.id
  );
}

export function startBiRuleGatedActionReconciler(): void {
  connectivityMonitor.subscribe((state) => {
    if (state === 'ONLINE') void reconcileOnce();
  });
}
