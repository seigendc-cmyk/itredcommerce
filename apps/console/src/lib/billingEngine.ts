// Billing calculation engine (DL-047, DL-053). Deliberately never branches
// on componentType or billingUnit's value — it takes no position on
// per-branch/per-terminal scope (resolved: DL-051, tenant-wide flat fee for
// features, enforced by a database trigger, not by this function). This is
// the live-preview copy, used before "Generate Invoice" actually writes
// anything. The authoritative copy that runs at generation time lives in
// supabase/functions/console-generate-billing-invoice/index.ts — duplicated
// rather than shared, since a Deno Edge Function and this Vite-bundled
// browser app have no build pipeline in common (DL-038). Keep both in sync
// manually.
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
  active_since: string;
  active_until: string | null;
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
  // 1 for a subscription active the whole period; less than 1 when
  // active_since/active_until (DL-053) clipped it to only part of
  // [periodStart, periodEnd). Exposed so a preview/invoice can show *why*
  // an amount is less than quantity * unitPrice, not just a smaller number.
  proratedFraction: number;
}

export interface InvoiceCalculation {
  lineItems: BillingLineItem[];
  total: number;
  currency: string | null;
}

export interface BillingPeriod {
  periodStart: string;
  periodEnd: string;
}

// DL-053: mid-cycle proration — rolled into the invoice for whatever period
// a subscription was actually (partially) active during, rather than a
// separate immediate charge. Applies uniformly to every component_type,
// including 'feature' rows: DL-051's flat-fee resolution is about SCALE
// (never scaling by branch/terminal count), not an exemption from
// proration — a flat fee can still be prorated for the partial period it
// was active. Never branches on component_type, same as before.
export function calculateInvoiceLineItems(
  components: PlanComponentRow[],
  subscriptions: TenantSubscriptionRow[],
  period: BillingPeriod
): InvoiceCalculation {
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
    // Not active at any point during this period — e.g. ended before it
    // started, or starts after it ends. Excluded entirely rather than
    // included at a zero/negative amount.
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

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

// Client-side mirror of supabase/migrations/20260905150000_billing_cycle_and_periods.sql's
// compute_billing_period_end() — calendar-based (+1/+3/+12 months), not a
// fixed day-count, for the same reason: "your March invoice" should stay
// the actual calendar March indefinitely rather than drifting (DL-052).
// This is a PREVIEW-only duplicate (same DL-038/DL-047 rationale as
// calculateInvoiceLineItems above) — the authoritative period boundaries
// used at generation time are computed server-side in the Edge Function
// (and ultimately by the same SQL function this mirrors); any drift here
// would only ever affect what the console shows before generating, never
// what actually gets invoiced.
export function computeBillingPeriodEnd(periodStart: Date, billingCycle: BillingCycle): Date {
  const result = new Date(periodStart);
  const monthsToAdd = billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 3 : 12;
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  return result;
}

// Mirrors the Edge Function's period-chaining logic (DL-053): the next
// period to invoice starts where the tenant's most recently generated
// invoice left off, or at their billing anchor (onboarding_completed_at,
// DL-052) if they've never been invoiced. Used only to show an accurate
// "what would the next invoice cover" preview — never to decide what
// actually gets written.
export function computeNextBillingPeriod(
  billingCycle: BillingCycle,
  anchor: string,
  mostRecentInvoicePeriodEnd: string | null
): BillingPeriod {
  const periodStart = mostRecentInvoicePeriodEnd ? new Date(mostRecentInvoicePeriodEnd) : new Date(anchor);
  const periodEnd = computeBillingPeriodEnd(periodStart, billingCycle);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

// Derived display label (DL-052) — e.g. '2026-09' for monthly, '2026-Q3'
// for quarterly, '2026' for yearly — computed from a period's start date,
// never accepted as free-text input. Mirrors the Edge Function's copy.
export function formatBillingPeriodLabel(periodStart: Date, billingCycle: BillingCycle): string {
  const year = periodStart.getUTCFullYear();
  const month = periodStart.getUTCMonth(); // 0-indexed
  if (billingCycle === 'yearly') return String(year);
  if (billingCycle === 'quarterly') return `${year}-Q${Math.floor(month / 3) + 1}`;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}
