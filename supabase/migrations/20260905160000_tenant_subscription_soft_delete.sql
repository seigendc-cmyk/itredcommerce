-- Mid-cycle proration (DL-053, follow-up to DL-052): a hard DELETE on
-- tenant_subscriptions would silently under-bill a removal made mid-period
-- — the row (and its active_since) would be gone by the time that period's
-- invoice generates, so the tenant would be charged nothing for the days
-- they actually had it. The console client now sets active_until = now()
-- instead of deleting (apps/console/src/lib/consoleApi.ts's
-- endTenantSubscription, formerly deleteTenantSubscription) — this
-- migration removes the DELETE grant/policy so that's enforced at the
-- database level, not just a client-side convention any direct REST call
-- could bypass, the same discipline DL-051's flat-quantity trigger already
-- applies to this same table.
revoke delete on tenant_subscriptions from authenticated;
drop policy if exists tenant_subscriptions_console_delete on tenant_subscriptions;
