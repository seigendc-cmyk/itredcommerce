-- BI Brain local mirrors (DL-058-063). No tenant_id columns, matching every
-- other local table (DL-001: one install binds to exactly one tenant).

-- Pull-only cache of the platform rule catalog, refreshed by
-- server/sync/biRulesPull.ts — same pull-cache shape DL-012 established
-- for `staff`.
CREATE TABLE IF NOT EXISTS bi_rules_cache (
  rule_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  conditions TEXT NOT NULL,
  event TEXT NOT NULL,
  parameters TEXT NOT NULL DEFAULT '[]',
  created_at TEXT,
  PRIMARY KEY (rule_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bi_rules_cache_rule ON bi_rules_cache(rule_id);

-- Mutable local mirror of this tenant's tenant_bi_rule_settings row —
-- `dirty` marks a row changed locally (by a BI Config page save, or by the
-- reconciliation step in biRulesPull.ts) that still needs pushing up to
-- Supabase; server/sync/biRuleSettingsPush.ts clears it on a successful
-- push. Deliberately its own tiny dirty-flag push loop rather than the
-- general outbox (server/sync/drainLoop.ts) — that mechanism has no live
-- caller anywhere in server/index.ts (see DL-057's Open Items), so this
-- mirrors the proven fiscalDrainLoop/terminalActivationConfirmationDrainLoop
-- pattern instead: a narrow need gets its own small loop.
CREATE TABLE IF NOT EXISTS tenant_bi_rule_settings (
  rule_id TEXT PRIMARY KEY,
  rule_version INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  parameter_values TEXT NOT NULL DEFAULT '{}',
  orphaned_parameters TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 0
);

-- Durable local queue for a REDIRECT_TO_APPROVAL rule that fired while
-- offline (DL-062): the gated action is blocked, not queued for staff to
-- manually retry — this row is what lets the reconnect handler
-- (server/sync/biRuleGatedActionReconciler.ts) automatically re-evaluate
-- against current facts once connectivity returns, with no further staff
-- input. `facts_snapshot` is recorded for audit/debugging only — the
-- reconciler re-evaluates against fresh facts, never this stale snapshot.
CREATE TABLE IF NOT EXISTS bi_rule_gated_actions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  facts_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVAL_CREATED', 'COMPLETED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bi_rule_gated_actions_status ON bi_rule_gated_actions(status);
