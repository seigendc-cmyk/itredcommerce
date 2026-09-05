// Billing calculation engine (DL-047). Deliberately never branches on
// componentType or billingUnit's value — it takes no position on DL-043's
// still-open proration question. Feature add-on billing scope (flat vs.
// per-branch/per-terminal) IS resolved (DL-051: tenant-wide flat fee), but
// not by this function branching on componentType — a database trigger on
// tenant_subscriptions enforces that a feature-type row's quantity is
// always 1, so this function's plain quantity * unitPrice already produces
// the flat-fee result without needing an opinion of its own.
// This is the live-preview copy, used before "Generate Invoice" actually
// writes anything. The authoritative copy that runs at generation time
// lives in supabase/functions/console-generate-billing-invoice/index.ts —
// duplicated rather than shared, since a Deno Edge Function and this
// Vite-bundled browser app have no build pipeline in common (DL-038). Keep
// both in sync manually; neither has anything tricky to keep in sync, since
// neither branches on anything beyond quantity * unit_price.
export interface PlanComponentRow {
  id: string;
  component_type: 'base' | 'branch' | 'terminal' | 'feature';
  feature_key: string | null;
  unit_price: number;
  currency: string;
  billing_unit: string;
}

export interface TenantSubscriptionRow {
  id: string;
  plan_component_id: string;
  quantity: number;
}

export interface BillingLineItem {
  planComponentId: string;
  componentType: string;
  featureKey: string | null;
  billingUnit: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  amount: number;
}

export interface InvoiceCalculation {
  lineItems: BillingLineItem[];
  total: number;
  currency: string | null;
}

export function calculateInvoiceLineItems(
  components: PlanComponentRow[],
  subscriptions: TenantSubscriptionRow[]
): InvoiceCalculation {
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
