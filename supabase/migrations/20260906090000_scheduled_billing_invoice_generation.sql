-- Scheduled invoice generation (DL-055) — the one piece of Prompt 15's
-- original scope left unbuilt after DL-052/DL-053/DL-054: invoice
-- generation was still exclusively console-operator-triggered
-- (console-generate-billing-invoice), with no guard anywhere against a
-- tenant's next period quietly going un-invoiced if no operator happened
-- to click "Generate" for them.
--
-- Follows the exact pg_cron -> pg_net -> Edge Function shape
-- 20260831150000_whatsapp_notifications.sql already established for
-- "a scheduled sweep needs to invoke an Edge Function": a platform_settings
-- row holds the (deployment-seeded) URL + a shared secret, a SECURITY
-- DEFINER function reads them and does nothing if unconfigured, and the
-- Edge Function itself checks the secret header rather than requiring a
-- human console-operator's JWT for this one caller. Reusing
-- console-generate-billing-invoice this way — rather than a second copy of
-- calculateInvoiceLineItems in plpgsql — keeps exactly two copies of that
-- math (apps/console's live preview, and this Edge Function), the same
-- count the function's own header comment already commits to.
create extension if not exists pg_net;

insert into platform_settings (key, value) values
  ('billing_invoice_generator_url', null),
  ('billing_invoice_generator_secret', null)
on conflict (key) do nothing;

-- --------------------------------------------------------
-- Which tenants have a fully-elapsed next period nobody has invoiced yet.
-- Chains the same way console-generate-billing-invoice's own period-1 step
-- does (from the latest invoice's period_end, or onboarding_completed_at
-- for a tenant's first-ever invoice) and reuses compute_billing_period_end
-- (DL-052) rather than re-deriving period math a third way. Only ACTIVE
-- tenants are considered — a SUSPENDED/CLOSED tenant isn't billed for
-- periods elapsing while it isn't a going concern.
-- --------------------------------------------------------
create or replace function tenants_due_for_billing_invoice()
returns table(tenant_id text)
language sql
stable
as $$
  select t.id
  from tenants t
  where t.status = 'ACTIVE'
    and t.onboarding_completed_at is not null
    and compute_billing_period_end(
      coalesce(
        (
          select bi.period_end
          from billing_invoices bi
          where bi.tenant_id = t.id and bi.period_end is not null
          order by bi.period_end desc
          limit 1
        ),
        t.onboarding_completed_at
      ),
      t.billing_cycle
    ) <= now();
$$;

-- Fire-and-forget per due tenant, mirroring trigger_whatsapp_notification_drain's
-- shape exactly: unconfigured means "deployment step pending," not an error
-- to raise on every run. A tenant several periods behind only advances one
-- period per invocation of console-generate-billing-invoice (it always
-- computes just the next chained period); catching fully up takes one run
-- of this sweep per missed period, which is fine at this cadence — nothing
-- here is time-critical to the day, only to eventually happening before the
-- resulting invoice itself would start affecting the module-lock grace
-- period (DL-040) on an unrelated, already-generated invoice.
create or replace function trigger_billing_invoice_generation() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_tenant_id text;
begin
  select value into v_url from platform_settings where key = 'billing_invoice_generator_url';
  select value into v_secret from platform_settings where key = 'billing_invoice_generator_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  for v_tenant_id in select tenant_id from tenants_due_for_billing_invoice()
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-drain-secret', v_secret),
      body := jsonb_build_object('tenantId', v_tenant_id)
    );
  end loop;
end;
$$;

revoke all on function trigger_billing_invoice_generation() from public;

-- Daily, not hourly: unlike mark-overdue-billing-invoices (which reacts to
-- a payment deadline) or drain-whatsapp-notifications (user-facing
-- latency), a billing period elapsing has no reason to be caught inside
-- the same hour it ends — the monthly/quarterly/yearly cycles this applies
-- to are measured in days at the shortest.
select cron.schedule('generate-due-billing-invoices', '0 2 * * *', $$select trigger_billing_invoice_generation()$$);
