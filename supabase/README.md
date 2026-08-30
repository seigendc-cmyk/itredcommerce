# Supabase schema

Migrations in `migrations/` define the multi-tenant Postgres schema
(Tenant → Branch → Terminal, plus every business table with `tenant_id`
scoping and RLS) from Prompt 1 of the re-platforming plan. See
`ITRED_GOVERNANCE_AND_ARCHITECTURE.md` for the decisions behind this design.

No Supabase project is linked yet — these are plain SQL files, not a
`supabase init`-managed project. To apply them once a project exists:

```
supabase link --project-ref <project-ref>
supabase db push
```

## What's here

- `20260829120000_extensions_and_rls_helpers.sql` — the `app_staff_role`
  enum and the RLS helper functions (`app_current_tenant_id()`,
  `app_current_branch_id()`, `app_current_role()`, `app_current_staff_id()`,
  `app_is_super_admin()`, `app_is_branch_scoped_role()`,
  `app_is_back_office_role()`) every later policy calls. They read custom
  JWT claims (`tenant_id`, `branch_id`, `staff_role`, `staff_id`) that a
  Supabase Auth Custom Access Token hook is expected to populate — that
  hook itself is Prompt 5's job, not built here.
- `20260829120100_tenant_branch_terminal_warehouse.sql` — the core
  hierarchy.
- The rest port every table from `server/db/migrations/001_init.sql` to
  Postgres with tenant scoping and RLS added, grouped the same way the
  original file's section banners group them.
- `20260830150000_staff_pin_verification.sql` (Prompt 5) — the
  `verify_staff_pin()` SECURITY DEFINER RPC that's now the one place a PIN
  is ever compared, plus `failed_attempts`/`locked_until` (centralized
  lockout) and `auth_user_id` (nullable, unpopulated — reserved for a
  future PWA prompt) on `staff`, and an `access_token_hook()` function
  ready to register once something populates `auth_user_id`. See the
  governance doc's DL-011/DL-012 addendum.
- `20260831090000_executive_rollups.sql` (Prompt 6) — pre-aggregated
  `mv_*` materialized views (daily sales, inventory valuation/turnover,
  debtor/creditor ageing, expense rollup) refreshed every 15 minutes via
  `pg_cron`, each fronted by an RLS-safe `v_*` wrapper view — matviews
  don't support RLS directly, so only the wrapper views are granted to
  `authenticated`. Requires the `pg_cron` extension enabled on the project.
- `20260831090100_chart_of_accounts.sql` (Prompt 6) — the GL account
  registry (`chart_of_accounts`) plus a nullable `gl_account_id` link from
  `cash_bank_accounts` to it. Not a posting engine — see the governance
  doc's DL-013 addendum for what this does and doesn't back.

`functions/executive-signin` and `functions/executive-roster` (Prompt 6)
are Supabase Edge Functions backing the Executive PWA's sign-in screen —
deploy with `supabase functions deploy executive-signin executive-roster`.
They are not applied by `supabase db push` (that only covers `migrations/`).

`seed.sql` (not a migration — see below) seeds one dev tenant
(`TENANT-NYAMUTSAMBA`) and migrates the four `INITIAL_STAFF_MEMBERS` mock
staff into it, PINs re-hashed at bcrypt cost 12. Apply it explicitly
(`psql -f supabase/seed.sql` or `supabase db reset`, which runs it
automatically after migrations) — `supabase db push` does not run it.

## Known omissions (deliberate, not oversights)

- `sessions` was not ported — it's an Express `express-session` storage
  artifact tied to the current server-side auth implementation, which
  DL-005 supersedes with Supabase Auth. Nothing to carry forward.
- The platform super-admin bypass (`app_is_super_admin()`) always returns
  `false`. Don't change that without the dedicated addendum the governance
  doc's "Open items" section calls for.
- Several tables (`held_sales`, `held_receipts`, `layaway_orders`,
  `credit_notes` and their line items) are tenant-wide rather than
  branch-scoped, because they don't carry a `branch_id` in the source
  SQLite schema or the TypeScript types. That's a faithful port of an
  existing limitation, not a new one introduced here.
- `access_token_hook()` still isn't registered anywhere by a migration
  (Auth Hooks are a dashboard setting, not SQL) — and now that the
  Executive PWA (Prompt 6) actually depends on it, this is a required
  manual step before that app will show anything but empty dashboards:
  Authentication → Hooks → Custom Access Token → point it at
  `public.access_token_hook`.
