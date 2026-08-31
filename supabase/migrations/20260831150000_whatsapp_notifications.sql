-- WhatsApp delivery notifications (Prompt 10). Widens the CODE_LOCKOUT-only
-- delivery_notifications table Prompt 9 built into a full outbox for every
-- delivery_orders status-change notification, sent through a Supabase Edge
-- Function (supabase/functions/whatsapp-notify) — the only place a Meta
-- access token is ever held, per the prompt's own requirement that this
-- never be a client-side call.
--
-- Mirrors DL-006's transactional-outbox shape deliberately: a trigger on
-- delivery_orders writes a durable PENDING row in the SAME transaction as
-- the status change (so a notification can never be silently dropped by a
-- crash between the two, whether the change came from the Express backend's
-- service-role write or a rider's own client UPDATE under RLS), and a
-- separate, independently-paced pg_cron sweep drains it by invoking the
-- Edge Function every minute. This is NOT routed through the existing
-- outbox/entityRules machinery (DL-007) — that system pushes local SQLite
-- mutations up to Supabase; this is the opposite direction (Supabase state
-- driving an outbound side effect), so it gets its own small outbox here.
--
-- Every message this system ever sends is `type: "template"` — never
-- free-form text. WhatsApp only allows free-form messages inside the 24h
-- window after a customer last messaged the business, and this table has
-- no reliable way to know if that window is open for a given recipient;
-- templates work regardless of the window and are required outside it, so
-- always using templates is the only design that doesn't silently break
-- once a delivery happens more than 24h after the customer's last message.
-- Template *content* is explicitly NOT decided by this migration — see
-- supabase/functions/whatsapp-notify/templates.ts and the governance doc's
-- new "WhatsApp Delivery Notifications" addendum for the drafted wording,
-- which still needs sign-off and Meta approval before go-live.

create extension if not exists pg_net;

-- --------------------------------------------------------
-- DELIVERY_NOTIFICATIONS — widen from Prompt 9's CODE_LOCKOUT-only shape
-- --------------------------------------------------------
alter table delivery_notifications rename column message_template_key to template_key;
alter table delivery_notifications alter column template_key drop default;
alter table delivery_notifications alter column notification_type drop default;
alter table delivery_notifications alter column recipient_type drop default;
alter table delivery_notifications add column if not exists template_params jsonb not null default '{}'::jsonb;
alter table delivery_notifications add column if not exists provider_message_id text;
alter table delivery_notifications add column if not exists error_message text;
alter table delivery_notifications add column if not exists attempt_count integer not null default 0;
alter table delivery_notifications add column if not exists sent_at timestamptz;
alter table delivery_notifications add column if not exists updated_at timestamptz not null default now();

alter table delivery_notifications drop constraint if exists delivery_notifications_status_check;
alter table delivery_notifications add constraint delivery_notifications_status_check
  check (status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED'));

do $$
begin
  alter table delivery_notifications add constraint delivery_notifications_notification_type_check
    check (notification_type in ('ORDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERY_ESCALATION', 'DELIVERED'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table delivery_notifications add constraint delivery_notifications_recipient_type_check
    check (recipient_type in ('CUSTOMER', 'BRANCH_CONTACT'));
exception
  when duplicate_object then null;
end $$;

create trigger trg_delivery_notifications_updated_at before update on delivery_notifications
  for each row execute function set_updated_at();

-- What the drain sweep (below) scans every minute.
create index if not exists idx_delivery_notifications_pending on delivery_notifications(status) where status = 'PENDING';

-- --------------------------------------------------------
-- ENQUEUE TRIGGER — the one place a delivery-status notification is ever
-- decided to be needed, so notification_type <-> status-transition mapping
-- lives in exactly one function, not scattered across every code path that
-- can change a delivery_orders row (server-side creation, a rider's own
-- RLS-gated UPDATE, and verify_delivery_code's SECURITY DEFINER writes all
-- fire this the same way — it's a table trigger, not a caller convention).
-- --------------------------------------------------------
create or replace function enqueue_delivery_notification() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_phone text;
begin
  -- Posted/assigned: the confirmation code and delivery details are fully
  -- known the moment a dispatch is created (Prompt 7), so this fires on
  -- INSERT rather than waiting for a rider to claim the job — the customer
  -- doesn't need to know which rider it is, only that a delivery with this
  -- code is coming.
  if tg_op = 'INSERT' then
    if new.status = 'posted' then
      insert into delivery_notifications (id, tenant_id, delivery_order_id, notification_type, recipient_type, recipient_phone, template_key, template_params)
      values (
        'NOTIF-' || new.id || '-ASSIGNED',
        new.tenant_id,
        new.id,
        'ORDER_ASSIGNED',
        'CUSTOMER',
        new.delivery_contact_phone,
        'delivery_order_assigned',
        jsonb_build_object(
          'customerName', coalesce(new.delivery_contact_name, 'Customer'),
          'pickupBranchName', new.pickup_branch_name,
          'deliveryAddressLine', new.delivery_address_line,
          'confirmationCode', new.confirmation_code,
          'orderRef', new.sale_number
        )
      )
      on conflict (tenant_id, id) do nothing;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'in_transit' then
      insert into delivery_notifications (id, tenant_id, delivery_order_id, notification_type, recipient_type, recipient_phone, template_key, template_params)
      values (
        'NOTIF-' || new.id || '-TRANSIT',
        new.tenant_id, new.id, 'OUT_FOR_DELIVERY', 'CUSTOMER', new.delivery_contact_phone, 'delivery_out_for_delivery',
        jsonb_build_object('customerName', coalesce(new.delivery_contact_name, 'Customer'), 'orderRef', new.sale_number, 'confirmationCode', new.confirmation_code)
      )
      on conflict (tenant_id, id) do nothing;

    -- Covers both the 3-failed-attempts lockout AND a code that simply
    -- expired unused (verify_delivery_code sets the same under_investigation
    -- status for both) — previously only the lockout path notified anyone;
    -- routing both through this one trigger closes that gap rather than
    -- carrying it forward.
    elsif new.status in ('failed', 'under_investigation') and old.status not in ('failed', 'under_investigation') then
      select contact_phone into v_branch_phone from branches where id = new.pickup_branch_id;
      insert into delivery_notifications (id, tenant_id, delivery_order_id, notification_type, recipient_type, recipient_phone, template_key, template_params)
      values (
        -- Random suffix, not deterministic: unlike the other three
        -- notification types (each fires at most once per order), an order
        -- can be reissued (DL-014's confirmed code-recovery path) and then
        -- escalate again, so this id must never collide with a prior one.
        'NOTIF-' || new.id || '-ESCALATION-' || substr(gen_random_uuid()::text, 1, 8),
        new.tenant_id, new.id, 'DELIVERY_ESCALATION', 'BRANCH_CONTACT', v_branch_phone, 'delivery_escalation_alert',
        jsonb_build_object(
          'orderRef', new.sale_number,
          'orderId', new.id,
          'reason', case when new.confirmation_code_attempt_count >= 3 then '3 failed confirmation code attempts' else 'confirmation code expired' end,
          'deliveryAddressLine', new.delivery_address_line
        )
      )
      on conflict (tenant_id, id) do nothing;

    elsif new.status = 'delivered' then
      insert into delivery_notifications (id, tenant_id, delivery_order_id, notification_type, recipient_type, recipient_phone, template_key, template_params)
      values (
        'NOTIF-' || new.id || '-DELIVERED',
        new.tenant_id, new.id, 'DELIVERED', 'CUSTOMER', new.delivery_contact_phone, 'delivery_confirmed',
        jsonb_build_object('customerName', coalesce(new.delivery_contact_name, 'Customer'), 'orderRef', new.sale_number)
      )
      on conflict (tenant_id, id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function enqueue_delivery_notification() from public;

create trigger trg_enqueue_delivery_notification
  after insert or update of status on delivery_orders
  for each row execute function enqueue_delivery_notification();

-- --------------------------------------------------------
-- verify_delivery_code — drop its Prompt 9 manual notification insert now
-- that the trigger above enqueues DELIVERY_ESCALATION generically on any
-- transition into under_investigation/failed. Everything else (ownership
-- check, state check, expiry check, the 3-attempt lockout itself, the
-- activity_events BI write) is unchanged from the Prompt 9 definition.
-- --------------------------------------------------------
create or replace function verify_delivery_code(
  p_tenant_id text,
  p_order_id text,
  p_code text
) returns table(status text, message text, attempts_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_id text;
  v_row delivery_orders%rowtype;
  v_max_attempts constant integer := 3;
  v_next_attempt_count integer;
begin
  select id into v_rider_id
  from riders
  where tenant_id = p_tenant_id and staff_id = app_current_staff_id();

  if v_rider_id is null then
    return query select 'FORBIDDEN'::text, 'No rider profile found for this account.'::text, null::integer;
    return;
  end if;

  select * into v_row
  from delivery_orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, 'Delivery order not found.'::text, null::integer;
    return;
  end if;

  if v_row.rider_id is distinct from v_rider_id then
    return query select 'FORBIDDEN'::text, 'This order is not assigned to you.'::text, null::integer;
    return;
  end if;

  if v_row.status not in ('accepted', 'in_transit') then
    return query select 'INVALID_STATE'::text, 'This order is not currently awaiting delivery confirmation.'::text, null::integer;
    return;
  end if;

  if now() > v_row.confirmation_code_expires_at then
    update delivery_orders
      set status = 'under_investigation', updated_at = now()
      where tenant_id = p_tenant_id and id = p_order_id;
    return query select 'EXPIRED'::text, 'Confirmation code expired. Dispatch has been notified to reissue one.'::text, 0;
    return;
  end if;

  if v_row.confirmation_code = p_code then
    update delivery_orders
      set status = 'delivered', updated_at = now()
      where tenant_id = p_tenant_id and id = p_order_id;

    insert into activity_events (id, tenant_id, event_type, "timestamp", description, staff_id, branch_id, reference_document, amount, metadata)
    values (
      'EVT-' || p_order_id,
      p_tenant_id,
      'DELIVERY_COMPLETED',
      now(),
      'Delivery order ' || p_order_id || ' confirmed delivered.',
      app_current_staff_id(),
      v_row.pickup_branch_id,
      p_order_id,
      v_row.fare_amount,
      jsonb_build_object(
        'saleNumber', v_row.sale_number,
        'distanceKm', v_row.distance_km,
        'routeClass', v_row.route_class,
        'rideTypeRequirement', v_row.ride_type_requirement
      )
    )
    on conflict (tenant_id, id) do nothing;

    return query select 'OK'::text, 'Delivery confirmed.'::text, null::integer;
    return;
  end if;

  v_next_attempt_count := v_row.confirmation_code_attempt_count + 1;

  if v_next_attempt_count >= v_max_attempts then
    update delivery_orders
      set confirmation_code_attempt_count = v_next_attempt_count, status = 'under_investigation', updated_at = now()
      where tenant_id = p_tenant_id and id = p_order_id;

    return query select 'LOCKED_OUT'::text, 'Too many failed attempts. This order has been flagged for investigation and the pickup branch notified.'::text, 0;
    return;
  end if;

  update delivery_orders
    set confirmation_code_attempt_count = v_next_attempt_count, updated_at = now()
    where tenant_id = p_tenant_id and id = p_order_id;

  return query select 'INVALID'::text, 'Incorrect code.'::text, (v_max_attempts - v_next_attempt_count);
end;
$$;

revoke all on function verify_delivery_code(text, text, text) from public;
grant execute on function verify_delivery_code(text, text, text) to authenticated;

-- --------------------------------------------------------
-- PLATFORM SETTINGS — the edge function URL + a shared drain secret this
-- project's own pg_cron job needs to invoke whatsapp-notify. Deliberately
-- NOT tenant-scoped: one Supabase project hosts a single whatsapp-notify
-- deployable serving every tenant (per-tenant WhatsApp Business accounts
-- are an explicitly deferred item — see the governance doc addendum), and
-- NOT granted to any client role — only the SECURITY DEFINER function below
-- ever reads it. Seeded null on purpose: populating the real URL/secret is
-- a deployment step this migration can't perform, the same class of
-- manual, dashboard/CLI-only step DL-013 already flagged for
-- access_token_hook's registration.
-- --------------------------------------------------------
create table if not exists platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into platform_settings (key, value) values
  ('whatsapp_edge_function_url', null),
  ('whatsapp_drain_secret', null)
on conflict (key) do nothing;

alter table platform_settings enable row level security;
-- No policies for any client role: unreachable except via a service-role
-- connection or the SECURITY DEFINER function below.

create or replace function trigger_whatsapp_notification_drain() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from platform_settings where key = 'whatsapp_edge_function_url';
  select value into v_secret from platform_settings where key = 'whatsapp_drain_secret';

  -- Not configured yet (deployment step pending) — do nothing rather than
  -- error every minute until someone sets it.
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-drain-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function trigger_whatsapp_notification_drain() from public;

select cron.schedule('drain-whatsapp-notifications', '* * * * *', $$select trigger_whatsapp_notification_drain()$$);
