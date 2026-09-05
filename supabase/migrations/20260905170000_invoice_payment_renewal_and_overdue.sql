-- Payment-triggered TerminalActivationToken renewal, PaymentProvider
-- abstraction, and overdue escalation (DL-054, Prompt 15 sections 3-5).
--
-- The direct client update(status, paid_at, payment_reference) grant on
-- billing_invoices (added by 20260905120000_console_operator_auth.sql) is
-- revoked: payment confirmation now goes through
-- console-confirm-invoice-payment exclusively, so marking an invoice paid
-- and renewing the tenant's TerminalActivationTokens always happen
-- together, atomically, from one service-role-mediated place. The old
-- grant let an operator mark an invoice paid without any renewal
-- happening at all — a gap this closes the same way DL-051/DL-053 already
-- closed the equivalent gaps on tenant_subscriptions (quantity, and hard
-- delete) for this same reason: an invariant enforced only by which
-- button a UI happens to show is not actually enforced.
revoke update (status, paid_at, payment_reference) on billing_invoices from authenticated;
drop policy if exists billing_invoices_console_mark_paid on billing_invoices;

-- Overdue escalation (Prompt 15 section 5): an invoice that stays
-- 'pending' past its own period_end — i.e. the tenant hasn't paid by the
-- time the period it covers has already ended — transitions to
-- 'overdue'. No separate lock mechanism is built for this (per the
-- original prompt's own instruction): an overdue invoice simply means no
-- renewed TerminalActivationToken was ever issued for that period, so the
-- tenant's terminals' existing tokens run out their own expires_at plus
-- the 5-working-day grace period and lock via the already-built
-- DL-040/DL-048/DL-049 module-lock logic — nothing new to build there.
--
-- "Retry cadence" from the original prompt doesn't have a literal
-- equivalent here: there is no automated charge-attempt to retry (no real
-- aggregator is integrated yet, DL-044) — every confirmation is
-- operator-driven via ManualPaymentProvider (DL-054 below), and an
-- operator can attempt to confirm payment again at any time regardless of
-- status. An automated retry schedule would have nothing to retry against
-- until a real aggregator exists.
create or replace function mark_overdue_billing_invoices() returns void
language sql
as $$
  update billing_invoices
  set status = 'overdue'
  where status = 'pending' and period_end is not null and period_end < now();
$$;

-- Hourly is deliberately not tighter: unlike whatsapp-notify's per-minute
-- drain (DL-008-adjacent, user-facing latency matters there) or executive
-- rollups' 15-minute refresh (dashboard freshness), nothing downstream of
-- an invoice going overdue is time-critical to the minute or even the
-- hour — the module lock it eventually feeds into already has its own
-- 5-working-day grace period on top.
select cron.schedule('mark-overdue-billing-invoices', '0 * * * *', $$select mark_overdue_billing_invoices()$$);
