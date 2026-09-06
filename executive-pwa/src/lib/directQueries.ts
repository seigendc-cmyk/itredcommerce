import { supabase } from './supabaseClient';

// Queries against base tables directly (not rollups) — all already
// tenant-scoped and RLS-permit executive reads without any new policy
// work (confirmed: business_reserves/reserve_transfers/cash_bank_accounts
// via app_is_back_office_role(), operational_exceptions/approval_requests
// via their existing tenant-scoped select policies).

export interface ReserveRow {
  id: string;
  code: string;
  name: string;
  category: string;
  target_amount: number;
  current_funded_balance: number;
  allocation_rule_percent: number;
  priority: string;
  status: string;
}

export async function fetchReserves(): Promise<ReserveRow[]> {
  const { data, error } = await supabase.from('business_reserves').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ReserveTransferRow {
  id: string;
  reserve_id: string;
  reserve_name: string;
  date_time: string;
  type: string;
  amount: number;
}

export async function fetchReserveTransfers(limit = 100): Promise<ReserveTransferRow[]> {
  const { data, error } = await supabase.from('reserve_transfers').select('*').order('date_time', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface CashBankAccountRow {
  id: string;
  code: string;
  name: string;
  account_type: string;
  current_balance: number;
  status: string;
  gl_account_id: string | null;
}

export async function fetchCashBankAccounts(): Promise<CashBankAccountRow[]> {
  const { data, error } = await supabase.from('cash_bank_accounts').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ChartOfAccountRow {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parent_account_id: string | null;
  is_active: boolean;
}

export async function fetchChartOfAccounts(): Promise<ChartOfAccountRow[]> {
  const { data, error } = await supabase.from('chart_of_accounts').select('*').order('account_code', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CashBankTransactionRow {
  id: string;
  account_id: string;
  date_time: string;
  movement_type: string;
  amount: number;
  description: string | null;
}

export async function fetchCashBankTransactionsForAccount(accountId: string, limit = 200): Promise<CashBankTransactionRow[]> {
  const { data, error } = await supabase
    .from('cash_bank_transactions')
    .select('id, account_id, date_time, movement_type, amount, description')
    .eq('account_id', accountId)
    .order('date_time', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Decision flows: union of operational_exceptions + approval_requests
// (original scope, kept per your answer to keep both sources) plus BI Brain
// engine output as a third source — approval_requests rows of
// type = 'BI_RULE_REDIRECT' are exactly BI Brain's REDIRECT_TO_APPROVAL
// output (server/lib/biRuleGate.ts's createApprovalTicket()), so no new
// table was introduced; `engine` is resolved from meta.ruleId against the
// `bi_rules` catalog (read-only, granted to `authenticated` tenant-wide —
// see supabase/migrations/20260906120000_bi_brain_rules_engine.sql) to get
// the actual category rather than the generic 'BI_RULE_REDIRECT' string.
// Still read-only — no decide/resolve actions here, those stay in the
// back-office apps.
export type BiEngineCategory = 'CAPITAL_VELOCITY' | 'BUDGET_VARIANCE_ADVISOR' | 'FORENSIC_THEFT_GUARD' | 'DEAD_STOCK_SEASONAL_DISPOSAL';

// Only DEAD_STOCK_SEASONAL_DISPOSAL has any rule with real computation logic
// today (server/lib/biRules/deadStockRestockFacts.ts) — the other three
// categories exist only as an allowed `bi_rules.category` value with no
// seeded rule and no facts computation anywhere in the codebase, confirmed
// by a full-repo search before this page was built. They stay listed here
// (not removed) so this filter needs no further change once each engine
// actually ships; until then, selecting one will correctly show zero rows.
export const BI_ENGINE_LABELS: Record<BiEngineCategory, string> = {
  DEAD_STOCK_SEASONAL_DISPOSAL: 'Dead Stock / Seasonal Disposal',
  CAPITAL_VELOCITY: 'Capital Velocity (not yet implemented)',
  BUDGET_VARIANCE_ADVISOR: 'Budget Variance Advisor (not yet implemented)',
  FORENSIC_THEFT_GUARD: 'Forensic Theft Guard (not yet implemented)',
};

export interface DecisionFlowEntry {
  kind: 'EXCEPTION' | 'APPROVAL';
  id: string;
  refNumber: string;
  title: string;
  category: string;
  engine: BiEngineCategory | null;
  branchName: string | null;
  severity: string;
  status: string;
  dateTime: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

async function fetchBiRuleCategories(): Promise<Map<string, BiEngineCategory>> {
  const { data, error } = await supabase.from('bi_rules').select('rule_id, category');
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.rule_id, r.category as BiEngineCategory]));
}

export async function fetchDecisionFlows(): Promise<DecisionFlowEntry[]> {
  const [exceptionsRes, approvalsRes, ruleCategories] = await Promise.all([
    supabase
      .from('operational_exceptions')
      .select('id, exception_number, title, category, branch_name, severity, status, date_time, assigned_or_reviewed_by, reviewed_date_time')
      .order('date_time', { ascending: false })
      .limit(200),
    supabase
      .from('approval_requests')
      .select('id, request_number, title, type, location_name, priority, status, requested_date_time, meta, decided_by_staff_name, decision_date_time')
      .order('requested_date_time', { ascending: false })
      .limit(200),
    fetchBiRuleCategories(),
  ]);
  if (exceptionsRes.error) throw exceptionsRes.error;
  if (approvalsRes.error) throw approvalsRes.error;

  const exceptions: DecisionFlowEntry[] = (exceptionsRes.data ?? []).map((r) => ({
    kind: 'EXCEPTION',
    id: r.id,
    refNumber: r.exception_number,
    title: r.title,
    category: r.category,
    engine: null,
    branchName: r.branch_name,
    severity: r.severity,
    status: r.status,
    dateTime: r.date_time,
    decidedBy: r.assigned_or_reviewed_by,
    decidedAt: r.reviewed_date_time,
  }));
  const approvals: DecisionFlowEntry[] = (approvalsRes.data ?? []).map((r) => {
    const ruleId = r.type === 'BI_RULE_REDIRECT' ? (r.meta as { ruleId?: string } | null)?.ruleId : undefined;
    const engine = ruleId ? ruleCategories.get(ruleId) ?? null : null;
    return {
      kind: 'APPROVAL',
      id: r.id,
      refNumber: r.request_number,
      title: r.title,
      category: r.type,
      engine,
      branchName: r.location_name,
      severity: r.priority,
      status: r.status,
      dateTime: r.requested_date_time,
      decidedBy: r.decided_by_staff_name,
      decidedAt: r.decision_date_time,
    };
  });

  return [...exceptions, ...approvals].sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1));
}

// Pending tasks / financial commitments — approval_requests still pending,
// plus purchase orders not yet fully received (a financial commitment: money
// already promised to a supplier).
export interface PendingTaskEntry {
  kind: 'APPROVAL' | 'PURCHASE_ORDER';
  refNumber: string;
  title: string;
  amount: number | null;
  status: string;
  dateTime: string;
}

export async function fetchPendingTasks(): Promise<PendingTaskEntry[]> {
  const [approvalsRes, poRes] = await Promise.all([
    supabase
      .from('approval_requests')
      .select('request_number, title, amount, status, requested_date_time')
      .eq('status', 'PENDING')
      .order('requested_date_time', { ascending: false })
      .limit(200),
    supabase
      .from('purchase_orders')
      .select('po_number, supplier_name, total_amount, status, date_created')
      .in('status', ['Open', 'Part Received'])
      .order('date_created', { ascending: false })
      .limit(200),
  ]);
  if (approvalsRes.error) throw approvalsRes.error;
  if (poRes.error) throw poRes.error;

  const approvals: PendingTaskEntry[] = (approvalsRes.data ?? []).map((r) => ({
    kind: 'APPROVAL',
    refNumber: r.request_number,
    title: r.title,
    amount: r.amount,
    status: r.status,
    dateTime: r.requested_date_time,
  }));
  const pos: PendingTaskEntry[] = (poRes.data ?? []).map((r) => ({
    kind: 'PURCHASE_ORDER',
    refNumber: r.po_number,
    title: `PO — ${r.supplier_name}`,
    amount: r.total_amount,
    status: r.status,
    dateTime: r.date_created,
  }));

  return [...approvals, ...pos].sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1));
}
