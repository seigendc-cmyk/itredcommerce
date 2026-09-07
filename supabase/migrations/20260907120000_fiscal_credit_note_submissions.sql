-- Mirrors server/db/migrations/017_fiscal_credit_note_submissions.sql.
create table if not exists fiscal_credit_note_submissions (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,
  registration_id text,

  credit_note_id text not null,
  credit_note_number text not null,

  submission_mode text not null default 'PER_TRANSACTION',
  status fiscal_submission_status not null default 'PENDING',

  invoice_sequence_number bigint,
  fiscal_reference_number text,
  qr_code_payload text,

  attempt_count integer not null default 0,
  non_retryable boolean not null default false,
  error_message text,
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (tenant_id, id),
  foreign key (tenant_id, credit_note_id) references credit_notes(tenant_id, id) on delete restrict
);
create index if not exists idx_fiscal_cn_submissions_tenant on fiscal_credit_note_submissions(tenant_id);
create index if not exists idx_fiscal_cn_submissions_status on fiscal_credit_note_submissions(tenant_id, status);
create index if not exists idx_fiscal_cn_submissions_branch on fiscal_credit_note_submissions(tenant_id, branch_id);

create trigger trg_fiscal_cn_submissions_updated_at before update on fiscal_credit_note_submissions
  for each row execute function set_updated_at();

alter table fiscal_credit_note_submissions enable row level security;

create policy fiscal_cn_submissions_select on fiscal_credit_note_submissions for select
  using (tenant_id = app_current_tenant_id() and app_is_fiscal_admin_role());
-- No client insert/update policy — only the Express backend's service-role
-- client ever writes here, same as fiscal_submissions.
