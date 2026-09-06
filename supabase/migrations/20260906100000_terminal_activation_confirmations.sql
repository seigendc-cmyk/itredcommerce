-- DL-057: the tenant-side half of DL-042's two-ledger reconciliation.
-- terminal_activation_tokens (Prompt 13/DL-039) is the console's own
-- authoritative "issued to tenant Y for terminal Z at time T" log. This
-- table is the tenant's independent "received and activated on terminal Z
-- at time T" log, written directly by each terminal's own trusted local
-- server (server/lib/supabaseAdmin.ts's service-role client — the same
-- DL-005/DL-011 trust model server/sync/terminalActivationTokenPull.ts
-- already uses to read the raw terminal_activation_tokens table), never by
-- a browser-facing authenticated session. Reconciling the two by
-- (tenant_id, terminal_id, token_issued_at) gives an audit trail
-- independent of a single point of failure, per DL-042.
create table if not exists terminal_activation_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  terminal_id text not null,
  token_issued_at timestamptz not null,
  event_type text not null check (event_type in ('manual_paste', 'sync_down')),
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_terminal_activation_confirmations_lookup
  on terminal_activation_confirmations (tenant_id, terminal_id, token_issued_at);

alter table terminal_activation_confirmations enable row level security;

-- Console-operator read access only, same pattern as the other five
-- Prompt-13 tables (20260905120000_console_operator_auth.sql). No insert/
-- update/delete grant to `authenticated` at all: this table only ever
-- receives service-role writes from a tenant's own trusted local server,
-- which bypasses RLS entirely and needs no policy to write here.
grant select on terminal_activation_confirmations to authenticated;
create policy terminal_activation_confirmations_console_read on terminal_activation_confirmations
  for select using (app_is_super_admin());
