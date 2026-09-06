// Console-operator action: generate a billing_invoices row for one tenant
// (DL-043/DL-047/DL-052/DL-053). Reads that tenant's tenant_subscriptions
// overlapping the next period to invoice, joined to plan_components, and
// sums them into prorated line items — a service-role Edge Function rather
// than a direct client write so a generated invoice's total/line_items are
// never something a client computes and asserts on its own; billing_invoices'
// RLS grant only lets a console operator update status/paid_at/payment_reference
// afterward.
//
// Also callable by the scheduled generator (DL-055,
// trigger_billing_invoice_generation) via an `x-drain-secret` header
// matching BILLING_INVOICE_GENERATOR_SECRET — the same shared-secret shape
// whatsapp-notify already uses for its own pg_cron-driven caller — instead
// of a console-operator JWT. That caller isn't a person clicking "Generate"
// in the console UI, so it has no operator session to present; everything
// past the auth check below (period chaining, subscription lookup, line
// items, insert) is identical either way.
//
// calculateInvoiceLineItems (and the period-math helpers below it) are
// intentionally duplicated from apps/console/src/lib/billingEngine.ts (used
// there for the live preview before generation) rather than shared —
// apps/console has zero shared runtime with anything outside itself
// (DL-038), and a Deno Edge Function and a Vite-bundled browser app have no
// build pipeline in common to share a file through even without that
// constraint. Keep both copies in sync manually. Neither branches on
// component_type or billing_unit's value (DL-047) — feature add-on billing
// scope IS resolved (DL-051: tenant-wide flat fee), enforced by a database
// trigger on tenant_subscriptions, not by either copy of this function
// branching, so the "don't branch on component_type" invariant still holds.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

interface PlanComponentRow {
  id: string;
  component_type: string;
  feature_key: string | null;
  unit_price: number;
  currency: string;
  billing_unit: string;
}

interface TenantSubscriptionRow {
  id: string;
  plan_component_id: string;
  quantity: number;
  active_since: string;
  active_until: string | null;
}

interface BillingLineItem {
  planComponentId: string;
  componentType: string;
  featureKey: string | null;
  billingUnit: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  amount: number;
  proratedFraction: number;
}

interface BillingPeriod {
  periodStart: string;
  periodEnd: string;
}

// DL-053: mid-cycle proration, rolled into the invoice for whatever period a
// subscription was actually (partially) active during — never a separate
// immediate charge. Applies uniformly to every component_type, including
// 'feature' rows: DL-051's flat fee is about scale, not an exemption from
// proration.
function calculateInvoiceLineItems(
  components: PlanComponentRow[],
  subscriptions: TenantSubscriptionRow[],
  period: BillingPeriod
): { lineItems: BillingLineItem[]; total: number; currency: string | null } {
  const componentsById = new Map(components.map((c) => [c.id, c]));
  const periodStartMs = new Date(period.periodStart).getTime();
  const periodEndMs = new Date(period.periodEnd).getTime();
  const periodLengthMs = periodEndMs - periodStartMs;
  const lineItems: BillingLineItem[] = [];
  let total = 0;
  let currency: string | null = null;

  for (const sub of subscriptions) {
    const component = componentsById.get(sub.plan_component_id);
    if (!component) continue;

    const activeSinceMs = new Date(sub.active_since).getTime();
    const activeUntilMs = sub.active_until ? new Date(sub.active_until).getTime() : periodEndMs;
    const effectiveStartMs = Math.max(activeSinceMs, periodStartMs);
    const effectiveEndMs = Math.min(activeUntilMs, periodEndMs);
    if (effectiveStartMs >= effectiveEndMs) continue;

    const proratedFraction = (effectiveEndMs - effectiveStartMs) / periodLengthMs;
    const amount = Math.round(sub.quantity * component.unit_price * proratedFraction * 100) / 100;
    lineItems.push({
      planComponentId: component.id,
      componentType: component.component_type,
      featureKey: component.feature_key,
      billingUnit: component.billing_unit,
      quantity: sub.quantity,
      unitPrice: component.unit_price,
      currency: component.currency,
      amount,
      proratedFraction,
    });
    total = Math.round((total + amount) * 100) / 100;
    currency = currency ?? component.currency;
  }

  return { lineItems, total, currency };
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

// Authoritative mirror of supabase/migrations/20260905150000_billing_cycle_and_periods.sql's
// compute_billing_period_end() (DL-052) — calendar-based, not fixed-day-count.
function computeBillingPeriodEnd(periodStart: Date, billingCycle: BillingCycle): Date {
  const result = new Date(periodStart);
  const monthsToAdd = billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 3 : 12;
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  return result;
}

// Derived display label (DL-052) — never accepted as caller input.
function formatBillingPeriodLabel(periodStart: Date, billingCycle: BillingCycle): string {
  const year = periodStart.getUTCFullYear();
  const month = periodStart.getUTCMonth();
  if (billingCycle === 'yearly') return String(year);
  if (billingCycle === 'quarterly') return `${year}-Q${Math.floor(month / 3) + 1}`;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { tenantId } = body;
  if (!tenantId) {
    return json({ error: 'tenantId is required' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // DL-055: the scheduled generator has no console-operator session to
  // present — it authenticates with a shared secret instead, the same
  // shape whatsapp-notify's pg_cron caller already uses.
  const drainSecret = req.headers.get('x-drain-secret');
  const isScheduledCaller =
    !!drainSecret && drainSecret === Deno.env.get('BILLING_INVOICE_GENERATOR_SECRET');

  if (!isScheduledCaller) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerJwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!callerJwt) return json({ error: 'Missing Authorization header' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(callerJwt);
    if (userErr || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const { data: operator, error: operatorErr } = await admin
      .from('console_operators')
      .select('is_active')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (operatorErr) {
      console.error('[console-generate-billing-invoice] operator lookup failed:', operatorErr);
      return json({ error: 'Temporarily unavailable' }, 502);
    }
    if (!operator || !operator.is_active) return json({ error: 'Not a console operator' }, 403);
  }

  // 1. Determine which period this invoice covers (DL-052/DL-053): chained
  // from the tenant's most recently generated invoice, or from their
  // billing anchor (onboarding_completed_at) if this is their first. Not
  // "as of now" — a period is always the next one in sequence, regardless
  // of when this function happens to be called. This does not guard
  // against generating a period that hasn't ended yet in real time; that's
  // a job for whichever future prompt builds the scheduled generator
  // (DL-043's "INVOICE GENERATION" step), not decided here.
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('billing_cycle, onboarding_completed_at')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenantErr) {
    console.error('[console-generate-billing-invoice] tenant read failed:', tenantErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!tenant) return json({ error: 'Tenant not found' }, 404);
  if (!tenant.onboarding_completed_at) {
    return json({ error: 'Tenant has not completed onboarding — no billing anchor available yet' }, 400);
  }
  const billingCycle = tenant.billing_cycle as BillingCycle;

  const { data: lastInvoice, error: lastInvoiceErr } = await admin
    .from('billing_invoices')
    .select('period_end')
    .eq('tenant_id', tenantId)
    .not('period_end', 'is', null)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastInvoiceErr) {
    console.error('[console-generate-billing-invoice] prior-invoice read failed:', lastInvoiceErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }

  const periodStart = new Date(lastInvoice?.period_end ?? tenant.onboarding_completed_at);
  const periodEnd = computeBillingPeriodEnd(periodStart, billingCycle);
  const period: BillingPeriod = { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };

  // 2. Subscriptions overlapping this period — not "active as of now" (a
  // fixed historical period being invoiced could be well in the past),
  // per DL-053: active_since before this period ends, and (never ended, or
  // ended after this period starts).
  const { data: subscriptions, error: subsErr } = await admin
    .from('tenant_subscriptions')
    .select('id, plan_component_id, quantity, active_since, active_until')
    .eq('tenant_id', tenantId)
    .lt('active_since', period.periodEnd)
    .or(`active_until.is.null,active_until.gt.${period.periodStart}`);
  if (subsErr) {
    console.error('[console-generate-billing-invoice] tenant_subscriptions read failed:', subsErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!subscriptions || subscriptions.length === 0) {
    return json({ error: 'No subscriptions active during this period' }, 400);
  }

  const componentIds = [...new Set(subscriptions.map((s) => s.plan_component_id))];
  const { data: components, error: componentsErr } = await admin
    .from('plan_components')
    .select('id, component_type, feature_key, unit_price, currency, billing_unit')
    .in('id', componentIds);
  if (componentsErr) {
    console.error('[console-generate-billing-invoice] plan_components read failed:', componentsErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }

  const { lineItems, total, currency } = calculateInvoiceLineItems(components ?? [], subscriptions, period);
  if (lineItems.length === 0 || !currency) {
    return json({ error: 'Subscribed components could not be resolved to a price' }, 400);
  }

  const billingPeriodLabel = formatBillingPeriodLabel(periodStart, billingCycle);
  const id = generateId('INV');
  const { error: insertErr } = await admin.from('billing_invoices').insert({
    id,
    tenant_id: tenantId,
    billing_period: billingPeriodLabel,
    period_start: period.periodStart,
    period_end: period.periodEnd,
    line_items: lineItems,
    total,
    currency,
    status: 'pending',
  });
  if (insertErr) {
    console.error('[console-generate-billing-invoice] insert failed:', insertErr);
    return json({ error: 'Failed to generate invoice' }, 502);
  }

  return json({ id, billingPeriod: billingPeriodLabel, periodStart: period.periodStart, periodEnd: period.periodEnd, lineItems, total, currency });
});
