import { supabase } from './supabaseClient';

// Typed query helpers over the RLS-safe wrapper views (v_*) built in
// supabase/migrations/20260831090000_executive_rollups.sql — never query
// the underlying mv_* materialized views directly from the client (they
// have no RLS; only the wrapper views are granted to `authenticated`).

export interface DailySalesRow {
  branch_id: string | null;
  sale_date: string;
  transaction_count: number;
  gross_revenue: number;
  discounts: number;
  tax: number;
  net_revenue: number;
  cost_basis: number;
  gross_margin_percent: number;
}

export async function fetchDailySales(fromDate: string, toDate: string): Promise<DailySalesRow[]> {
  const { data, error } = await supabase
    .from('v_daily_sales_summary')
    .select('branch_id, sale_date, transaction_count, gross_revenue, discounts, tax, net_revenue, cost_basis, gross_margin_percent')
    .gte('sale_date', fromDate)
    .lte('sale_date', toDate)
    .order('sale_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface InventoryValuationRow {
  sku: string;
  department: string | null;
  category: string | null;
  stock_on_hand: number;
  unit_cost: number;
  retail_price: number;
  valuation_at_cost: number;
  valuation_at_retail: number;
}

export async function fetchInventoryValuation(): Promise<InventoryValuationRow[]> {
  const { data, error } = await supabase.from('v_inventory_valuation').select('*').order('valuation_at_cost', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface InventoryTurnoverRow {
  sku: string;
  name: string | null;
  stock_on_hand: number;
  units_sold_30d: number;
  units_sold_90d: number;
  avg_daily_velocity: number;
  days_of_supply: number | null;
  movement_class: 'FAST' | 'NORMAL' | 'SLOW' | 'DEAD';
  last_movement_at: string | null;
  days_since_last_movement: number | null;
}

export async function fetchInventoryTurnover(): Promise<InventoryTurnoverRow[]> {
  const { data, error } = await supabase.from('v_inventory_turnover').select('*').order('units_sold_30d', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Top-N oldest-since-last-movement items — the "inventory ageing" page's data source (distinct from turnover velocity). */
export async function fetchInventoryAgeing(topN: number): Promise<InventoryTurnoverRow[]> {
  const { data, error } = await supabase
    .from('v_inventory_turnover')
    .select('*')
    .not('days_since_last_movement', 'is', null)
    .order('days_since_last_movement', { ascending: false })
    .limit(topN);
  if (error) throw error;
  return data ?? [];
}

export interface AgingRow {
  current_0_to_30: number | null;
  days_31_to_60: number | null;
  days_61_to_90: number | null;
  days_90_plus: number | null;
  total_outstanding: number;
  overdue_amount: number | null;
}

export interface DebtorAgingRow extends AgingRow {
  customer_id: string;
  customer_name: string | null;
}

export async function fetchDebtorAging(): Promise<DebtorAgingRow[]> {
  const { data, error } = await supabase.from('v_debtor_aging').select('*').order('total_outstanding', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CreditorAgingRow extends AgingRow {
  supplier_code: string;
  supplier_name: string | null;
}

export async function fetchCreditorAging(): Promise<CreditorAgingRow[]> {
  const { data, error } = await supabase.from('v_creditor_aging').select('*').order('total_outstanding', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface ExpenseRollupRow {
  expense_date: string;
  movement_type: string;
  total_amount: number;
}

export async function fetchExpenseRollup(fromDate: string, toDate: string): Promise<ExpenseRollupRow[]> {
  const { data, error } = await supabase
    .from('v_expense_rollup')
    .select('expense_date, movement_type, total_amount')
    .gte('expense_date', fromDate)
    .lte('expense_date', toDate)
    .order('expense_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLastRefreshed(viewName: string): Promise<string | null> {
  const { data, error } = await supabase.from('rollup_refresh_log').select('refreshed_at').eq('view_name', viewName).maybeSingle();
  if (error || !data) return null;
  return data.refreshed_at;
}

export async function fetchAllRefreshTimes(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('rollup_refresh_log').select('view_name, refreshed_at');
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.view_name, r.refreshed_at]));
}
