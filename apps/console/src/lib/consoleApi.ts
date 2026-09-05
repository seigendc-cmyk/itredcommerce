import { supabase } from './supabaseClient';
import type { PlanComponentRow, TenantSubscriptionRow, BillingLineItem, BillingCycle } from './billingEngine';

export type { PlanComponentRow, TenantSubscriptionRow, BillingLineItem, BillingCycle };

export interface TenantRow {
  id: string;
  display_name: string;
  status: string;
  billing_cycle: BillingCycle;
  onboarding_completed_at: string | null;
}

export interface ActivationRequestRow {
  id: string;
  tenant_id: string;
  terminal_id: string | null;
  requested_at: string;
  channel: string;
  fulfillment_status: string;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
}

export interface TerminalActivationTokenRow {
  id: string;
  tenant_id: string;
  terminal_id: string;
  plan_tier: string;
  issued_at: string;
  expires_at: string;
  status: string;
  issued_by: string | null;
}

export interface BillingInvoiceRow {
  id: string;
  tenant_id: string;
  billing_period: string;
  period_start: string | null;
  period_end: string | null;
  line_items: BillingLineItem[];
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

async function invokeConsoleFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listTenants(): Promise<TenantRow[]> {
  const res = await supabase
    .from('tenants')
    .select('id, display_name, status, billing_cycle, onboarding_completed_at')
    .order('display_name');
  return unwrap({ data: res.data ?? [], error: res.error });
}

export async function listActivationRequests(): Promise<ActivationRequestRow[]> {
  const res = await supabase
    .from('activation_requests')
    .select('id, tenant_id, terminal_id, requested_at, channel, fulfillment_status, fulfilled_by, fulfilled_at')
    .order('requested_at', { ascending: false });
  return unwrap({ data: res.data ?? [], error: res.error });
}

export async function issueTerminalActivationToken(input: {
  tenantId: string;
  terminalId: string;
  planTier: string;
  validityDays: number;
  activationRequestId?: string;
}): Promise<{ id: string; token: string; expiresAt: string }> {
  return invokeConsoleFunction('console-issue-terminal-activation-token', input);
}

export async function resolveActivationRequest(input: {
  activationRequestId: string;
  fulfillmentStatus: 'fulfilled' | 'rejected';
}): Promise<{ id: string; fulfillmentStatus: string }> {
  return invokeConsoleFunction('console-resolve-activation-request', input);
}

export async function listTerminalActivationTokens(tenantId: string): Promise<TerminalActivationTokenRow[]> {
  const res = await supabase
    .from('terminal_activation_tokens')
    .select('id, tenant_id, terminal_id, plan_tier, issued_at, expires_at, status, issued_by')
    .eq('tenant_id', tenantId)
    .order('issued_at', { ascending: false });
  return unwrap({ data: res.data ?? [], error: res.error });
}

export async function listPlanComponents(): Promise<PlanComponentRow[]> {
  const res = await supabase
    .from('plan_components')
    .select('id, component_type, feature_key, unit_price, currency, billing_unit')
    .order('component_type');
  return unwrap({ data: res.data ?? [], error: res.error });
}

export async function createPlanComponent(input: Omit<PlanComponentRow, 'id'>): Promise<PlanComponentRow> {
  const id = `PC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await supabase.from('plan_components').insert({ id, ...input }).select().single();
  return unwrap({ data: res.data, error: res.error });
}

export async function updatePlanComponent(id: string, input: Partial<Omit<PlanComponentRow, 'id'>>): Promise<PlanComponentRow> {
  const res = await supabase.from('plan_components').update(input).eq('id', id).select().single();
  return unwrap({ data: res.data, error: res.error });
}

export async function deletePlanComponent(id: string): Promise<void> {
  const { error } = await supabase.from('plan_components').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listTenantSubscriptions(tenantId: string): Promise<TenantSubscriptionRow[]> {
  const res = await supabase
    .from('tenant_subscriptions')
    .select('id, plan_component_id, quantity, active_since, active_until')
    .eq('tenant_id', tenantId);
  return unwrap({ data: res.data ?? [], error: res.error });
}

export async function createTenantSubscription(input: {
  tenantId: string;
  planComponentId: string;
  quantity: number;
}): Promise<TenantSubscriptionRow> {
  const id = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await supabase
    .from('tenant_subscriptions')
    .insert({ id, tenant_id: input.tenantId, plan_component_id: input.planComponentId, quantity: input.quantity })
    .select('id, plan_component_id, quantity, active_since, active_until')
    .single();
  return unwrap({ data: res.data, error: res.error });
}

export async function updateTenantSubscriptionQuantity(id: string, quantity: number): Promise<void> {
  const { error } = await supabase.from('tenant_subscriptions').update({ quantity }).eq('id', id);
  if (error) throw new Error(error.message);
}

// DL-053: soft delete (active_until = now()), not a hard DELETE — a hard
// delete would erase the row (and its active_since) before the period it
// was active during ever gets invoiced, silently under-billing for days
// already used. tenant_subscriptions' DELETE grant was revoked at the
// database level for exactly this reason (see the migration that added
// this), so a hard delete isn't even available as a fallback here anymore.
export async function endTenantSubscription(id: string): Promise<void> {
  const { error } = await supabase
    .from('tenant_subscriptions')
    .update({ active_until: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// DL-052/DL-053: billingPeriod is no longer caller input — the Edge
// Function derives it (and period_start/period_end) from the tenant's
// billing_cycle and either their most recent invoice or their onboarding
// anchor. This always generates whatever the next period in sequence is.
export async function generateBillingInvoice(input: {
  tenantId: string;
}): Promise<{ id: string; billingPeriod: string; periodStart: string; periodEnd: string; lineItems: BillingLineItem[]; total: number; currency: string }> {
  return invokeConsoleFunction('console-generate-billing-invoice', input);
}

export async function listBillingInvoices(tenantId: string): Promise<BillingInvoiceRow[]> {
  const res = await supabase
    .from('billing_invoices')
    .select('id, tenant_id, billing_period, period_start, period_end, line_items, total, currency, status, paid_at, payment_reference')
    .eq('tenant_id', tenantId)
    .order('period_end', { ascending: false, nullsFirst: false });
  return unwrap({ data: res.data ?? [], error: res.error });
}

export interface ConfirmInvoicePaymentResult {
  id: string;
  status: 'paid';
  paidAt: string;
  renewed: boolean;
  reason?: string;
  periodEnd?: string;
  terminalsRenewed: { terminalId: string; token: string; expiresAt: string }[];
}

// DL-054: no longer a direct table update — billing_invoices' RLS grant
// for this was revoked (see the migration adding this function) so
// payment confirmation and TerminalActivationToken renewal always happen
// together, atomically, server-side. Verifies through the abstracted
// PaymentProvider (DL-044's aggregator choice is still unresolved) and, on
// success, renews a token for every one of the tenant's terminals,
// expiring exactly when the paid period ends.
export async function confirmInvoicePayment(input: {
  invoiceId: string;
  paymentReference: string;
}): Promise<ConfirmInvoicePaymentResult> {
  return invokeConsoleFunction('console-confirm-invoice-payment', input);
}
