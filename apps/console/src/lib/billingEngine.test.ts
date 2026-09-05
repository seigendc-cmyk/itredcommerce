import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInvoiceLineItems,
  computeBillingPeriodEnd,
  computeNextBillingPeriod,
  formatBillingPeriodLabel,
  type PlanComponentRow,
  type TenantSubscriptionRow,
} from './billingEngine';

const PERIOD = { periodStart: '2026-02-01T00:00:00.000Z', periodEnd: '2026-03-01T00:00:00.000Z' }; // 28-day February period

const BASE_COMPONENT: PlanComponentRow = {
  id: 'PC-base',
  component_type: 'base',
  feature_key: null,
  unit_price: 100,
  currency: 'USD',
  billing_unit: 'tenant',
};

const FEATURE_COMPONENT: PlanComponentRow = {
  id: 'PC-feature',
  component_type: 'feature',
  feature_key: 'bi_brain',
  unit_price: 50,
  currency: 'USD',
  billing_unit: 'tenant',
};

function sub(overrides: Partial<TenantSubscriptionRow>): TenantSubscriptionRow {
  return { id: 'SUB-1', plan_component_id: BASE_COMPONENT.id, quantity: 1, active_since: PERIOD.periodStart, active_until: null, ...overrides };
}

test('a subscription active for the entire period bills at full price (fraction 1)', () => {
  const result = calculateInvoiceLineItems([BASE_COMPONENT], [sub({})], PERIOD);
  assert.equal(result.lineItems.length, 1);
  assert.equal(result.lineItems[0].proratedFraction, 1);
  assert.equal(result.lineItems[0].amount, 100);
  assert.equal(result.total, 100);
});

test('a subscription starting mid-period is prorated to the fraction actually active', () => {
  // Feb has 28 days in 2026 (not a leap year). Starting Feb 15 00:00Z means
  // 14 of 28 days active = exactly half.
  const result = calculateInvoiceLineItems([BASE_COMPONENT], [sub({ active_since: '2026-02-15T00:00:00.000Z' })], PERIOD);
  assert.equal(result.lineItems.length, 1);
  assert.equal(result.lineItems[0].proratedFraction, 0.5);
  assert.equal(result.lineItems[0].amount, 50);
});

test('a subscription ending mid-period (removed before period end) is prorated to the fraction it was active', () => {
  const result = calculateInvoiceLineItems([BASE_COMPONENT], [sub({ active_until: '2026-02-15T00:00:00.000Z' })], PERIOD);
  assert.equal(result.lineItems[0].proratedFraction, 0.5);
  assert.equal(result.lineItems[0].amount, 50);
});

test('a subscription both starting and ending mid-period is prorated to just that overlap', () => {
  // Active Feb 8 - Feb 22: 14 of 28 days = half, regardless of the period's own boundaries.
  const result = calculateInvoiceLineItems(
    [BASE_COMPONENT],
    [sub({ active_since: '2026-02-08T00:00:00.000Z', active_until: '2026-02-22T00:00:00.000Z' })],
    PERIOD
  );
  assert.equal(result.lineItems[0].proratedFraction, 0.5);
});

test('a subscription that ended before this period started is excluded entirely', () => {
  const result = calculateInvoiceLineItems([BASE_COMPONENT], [sub({ active_until: '2026-01-15T00:00:00.000Z' })], PERIOD);
  assert.equal(result.lineItems.length, 0);
  assert.equal(result.total, 0);
});

test('a subscription that starts after this period ends is excluded entirely', () => {
  const result = calculateInvoiceLineItems([BASE_COMPONENT], [sub({ active_since: '2026-03-15T00:00:00.000Z' })], PERIOD);
  assert.equal(result.lineItems.length, 0);
});

test('proration applies uniformly to feature-type components too, not just base/branch/terminal', () => {
  // DL-051 (flat fee) is about scale, not an exemption from proration.
  const result = calculateInvoiceLineItems(
    [FEATURE_COMPONENT],
    [sub({ plan_component_id: FEATURE_COMPONENT.id, active_since: '2026-02-15T00:00:00.000Z' })],
    PERIOD
  );
  assert.equal(result.lineItems[0].componentType, 'feature');
  assert.equal(result.lineItems[0].proratedFraction, 0.5);
  assert.equal(result.lineItems[0].amount, 25);
});

test('multiple subscriptions in the same invoice are prorated independently and summed correctly', () => {
  const result = calculateInvoiceLineItems(
    [BASE_COMPONENT, FEATURE_COMPONENT],
    [
      sub({ id: 'SUB-1', plan_component_id: BASE_COMPONENT.id }), // full period: 100
      sub({ id: 'SUB-2', plan_component_id: FEATURE_COMPONENT.id, active_since: '2026-02-15T00:00:00.000Z' }), // half: 25
    ],
    PERIOD
  );
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.total, 125);
});

test('computeBillingPeriodEnd advances by whole calendar months/quarters/years', () => {
  const start = new Date('2026-02-01T00:00:00.000Z');
  assert.equal(computeBillingPeriodEnd(start, 'monthly').toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(computeBillingPeriodEnd(start, 'quarterly').toISOString(), '2026-05-01T00:00:00.000Z');
  assert.equal(computeBillingPeriodEnd(start, 'yearly').toISOString(), '2027-02-01T00:00:00.000Z');
});

test('computeBillingPeriodEnd overflows past a short month rather than clamping (documented JS Date behavior, matches Postgres interval math)', () => {
  // Jan 31 + 1 month has no Feb 31 — both JS Date.setUTCMonth and
  // Postgres's `+ interval '1 month'` overflow into March rather than
  // clamping to Feb 28/29. Asserting this explicitly since it's a known,
  // easy-to-get-wrong quirk (DL-052).
  const janThirtyFirst = new Date('2026-01-31T00:00:00.000Z');
  assert.equal(computeBillingPeriodEnd(janThirtyFirst, 'monthly').toISOString(), '2026-03-03T00:00:00.000Z');
});

test('computeNextBillingPeriod uses the tenant anchor when there is no prior invoice', () => {
  const period = computeNextBillingPeriod('monthly', '2026-01-15T00:00:00.000Z', null);
  assert.equal(period.periodStart, '2026-01-15T00:00:00.000Z');
  assert.equal(period.periodEnd, '2026-02-15T00:00:00.000Z');
});

test('computeNextBillingPeriod chains from the most recent invoice period_end, ignoring the anchor', () => {
  const period = computeNextBillingPeriod('monthly', '2026-01-15T00:00:00.000Z', '2026-02-15T00:00:00.000Z');
  assert.equal(period.periodStart, '2026-02-15T00:00:00.000Z');
  assert.equal(period.periodEnd, '2026-03-15T00:00:00.000Z');
});

test('formatBillingPeriodLabel formats monthly, quarterly, and yearly labels', () => {
  const marchFirst = new Date('2026-03-01T00:00:00.000Z');
  assert.equal(formatBillingPeriodLabel(marchFirst, 'monthly'), '2026-03');
  assert.equal(formatBillingPeriodLabel(marchFirst, 'quarterly'), '2026-Q1');
  assert.equal(formatBillingPeriodLabel(marchFirst, 'yearly'), '2026');

  const octoberFirst = new Date('2026-10-01T00:00:00.000Z');
  assert.equal(formatBillingPeriodLabel(octoberFirst, 'quarterly'), '2026-Q4');
});
