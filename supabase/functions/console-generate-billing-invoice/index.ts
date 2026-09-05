// Console-operator action: generate a billing_invoices row for one tenant/
// billing period (DL-043/DL-047). Reads that tenant's active
// tenant_subscriptions joined to plan_components and sums them into line
// items — a service-role Edge Function rather than a direct client write so
// a generated invoice's total/line_items are never something a client
// computes and asserts on its own; billing_invoices' RLS grant only lets a
// console operator update status/paid_at/payment_reference afterward.
//
// calculateInvoiceLineItems below is intentionally duplicated from
// apps/console/src/lib/billingEngine.ts (used there for the live preview
// before generation) rather than shared — apps/console has zero shared
// runtime with anything outside itself (DL-038), and a Deno Edge Function
// and a Vite-bundled browser app have no build pipeline in common to share
// a file through even without that constraint. Keep the two in sync
// manually; neither branches on component_type or billing_unit's value, so
// there is nothing tricky to keep in sync (DL-047).
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
}

// Never branches on component_type or billing_unit's value (DL-047) —
// mechanically sums quantity * unit_price per subscribed component and
// labels the line with the component's own billing_unit, taking no
// position on either of DL-043's still-open questions.
function calculateInvoiceLineItems(
  components: PlanComponentRow[],
  subscriptions: TenantSubscriptionRow[]
): { lineItems: BillingLineItem[]; total: number; currency: string | null } {
  const componentsById = new Map(components.map((c) => [c.id, c]));
  const lineItems: BillingLineItem[] = [];
  let total = 0;
  let currency: string | null = null;

  for (const sub of subscriptions) {
    const component = componentsById.get(sub.plan_component_id);
    if (!component) continue;
    const amount = Math.round(sub.quantity * component.unit_price * 100) / 100;
    lineItems.push({
      planComponentId: component.id,
      componentType: component.component_type,
      featureKey: component.feature_key,
      billingUnit: component.billing_unit,
      quantity: sub.quantity,
      unitPrice: component.unit_price,
      currency: component.currency,
      amount,
    });
    total = Math.round((total + amount) * 100) / 100;
    currency = currency ?? component.currency;
  }

  return { lineItems, total, currency };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerJwt) return json({ error: 'Missing Authorization header' }, 401);

  let body: { tenantId?: string; billingPeriod?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { tenantId, billingPeriod } = body;
  if (!tenantId || !billingPeriod) {
    return json({ error: 'tenantId and billingPeriod are required' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

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

  const { data: subscriptions, error: subsErr } = await admin
    .from('tenant_subscriptions')
    .select('id, plan_component_id, quantity')
    .eq('tenant_id', tenantId)
    .or(`active_until.is.null,active_until.gt.${new Date().toISOString()}`);
  if (subsErr) {
    console.error('[console-generate-billing-invoice] tenant_subscriptions read failed:', subsErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!subscriptions || subscriptions.length === 0) {
    return json({ error: 'No active subscriptions for this tenant' }, 400);
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

  const { lineItems, total, currency } = calculateInvoiceLineItems(components ?? [], subscriptions);
  if (lineItems.length === 0 || !currency) {
    return json({ error: 'Subscribed components could not be resolved to a price' }, 400);
  }

  const id = generateId('INV');
  const { error: insertErr } = await admin.from('billing_invoices').insert({
    id,
    tenant_id: tenantId,
    billing_period: billingPeriod,
    line_items: lineItems,
    total,
    currency,
    status: 'pending',
  });
  if (insertErr) {
    console.error('[console-generate-billing-invoice] insert failed:', insertErr);
    return json({ error: 'Failed to generate invoice' }, 502);
  }

  return json({ id, lineItems, total, currency });
});
