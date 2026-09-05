-- Billing cycle schema (prerequisite for DL-043's still-open proration
-- item, surfaced during the Step 0 audit ahead of implementing proration):
-- billing_invoices.billing_period was free text with no stored per-tenant
-- cycle length, so proration had nothing to measure a partial period
-- against. This migration adds that; it does not implement proration or
-- invoice generation itself (later prompts).

-- --------------------------------------------------------
-- TENANTS.BILLING_CYCLE — distinct from fiscal_year_start_month (which
-- anchors fiscal-year reporting, not billing recurrence). Text + check,
-- matching every other enum-like column in this schema (component_type,
-- billing_invoices.status, etc.) rather than a native Postgres ENUM type.
-- --------------------------------------------------------
alter table tenants
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'quarterly', 'yearly'));

-- Changing an existing tenant's billing_cycle is deliberately NOT given any
-- special handling here (confirmed out of scope for now): it applies
-- prospectively only, to periods computed after the change. The
-- most-recently-generated period is left exactly as it was invoiced: no
-- retroactive proration of the transition itself. Revisit explicitly if
-- this needs a real transition rule later.

-- --------------------------------------------------------
-- BILLING_INVOICES.PERIOD_START / PERIOD_END — the authoritative interval
-- an invoice covers, [period_start, period_end), replacing free-text
-- billing_period as the source of truth for period math. Nullable for now:
-- there is no reliable way to backfill a concrete interval from an
-- arbitrary already-typed free-text string, and no proration/generation
-- logic writes these yet. billing_period itself is kept as a computed
-- display label (e.g. '2026-09' for monthly) — no longer accepted as
-- caller input once the generator is updated to derive it from
-- period_start + the tenant's billing_cycle, but left as a plain text
-- column rather than a SQL GENERATED column, since that computation needs
-- tenants.billing_cycle from a different table and Postgres generated
-- columns can only reference columns in the same row.
-- --------------------------------------------------------
alter table billing_invoices
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz;

-- --------------------------------------------------------
-- Period-boundary math — calendar-based (+1/+3/+12 months), not a fixed
-- day-count, so "your March invoice" stays the actual calendar March
-- indefinitely rather than drifting. The tradeoff this creates (a
-- monthly period's actual length varies 28-31 days) is what step 2's
-- proration math will need to account for via period_end - period_start,
-- not a hardcoded day count.
-- --------------------------------------------------------
create or replace function compute_billing_period_end(p_period_start timestamptz, p_billing_cycle text)
returns timestamptz
language sql
immutable
as $$
  select case p_billing_cycle
    when 'monthly' then p_period_start + interval '1 month'
    when 'quarterly' then p_period_start + interval '3 months'
    when 'yearly' then p_period_start + interval '1 year'
    else null
  end
$$;

-- Given a tenant's billing anchor (onboarding_completed_at) and cycle,
-- returns the [period_start, period_end) interval containing `p_as_of`
-- (defaults to now()). Walks forward from the anchor in whole cycle-length
-- steps rather than assuming a fixed day-count, so it stays correct across
-- variable-length calendar periods without drifting. `stable`, not
-- `immutable`, since p_as_of's default (now()) makes repeated calls within
-- the same statement consistent but not eternally fixed.
create or replace function compute_current_billing_period(
  p_anchor timestamptz,
  p_billing_cycle text,
  p_as_of timestamptz default now()
)
returns table(period_start timestamptz, period_end timestamptz)
language plpgsql
stable
as $$
declare
  v_start timestamptz := p_anchor;
  v_end timestamptz;
begin
  loop
    v_end := compute_billing_period_end(v_start, p_billing_cycle);
    exit when v_end > p_as_of;
    v_start := v_end;
  end loop;
  period_start := v_start;
  period_end := v_end;
  return next;
end;
$$;
