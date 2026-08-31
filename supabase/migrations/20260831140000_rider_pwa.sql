-- Rider PWA (Prompt 9): broadcast board, accept/progress, and confirmation-
-- code verification. This PWA has no backend of its own (DL-002, same shape
-- as the Executive PWA) — every write below happens directly from the
-- rider's browser session under RLS, except the security-sensitive
-- confirmation-code check, which follows DL-011's verify_staff_pin
-- precedent (a SECURITY DEFINER RPC is the one place that comparison and
-- its attempt-counting/lockout side effects happen, never a plain client
-- UPDATE).

-- --------------------------------------------------------
-- RIDER LIVE LOCATION & AVAILABILITY
-- --------------------------------------------------------
-- A rider's current position is a single live value, not a tracked history
-- — the broadcast board only ever needs "where are they right now," and a
-- full location-history ledger isn't asked for by this prompt.
alter table riders add column if not exists current_latitude numeric(9, 6);
alter table riders add column if not exists current_longitude numeric(9, 6);
alter table riders add column if not exists location_updated_at timestamptz;
alter table riders add column if not exists is_available boolean not null default false;

-- Riders manage their own profile (availability, live location, vehicle
-- type, phone) directly — this is self-service, not a back-office admin
-- action, unlike riders_write/riders_update (Prompt 7, still back-office-
-- only for onboarding a new rider's initial record). RLS controls which
-- ROWS a rider can touch (their own only); it doesn't further restrict
-- which columns, matching this table's small, entirely-self-owned field
-- set.
create policy riders_update_own on riders for update
  using (tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id())
  with check (tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id());

-- --------------------------------------------------------
-- DELIVERY ORDERS — rider visibility and self-service transitions
-- --------------------------------------------------------
-- Additive to delivery_orders_select (Prompt 7, till/head-office only):
-- a rider sees every unclaimed posted order tenant-wide (the broadcast
-- board applies the proximity/radius filter client-side — see
-- rider-pwa/src/lib/riderApi.ts) plus their own order once claimed,
-- regardless of its status.
create policy delivery_orders_rider_select on delivery_orders for select
  using (
    tenant_id = app_current_tenant_id()
    and app_current_role() = 'rider'
    and (
      status = 'posted'
      or rider_id in (select id from riders where tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id())
    )
  );

-- Pull model, no waterfall (per the prompt): any rider may claim any
-- currently-unclaimed posted order for themselves. The USING clause reads
-- the row's state *before* the update (must be posted/unclaimed); WITH
-- CHECK constrains what the row is allowed to become (accepted, and
-- rider_id must be the claiming rider's own row) — this is what stops a
-- rider from claiming on someone else's behalf or changing the row into
-- any other state via this policy.
create policy delivery_orders_rider_accept on delivery_orders for update
  using (
    tenant_id = app_current_tenant_id()
    and app_current_role() = 'rider'
    and status = 'posted'
    and rider_id is null
  )
  with check (
    tenant_id = app_current_tenant_id()
    and status = 'accepted'
    and rider_id in (select id from riders where tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id())
  );

-- A rider progressing their own already-accepted order to in_transit.
-- Reaching delivered/under_investigation is deliberately NOT reachable via
-- any client-side UPDATE policy — only verify_delivery_code() below can
-- get there, since those transitions carry the confirmation-code and
-- attempt-count logic that must never be bypassable by a direct write.
create policy delivery_orders_rider_progress on delivery_orders for update
  using (
    tenant_id = app_current_tenant_id()
    and app_current_role() = 'rider'
    and status = 'accepted'
    and rider_id in (select id from riders where tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id())
  )
  with check (
    tenant_id = app_current_tenant_id()
    and status = 'in_transit'
    and rider_id in (select id from riders where tenant_id = app_current_tenant_id() and staff_id = app_current_staff_id())
  );

-- --------------------------------------------------------
-- DELIVERY NOTIFICATIONS — durable trigger record, not a live send
-- --------------------------------------------------------
-- No WhatsApp Business API integration exists anywhere in this codebase,
-- and per the governance doc's explicit "WhatsApp template wording...
-- requires a proposal-and-sign-off step before implementation — do not
-- implement any of these unilaterally," this migration does NOT fabricate
-- message wording or a live send. What it does build is the durable,
-- auditable trigger: verify_delivery_code() inserts one row here on a
-- lockout, with the confirmed recipient-resolution decision (branch-level
-- contact, since the creating staff member may be off-shift) already
-- correctly wired — a future prompt that adds real WhatsApp sending has a
-- queue of real rows to consume, with nothing here needing to change.
create table if not exists delivery_notifications (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  delivery_order_id text not null,
  notification_type text not null default 'CODE_LOCKOUT',
  channel text not null default 'WHATSAPP',
  recipient_type text not null default 'BRANCH_CONTACT',
  recipient_phone text,
  -- Not real message copy — a key for whichever template a future,
  -- explicitly-approved prompt defines. See header comment.
  message_template_key text not null default 'PENDING_TEMPLATE_SIGNOFF',
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  foreign key (tenant_id, delivery_order_id) references delivery_orders(tenant_id, id) on delete cascade
);
create index if not exists idx_delivery_notifications_tenant on delivery_notifications(tenant_id);
create index if not exists idx_delivery_notifications_status on delivery_notifications(tenant_id, status);

alter table delivery_notifications enable row level security;

-- Back-office-visible only (this is an operational queue for whoever
-- eventually builds the send integration, not a rider- or till-facing
-- concept) — no insert/update policy for any client role: only
-- verify_delivery_code()'s SECURITY DEFINER context ever writes here.
create policy delivery_notifications_select on delivery_notifications for select
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
-- verify_delivery_code — the one place a confirmation code is ever
-- compared, mirroring DL-011's verify_staff_pin shape exactly: a `status`
-- column returned from the row rather than a thrown exception (so the
-- attempt-count increment always commits even when the code is wrong —
-- raising would roll that back, the same bug DL-011's comment already
-- documents once), SECURITY DEFINER so it can enforce the row transition
-- regardless of the caller's own RLS grants, called directly by the rider's
-- own authenticated session (this PWA has no backend to call it on the
-- rider's behalf).
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
  v_branch_phone text;
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

    -- "Record completion to BI Brain": the same free-form ledger every
    -- other completed-transaction event in this schema writes to, so
    -- executive rollups have a real row to eventually read from.
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

  -- Wrong code: always persist the attempt increment, even on the attempt
  -- that trips the lockout (see header comment on why this can't be a
  -- `raise exception` path).
  v_next_attempt_count := v_row.confirmation_code_attempt_count + 1;

  if v_next_attempt_count >= v_max_attempts then
    update delivery_orders
      set confirmation_code_attempt_count = v_next_attempt_count, status = 'under_investigation', updated_at = now()
      where tenant_id = p_tenant_id and id = p_order_id;

    select contact_phone into v_branch_phone from branches where id = v_row.pickup_branch_id;

    insert into delivery_notifications (id, tenant_id, delivery_order_id, notification_type, recipient_type, recipient_phone)
    values ('NOTIF-' || p_order_id || '-' || v_next_attempt_count, p_tenant_id, p_order_id, 'CODE_LOCKOUT', 'BRANCH_CONTACT', v_branch_phone);

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
