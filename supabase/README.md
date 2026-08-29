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
