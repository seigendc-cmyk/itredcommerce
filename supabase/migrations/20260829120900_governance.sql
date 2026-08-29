-- Approvals, operational exceptions, activity events (audit trail), backup
-- records, and BI alerts.

create table if not exists approval_requests (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  request_number text, type text, title text, description text, amount numeric(18, 4),
  reference_id text, reference_type text, location_name text,
  requested_by_staff_id text, requested_by_staff_name text, requested_by_role text,
  requested_date_time timestamptz, reason text, priority text not null default 'MEDIUM',
  status text not null default 'PENDING', decided_by_staff_id text, decided_by_staff_name text,
  decided_by_role text, decision_date_time timestamptz, decision_notes text, meta jsonb not null default '{}'::jsonb,
  primary key (tenant_id, id)
);
create index if not exists idx_approval_requests_tenant on approval_requests(tenant_id);

alter table approval_requests enable row level security;

-- Any tenant member can raise a request (e.g. a till_operator requesting a
-- discount override); back-office roles see every request tenant-wide, but
-- a requester who is neither back-office nor the request's own author has
-- no reason to see it, so non-back-office SELECT is limited to "my own".
create policy approval_requests_select on approval_requests for select
  using (
    tenant_id = app_current_tenant_id()
    and (app_is_back_office_role() or requested_by_staff_id = app_current_staff_id())
    or app_is_super_admin()
  );
create policy approval_requests_insert on approval_requests for insert
  with check (tenant_id = app_current_tenant_id() and requested_by_staff_id = app_current_staff_id());
create policy approval_requests_update on approval_requests for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
create table if not exists operational_exceptions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  exception_number text, title text, category text, date_time timestamptz,
  branch_id text references branches(id) on delete set null, branch_name text,
  terminal_id text, terminal_name text,
  staff_id text, staff_name text, related_transaction_ref text, related_event_id text,
  severity text not null default 'MEDIUM', status text not null default 'OPEN',
  variance_amount numeric(18, 4), variance_units numeric(18, 4),
  assigned_or_reviewed_by text, reviewed_date_time timestamptz,
  resolution text, details text, opened_at timestamptz, resolved_at timestamptz,
  primary key (tenant_id, id)
);
create index if not exists idx_exceptions_tenant_status on operational_exceptions(tenant_id, status);
create index if not exists idx_exceptions_tenant_branch on operational_exceptions(tenant_id, branch_id);

alter table operational_exceptions enable row level security;

create policy operational_exceptions_select on operational_exceptions for select
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
    or app_is_super_admin()
  );
create policy operational_exceptions_insert on operational_exceptions for insert
  with check (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  );
create policy operational_exceptions_update on operational_exceptions for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());

-- --------------------------------------------------------
-- Append-only audit trail: INSERT only, no UPDATE/DELETE policy for any
-- client role. Corrections belong in a new event, never an edit to
-- history.
create table if not exists activity_events (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  event_type text not null, "timestamp" timestamptz not null,
  description text, staff_id text, staff_name text,
  branch_id text references branches(id) on delete set null, branch_name text,
  terminal_id text,
  reference_document text, amount numeric(18, 4), quantity numeric(18, 4), metadata jsonb not null default '{}'::jsonb,
  primary key (tenant_id, id)
);
create index if not exists idx_activity_tenant_ts on activity_events(tenant_id, "timestamp");
create index if not exists idx_activity_tenant_staff on activity_events(tenant_id, staff_id);

alter table activity_events enable row level security;

create policy activity_events_select on activity_events for select
  using (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
    or app_is_super_admin()
  );
create policy activity_events_insert on activity_events for insert
  with check (
    tenant_id = app_current_tenant_id()
    and (not app_is_branch_scoped_role() or branch_id = app_current_branch_id())
  );

-- --------------------------------------------------------
create table if not exists backups (
  backup_id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  type text not null, created_at timestamptz not null, application_version text, schema_version integer,
  file_path text, file_size bigint, verification_status text not null default 'PENDING',
  checksum text, tables_count integer, records_count integer,
  wal_checkpoint_completed boolean not null default false, failure_reason text, notes text,
  initiated_by_staff_id text, initiated_by_staff_name text,
  primary key (tenant_id, backup_id)
);
create index if not exists idx_backups_tenant on backups(tenant_id);

alter table backups enable row level security;
create policy backups_select on backups for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy backups_insert on backups for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());

-- --------------------------------------------------------
create table if not exists bi_alerts (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  rule_type text, category text, title text, recommendation text, explanation text,
  related_record jsonb not null default '{}'::jsonb, priority text not null default 'MEDIUM',
  status text not null default 'NEW', date_time timestamptz, impact_metric text,
  suggested_action_label text, user_response text, rule_trigger_criteria text,
  primary key (tenant_id, id)
);
create index if not exists idx_bi_alerts_tenant on bi_alerts(tenant_id);

alter table bi_alerts enable row level security;
create policy bi_alerts_select on bi_alerts for select
  using ((tenant_id = app_current_tenant_id() and app_is_back_office_role()) or app_is_super_admin());
create policy bi_alerts_write on bi_alerts for insert
  with check (tenant_id = app_current_tenant_id() and app_is_back_office_role());
create policy bi_alerts_update on bi_alerts for update
  using (tenant_id = app_current_tenant_id() and app_is_back_office_role())
  with check (tenant_id = app_current_tenant_id());
