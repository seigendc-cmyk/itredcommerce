-- Feature add-on billing scope resolution (DL-051, follow-up to DL-043):
-- a feature-type plan_component always bills as one tenant-wide flat fee,
-- never scaled by branch/terminal count. Enforced here at the database
-- level rather than left as a console-UI-only nicety or an operator
-- convention, because tenant_subscriptions gets ordinary direct RLS-gated
-- CRUD for any authenticated console operator (DL-047) — a client-side-only
-- check could always be bypassed by writing to the table directly via the
-- Supabase REST API. calculateInvoiceLineItems (apps/console/src/lib/
-- billingEngine.ts, console-generate-billing-invoice) still never branches
-- on component_type; this trigger is what guarantees a feature-type row's
-- quantity is always 1, so that mechanically neutral multiplication already
-- produces the flat-fee result without the calculator needing an opinion.
create or replace function enforce_feature_subscription_flat_quantity()
returns trigger
language plpgsql
as $$
declare
  v_component_type text;
begin
  select component_type into v_component_type
  from plan_components
  where id = new.plan_component_id;

  if v_component_type = 'feature' and new.quantity <> 1 then
    raise exception 'Feature add-on subscriptions must have quantity = 1 (tenant-wide flat fee, DL-051) — got %', new.quantity
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tenant_subscriptions_feature_flat_fee on tenant_subscriptions;
create trigger trg_tenant_subscriptions_feature_flat_fee
  before insert or update on tenant_subscriptions
  for each row execute function enforce_feature_subscription_flat_quantity();
