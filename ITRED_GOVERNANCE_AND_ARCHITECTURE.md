# iTred Commerce — Governance & Architecture

This document is the single source of truth (SOT) for architectural decisions on
iTred Commerce. It is binding context for all implementation work. New sections
are appended as dated addenda; existing sections are not rewritten in place —
superseding decisions get a new entry that references the one it replaces.

Two things this document is NOT: a task tracker (see project planning docs/PR
descriptions for that), and a tutorial on the code (read the code for that). It
exists to answer "why is it built this way" when the code alone doesn't say.

---

## 1. Current State (baseline as of 2026-08-29)

This section describes what exists in the repository today, before any of the
multi-tenant/delivery/Tauri re-platforming work begins. It was compiled by
direct inspection of the codebase, not from aspiration or prior planning docs.
Treat it as ground truth for "what we're starting from."

### 1.1 What this actually is today

`d:\ICOS\itred-commerce` is a **browser-based React SPA + Express API prototype**,
originally scaffolded via Google AI Studio (`package.json` name is still the
default `"react-example"`; `metadata.json` and `.env.example` carry unused
`GEMINI_API_KEY` scaffolding — no code anywhere references it). It is **not**
currently a Tauri desktop app, does not use Supabase, and has no multi-tenant
concept. All of that is target-state work, not current state.

### 1.2 Tech stack in use

- **Client**: React 19, Vite 6, Tailwind CSS 4, `lucide-react`, `motion`.
- **Server**: Express 4, `express-session` with a custom SQLite-backed session
  store, `bcryptjs` for PIN hashing.
- **Database**: SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) — not
  `better-sqlite3` or any npm SQLite package. WAL mode and foreign keys are
  already enabled at the connection layer (`server/db/connection.ts`).
- **No Tauri, no Supabase, no router library** (no react-router) anywhere in
  the repo, confirmed by repo-wide search.

### 1.3 Architecture pattern

- `src/App.tsx` is a single large component that owns nearly all application
  state via `useState`, with a manual state-machine for navigation:
  `appStage` (`SPLASH → WELCOME_UPDATE → STAFF_ACCESS → MAIN_APP`) and
  `activeView` (a ~65-key string-literal union in `src/types/index.ts`) driving
  a big `switch` render dispatcher. There is no URL-based routing.
- **Auth is real and server-backed**: PIN entry is client-side
  (`StaffAccessScreen.tsx`), but verification happens server-side
  (`bcrypt.compare` against `server/db` `staff.pin_hash`), with session state
  held via `express-session` + a custom SQLite session store. Includes
  brute-force lockout (5 attempts / 60s), though lockout state is in-memory
  only and resets on server restart.
- **Critical gap**: despite a fully modeled SQLite schema
  (`server/db/migrations/001_init.sql` — staff, branches, terminals,
  warehouses, sales, inventory, shifts, EOD, purchasing, transfers, debtors,
  creditors, cash/bank, reserves, tax config, approvals, exceptions, activity
  events, backups, BI alerts, and more) and a seed script that populates all of
  it, **only authentication is actually wired to the server at runtime**. Every
  other feature (sales, inventory, shifts, purchasing, debtors, reporting,
  etc.) runs on in-memory React state seeded directly from
  `src/data/mockData.ts` / `mockBiData.ts`, with no persistence and no server
  round-trip. This is the single most important fact for planning the
  re-platform: the UI and type layer are mature, but almost nothing is
  actually durable yet.
- `server/lib/crudFactory.ts` (a generic CRUD router over a `generic_records`
  JSON table) exists but is not mounted — evidence more server routes were
  planned but not built.

### 1.4 Feature surface (existing view components)

Full inventory under `src/components/views/`: activity, approvals, bi,
cashbank, cashflow, cashmanager, creditors, debtors, eod, exceptions,
inventory (incl. stocktake priorities, commercial data quality, attention
center), locations (branches/warehouses/terminals), metrics, purchasing
(memos, POs, receiving), reports, reserves, sales (cart, tender, receipts,
held sales, layaway, credit notes), settings, shifts, stocktake, system
(devices, fiscalization, payment methods, licensing, software updates,
operational readiness, backup/restore, DB integrity), transfers, upgrade.

All twelve component/type names referenced by the multi-tenant/delivery
planning prompts (`StaffAccessScreen`, `LicensingView`, `LicenceInfo`,
`shiftReconciliation`, `EODSummaryView`, `SalesView`, `PaymentTenderModal`,
`ReceiptModal`, `PurchasingView`, `PurchaseOrderModal`, `ReceiveStockView`,
`InventoryItemListView`, `ReportsCenterView`) exist today under those exact
names — none are aspirational.

### 1.5 The versioning pattern (`deterministicRulesEngine.ts`)

`src/utils/deterministicRulesEngine.ts` is a pure, deterministic (no AI, no
randomness, no external calls) rules module: a static array of
`BusinessRuleDefinition`s (reorder thresholds, price-floor policy, stocktake
risk scoring, data-quality checks, operational readiness), each with a
`ruleId`, a **separate `ruleVersion: number`**, and an `effectiveDate`.

The versioning discipline that later pricing/fare work must follow:

- Every record a deterministic engine *generates* (e.g. a
  `ReorderRecommendation`) embeds the `ruleId` + `ruleVersion` of the rule that
  produced it, at generation time, immutably.
- Editing a rule's thresholds later and bumping its `ruleVersion` never
  retroactively changes historical records — they keep referencing the version
  they were actually generated under, so calculations stay reproducible and
  auditable.
- This is currently a **type-level convention**, not an enforced runtime
  version-management system — there's no automatic version-increment
  mechanism. One existing inconsistency: `evaluateStocktakeRiskSignals()`
  output does not currently carry a `ruleVersion` field despite using a rule
  ID. Future versioned-rate work (Prompt 8, fare engine) should close this gap
  rather than propagate it — every generated record must carry its version
  reference, no exceptions.

### 1.6 Known gaps to design around (not to silently fix as a side effect of other work)

- Multi-tenancy does not exist in any form: no `tenants` table, no
  `tenant_id` column on any real SQL table. A handful of TypeScript types
  (`ActivityEvent`, `BusinessRuleResult`, `BackupRecord`,
  `InventoryMovement`) carry an optional `tenantId?: string` field, but it is
  unpopulated everywhere — a leftover placeholder, not a partial
  implementation to build on.
- `Branch`, `Terminal`, and `Warehouse` are already first-class, well-modeled
  concepts in both the type layer and SQL schema — this is real groundwork the
  multi-tenant work can build on, not something to reinvent.
- Duplicate/legacy type pairs exist in `src/types/index.ts` (e.g.
  `StocktakeRecord` vs. the richer `StocktakeSession`, inconsistent casing
  between `MovementType` variants). Do not silently delete these as part of
  unrelated work — they may still be referenced — but avoid extending the
  legacy variants further.
- `mockData.ts` currently doubles as both UI seed data and DB seed source
  (imported by both `App.tsx` and `server/db/seed.ts`). Any move to a real
  data-access layer needs to explicitly retire this dual role rather than
  leave it as an ambiguous second source of truth alongside Supabase.

---

## 2. Decision Log Format

Each entry: a stable ID, a one-line decision, and a short rationale. Entries
are never edited after the fact — a changed decision gets a new entry that
supersedes the old one by ID.

---

## MULTI-TENANT & DELIVERY SUBSYSTEM ADDENDUM (2026-08-29)

This addendum captures the architectural decisions for evolving iTred Commerce
from the single-tenant browser prototype described in Section 1 into a
multi-tenant, offline-first, five-surface product family with an integrated
delivery subsystem. These decisions are binding for all subsequent
implementation prompts.

### DL-001: Multi-tenancy hierarchy is Tenant → Branch → Terminal

**Decision**: The platform is multi-tenant — multiple independent businesses,
potentially in different countries, each with fully isolated data — structured
as Tenant → Branch → Terminal. Every Supabase table and every local SQLite
table carries `tenant_id`, plus `branch_id`/`terminal_id` where applicable. A
single Tauri installation binds to exactly one tenant but serves multiple
branches and terminals within it. Row-Level Security in Supabase is the
primary security boundary for tenant isolation — no cross-tenant reads or
writes are valid except from the platform super-admin role (scope deferred,
see Open Items below).

**Rationale**: `Branch` and `Terminal` already exist as first-class concepts
(Section 1.6) but with no tenant concept above them — retrofitting tenancy as
the top of an existing, working hierarchy is lower-risk than redesigning the
hierarchy itself. Enforcing isolation at the database layer (RLS) rather than
solely in application code means a bug in any one of five client surfaces
can't leak one business's data into another's.

### DL-002: Five client surfaces, one shared type layer, independent data-access layers

**Decision**: The product family has five deployables:
- **Branch Terminal App** — Tauri desktop, offline-first, mobile-first
  responsive (touch-friendly, small-tablet-capable), restricted feature set
  (sell, view products, returns, EOD, simple cart only).
- **Head Office App** — Tauri desktop, same offline-first/local-SQLite
  durability model as the terminal app, full feature set (purchasing,
  inventory management, rate configuration, staff admin, full reporting).
  Each desk is an independent Tauri install with its own local SQLite and its
  own independent Supabase sync connection — no shared local server between
  desks.
- **Executive PWA** — installable web PWA, mobile-first, read-only, reads
  exclusively from Supabase (never local till SQLite), reused staff PIN auth
  scoped to an "executive" role with cross-branch, single-tenant read access.
- **Delivery/Rider PWA** — installable web PWA, always-online (no offline
  durability requirement), reused staff PIN auth scoped to a "rider" role,
  tenant-scoped.
- **Platform Super-Admin View** — for the platform operator, not a tenant;
  cross-tenant read access. Scope deferred to a future addendum.

All five share `src/types/index.ts` and as much of the existing UI component
library as practical, but have independent data-access layers.

**Rationale**: The existing type layer (Section 1.4) is mature and worth
reusing across surfaces; sharing it avoids five divergent definitions of the
same domain objects. Independent data-access layers per surface reflect that
they have fundamentally different durability/connectivity requirements (two
offline-first desktop apps, two always-online read paths, one cross-tenant
admin path) — forcing one data-access abstraction across all five would mean
designing to the lowest common denominator.

### DL-003: Fiscalization is a pluggable interface, not a hardcoded integration

**Decision**: KRA eTIMS (Kenya) is refactored from an assumed hardcoded
integration into one implementation of a pluggable `FiscalizationProvider`
interface (submit invoice, validate response, handle retry/offline queuing),
selected per tenant based on the tenant's country. Only the Kenya
implementation exists initially; the interface is defined now so a second
country's provider doesn't require touching call sites later.

**Rationale**: Multi-tenancy (DL-001) means tenants in different countries
will need different fiscal authorities' integrations. Existing fiscalization
UI (`FiscalizationView.tsx`, `FiscalConfig` type — Section 1.4) already models
a fiscal-document queue; wrapping that behind an interface now is cheap
compared to unwinding a hardcoded Kenya-only assumption after a second country
is sold.

### DL-004: Vendor-configurable rates follow the deterministic-rules-engine versioning pattern

**Decision**: Any vendor-configurable rate (delivery fare components, tax
rates, etc.) follows the same versioning discipline as
`deterministicRulesEngine.ts` (Section 1.5): changing a rate in settings must
never retroactively alter fares/prices already quoted or completed. Each
relevant record locks in the rate version active at the moment it was
created. Currency: each tenant operates in its own base currency; exchange
rates for tenants needing multi-currency are manually entered/updated by the
vendor in settings (no live FX API dependency, consistent with offline-first
principles), and each transaction locks in the rate active at that moment.

**Rationale**: The existing rules engine already solves "how do we let
thresholds change over time without corrupting historical records" — reusing
that pattern for fares/rates/FX is consistent rather than inventing a second
versioning mechanism. No live FX API matches the offline-first constraint
already established for the rest of the platform (branch terminals must
function without connectivity).

### DL-005: Staff/PIN auth becomes tenant-aware and Supabase-sourced

**Decision**: Staff/PIN records move from till-local-only to Supabase as
source of truth, scoped by `tenant_id`. Till and head-office apps sync
staff/PIN records down from Supabase on connect and fall back to their
last-synced local copy for PIN validation when offline. Role scopes: till
operator, head-office staff, executive, rider, platform super-admin.

**Rationale**: Auth is already the one part of the current prototype that's
genuinely server-backed (Section 1.3) — bcrypt hashing and session handling
are sound patterns to carry forward. Moving the source of truth to Supabase
(rather than each terminal's local SQLite) is required once there are
multiple terminals and multiple app surfaces (DL-002) that all need to
recognize the same staff member; last-synced local fallback preserves the
existing offline-capable login behavior.

## OUTBOX SYNC & CONFLICT RESOLUTION ADDENDUM (2026-08-29)

Prompt 2 (event-sourced outbox sync engine) calls for conflict resolution to
"follow the per-entity rules already defined in the governance doc" — those
rules didn't exist yet when that prompt was written. This addendum defines
them now, grounded in the schema built in Prompt 1, before the sync engine
is implemented against them.

### DL-006: Transactional local write, independently-paced background drain

**Decision**: Every local mutation is written to an outbox table in the same
SQLite transaction as the mutation itself (the "transactional outbox"
pattern) — so a mutation and its durable, replayable sync record either both
land or neither does, even across a crash. A separate background process
drains the outbox to Supabase only while the connectivity signal (DL-008)
reports online, processing rows oldest-first, and paces retries per-row via
exponential backoff with jitter (DL-007 governs what happens when a push is
rejected as a conflict rather than merely failing). A drain cycle only
attempts rows whose individual backoff timer has elapsed — connectivity
flipping online does not itself force-retry every pending row regardless of
its own backoff state, which is what avoids the thundering-herd/thrashing
behavior on flaky connections that Prompt 2 explicitly warned against.

**Rationale**: Atomicity between a mutation and its outbox record is what
makes the log actually durable and replayable — a design where the outbox
write could fail or succeed independently of the live write would defeat the
purpose. Per-row backoff (rather than a single global retry clock) means one
row's repeated failure doesn't block or reset the retry timing of every
other pending row.

### DL-007: Per-entity conflict resolution categories

Every table gets its conflict-resolution behavior from which of four
categories it falls into, rather than each table needing a bespoke rule.
The categories exist because they map to a real structural distinction
already present in Prompt 1's schema: some tables are insert-once facts,
others are mutable projections/caches of those facts.

1. **Ledger / insert-once** — `sales_transactions` (+ `sale_line_items`,
   `sale_payments`), `inventory_movements`, `debtor_transactions`,
   `creditor_transactions`, `cash_bank_transactions`, `cash_movements`,
   `activity_events`, `stock_adjustments`, `credit_notes` (+ items),
   `reorder_recommendations`, `stocktake_lines`, `backups`,
   `reserve_transfers`. These rows are
   created once and never updated by the sync engine. **Resolution: idempotent
   insert.** If Supabase already has a row at that primary key, the push is
   treated as already-synced, not a conflict — never overwritten. This
   requires no timestamp comparison at all, because there is nothing to
   compare: two writers can't disagree about a fact that only one of them
   could have created (app-generated IDs are unique per origin).
2. **Cached aggregate on a master record** — `inventory_items.stock_on_hand`
   (and `.status`), `customers.current_balance`/`available_credit`,
   `suppliers.current_balance`, `cash_bank_accounts.current_balance`,
   `business_reserves.current_funded_balance`. These fields are
   *derived* — the real audit-grade truth for each is the corresponding
   ledger table above (inventory_movements, debtor_transactions,
   cash_bank_transactions, reserve_transfers). **Resolution: last-write-wins**,
   compared using the pushing outbox row's `created_at` against the remote
   row's `updated_at`. A LWW mismatch here is non-critical by design — since
   the ledger is authoritative, a drifted cached value is always
   recomputable from it. (Building that recomputation/reconciliation job is
   not in scope for Prompt 2 — noted here so it isn't forgotten later.)
3. **Single-owner workflow record** — `shifts`, `held_sales`,
   `held_receipts`, `layaway_orders`, `stocktake_sessions`, `stocktakes`,
   `purchase_memos`,
   `purchase_orders`, `goods_receipt_notes`, `stock_transfers`,
   `approval_requests`, `operational_exceptions`. Normally mutated by one
   actor/workflow at a time (the terminal that opened a shift is the one
   that closes it, etc.), so genuine concurrent edits are rare.
   **Resolution: last-write-wins** by the same `created_at`-vs-`updated_at`
   comparison as category 2.
4. **Centrally-edited config/master data** — `branches`, `terminals`,
   `warehouses`, `staff`, `tax_config`, `tax_categories`,
   `tax_classifications`, `generic_records`, and the non-balance fields of
   `customers`/`suppliers`. **Resolution: last-write-wins**, same comparison.

**Terminal-state immutability guard**: independent of the categories above,
a small set of tables must never be pushed as an UPDATE once they reach a
terminal status — a `COMPLETED` `sales_transactions` row, a `CLOSED` `shifts`
row (whose `reconciliation_snapshot` is the existing immutable-snapshot
design from `shiftReconciliation.ts`). The outbox write path rejects such
updates outright, before they ever reach the drain loop or conflict
resolution — this isn't a sync-layer conflict-resolution question, it's the
same "don't mutate history" invariant the app already enforces, just
enforced one layer lower.

**Rationale**: Treating "which ledger is this a cache of" as the organizing
question, rather than picking LWW-vs-merge per table in isolation, is what
keeps this tractable across ~35 tables — new tables added later just need to
be slotted into one of the four categories, not given a bespoke rule.

### DL-008: Connectivity is an explicit, subscribable signal

**Decision**: Online/offline state is tracked by one connectivity monitor
with an explicit two-state model (`ONLINE` / `OFFLINE`), driven by an
injectable probe function, exposing `getState()` and `subscribe(listener)`.
The outbox drain loop is one subscriber; other app surfaces (e.g. the
delivery dispatch "create delivery" button being disabled offline, per the
delivery subsystem prompts) are expected to subscribe to the same signal
rather than each surface independently guessing at connectivity.

**Rationale**: Prompt 7 already requires a UI element (dispatch creation)
to react to connectivity state precisely, not queue-and-hope — that only
works if connectivity is one well-defined, testable signal rather than
implicit state inferred differently in different places.

## HEAD-OFFICE APP ADDENDUM (2026-08-30)

Prompt 4 built the head-office variant of the app — purchasing, inventory
management (item CRUD, transfers, stocktake, reorder review), a new versioned
fare/rate configuration, staff administration, and full reporting — sharing
the same codebase, local SQLite schema, and outbox sync engine as the
branch-terminal app from Prompt 3. This addendum records how DL-002/DL-005's
app-surface split actually got realized in code, the new rate-config table's
sync classification, and a load-bearing platform gap that must not be lost a
second time.

### DL-009: DL-002/DL-005 app-surface gating realized as `access_role`

**Decision**: `StaffAccessRole` (`TILL_OPERATOR` / `HEAD_OFFICE_STAFF` /
`EXECUTIVE` / `RIDER` / `PLATFORM_SUPER_ADMIN` — already defined in
`src/types/index.ts` per DL-002/DL-005, previously unpopulated) is now a real
`access_role` column on the local SQLite `staff` table
(`server/db/migrations/004_access_roles.sql`), mirroring the column that
already existed on Supabase's `staff` table since Prompt 1
(`supabase/migrations/20260829120200_identity_and_parties.sql`). Enforcement
has exactly one mechanism on each side, not one gate per feature:

- **Server**: `requireAccessRole(...)` (`server/middleware/auth.ts`, parallel
  to the existing unused `requireRole`) gates every head-office-only route.
  `server/lib/accessRoles.ts` mirrors Supabase's `app_is_back_office_role()` /
  `app_is_branch_scoped_role()` role sets by hand — there's no shared runtime
  between the two yet.
- **Client**: `src/utils/accessRoleGate.ts`'s `BRANCH_TERMINAL_VIEWS` set +
  `canAccessView()` is the single source of truth for what a till-operator
  session can reach, consumed at four points so it can't be bypassed by any
  one of them individually: `handleNavigate` (all programmatic navigation),
  the global keyboard-shortcut effect, `HeaderNav`'s menu filtering
  (discoverability), and `renderActiveView`'s top-of-function guard (defense
  in depth, renders `AccessRestrictedView` if somehow reached anyway).
  `SettingsView`'s Roles & Rights tab renders its "Access Scope" table
  directly from `BRANCH_TERMINAL_VIEWS`, so that display can never drift from
  what's actually enforced.

**Known follow-up**: the local `access_role` column stores values in
UPPER_SNAKE_CASE (`TILL_OPERATOR`) to match this codebase's existing
enum-storage convention (e.g. `shifts.status`), while Postgres's
`app_staff_role` enum uses lowercase (`till_operator`). Reconciling that
casing difference is deferred to whichever prompt builds the real Supabase
push adapter (`server/sync/drainLoop.ts`'s `RemoteSyncClient` is still an
injected, unimplemented interface — no live sync exists yet regardless).

**Rationale**: DL-002/DL-005 already specified this exact role vocabulary and
its purpose; the only gap was that nothing populated or enforced it. Reusing
the existing type rather than inventing a parallel concept, and routing every
enforcement point through one shared predicate rather than ad hoc per-view
checks, is what keeps the gate auditable as more head-office views get added.

### DL-010: `rate_config` is an insert-only ledger, never LWW config

**Decision**: The new versioned fare/rate table (`rate_config` — base fee,
per-km rate, load-size surcharge tiers, ride-type multipliers; see
`server/db/migrations/005_rate_config.sql` and the matching Supabase
migration) is classified DL-007 category 1 (LEDGER / insert-once) in
`server/sync/entityRules.ts`, not category 4 (CONFIG / last-write-wins) like
`tax_config`. Publishing a new rate is always `version = MAX(version) + 1`,
always an `INSERT`, never an `UPDATE` — there is no status/active flag and no
UPDATE code path anywhere in `server/routes/rateConfig.ts`. The Supabase
migration reinforces this at the RLS layer too: it defines an `insert` policy
and deliberately no `update` policy at all.

**Rationale**: DL-004 requires that changing a rate must never retroactively
alter a fare/price already quoted or completed against an earlier version.
An insert-only ledger makes that structurally true rather than a convention
someone could violate with a future UPDATE statement — "current" is always
`ORDER BY version DESC LIMIT 1`, and every past row is permanently
inspectable exactly as it was published.

### Second Tauri flag — still not resolved, now flagged twice

Prompt 3's plan flagged that the branch-terminal app was built against the
single Express+SQLite browser prototype from the Section 1 baseline instead
of a real per-desk Tauri install, and deferred fixing it. **That gap is still
unresolved.** Prompt 4's full head-office feature set — purchasing, inventory
management, rate config, staff admin, reporting — was built on the exact same
shared Express+SQLite backend. Concretely, today:

- There is still no `src-tauri`, no Tauri dependency anywhere in the repo.
- "Branch terminal" vs. "head office" is *only* a client-side `access_role`
  gate inside one shared web app talking to one shared local SQLite file
  through one shared Express process — not the two-independent-installs
  model DL-002 specifies (separate local SQLite per desk, independent
  Supabase sync connection per desk, no shared server between desks).
- A real multi-desk deployment today would mean multiple browser sessions
  hitting one Express process and one SQLite file concurrently — the exact
  LAN-coordination anti-pattern DL-002 and this prompt's own text explicitly
  rule out.

This must be resolved — real per-desk Tauri packaging, with genuinely
separate local SQLite files and independent sync connections per install —
before any multi-desk production rollout. Carried over and re-flagged a
second time so it can't quietly disappear a third time.

## SUPABASE-SOURCED STAFF/PIN AUTH ADDENDUM (2026-08-30)

Prompt 5 implements the "Prompt 5's job" work that DL-005 and the Prompt-1
Supabase migrations explicitly deferred: the actual PIN-verification flow,
JWT claim population groundwork, and a PIN-hash security review. Dev/tenant
data note: the tenant seeded for local development is `TENANT-NYAMUTSAMBA`
("L Nyamutsamba") — see `supabase/seed.sql`.

### DL-011: `verify_staff_pin` is the one place a PIN is ever compared

**Decision**: `verify_staff_pin(tenant_id, staff_id, pin)` — a Postgres
`SECURITY DEFINER` function (`supabase/migrations/20260830150000_staff_pin_verification.sql`)
— is the single place `pin_hash` is ever read or compared, for both current
and future callers:

- **Today**: the Express backend behind the Tauri branch-terminal/head-office
  apps (`server/routes/auth.ts`) calls it via a service-role Supabase client
  (`server/lib/supabaseAdmin.ts`) when reachable, and keeps issuing its own
  existing Express cookie session on success — no Supabase Auth session is
  needed for this path, since the Tauri apps never talk to Supabase directly.
  When Supabase can't be reached (`server/lib/staffAuth.ts`'s `UNREACHABLE`
  outcome — network failure/timeout, never an actual "PIN is wrong" verdict),
  it falls back to `bcrypt.compare` against the last-synced local SQLite
  cache, exactly as the pre-Prompt-5 implementation did. Only Postgres's own
  authoritative `INVALID`/`LOCKED_OUT` verdicts are ever treated as a real
  auth outcome — a network-level failure is never conflated with "wrong PIN,"
  which is what stops an attacker from forcing a downgrade to the
  less-centrally-rate-limited local path by interfering with connectivity.
- **Future (Executive/Rider PWA, later prompts)**: the same function is
  designed to be called from a Supabase Edge Function that additionally mints
  a real Supabase Auth session, since those PWAs have no backend of their own
  and read Supabase directly. **That Edge Function is explicitly NOT built by
  this prompt** — it depends on a design decision only the PWA prompt can
  make (how a staff row gets linked to a real `auth.users` identity in the
  first place), so building it now would be speculative. What Prompt 5 does
  ship, ready for that later work: an `auth_user_id` column on `staff`
  (nullable, unpopulated) and an `access_token_hook()` Postgres function that
  injects `tenant_id`/`branch_id`/`staff_role`/`staff_id` JWT claims once a
  staff row's `auth_user_id` is set and the hook is registered in the
  Supabase dashboard (Auth Hooks aren't something a SQL migration can
  register on its own). Until then it has no effect on anything.

**Centralized lockout**: `staff.failed_attempts`/`locked_until` (same
migration) replace the pre-Prompt-5 in-process `Map` for the Supabase path —
enforced inside `verify_staff_pin` itself, so it's shared across every
terminal/desk hitting the same tenant, not reset by an Express restart. The
in-process `Map` in `server/routes/auth.ts` still exists, but only as a local
circuit breaker for the offline-fallback branch specifically.

**Rationale**: the schema's own comments ("reading `pin_hash` back... is
Prompt 5's job via a SECURITY DEFINER function or edge function, never a
plain SELECT") already specified this shape. One shared primitive for both
callers avoids duplicating the bcrypt-compare-plus-lockout logic in two
places that could drift apart.

### DL-012: staff is a pull-only cache locally, not outbox-synced

**Decision**: `server/routes/staff.ts`'s CRUD (create/update/reset-PIN/
deactivate/reactivate) writes directly to Supabase via the service-role
client and returns `503 SUPABASE_UNAVAILABLE` when Supabase can't be
reached — it does **not** fall back to writing local SQLite + queuing an
outbox push, unlike every other synced table in this app. A new pull-only
job (`server/sync/staffPull.ts`) refreshes local SQLite's `staff` table
(including `pin_hash`, needed for the offline PIN-fallback path) from
Supabase at server startup and every 5 minutes thereafter
(`server/index.ts`) whenever Supabase is configured.

**Rationale**: staff administration is inherently a connected, back-office
operation — minting a new credential, resetting a PIN, or deactivating an
account while offline and trusting it locally until a later sync would mean
a stolen/compromised till could silently create or resurrect credentials
with no live check against the tenant's real staff record. Every other
table's push-then-reconcile model is fine because DL-007's conflict
categories give a defined resolution; "trust an offline-created staff
credential until it eventually syncs" has no safe resolution, so the right
answer is "unavailable," not "queued."

### DL-011 security review — decisions made, and what's explicitly deferred

Reviewed against the security considerations flagged in the pre-implementation
plan (see chat history for the full review); decisions made:

- **PIN length vs. bcrypt cost**: accepted as an inherent trade-off of the
  till PIN UX (see the pre-implementation review for the full reasoning) —
  not "fixed," but bcrypt cost for newly-created/reset PINs is now **12**
  (`server/routes/staff.ts`), up from the original local seed's cost 10; the
  four migrated mock staff PINs were re-hashed at cost 12 during migration
  (`supabase/seed.sql`) since plaintext was still available for mock data —
  that option won't exist for any real staff PIN migrated later.
- **Weak-PIN denylist**: added (`server/routes/staff.ts`'s `WEAK_PINS`/
  `assertStrongPin`) — rejects the obvious sequential/repeated-digit
  patterns at creation and reset time.
- **Centralized brute-force lockout**: done — see DL-011 above.
- **Local offline-cache exposure** (a lost/stolen terminal's SQLite file
  exposes cached `pin_hash` values with no rate limiting): explicitly
  **not mitigated** in this prompt. Real mitigation (encryption at rest)
  needs Tauri's secure-storage APIs, which don't exist yet — the app still
  runs as the plain-file Express+SQLite prototype (see the two prior Tauri
  addenda above). Flagged again here rather than silently accepted a third
  time: this is a real, currently-unmitigated risk on any till that syncs
  staff data, not just a theoretical one.
- **Service-role key handling**: `SUPABASE_SERVICE_ROLE_KEY` is read only in
  `server/env.ts`/`server/lib/supabaseAdmin.ts`, never included in any HTTP
  response, never logged. `.env.example` documents the required vars
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TENANT_ID`) without real
  values.
- **PWA session TTL/revocation model**: genuinely deferred, not decided —
  there is no PWA yet for it to apply to. Flagged as a decision the
  Executive/Rider PWA prompt must make explicitly, not default silently.

## EXECUTIVE PWA ADDENDUM (2026-08-31)

Prompt 6 builds the Executive PWA — the first surface DL-002 actually
requires to be a *separate deployable*, not a client-side gate inside the
shared Tauri codebase: `executive-pwa/` is its own package (own
`package.json`, own Vite dev server on port 3100, own `.env`), talks to
Supabase directly with the anon key, and has no dependency on the Express
backend at all. It reuses `src/types/index.ts` and selected `src/components/ui`
primitives via a `@shared` Vite alias (per DL-002's "share as much as
practical"), but its data access, auth, and app shell are fully independent.

### DL-013: Executive PWA — auth bridge, rollups, and honestly-scoped financials

**Decision**: several related pieces, all introduced together for this one
app surface:

- **Sign-in** (`supabase/functions/executive-signin`): bridges `verify_staff_pin()`
  (DL-011's shared primitive — same RPC the Express backend calls) to a real
  Supabase Auth session, since this PWA has no backend of its own and reads
  Supabase directly under RLS. On first sign-in it just-in-time provisions
  an `auth.users` identity (synthetic `<staffId>@<tenantId>.execpwa.internal`
  email, random password, never surfaced) and links it via `staff.auth_user_id`
  (added by Prompt 5, unpopulated until now); it then mints a session
  server-side (`generateLink` + `verifyOtp` in one call) so the user only
  ever sees the PIN pad, never a magic-link/redirect UX. Only
  `access_role = 'executive'` may sign in here — a correct PIN for any other
  role is refused with `NOT_EXECUTIVE`. `supabase/functions/executive-roster`
  is the unauthenticated staff-picker endpoint (names/initials only, same
  acceptable-exposure precedent as the main app's `GET /auth/staff`).
- **Session TTL**: Supabase's own access/refresh-token lifecycle applies as
  normal, plus this app enforces its own 12h absolute ceiling on top
  (`executive-pwa/src/lib/session.ts`, mirroring `ABSOLUTE_SESSION_CEILING_MS`
  in the Tauri apps' `server/middleware/session.ts`) — checked at startup,
  every 5 minutes, and on tab-visibility change, forcing a real
  `supabase.auth.signOut()` (not just clearing a local flag) once it trips,
  so a technically-still-refreshable session can't outlive it in a
  left-open tab. This is the PWA session-TTL decision DL-011 flagged as
  genuinely deferred, now made.
- **Rollups** (`supabase/migrations/20260831090000_executive_rollups.sql`):
  dashboard pages read from materialized views refreshed every 15 minutes
  via `pg_cron`, not raw transaction aggregation on every page load. The one
  correctness detail that matters most in that file: Postgres does not
  enforce RLS on materialized views, so every `mv_*` view is ungranted and a
  thin `v_*` wrapper view (re-applying `tenant_id = app_current_tenant_id()`)
  is the only thing ever granted to `authenticated` — client code
  (`executive-pwa/src/lib/rollups.ts`) only ever queries the `v_*` views.
  `rollup_refresh_log` powers each page's "As of [time]" label.
- **Chart of Accounts** (`supabase/migrations/20260831090100_chart_of_accounts.sql`):
  an account *registry* (`chart_of_accounts`) plus a nullable one-to-one
  linkage from real `cash_bank_accounts` rows to one GL account each —
  explicitly not a double-entry posting engine, because no posting engine
  exists anywhere in this schema. Existing accounts are not retroactively
  assigned a GL account by the migration; back-office staff assign one
  per account going forward.
- **P&L and Balance Sheet** (`FinancialStatementsPage`): approximated from
  the existing rollups and direct aggregates (sales rollup net
  revenue/cost basis, expense rollup, cash/bank balances, inventory
  valuation at cost, debtor/creditor totals) rather than derived from real
  ledger postings, since there are none to derive from. The page carries an
  explicit on-screen disclaimer saying so rather than presenting the numbers
  as GL-accurate statements.
- **Decision Flows / Pending Tasks**: read-only, by explicit scope decision
  — `DECISION_FLOWS` is a read-only union of `operational_exceptions` +
  `approval_requests`; `PENDING_TASKS` is pending approvals plus
  open/part-received purchase orders (money already committed to a
  supplier). Neither page offers a decide/resolve/approve action — those
  stay in the back-office apps, this app is a dashboard, not another place
  to action the same request from.
- **Deliberately not built**: Market Signals & Seasonal Demand, Staffing
  Scoring, and Health Scoring & Risk Factors all render a shared
  `PendingSignOffPage` placeholder instead of a real page. Each needs a
  scoring/analysis methodology proposed and signed off before
  implementation — per this document's own "Open items" rule against
  implementing scoring methodologies unilaterally — so shipping a
  placeholder here was chosen over either a half-built page or a silently
  missing menu item.

**Rationale**: bridging PIN auth to a real Supabase session (rather than,
say, giving this PWA its own separate credential) keeps "the PIN is the one
credential" true across every surface, till operator through executive.
Pre-aggregating via scheduled materialized views rather than querying raw
transaction tables from the browser on every dashboard open keeps the app
usable as transaction volume grows, and the `mv_*`/`v_*` split is what stops
that optimization from accidentally becoming a cross-tenant data leak.
Naming the financial statements as approximations rather than quietly
presenting them as authoritative is the same "don't misrepresent what the
system actually knows" principle DL-010's insert-only rate ledger and DL-004
already apply elsewhere.

**Operational step required, not yet done**: `access_token_hook()` (built by
Prompt 5, still unregistered) must actually be registered under
Authentication → Hooks in the Supabase project dashboard before this app can
work at all — without it, a signed-in executive's JWT carries no
`tenant_id`/`staff_role` claim, every RLS-protected query returns nothing,
and the app will appear to sign in successfully but show empty dashboards
everywhere. This is a deployment step no migration can perform; flag it
explicitly when standing up a real Supabase project for this app, the same
way the Tauri packaging gap is flagged above so it isn't lost.

## DELIVERY SUBSYSTEM — DISPATCH DATA MODEL & CREATION ADDENDUM (2026-08-31)

Prompt 7 builds the delivery subsystem's dispatch-side data model
(`delivery_orders`, `riders`) and the till/head-office dispatch-creation
flow only — the fare formula (Prompt 8) and the rider-facing board (Prompt
9) are both explicitly out of scope and not built here.

### DL-014: Confirmed decisions, and why they're structured this way

Four items this document's own "Open items" list (below, now resolved)
flagged as requiring proposal-and-sign-off before implementation were
confirmed for this prompt, not invented unilaterally:

- **Local vs. intercity boundary: 10km.** Computed once at dispatch-creation
  time (`server/lib/geo.ts`'s `classifyRoute`) and stored on the row —
  never recomputed later, so a subsequent change to this constant can't
  retroactively reclassify an existing dispatch (the same "don't corrupt
  history" principle DL-004/DL-010 already apply to rates).
- **Confirmation code: 6-character alphanumeric.** Generated by
  `server/lib/deliveryCode.ts` from a charset excluding characters easily
  confused when read aloud or hand-copied (0/O, 1/I/L) — chosen because the
  code must be read aloud to a customer/rider, per the prompt's own
  requirement.
- **Load-size tiers: small / medium / large.**
- **Ride types: bicycle / motorbike / car / van.**

**Rationale**: this document already established (Executive PWA addendum,
"Open items") that these four specifically must not be guessed at — they
directly shape fare calculation (Prompt 8) and rider-matching (Prompt 9),
so getting them wrong here would mean redesigning two future prompts'
schemas, not just this one's.

**Re-confirmed (2026-09-01)**: when a later prompt checked whether Prompt 7
had actually finished, the boundary and code format were put to you a
second time directly (by then several other prompts — the fare engine,
rider PWA, WhatsApp templates — already depended on both values, so
silently trusting this entry without asking again would have risked
building on an assumption rather than a real confirmation). Both were
reconfirmed as-is: 10km, 6-character alphanumeric. No code changed. What
*did* turn out incomplete in that same check: the "create delivery" CTA
was not actually wired into the till/head-office sale-complete screen —
`DeliveryDispatchView` existed as a correctly-built standalone view, but
nothing on `ReceiptModal` linked to it, so staff had to navigate there
separately and retype the sale number. Fixed the same session:
`ReceiptModal` gained a "Create Delivery Dispatch" button (shown only when
a handler is supplied), threaded through `SalesView`'s new
`onNavigateToDeliveryDispatch` prop to `App.tsx`'s `handleNavigate('DELIVERY_DISPATCH',
{ saleNumber })`, and `DeliveryDispatchView` now accepts an
`initialSaleNumber` that deep-links straight into the create modal with
that sale already looked up.

### DL-015: Delivery orders bypass the outbox entirely — direct, synchronous Supabase write

**Decision**: `delivery_orders` is the first table in this schema that is
**not** written via `applyWithOutbox`/`applyBatchWithOutbox` (DL-006).
`server/routes/deliveryOrders.ts`'s creation route writes directly to
Supabase (service-role client) synchronously, gated on a live
`connectivityMonitor.checkNow()` call, and only mirrors the row into local
SQLite afterward — with no outbox entry, since it's already synced. The
table is deliberately absent from `server/sync/entityRules.ts`'s
`CATEGORY_BY_TABLE`, so `categoryForTable('delivery_orders')` throws if
anything ever tries to route it through the outbox path instead — an
intentional guard, not an oversight (see that file's comment).

The connectivity signal itself (DL-008) is now actually instantiated for
the first time: `server/sync/connectivityInstance.ts` creates the one
shared `ConnectivityMonitor`, probing Supabase reachability (a cheap
`select id from tenants limit 1`, 4s timeout) rather than
`navigator.onLine`, which only reflects the local network link. It's
polled every 10s server-side (`server/index.ts`) and exposed to the client
via `GET /api/connectivity` (`src/hooks/useConnectivity.ts` polls this
every 8s) to drive the dispatch-creation CTA's disabled state. The route
itself re-probes live immediately before writing rather than trusting the
last poll, since the decision is irreversible once a confirmation code is
issued.

**Rationale**: the prompt's own requirement — "delivery orders are never
queued in the outbox for later creation" — isn't compatible with the
transactional-outbox-then-eventually-sync model every other table uses.
An outbox-queued delivery dispatch would sit invisibly on one terminal
until connectivity returned, at which point a rider board (Prompt 9)
expecting to see it "live" would have no way to know it existed — worse,
two terminals could independently queue conflicting dispatches for the
same sale while both offline. Disabling the CTA and refusing the write
outright is the only safe behavior, which is exactly what DL-008 already
anticipated ("not queue-and-hope").

### DL-016: Pickup coordinates travel with the client, not a persisted branch record

**Decision**: `delivery_orders.pickup_latitude`/`pickup_longitude` are
captured from the client's in-memory `Branch` record (`src/types/index.ts`'s
`Branch.latitude`/`longitude`, new in this prompt) and submitted as part of
the creation request, rather than being looked up server-side from a
persisted `branches` table row.

**Rationale**: as the "Second Tauri flag" note above already documents,
`branches` has no CRUD API or seeded rows anywhere in this codebase today —
`BranchListView`/`BranchDetailView` operate on client-side mock state only.
Requiring a real geocoded branch record server-side would mean this prompt
silently taking on building branch persistence as a prerequisite, which is
its own separate concern. Capturing pickup coordinates redundantly at
dispatch time exactly mirrors how `branch_name` is already captured
redundantly on every `sales_transactions` row today — consistent with this
codebase's actual current trust model, not a new weaker one. `pickup_branch_id`
and `pickup_branch_name` themselves are still derived server-side from the
authoritative completed-sale row, not trusted from the client.

## DELIVERY FARE CALCULATION ENGINE ADDENDUM (2026-08-31)

Prompt 8 builds the fare *formula structure* and the settings UI that lets
each vendor configure it — not real rate numbers. Rider assignment,
status transitions, and confirmation-code verification remain Prompt 9's
job and are untouched here.

### DL-017: Fare formula, versioning, and confirmed decisions

**Decision**: `fare = base_fee + (distance_km * per_km_rate) +
load_surcharge[load_tier] * ride_type_multiplier[ride_type]`, implemented
as a pure function (`server/lib/fareEngine.ts`'s `calculateFare`) over a
`rate_config` row the caller has already selected — it never reads "the
current rate" implicitly itself, mirroring
`src/utils/deterministicRulesEngine.ts`'s versioned-definition-applied-at-
calculation-time pattern. `server/routes/deliveryOrders.ts` selects the
active version (`ORDER BY version DESC LIMIT 1`) once, immediately before
creating a dispatch, and locks that exact version number onto the new row
(`delivery_orders.fare_rate_config_version`) — a later rate publish can
never retroactively alter an existing dispatch's fare, the same guarantee
DL-004/DL-010 already give `rate_config` itself.

Two items this document's "Open items" list separately flagged (below,
now resolved) were confirmed for this prompt:
- **Local vs. intercity per-km rate: vendor-toggleable**, not automatic.
  `rate_config.use_separate_intercity_rate` (default off) — when off,
  `per_km_rate` applies to every route regardless of DL-014's 10km
  classification; when on, `per_km_rate_intercity` applies to intercity
  routes specifically.
- **No new load-size/ride-type taxonomy was proposed** — Prompt 7 had
  already confirmed small/medium/large and bicycle/motorbike/car/van
  (DL-014); this prompt reuses that vocabulary rather than re-litigating
  it, and `rate_config`'s `load_size_surcharge_tiers`/`ride_type_multipliers`
  JSON columns (Prompt 4, previously a weight-band array and an open
  vocabulary respectively, since the taxonomy didn't exist yet) are now
  validated server-side against exactly those four/three keys.

**Rate numbers themselves**: per this prompt's own explicit instruction,
none were hardcoded as defaults beyond a clearly-marked placeholder.
`server/db/seed.ts`'s v1 `rate_config` row carries an unambiguous
`notes` field ("PLACEHOLDER EXAMPLE VALUES ONLY — not a real rate card")
and every vendor must publish their own version via Settings before
relying on calculated fares — if none has been published yet,
`fareAmount` simply stays `null` on new dispatches (graceful degradation,
not a hard block on dispatch creation), exactly as Prompt 7 already
allowed.

### DL-018: Multi-currency settlement is bundled into the same rate_config version, not a second ledger

**Decision**: rather than a separate versioned FX-rate table, `rate_config`
gained three more columns: `is_multi_currency` (default off),
`settlement_currency`, and `exchange_rate_to_settlement`. When enabled, the
fare is still computed in `currency` first, then converted once by that
rate; `fareCurrency` on the resulting dispatch is the settlement currency,
not the rate's own currency. `delivery_orders.fare_rate_config_version`
therefore locks in the exchange rate used at the same time it locks in the
fare formula used — one version reference, not two independently-drifting
ones.

**Rationale**: the prompt's own phrasing — "apply the vendor's manually-set
exchange rate active at that moment, **and store which rate version was
used**" (singular) — reads as one locked version covering both concerns,
not a parallel versioning mechanism. A tenant-wide, general-purpose FX
table would be the more "correct" long-term shape if multi-currency needs
ever grow beyond delivery fares specifically, but building that
speculatively now (with no other consumer and no tenant `baseCurrency`
value actually reachable from the branch-terminal server today — see
DL-016's branch-persistence gap for the same class of problem) would be
scope creep this prompt didn't ask for.

### Open items (explicitly not decided here)

- **Platform super-admin view scope**: referenced in DL-002 but deliberately
  undefined until the tenant-scoped surfaces are built and there's real
  tenant-scoped data to design a cross-tenant view against.
- **Branch geocoding as a real, persisted, staff-editable feature**: DL-016
  works around the absence of this, but doesn't build it. A real fix
  requires the same branch-persistence work the "Second Tauri flag" note
  already flags as outstanding.
- **A tenant-wide, general-purpose exchange-rate ledger** (as opposed to
  DL-018's per-rate-config-version bundling, scoped to delivery fares
  only): not built. Revisit if a second multi-currency consumer emerges.
- **Executive-PWA scoring methodologies**: still requires a
  proposal-and-sign-off step before implementation, per the individual
  implementation prompts that cover it. Do not implement unilaterally.
- **WhatsApp template wording — drafted, not yet approved**: the send
  integration itself is now built (DL-021/DL-022 below), but the four
  template bodies are a DRAFT pending your sign-off and, after that, Meta's
  own template review. Until a template is actually approved in Meta
  Business Manager under the exact name DL-022 lists, sending that
  notification type will fail at the Graph API call (the code doesn't
  simulate approval or fall back to free-form text — see DL-021). Real
  Meta credentials (`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`) and
  the `platform_settings` drain URL/secret are also unset until a real
  project is stood up — the same class of deployment-time gap as
  `access_token_hook`'s dashboard registration (DL-013).

## RIDER PWA — BROADCAST BOARD, ACCEPTANCE & DELIVERY CONFIRMATION ADDENDUM (2026-08-31)

Prompt 9 builds the rider-facing surface DL-002 specified: `rider-pwa/`, a
fifth independent deployable (own `package.json`, own Vite dev server on
port 3200, own `.env`) with no dependency on the Express backend, reusing
`verify_staff_pin` and the executive-PWA's PIN-bridge-to-a-real-session
pattern (DL-011/DL-013) rather than inventing a second auth mechanism. It
also resolves the three items this document's own "Open items" list
flagged as requiring proposal-and-sign-off before implementation — none of
the three were guessed at; each was confirmed before being wired in.

### DL-019: Rider PWA — pull-model broadcast board with a dynamic radius, and the two confirmed operational decisions

**Decision**: three items open since the Prompt 7/8 addenda are now settled:

- **Broadcast radius: 5km default, rider-adjustable (1–50km) via an
  on-screen slider, persisted per-device in `localStorage`.** Not a fixed
  named zone — the board filters `delivery_orders` where `status =
  'posted'` client-side against the rider's live device position
  (`rider-pwa/src/App.tsx`'s `visibleOffers`), recomputed continuously as
  both the rider's position and the radius change. A rider only appears
  addressable at all while toggled "Online" (`riders.is_available`,
  self-service via `riders_update_own` — new RLS policy, not part of
  Prompt 7's back-office-only `riders_update`), which also starts a
  `navigator.geolocation.watchPosition` feed pushing `riders.current_latitude`/
  `current_longitude` at most once per 15s.
- **Pull model, no waterfall, confirmed as specified**: any online rider
  may accept or reject any visible offer; there is no assignment/reassignment
  logic. `delivery_orders_rider_accept`'s RLS policy is the actual
  enforcement — `USING` requires the row still be `status = 'posted'` and
  `rider_id IS NULL` at the moment the `UPDATE` executes, `WITH CHECK` pins
  the new `rider_id` to the claiming rider's own `riders` row — so a race
  between two riders accepting the same offer resolves via ordinary
  optimistic concurrency (`rider-pwa/src/lib/riderApi.ts`'s `acceptOrder`:
  an empty result means someone else won the race), not client-side
  coordination.
- **WhatsApp lockout notification recipient: the pickup branch's contact
  number, not the individual staff member who created the dispatch.**
  Confirmed specifically because the creating staff member may be off-shift
  by the time a lockout happens hours later; a branch-level contact is
  reachable regardless of who's rostered at that moment. What actually gets
  built here is the durable, auditable trigger only — a new
  `delivery_notifications` table that `verify_delivery_code()` inserts one
  row into on a 3rd failed attempt, `recipient_phone` resolved from
  `branches.contact_phone`. **No live WhatsApp Business API send exists**
  (still an open item — see above); this is deliberately structured so a
  future, separately-approved send integration has a real queue of rows to
  consume with nothing here needing to change.
- **Code-recovery path: option (a) — dispatch manually reissues a fresh
  code and the same order reopens**, not option (b) (cancel and repost to
  the board as a new job). `POST /delivery-orders/:id/reissue-code`
  (`server/routes/deliveryOrders.ts`, till/head-office only, same live
  connectivity gate as dispatch creation per DL-015) resets a
  `status = 'under_investigation'` row back to `accepted` with a new code,
  a new expiry, and `confirmation_code_attempt_count` reset to 0 — same
  rider, same sale, same dispatch identity throughout. Chosen over (b)
  because the pickup, load, and fare on an in-progress dispatch don't
  change just because a code was mistyped three times; reopening avoids
  re-running fare calculation and re-broadcasting a job that's already
  physically in a rider's hands.

**Rationale**: reusing the PIN-bridge-to-session and RLS-as-the-real-gate
patterns already established by DL-011/DL-013 kept this prompt from
inventing a second security model for a fifth surface. The radius being
rider-adjustable (rather than a single fixed constant) was chosen because a
5km default that's right for a dense urban branch is visibly wrong for a
sparse rural one, and DL-002 already commits this app to being
always-online — there's no offline-cache reason to keep it fixed.

### DL-020: `verify_delivery_code` — the one place a confirmation code is ever compared, mirroring DL-011 exactly

**Decision**: `verify_delivery_code(tenant_id, order_id, code)`
(`supabase/migrations/20260831140000_rider_pwa.sql`) is a `SECURITY
DEFINER` RPC, called directly by the rider's own authenticated session
(this PWA has no backend to call it on the rider's behalf). It returns a
`status` column rather than raising on a wrong code — the same shape
`verify_staff_pin` uses and for the same reason its own comment already
documents: a thrown exception would roll back the attempt-count increment
on the very attempt that trips the lockout, silently under-counting real
attempts. Enforces, in one transaction per call: ownership (the row's
`rider_id` must match the caller's own `riders` row), state (`accepted`/
`in_transit` only), expiry (12h local / 48h intercity, from
`confirmation_code_expires_at` as already set by DL-014's
`confirmationCodeExpiryHours`), and the 3-attempt limit — the 3rd wrong
attempt and an expired attempt both flip the order to
`under_investigation`; a correct code flips it to `delivered` and inserts
one `activity_events` row (`event_type = 'DELIVERY_COMPLETED'`) so the
completion is visible to the executive rollups (DL-013) through the same
ledger every other completed transaction already writes to — no new BI
pathway was built for this. (Originally, as first shipped, this function
also inserted the lockout notification row directly; DL-021 below replaced
that with a generic trigger on `delivery_orders` so every status-driven
notification — not just this one — is decided in exactly one place.)

Status transitions reachable via a direct client `UPDATE` are intentionally
narrower than this RPC's: `delivery_orders_rider_progress` (RLS) lets a
rider push their own `accepted` order to `in_transit` directly, but
`delivered` and `under_investigation` are reachable *only* through
`verify_delivery_code` — no RLS policy grants a direct client write to
either state, so the attempt-counting and lockout-notification side effects
can never be bypassed by a plain `UPDATE`.

**Rationale**: DL-011 already established this exact shape (status column,
not exception; SECURITY DEFINER; one shared choke point) for the
functionally identical problem of "compare a secret, count failed
attempts, lock out after too many" — reusing it rather than a bespoke
mechanism keeps the codebase's one precedent for this class of problem
actually singular.

## WHATSAPP DELIVERY NOTIFICATIONS ADDENDUM (2026-08-31)

Prompt 10 builds the actual WhatsApp Business Cloud API integration the
DL-019 lockout notification (and three new trigger points) needed but
never had: a Supabase Edge Function holding the Meta credentials, a
database-side outbox feeding it, and a first DRAFT of the four template
messages it sends — submitted here for review, not assumed.

### DL-021: Trigger-fed outbox, pg_cron-driven Edge Function, template-only — never client-side, never free-form

**Decision**: `supabase/migrations/20260831150000_whatsapp_notifications.sql`
widens Prompt 9's CODE_LOCKOUT-only `delivery_notifications` table into a
general outbox for four notification types
(`ORDER_ASSIGNED`/`OUT_FOR_DELIVERY`/`DELIVERY_ESCALATION`/`DELIVERED`), and
replaces that prompt's one hand-written notification insert (inside
`verify_delivery_code`) with a single generic trigger,
`enqueue_delivery_notification()`, fired `AFTER INSERT OR UPDATE OF status
ON delivery_orders`:

- **Posted → `ORDER_ASSIGNED`** (customer): fires on `INSERT` where
  `status = 'posted'`. Delivery info and the confirmation code are both
  already known at creation time (Prompt 7), so this doesn't wait for a
  rider to claim the job — the customer doesn't need to know which rider
  it is, only that a delivery with this code is coming.
- **→ `in_transit` → `OUT_FOR_DELIVERY`** (customer).
- **→ `failed` / `under_investigation` → `DELIVERY_ESCALATION`** (branch
  contact, per DL-019's confirmed recipient decision). This now also fires
  for an *expired*, not just a 3-attempts-locked-out, code — Prompt 9's
  original hand-written insert only covered the lockout path; folding both
  into one trigger closed that gap rather than carrying it forward. Uses a
  random id suffix (`gen_random_uuid()`), not a deterministic one, because
  DL-014's confirmed code-recovery path means an order can be reissued and
  escalate a second time — the other three notification types each fire at
  most once per order and keep deterministic ids.
- **→ `delivered` → `DELIVERED`** (customer, best-effort/optional per the
  prompt's own framing — still logged and sent the same as the other three,
  just lower-priority in practice).

**Delivery mechanism mirrors DL-006's transactional-outbox shape on
purpose**: the trigger writes a durable `PENDING` row in the *same*
transaction as the status change (so a crash between the two can't
silently drop a notification, whether the change came from the Express
backend's service-role write or a rider's own RLS-gated client `UPDATE`),
and a separate, independently-paced process drains it —
`trigger_whatsapp_notification_drain()`, scheduled via `pg_cron` every
minute (`select cron.schedule('drain-whatsapp-notifications', '* * * * *',
...)`, same tool DL-013's executive-rollup refresh already uses), calls the
new `supabase/functions/whatsapp-notify` Edge Function via `pg_net`. That
Edge Function — **not** Postgres, **not** any client — is the only place
`WHATSAPP_ACCESS_TOKEN` is ever held (an Edge Function secret), satisfying
the prompt's explicit requirement that this never be a client-side call.
It authenticates the cron→function call via a shared secret header
(`x-drain-secret`, compared against `WHATSAPP_DRAIN_SECRET`), not a
Supabase JWT, since `pg_net` calls carry neither an `anon` nor a service
JWT. On each invocation it drains up to 25 `PENDING` rows oldest-first,
normalizes each `recipient_phone` to E.164 (no guessed country code — a
number without a leading `+` is marked `SKIPPED` with an explanatory
`error_message` rather than guessed at, so the underlying phone data gets
fixed at the source instead of silently mis-sending), and calls the Graph
API. A transient failure retries automatically on the next minute's sweep
(bounded at 3 attempts total — the same convention the confirmation-code
lockout already uses, not because the two are related, just an
already-established bound rather than inventing a new one); a 3rd failure
is left `FAILED` for manual follow-up, not retried forever.

**Every message this system ever sends is `type: "template"` — there is no
free-form-text code path at all.** WhatsApp only permits free-form
messages inside the 24h window after a customer last messaged the
business, and this table has no reliable way to know whether that window
is open for a given recipient at send time; templates work regardless of
the window and are required outside it. Building a free-form path "for
when the window happens to be open" would mean the integration silently
breaks the first time a delivery notification is needed more than 24h
after a customer's last message — exactly the assumption the prompt said
not to build on.

`supabase/functions/whatsapp-notify/templates.ts` holds only template
*metadata* (the Meta-approved template name and its `{{n}}` parameter
order) — never body text, since Meta owns that once approved and it must
never drift from what's actually configured in Business Manager. A
`platform_settings` table (new, not tenant-scoped — one Edge Function
deployable currently serves every tenant; see the Open Items note on
per-tenant WhatsApp accounts) holds the drain URL/secret the cron job
needs, seeded `null`. **Populating it, and setting the Edge Function's own
Meta secrets, is a deployment step this migration cannot perform** — the
same class of gap as `access_token_hook`'s dashboard registration
(DL-013): `whatsapp-notify` will simply defer (leave rows `PENDING`,
`deferred` count in its response) rather than error until
`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` are set as Edge Function
secrets and `platform_settings.whatsapp_edge_function_url`/
`whatsapp_drain_secret` are populated to match.

**Rationale**: a database trigger is the only place that reliably sees
*every* path that can change a `delivery_orders` row's status — the
Express backend's direct Supabase writes, a rider's own RLS-gated client
`UPDATE`, and `verify_delivery_code`'s `SECURITY DEFINER` writes all go
through the same table, so a table trigger is the one mechanism that can't
be bypassed by adding a fourth write path later without someone
remembering to wire up notifications for it by hand. Reusing DL-006's
outbox shape and DL-013's `pg_cron` scheduling rather than inventing a
webhook-per-row or a bespoke queue keeps this the third instance of the
same "transactional write, independently-paced drain" pattern in this
codebase, not a fourth different one.

### DL-022: Draft template content — submitted for review, not decided here

**Per the prompt's explicit instruction, none of the four template bodies
below are approved or final.** They are a starting draft for your review
and eventual submission to Meta's template approval flow. Meta template
names must be lowercase snake_case; category recommendations below are
`UTILITY` for all four (each is a transactional update tied to an existing
order, not marketing) — Meta may reclassify on review. Placeholders are
numbered to match `templates.ts`'s `paramOrder` exactly; if wording changes
during review in a way that adds, removes, or reorders a placeholder,
`paramOrder` must be updated to match or the Edge Function will send
parameters in the wrong slots.

1. **`delivery_order_assigned`** — customer, sent when a dispatch is
   created (DL-021's `ORDER_ASSIGNED`).
   > Hi {{1}}, your order from {{2}} has been dispatched for delivery.
   > Delivery address: {{3}}. Your confirmation code is {{4}} — please
   > share this code with the rider when your order arrives. Order ref:
   > {{5}}.

   `{{1}}` customer name · `{{2}}` pickup branch name · `{{3}}` delivery
   address line · `{{4}}` confirmation code · `{{5}}` sale/order reference.

2. **`delivery_out_for_delivery`** — customer, sent when a rider marks the
   order `in_transit` (DL-021's `OUT_FOR_DELIVERY`).
   > Hi {{1}}, your order {{2}} is now out for delivery and should arrive
   > soon. Please have your confirmation code {{3}} ready for the rider.

   `{{1}}` customer name · `{{2}}` sale/order reference · `{{3}}`
   confirmation code.

3. **`delivery_escalation_alert`** — branch contact, sent when an order
   is flagged `under_investigation`/`failed` (DL-021's
   `DELIVERY_ESCALATION`; recipient per DL-019's confirmed decision).
   > ALERT: Delivery order {{1}} (sale {{2}}) has been flagged for
   > investigation — {{3}}. Please verify with the rider and either issue
   > a new confirmation code or mark the order as fulfillment-failed.
   > Delivery address: {{4}}.

   `{{1}}` order id · `{{2}}` sale/order reference · `{{3}}` reason ("3
   failed confirmation code attempts" or "confirmation code expired") ·
   `{{4}}` delivery address line.

4. **`delivery_confirmed`** — customer, sent when the confirmation code is
   verified and the order is marked `delivered` (DL-021's `DELIVERED`;
   optional/best-effort per the prompt).
   > Hi {{1}}, your order {{2}} has been delivered. Thank you for your
   > order! If you have any concerns, please contact the branch directly.

   `{{1}}` customer name · `{{2}}` sale/order reference.

**Open for your review specifically**: exact wording/tone, whether the
branch name or a business name should appear in the customer-facing
templates, whether template #4 needs a contact number parameter rather
than "contact the branch directly," and language localization (all four
are drafted `en`-only — a tenant operating in a market needing another
language isn't addressed here).

## FISCALIZATION — PLUGGABLE LAYER, ZIMRA VIRTUAL FISCALISATION ADDENDUM (2026-09-01)

Prompt 11 finally builds what DL-003 only scoped: a real `FiscalizationProvider`
interface, a live (if placeholder-wire-format) implementation for ZIMRA —
Zimbabwe, the confirmed primary launch market, not Kenya — and the vendor-
facing Settings UI to configure and monitor it. Four items were explicitly
flagged in the prompt as requiring your sign-off rather than unilateral
implementation; all four were put to you directly and answered before any
code was written (see chat history). This addendum records what was
decided and, more importantly, *why* the resulting design looks the way it
does — two of the four answers ran counter to this document's own
recommendation, which reshaped the architecture materially.

### DL-023: Fiscal registration is shared per BRANCH, not per terminal — a deliberate deviation from DL-002/DL-009

**Decision (your call, against the recommendation)**: `fiscal_registrations`
(`supabase/migrations/20260901090000_fiscalization.sql`) is one row per
`(tenant_id, branch_id)`, shared by every terminal at that branch — not one
row per terminal. This is a genuine, acknowledged exception to DL-002/
DL-009's usual fully-independent-terminal model (own local SQLite, own
outbox, no shared local server between desks); it exists because ZIMRA's
FDMS model ties fiscal-day/invoice-sequence state to one registered device
identity, and a hardware fiscal device is physically one box per location
in practice anyway.

The hard problem this creates — how do multiple terminals at a branch
share one invoice-sequence counter without coordinating, given some of
them are sometimes offline — is solved by **allocating a sequence number
only at actual submission time**, never at sale-completion time:
`claim_next_fiscal_sequence(tenant_id, branch_id)` is a `SECURITY DEFINER`
Postgres function that atomically increments
`fiscal_registrations.invoice_sequence_counter` and is the *only* place a
sequence number is ever assigned. A sale completes locally and instantly
regardless of connectivity; nothing about it needs a fiscal sequence
number until the moment it's actually submitted, and submission itself
already requires reaching Supabase (to claim the sequence) and the fiscal
authority (to submit) — so the atomic claim never has to happen while
offline. Stated plainly, the trade-off this accepts: **invoice sequence
numbers reflect submission order across terminals, not strict
sale-completion chronological order.** That's an inherent consequence of
sharing one registration across independent, sometimes-offline terminals
while refusing to block a sale on fiscal availability (DL-026) — not
something this design can avoid while keeping both of those properties.

Credential distribution across terminals sharing one registration is
covered by DL-024.

**Known gap, not solved here**: today's actual deployment (per the
repeatedly-flagged "Second Tauri flag" note) is still one shared
Express+SQLite process serving both branch-terminal and head-office roles,
so a manual "retry" issued from Settings and a terminal's own local drain
loop are, in practice, touching the same database. Once genuine per-install
separation lands, a manually-reset Supabase submission row needs some way
to reach back to whichever terminal's local queue actually owns it —
`server/routes/fiscalization.ts`'s retry endpoint does not build that
mechanism (it flips the local + Supabase-mirrored row it can see, and
nothing more). Flagged now rather than silently assumed away, the same
discipline the "Second Tauri flag" note itself established.

### DL-024: Credential storage — ciphertext everywhere, key held only by each terminal's own process, distribution is a manual step

**Decision**: `fiscal_registrations.credentials_ciphertext`/`_iv`/
`_auth_tag` in Supabase, and the identical ciphertext mirrored into local
SQLite's `fiscal_registration_cache` (`server/db/migrations/008_fiscalization.sql`),
are the *only* form fiscal credentials ever take at rest, on either side.
`server/lib/fiscalCrypto.ts` (AES-256-GCM) is the one place encryption/
decryption ever happens, keyed by `FISCAL_CREDENTIALS_KEY` — a process
environment variable, never written to any database, never sent to
Supabase, never logged (`redactCredentialsForLogging()` exists specifically
so an error-logging call site can't accidentally dump a credentials object).
This is what makes "no centralized platform-held credential store" (your
confirmed architectural decision, restated at the top of the prompt) more
than an RLS policy: even full service-role access to Supabase — which the
platform operator has — can never recover a tenant's plaintext fiscal
credentials, because the key that would decrypt them never reaches
Supabase or any platform-controlled system.

**What this doesn't solve, by design, in this prompt**: getting the same
`FISCAL_CREDENTIALS_KEY` value onto every terminal sharing a DL-023 branch
registration is a **manual, out-of-band deployment step** — generate once
(`.env.example` documents the one-liner), distribute to every terminal at
that branch outside this application entirely. This is the same class of
gap as DL-013's `access_token_hook` dashboard registration: a real
requirement this codebase flags and does not silently paper over with a
weaker automated alternative. A terminal missing the key can't decrypt
credentials and fails loudly (`FISCAL_CRYPTO_UNAVAILABLE`), never silently
falls back to trusting an unencrypted value.

**Investigated and explicitly not built**: Tauri OS-keychain/secure-storage
(e.g. `stronghold`). Moot for this prompt — there is no Tauri app in this
codebase yet (the same gap DL-013 and the "Second Tauri flag" note already
flag twice over). Encrypted SQLite is the practical ceiling until that
packaging work lands; this is a known, stated limitation, the same
disclosure DL-011's security review already made for cached PIN hashes,
not a new weaker precedent invented here.

### DL-025: FiscalizationProvider interface — one call site for both submission modes, via an internal adapter

**Decision (your call, matching the recommendation)**: `server/lib/fiscalization/types.ts`
defines one interface every provider implements — `testConnection`,
`submitInvoice`, and an optional `runPeriodicBatch` that only batch-mode
providers implement. `submitInvoice` is the *only* method any caller
(`fiscalSubmissionService.ts`, the sale-completion hook, the Settings
routes) ever calls; a per-transaction provider (Zimbabwe/Zambia/Malawi)
submits immediately and returns `SUBMITTED`/`FAILED`, while a future
batch-mode provider (Mozambique) would buffer locally inside its own
`submitInvoice` implementation and return `QUEUED_FOR_BATCH`, with the
actual periodic submission happening in `runPeriodicBatch` — invisible to
every call site. Adding Mozambique later means adding a provider file and
a registry entry (`server/lib/fiscalization/registry.ts`), not touching
`fiscalSubmissionService.ts`, the sale-completion hook, or the Settings UI
structure — which is exactly what requirement 6 asked for.

`FiscalSubmissionResult.retryable` is the other half of this interface's
job: a provider decides, per failure, whether retrying the identical
payload could ever succeed (a network blip / 5xx — `retryable: true`, the
default) or definitely can't (a validation rejection — `retryable: false`).
This is what DL-026's unbounded-retry design needs to avoid hammering a
fiscal authority with a request that can never succeed as-is.

### DL-026: Real-time submission never blocks a sale; a fiscal-specific outbox with unbounded retry, not the general one

**Decision (your call, matching the recommendation)**: every sale completes
regardless of fiscal connectivity — `queueSaleForFiscalization()`
(`server/lib/fiscalization/fiscalSubmissionService.ts`), called from
`server/routes/sales.ts` right after a sale commits, is fire-and-forget and
cannot throw back into the sale route. A sale at a branch with no ACTIVE
fiscal registration is simply a no-op (nothing queued); one at a branch
with an ACTIVE registration gets a `fiscal_submissions` row (local SQLite,
`status = 'PENDING'`) and an immediate best-effort attempt if already
online.

**Explicitly not the general outbox (DL-006/DL-007)**: a fiscal submission
is a compliance obligation, not a UX nicety, so — unlike, say, the
WhatsApp notification outbox's bounded 3-attempt retry — a *transient*
failure (network error, 5xx, offline) is retried **indefinitely** by
`server/sync/fiscalDrainLoop.ts`, a dedicated drain loop on a tighter 30s
cadence than either the general outbox or the WhatsApp drain. Only a
provider-reported non-retryable failure (DL-025) is ever marked terminally
`FAILED`, surfaced in Settings for manual attention instead of being
retried forever. The Settings page's "pending/failed count, drill-down
into failures" requirement is backed by a threshold alert (5+ pending, or
oldest pending 60+ minutes) computed in `GET /api/fiscalization/submissions`.

**Rationale for going against the general outbox**: DL-007's four
conflict-resolution categories all answer "what happens when two writers
disagree about a row's value" — a fiscal submission isn't that kind of
problem at all (there's no conflict to resolve, only "did this reach the
fiscal authority yet, and if not, keep trying"), so forcing it into one of
those categories would have been a worse fit than giving it its own small,
purpose-built outbox, the same reasoning DL-015 already used to justify
`delivery_orders` bypassing the outbox entirely.

### DL-027: ZIMRA Virtual Fiscalisation implemented against a placeholder wire format; KRA eTIMS is a non-functional reference only

**Decision**: `server/lib/fiscalization/providers/zimraVirtualProvider.ts`
targets ZIMRA's Virtual Fiscalisation API (FDMS TEST environment) — your
confirmed choice, after the initial "hardware device" answer surfaced a
real constraint neither of us had accounted for (hardware devices have no
single ZIMRA-published protocol; it varies per Approved Supplier, so
"implement the hardware path" isn't a well-defined target the way the API
is). Hardware remains a second adapter to build later behind the same
`FiscalizationProvider` interface, once a specific supplier/device is
chosen — nothing in this prompt forecloses that.

**The wire format itself is an explicitly-flagged placeholder, not a
guess presented as real.** ZIMRA does not publish the FDMS request/
response JSON contract; it's issued directly by ZIMRA's Fiscalisation Team
upon TEST registration (`docs/fiscalization/zimra-reference.md`). The
provider file's header comment says this in the first line, in capitals,
before any code — every field name, endpoint path, and the auth mechanism
in `buildInvoicePayload`/`callFdms` must be verified and likely changed
once the real contract is obtained. This mirrors this document's own
established discipline for exactly this situation: `rate_config`'s seed
row is marked "PLACEHOLDER EXAMPLE VALUES ONLY," the WhatsApp templates
(DL-022) are marked draft-pending-approval — a structurally plausible but
explicitly-unconfirmed integration was chosen over either fabricating
false confidence or building nothing at all.

**KRA eTIMS** (`kraETimsReferenceProvider.ts`) fulfills requirement 5's
"move existing KRA eTIMS logic behind the interface as a reference
implementation" — except there was no existing working eTIMS logic to
move. A repo-wide search found only a cosmetic QR-verification URL string
inside the old mock `FiscalizationView` UI, never a real client. This
provider is a from-scratch minimal stub whose only purpose is proving the
interface holds for a second country's per-transaction shape; its
`testConnection`/`submitInvoice` always return a clear "reference
implementation only" failure and it is never offered as an active option
outside a `KE`-country tenant.

### Fiscal-day open/close: modeled in the schema, not operated on

`fiscal_registrations.fiscal_day_status`/`fiscal_day_number`/
`last_z_report_*` exist in the schema (ZIMRA's FDMS concept is real and
likely relevant even to the Virtual/API path, given Public Notice 26/2024's
own framing as "Virtual Fiscalisation *and API FDMS*") but **no code in
this prompt opens, closes, or reads them** — deliberately, because whether
day-open/close is actually required by the Virtual API specifically
(as opposed to being purely a hardware-fiscal-memory concept) is not
confirmed by anything in `docs/fiscalization/zimra-reference.md`, and the
Settings-page requirement list (prompt item 3) didn't ask for fiscal-day
lifecycle controls. Building confident-looking day-open/close logic
against an unconfirmed requirement would repeat exactly the mistake this
document's "Open items" discipline exists to prevent. Revisit once the
real FDMS API docs are in hand.

### The old mock `FiscalizationView` (System settings) is now a second, unwired fiscalization surface

`src/components/views/system/FiscalizationView.tsx` (pre-existing, not
touched by this prompt) still renders its own fiscal-day/Z-report/document-
queue UI entirely from local `useState`, with fabricated signatures/QR
URLs. It is not deleted or merged into the new Settings section — doing
either wasn't asked for and risks silently discarding a UI/UX surface that
may still be wanted for its Z-report/day-lifecycle concept (see above).
Flagged, not decided: a future prompt should either retire this view or
wire it to the real `fiscal_registrations`/`fiscal_submissions` data this
prompt built, rather than leaving two fiscalization surfaces (one real, one
entirely mock) coexisting indefinitely.

### Open items (explicitly not decided here)

- **The real ZIMRA FDMS wire format**: see DL-027 — obtaining it requires
  registering with ZIMRA's Fiscalisation Team; `zimraVirtualProvider.ts`
  must be revisited once it's in hand.
- **Fiscal-day open/close operational logic**: schema exists, nothing
  reads/writes it yet — see above.
- **Zambia (ZRA Smart Invoice), Malawi (MRA EIS), and Mozambique (AT,
  batch/SAF-T) providers**: not built, per the prompt's own explicit scope
  boundary. The interface (DL-025) and the batch-adapter shape are meant
  to make each a self-contained addition when its turn comes.
- **Per-tenant WhatsApp-style separate credential sets for the same
  provider across multiple branches with genuinely different fiscal
  identities within one tenant**: not a gap today (DL-023's one-row-per-
  branch shape already handles this), noted only because it's the kind of
  thing worth re-checking if a tenant's real-world fiscal setup turns out
  more complex than "one registration per branch."
- **Cross-terminal manual-retry propagation once per-install separation is
  real** (not today's shared-backend deployment): see DL-023's "Known gap"
  note.
- **The old mock `FiscalizationView` system view**: retire or rewire — see
  above.

## BUSINESS PROFILE ONBOARDING ADDENDUM (2026-09-02)

Builds a first-launch onboarding wizard (Tenant → Branch → the tenant's
first Staff record) plus a permanent Business Profile page in the System
menu that edits the same tenant/branch records, not a parallel store. Two
items were explicitly flagged as requiring sign-off before implementation;
both were put to you directly and confirmed before any code was written.

### DL-028: Wizard scope — option (a), keyed off a new Tenant Pairing Code, not the software activation code

**Decision (your call, matching the recommendation)**: the full wizard runs
only on the install that creates a new tenant; any later install either
joins that tenant via a lightweight branch/terminal confirm, or creates a
new tenant if given no pairing code. The signal is a new **Tenant Pairing
Code** (`tenants.pairing_code`, 8-char alphanumeric, same confusable-excluding
charset as `deliveryCode.ts`'s confirmation code) — generated once when the
founding install's wizard completes, shown to the admin, and re-shown on the
permanent Business Profile page for handing to whoever sets up the next
branch till.

This is a **different concept** from `LicenceInfo.activationCode` (a
product/plan software license key, unrelated to tenant identity) —
conflating the two was considered and rejected during design: the existing
activation-code format/flow (`ITR-PRO-XXXX-XXXX-202X`) reads as a purchase
credential issued by iTred support, with no natural mechanism for it to also
encode which tenant a second install should join. Introducing one new,
narrowly-scoped concept was simpler and more honest than overloading an
existing one to do a second, unrelated job.

**Real pre-login ACTIVATION stage, added as a prerequisite**: `LicensingView`
existed only as a post-login System-menu page with entirely simulated
activation (`handleActivateSubmit` was a `setTimeout`, never touched a
server) — there was no gate before `STAFF_ACCESS` at all
(`WELCOME_UPDATE` → `STAFF_ACCESS` directly). Since the wizard's Step 5
creates the tenant's *first* staff record, nothing could log in to reach a
post-login activation screen on a genuine first launch. A new `ACTIVATION`
app stage (`src/types/index.ts`'s `AppStage`) was inserted between
`WELCOME_UPDATE` and `STAFF_ACCESS`, reusing LicensingView's activation-code
UI pattern but making only the pairing-code resolution call real
(`POST /onboarding/resolve-pairing-code`). `LicensingView` itself — renewal,
entitlements, expiry countdown — is untouched and still simulated; making
the rest of it real was flagged as separate, unrequested scope, not folded
in here. An already-provisioned install skips ACTIVATION's real branching
entirely: `WelcomeUpdateScreen`'s continue button now calls
`GET /onboarding/status` first and goes straight to `STAFF_ACCESS` exactly
as before this feature existed unless `needsOnboarding` is true.

### DL-029: Onboarding is the one legitimate caller that predates env.tenantId — and the one thing that makes env.tenantId mutable

**Decision**: every route in this codebase (per DL-011) is scoped by
`env.tenantId`, sourced from a `TENANT_ID` env var fixed at process boot —
but a fresh install has no tenant yet, which is exactly what onboarding
exists to create. Rather than special-case this one flow with its own
parallel Supabase-client path, `server/env.ts`'s `isSupabaseConfigured` became
a function (was a boot-time-computed `const boolean`) and `env.tenantId`
became explicitly mutable, so `server/lib/installationConfig.ts`'s
`persistInstallationConfig()` — called at the end of both
`POST /onboarding/complete` and `POST /onboarding/join-tenant` — can flip
this process from unconfigured to configured **without a restart**:
existing routes, the staff/tenant pull-cache loops, and connectivity polling
all pick up the new tenant immediately. `server/lib/supabaseAdmin.ts` gained
one deliberate exception, `getSupabaseAdminUnscoped()` (url+key only, no
tenant check) — the only thing onboarding.ts is allowed to import instead of
`getSupabaseAdmin()`, since it is by definition the one caller that runs
before a tenant exists.

Restart-survival reuses, rather than reinvents, local SQLite's
`installation_config` singleton (`002_multi_tenant.sql`) — scaffolded in
Prompt 2 specifically for "this device's fixed tenant/branch/terminal
binding, captured once at activation time" and explicitly left unwired
("that's business logic for a later prompt"). This is that prompt:
`bootstrapTenantIdFromLocal()` runs once at boot, after migrations, and
restores `env.tenantId` from that table if `TENANT_ID` isn't set in the
environment — so a second process start after onboarding doesn't need the
`.env` file rewritten, avoiding a whole separate persistence mechanism.

**Unauthenticated by design, guarded by provisioning state instead of a
session**: `/api/onboarding/*` mounts with no `requireAuth` (there is no
staff/session yet), and every route instead refuses to run a second time
once `env.tenantId` is already set (409 `ALREADY_PROVISIONED`) — verified
live against the running server, along with `/api/business-profile`'s normal
401 when unauthenticated.

**Tenant/branch/staff/terminal rows are written directly to both Supabase
and local SQLite** (not via the outbox) at wizard completion, so this
device's own data is usable the instant setup finishes rather than waiting
up to 5 minutes for the first pull-cache cycle — the same reasoning DL-015
already used for delivery orders bypassing the outbox, applied here for a
different reason (immediate local usability vs. never-should-be-queued).

### DL-030: Field-locking is confirm-to-change, not a hard lock; branch geocoding is now genuinely persisted

**Decision (your call, matching the recommendation)**: TIN, VAT number,
registration number, country, and base currency require an explicit
confirm-to-change step (`ConfirmDialog`) on the permanent Business Profile
page before becoming editable; every other field is freely editable.
Changing one of the five is also the one thing this page logs — a
`BUSINESS_PROFILE_SENSITIVE_FIELD_CHANGED` `activity_events` row (via the
existing `applyWithOutbox`, so it syncs like every other activity event),
carrying old/new values in `metadata`. Nothing about a past record changes:
this is a forward-looking guard, not a data-integrity mechanism — the
existing versioning pattern (DL-004/DL-010/DL-023) already makes historical
fiscal submissions and priced transactions immune to a later config change
regardless of this UI gate.

**Business type taxonomy** (your call, matching the recommendation):
`BusinessType` — General Retail/Supermarket, Wholesale & Distribution,
Hospitality, Pharmacy, Hardware & Building Supplies, Fashion & Apparel,
Electronics & Appliances, Liquor/Bottle Store, Butchery & Fresh Produce,
Automotive Parts & Services, Salon & Personal Care, Other — tuned to this
product's actual Zimbabwe/Kenya retail SME market rather than a generic
global list, on the stated assumption it may later feed BI Brain peer-group
benchmarking (not built here).

**Branch geocoding persistence gap (flagged in the Executive PWA and
Delivery Fare addenda's "Open items," and again in DL-016) is now closed**:
`branches.latitude`/`longitude` are real columns (Supabase and local SQLite
both), not just the client-side-only `Branch.latitude`/`longitude` DL-016
introduced as a workaround. The primary branch created by onboarding is the
first real row ever written there. `server/routes/branches.ts`'s existing
GET still doesn't select them (unchanged, out of this prompt's scope) — the
delivery-dispatch pickup-coordinate flow DL-016 built keeps working exactly
as before, unaffected.

**"Trading/brand name" reuses `tenants.display_name`** (already existed,
previously just mirrored `legal_name`) rather than adding a redundant
`trading_name` column — Section 1.6's warning against duplicate/legacy type
pairs applied directly here.

**New, small, reusable addition, not onboarding-specific**:
`staff.contact_phone`/`contact_email` (Supabase and local) — Step 5 needed
somewhere to put the admin's recovery contact details, and no such columns
existed on any staff record at all; adding them generically (available to
every staff member, not gated to admins) was simpler than inventing a
side-table for two nullable strings.

### Open items (explicitly not decided here)

- **The Supabase migration for this addendum has not been applied to any
  real deployed project** — `supabase/migrations/20260902090000_business_profile.sql`
  exists as a file only; running it against a real project is a deployment
  step, the same class of gap `access_token_hook` registration (DL-013) and
  the WhatsApp Edge Function secrets (DL-021) already are.
- **Logo storage as a base64 `logo_data_url` column, not object storage**:
  no Supabase Storage bucket exists anywhere in this codebase yet, and one
  wasn't built here — same "no live external dependency" simplification
  precedent as DL-018's manual FX rate. Revisit if logo sizes (capped at
  300KB client-side) or a second consumer make this untenable.
  `MAX_LOGO_DATA_URL_LENGTH` in `server/routes/onboarding.ts` is the
  matching server-side ceiling.
- **`POST /onboarding/resolve-pairing-code` has no rate limiting** — it's
  the one unauthenticated endpoint that answers "does a business with this
  code exist," which is a low-value oracle (confirms existence, reveals
  legal/display name and branch list) but not a zero-value one. Flagged,
  not mitigated.
- **No `branchPull.ts` job exists** — `server/routes/branches.ts`'s GET
  still only ever reads local SQLite (unchanged, per its own header
  comment). `businessProfile.ts`'s PUT mirrors a primary-branch edit into
  local SQLite by hand for this reason, rather than assuming a pull job will
  reconcile it.
- **`Branch.latitude`/`longitude` on other, non-primary branches**: only the
  primary branch is guaranteed geocoded (onboarding requires it); additional
  branches created later (head-office "Locations" management, or
  `JoinTenantConfirm`'s "add a new branch" path) also require coordinates at
  creation time, but nothing back-fills coordinates for branches that
  predate this addendum in an existing tenant.

## BRANCH TERMINAL CORE FLOWS — AUDIT & EOD WIRING ADDENDUM (2026-09-02)

This prompt asked for the branch-terminal app's core flows (sell/cart, view
products, returns, EOD) to be wired to the real backend, plus the
already-built delivery-dispatch and fiscalization hooks to be attached at
the sale-complete point — with explicit instructions to stop and report
rather than build a parallel path if either hook didn't cleanly attach. An
audit against the actual codebase (not assumption) found most of the
requested scope already done in Prompt 3 and the delivery/fiscalization
prompts; this addendum records what the audit found, what it fixed, and
what it deliberately left as a flagged gap rather than silently patching.

### DL-031: Audit findings — sell/cart, products, and returns were already real; two hooks needed attention

**Already wired, verified by direct inspection, no changes made**: sell/cart
(`SalesView` → `POST /sales`, written through the outbox — Prompt 3), view
products (`App.tsx` fetches `GET /inventory/items`, real local SQLite synced
from Supabase, passed down as a prop — the mock-data import in `SalesView`
is only an unused-until-loaded default), and accept returns (`CreditNotesView`
→ `POST /credit-notes` — Prompt 3). The fiscalization hook was also
confirmed already correctly attached: `queueSaleForFiscalization()` is
called directly inside `server/routes/sales.ts`'s sale-creation route.

**Delivery CTA — functionally attached, but missing the specified
connectivity behavior**: `ReceiptModal`'s "Create Delivery Dispatch" button
was already wired end-to-end (`onCreateDelivery` → `onNavigateToDeliveryDispatch(saleNumber)`
→ `DeliveryDispatchView`, from the Delivery Dispatch addendum's
re-confirmation pass), but had no disabled-when-offline state and no
connectivity indicator, contrary to this prompt's explicit requirement. Not
a structural mismatch requiring a decision — `useConnectivity()` (DL-008)
already existed and was simply unused here. Fixed: the button is now
`disabled` (not hidden) while offline, with a `Wifi`/`WifiOff` indicator
next to it, mirroring the gating `DeliveryDispatchView` itself already
applies to its own create action.

### DL-032: EOD was entirely unwired — built on closed shifts' frozen totals, never on raw transactions

**Decision**: `EODSummaryView` was 100% local React state with no backend
route at all, despite `eod_reports`/`eod_reconciliation_entries` existing in
the schema since Prompt 1. `server/routes/eod.ts` (new) aggregates EOD's
seven tender categories by summing the corresponding column
(`total_cash_sales`, `total_mobile_money_sales`, etc.) across every
`status = 'CLOSED'` shift row for the branch/date — those columns are
themselves populated at shift-close time from `shiftReconciliation.ts`'s
immutable snapshot (`server/routes/shifts.ts`'s close handler). EOD
therefore never touches `sales_transactions` or recomputes anything a
shift already froze — it only sums numbers that were already locked at
shift-close, which is what "reconcile against shiftReconciliation.ts, which
must remain immutable/versioned" requires. `POST /eod/reports` always
recomputes expected amounts server-side from this same aggregation — the
client only ever supplies physically-counted amounts and notes, never
expected ones, so a stale or tampered client value can't misstate what the
system actually recorded. Verified against the running server end-to-end
(login, fetch reconciliation, finalize, list — including a pre-seeded
historical report surfacing correctly alongside the new one), not just
type-checked.

**Known limitation, flagged rather than fixed (your explicit call)**:
`shifts.total_refunds`, `total_payouts`, and `total_layaway_receipts` are
never populated by any real write path — credit notes (returns) live in
their own ledger with no link back to the issuing shift, and there is no
cash-payout feature anywhere in this codebase. REFUNDS and PAYOUTS will
therefore always aggregate to $0.00 in both the reconciliation screen and
finalized reports, regardless of what actually happened that day. Rather
than silently shipping a number that looks reconciled but isn't,
`EODSummaryView` shows an explicit warning banner naming this, and an info
icon on the two affected table rows. Building real credit-note-to-shift
linkage and a cash-payout feature is out of scope for this prompt — revisit
if EOD accuracy on those two categories becomes a blocker.

**Two pre-existing, unrelated type errors surfaced and fixed while rewriting
this file** (present before this prompt, not introduced by it — confirmed
via a before/after `tsc` diff): `unresolvedHeldSales` filtered on
`hs.status === 'HELD' || hs.status === 'PARKED'`, values that don't exist in
`HeldSale.status`'s real union (`'OUTSTANDING' | 'SETTLED' | 'CONVERTED_CREDIT' | 'CANCELLED'`)
and so could never have matched a real record — fixed to filter on
`'OUTSTANDING'`. `pendingAdjustments` filtered on `sa.status === 'PENDING_APPROVAL'`,
a field that doesn't exist on `StockAdjustmentRecord` at all (it's an
already-posted, one-shot record with no approval workflow) — left as an
explicit empty list with a comment, rather than inventing an approval
workflow that wasn't asked for.

### Hardware peripheral integration — researched per this prompt's request, not built

No official `tauri-apps`-org plugin exists for POS hardware. Findings,
recorded here so a later prompt doesn't have to re-research this:

- **Barcode scanner**: needs no Tauri plugin at all. Standard retail
  scanners are USB-HID keyboard-wedge or POS-scanner-class devices that
  emit keystrokes; the robust approach is capturing rapid keystroke+Enter
  bursts into a focused input, which works today even before Tauri
  packaging is finished.
- **Receipt printer (ESC/POS)**: third-party-only, mixed maturity —
  `tauri-plugin-esc-pos`, `tauri-plugin-thermal-printer`,
  `tauri-plugin-lnxdxtf-thermal-printer` (adds Bluetooth),
  `tauri-plugin-thermoprint`. Picking one means taking a dependency on a
  single third-party maintainer; none evaluated in depth or installed.
- **Cash drawer**: not a separate integration — conventionally kicked via
  an ESC/POS pulse command sent through the receipt printer's own
  RJ11/RJ12 port, so whichever printer plugin is chosen typically covers
  this for free.
- **Generic serial/USB**: `tauri-plugin-serialplugin` (s00d) is the most
  actively maintained generic option if a device needs raw serial rather
  than one of the ESC/POS-specific plugins.

**Not implemented, deliberately**: the Tauri sidecar/plugin foundation from
the earlier Tauri-scaffolding session is still incomplete (`lib.rs` only
registers the log plugin — see the "Second Tauri flag" note and the
still-open Cargo dependency work). Wiring any of the above against that
unfinished foundation would risk exactly the "parallel/duplicate path"
problem this prompt warned against. Recommend treating hardware I/O as its
own later prompt once Tauri packaging itself is finished.

## TAURI DESKTOP PACKAGING ADDENDUM (2026-09-04)

This closes the "Second Tauri flag" — first raised in the HEAD-OFFICE APP
ADDENDUM ("still no `src-tauri`, no Tauri dependency anywhere in the repo"),
carried forward unresolved through every subsequent prompt, and re-flagged a
second time in DL-023's "Known gap" note. Two packaging approaches were
proposed for review rather than decided unilaterally, given how much mature,
already-tested business logic (DL-006 through DL-030: outbox/sync, delivery
dispatch, fare engine, fiscalization, onboarding) lives in the Express layer:
(a) bundle the existing Express server as a Tauri sidecar, each install
spawning its own process against its own local SQLite file; (b) port that
logic into Rust/Tauri commands directly, eliminating Express. Option (a) was
confirmed — the existing Express logic was extensive and already correct per
this document's own addenda, and a from-scratch Rust rewrite of ~25 prompts'
worth of working logic was assessed as high-risk for no functional gain at
this stage.

### DL-033: Sidecar approach — each install spawns its own Express+SQLite backend as a Tauri external binary

**Decision**: `src-tauri/src/sidecar.rs` spawns the Express server
(`dist-server/server.mjs`) as a Tauri `externalBin` sidecar, once per app
launch, in release builds only — `tauri dev` keeps using its existing
`beforeDevCommand` (Vite + a fixed-port Express dev server), unchanged. Since
Node's Single Executable Application feature is still experimental and
complicates `node:sqlite`, the sidecar binary is the real Node.js runtime
itself, copied under Tauri's external-binary naming convention
(`scripts/prepare-sidecar.mjs`) and invoked as `node.exe dist-server/server.mjs`
— not a compiled Node binary.

What makes each install genuinely independent, per DL-002/DL-009's
requirement (own local SQLite, own outbox, no shared local server between
desks) rather than just a Tauri window wrapping the existing shared setup:

- **Own SQLite file**: `<app-data-dir>/data/itred.db`, where `app-data-dir`
  is Tauri's OS-standard per-install application-data directory
  (`app.path().app_data_dir()`) — a different physical file per install by
  OS convention, never a shared path.
- **Own ephemeral port**: `find_free_port()` binds `127.0.0.1:0`, reads back
  whatever the OS assigned, releases it, and hands it to the sidecar as
  `API_PORT` — no fixed port shared between installs, no coordination
  needed between them to avoid collision.
- **Own independent Supabase connection**: `SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY`/`FISCAL_CREDENTIALS_KEY`/etc. are read from an
  optional `config.env` file dropped in that install's own app-data
  directory (`read_config_overrides`) — the same manual, out-of-band
  secret-distribution discipline DL-024 already established for the fiscal
  credentials key, now the generic mechanism for every per-install secret a
  real deployment needs. No secret is baked into the shipped binary or
  installer.
- **Two-installs-on-one-machine dev testing**: an `ITRED_INSTANCE_ID` env
  var (set only by a developer, never by a real install) suffixes the
  app-data directory (`…/instances/<id>`), letting two "installs" run side
  by side on one machine without two physical devices — verified directly
  (not via this mechanism specifically, but its equivalent): two backends
  launched concurrently against distinct `DB_PATH`/`API_PORT` pairs
  bootstrapped independent schemas with zero collision on port or file lock.
- **WAL mode**: unconditional, unchanged — `server/db/connection.ts`'s
  `db.exec('PRAGMA journal_mode = WAL')` runs on every connection open with
  no conditional gate. Confirmed directly against two independent fresh
  per-install databases (`PRAGMA journal_mode` returned `wal` on both).
- **Installer target**: Windows MSI + NSIS only (`tauri.conf.json`'s
  `bundle.targets`), confirmed as the sole target for the current dev
  environment — no macOS/Linux build requested or produced. A full
  `tauri build` was run end-to-end (Vite → esbuild server bundle → sidecar
  prep → Rust release compile → bundling) and produced both
  `iTred Commerce_0.1.0_x64_en-US.msi` and
  `iTred Commerce_0.1.0_x64-setup.exe` successfully.

**Rationale**: reusing the real Node runtime as the sidecar avoids taking on
Node SEA's experimental-feature risk merely to save a few hundred MB in the
installer. Per-install ephemeral ports and OS-standard app-data directories
mean two installs never need to coordinate with each other to avoid
collision — each simply asks the OS for what's free/private to it, at spawn
time, independently.

### DL-034: `seedIfEmpty()` was silently defeating "genuinely fresh install" — now gated to non-production

**Decision**: `server/index.ts` called `seedIfEmpty()` (mock demo data —
fake staff with working bcrypt-hashed PINs, fake products, fake sales/shifts/
purchasing) unconditionally at every boot, gated only on "does the local
`staff` table have zero rows." That condition is true exactly once for the
shared dev database (harmless, intended), but was *also* true for every
single genuinely fresh Tauri install, every time — discovered directly while
testing requirement 3 below: a server pointed at a brand-new empty SQLite
file auto-seeded fake demo data before onboarding ever ran. A real
customer's first launch would have shown a mix of fake demo staff/PINs/
products alongside whatever the onboarding wizard created, not the blank
slate DL-028/029 assumes. Fixed with one guard in `server/index.ts`:
`seedIfEmpty()` now only runs when `!env.isProduction` — `npm run dev`/`tsx`
always run with `NODE_ENV=development` (unchanged), and the packaged Tauri
sidecar always sets `NODE_ENV=production` (`sidecar.rs`), so no existing
dev/demo workflow changes.

**Rationale**: this is exactly the class of "existing logic assumes a
shared/dev setup" problem this addendum's own scope explicitly called out
for a stop-and-report rather than a silent side-effect fix — flagged to you
directly before being fixed, per your explicit go-ahead.

### DL-035: `join-tenant`'s existing-branch path didn't cache the tenant or branch locally before inserting a terminal — broke under genuine per-install separation

**Decision**: discovered live while testing requirement 3's "brand-new
install joining an existing tenant via pairing code" case. Under the old
shared-single-SQLite-file setup this was invisible: every terminal already
had every tenant/branch row cached locally, because they were all the same
file. On a genuinely separate per-install database, two real foreign keys
(`branches.tenant_id`, `terminals.tenant_id`/`branch_id` —
`002_multi_tenant.sql`) fail on insert, because neither the tenant nor the
branch being joined has ever been cached on this install before. The
`branch.new` path already mirrored a newly-created branch into local SQLite;
the `branch.existingBranchId` path (the realistic case — a second till
joining an already-set-up branch) did not, and neither path cached the
tenant row at all. Fixed in `server/routes/onboarding.ts`'s `/join-tenant`
route: the full tenant row is fetched and mirrored into local SQLite
immediately after the pairing code resolves (before any branch/terminal
work), and the existing-branch lookup now selects and mirrors the full
branch row the same way the new-branch path already did. Deliberately *not*
done via `pullTenantFromSupabase()`/`env.tenantId` directly at that point —
this request can still fail afterward (branch not found, a Supabase
terminal-insert error), and setting `env.tenantId` before
`persistInstallationConfig()` durably commits would leave the process
believing it's already provisioned with no matching `installation_config`
row if that later failure happened. Verified live end-to-end after the fix:
a second install joined the first install's freshly-onboarded test tenant by
pairing code, ending with two installs sharing the same tenant/branch but
each with its own distinct `installation_config`, own terminal, and correct
independent local SQLite state.

**Rationale**: same discipline as DL-034 — a genuine gap this packaging work
surfaced, not something to patch quietly. The fix mirrors the pattern the
`branch.new` path already established rather than inventing a new one.

### Known gap, reconfirmed — DL-023's cross-terminal fiscal-retry routing is now concretely real, not theoretical

DL-023 already flagged that a manually-triggered fiscal-submission retry and
a terminal's own local drain loop were, at the time, touching the same
shared database, and that this would need a real cross-terminal mechanism
"once genuine per-install separation lands." It has now landed, and the gap
is unchanged and unresolved, per this prompt's explicit instruction not to
touch DL-006 through DL-030's business logic: `server/routes/fiscalization.ts`'s
`POST /submissions/:id/retry` reads `fiscal_submissions` from `WHERE id = ?`
against **this terminal's own local SQLite only**, and its own 404 message
already says so verbatim — `'Fiscal submission not found on this terminal'`.
Under genuine per-install separation, a submission created by the terminal
that completed the sale lives only in that terminal's local queue; a
head-office admin clicking "retry" on a different terminal's Settings page
has no way to see or flip that row. Not fixed here — flagged again, as
DL-023 itself already anticipated, so it isn't lost a third time.

**Resolved 2026-09-05 — see DL-037** (Tauri Desktop Packaging Addendum,
below): a Supabase mailbox flag plus the existing fiscal drain loop now
lets a retry issued from any terminal reach whichever terminal actually
owns the submission locally.

### Testing performed

- `cargo check` on `src-tauri` — clean.
- Two independent simulated fresh installs launched concurrently (distinct
  `DB_PATH`/`API_PORT`, no shared `.env` in scope, mirroring the sidecar's
  real `current_dir`/env-var contract): both migrated schema from scratch,
  both showed `journal_mode = wal`, both had zero seeded rows (post-DL-034
  fix), no port or file-lock collision between them.
- Live round-trip against the dev Supabase project (after 8 previously-
  unapplied migrations — an existing, already-documented "file only, not
  applied" gap unrelated to this packaging work — were applied by you): a
  brand-new install created a new tenant via the wizard; a second brand-new
  install joined that tenant via its real pairing code, attaching to the
  existing branch. Verified both installs' local SQLite ended up correct
  and mutually independent (own `installation_config`, own terminal row,
  shared tenant/branch data correctly synced). Test tenant/branch/staff/
  terminal rows deleted from Supabase afterward.
- Full `tauri build` produced both a working MSI and NSIS installer.

### Open items (explicitly not decided here)

- **macOS/Linux builds**: not requested, not built. Windows MSI/NSIS only.
- **Hardware peripheral integration**: unchanged from the prior addendum's
  findings — still a separate, later prompt.
- **Local `terminals` cache has no `app_surface` column** (pre-existing,
  predates this prompt): Supabase's `terminals` table carries it; local
  SQLite's does not, and neither onboarding route writes it locally. Not a
  packaging-caused issue (the shared setup had the same gap) and not
  encountered as a functional problem in this testing — this install's own
  surface is already available via `installation_config.app_surface`. Noted
  for awareness, not fixed here.
- **The 8 previously-unapplied Supabase migrations**: now applied to the dev
  project (delivery orders, fare engine, rider PWA, WhatsApp notifications,
  fiscalization, business profile, executive rollups, chart of accounts) —
  this closes those specific "file only, not applied" gaps as a side effect
  of unblocking this prompt's required onboarding test, not as originally
  scoped work.
- **DL-023's cross-terminal fiscal-retry routing**: was unresolved, now
  concretely reachable rather than theoretical — closed by DL-037 below.

### DL-036: the packaged app never actually launched successfully until now — two silent packaging bugs, found only by running the real installed app

Everything above (DL-033 through DL-035) was verified via manually-orchestrated
processes standing in for the sidecar (same env vars/cwd contract, not the
actual `app.exe`/Tauri runtime). The gap in that testing showed immediately
once the real installed app was launched (via the built MSI) and reported as
a blank window that never reached Staff Access — the exact kind of thing this
document's own guidance says to verify in the real app, not infer from
adjacent testing. Root causes, found by adding an always-on plain-text
`sidecar.log` next to this install's data directory (release builds
previously had **zero** diagnostics at all — `lib.rs` only registers
`tauri-plugin-log` under `cfg!(debug_assertions)`, so a release-mode failure
here was completely invisible, not merely unlogged):

1. **`resource_dir()` path was missing a path segment.** It resolves to the
   install's own base directory, not the bundled-resources folder directly;
   `tauri.conf.json`'s `bundle.resources: ["resources/server/**/*"]`
   preserves that same `resources/` prefix underneath it, so the real files
   sit at `<resource_dir>/resources/server/...`. `sidecar.rs` only joined
   `"server"`, pointing `current_dir()` at a directory that didn't exist —
   `spawn()` failed outright ("the directory name is invalid," Windows error
   267), before the sidecar process ever started.
2. **Node's own main-module resolver doesn't handle Windows extended-length
   paths.** Once (1) was fixed, the sidecar spawned but Node itself crashed
   inside `resolveMainPath`/`realpathSync` with `EISDIR: lstat 'C:'` —
   Tauri's path APIs return `\\?\`-prefixed paths, and passing one as the
   main script argument corrupted it down to just `C:` inside Node's
   internal resolver, before any application code ran. Fixed by stripping
   the `\\?\` prefix (`normalize_path()`) from every path handed to the
   sidecar — cwd, script argument, and the `DB_PATH`/`DIST_DIR` env vars.

Both fixed and verified against the actual installed app (not a stand-in):
`sidecar.log` shows a clean start (migrations applied, `iTred Commerce API
listening on http://localhost:<port>`), the window navigates to the real
backend, and `GET /api/onboarding/status` responds correctly through it.
Both MSI and NSIS installers were rebuilt afterward — the ones DL-033 first
verified were built *before* this fix and would have exhibited the same
blank-window failure on a real machine.

**Rationale for fixing directly rather than stopping to ask**: unlike
DL-034/DL-035 (onboarding business logic), this is squarely inside this
prompt's own scope — packaging/process-topology — and both bugs are in code
this same prompt wrote, not in DL-006 through DL-030's existing logic.
**Lesson for this document's own testing discipline**: manually reconstructing
a sidecar's env/cwd contract is not a substitute for launching the actual
packaged binary at least once — it validates the Express/SQLite layer
correctly but cannot catch bugs in the Tauri-specific glue code connecting
the two, which is exactly where both of these lived.

### DL-037: Cross-terminal fiscal-submission retry — a Supabase mailbox flag, consumed by whichever terminal actually owns the row

**Decision**: closes DL-023's "Known gap" note (re-flagged a second time in
this addendum's own "Open items"): a manual retry issued from one terminal
could only ever see and flip a row in *that terminal's own* local
`fiscal_submissions` queue, never a submission created by a different till
at the same branch — a real problem now that DL-033's per-install
separation is genuinely in place, not a theoretical one. Fixed with a
mailbox column rather than any live terminal-to-terminal channel (no such
channel exists anywhere in this codebase, and building one would be a much
larger addition than this gap warrants):

- **`fiscal_submissions.retry_requested_at`** (new, Supabase only —
  `supabase/migrations/20260905090000_fiscal_remote_retry.sql`): null in the
  overwhelming common case. `POST /submissions/:id/retry`
  (`server/routes/fiscalization.ts`) now checks this terminal's own local
  SQLite first — a hit is retried exactly as before, immediately, no
  Supabase round-trip needed. A miss means the row belongs to some other
  terminal at this tenant (or doesn't exist at all): the route looks it up
  in Supabase to distinguish those two cases (404 vs. genuinely
  cross-terminal) and, if found, sets this timestamp — never writing
  anything else about the row, since this terminal doesn't have the local
  context (decrypted credentials, the actual sale) needed to attempt the
  submission itself.
- **Consumption**: every online terminal's existing 30s fiscal drain tick
  (`server/sync/fiscalDrainLoop.ts`) now starts with
  `applyRemoteRetryRequests()` — pull the tenant's outstanding flagged ids
  from Supabase, and for each one, check local SQLite. Not found: skip,
  leave the flag for whichever terminal does own it. Found: reset it to
  `PENDING` (`fiscalSubmissionService.ts`'s new exported
  `resetSubmissionForRetry`, the same reset both the local-immediate path
  and this path now share) and clear the Supabase flag — the row then falls
  straight into that same tick's existing PENDING scan, so a cross-terminal
  retry and a same-terminal one both end up attempted within one drain
  cycle either way. No coordination between terminals is needed to decide
  who owns a given row: the check is a cheap local no-op for every terminal
  that isn't the owner.
- **`GET /submissions`** (same route file) now reads the tenant-wide
  Supabase mirror by default — the local-only view was never going to be
  enough for Head Office to find (let alone retry) another till's
  submission in the first place — falling back to this terminal's own local
  SQLite only when Supabase can't be reached, flagged via a new `scope:
  'tenant' | 'local'` field in the response. Verified live against this
  install's own dev environment: with the Supabase-side migration not yet
  applied to the dev project (the `fiscal_registrations`/`fiscal_submissions`
  tables don't exist there yet — a pre-existing, already-documented "file
  only" gap, unrelated to this fix), the endpoint correctly fell back to
  `scope: 'local'` rather than erroring, and a locally-inserted test
  submission's retry correctly reset it to `PENDING` and re-attempted it
  end-to-end (failed again as expected, since the test row referenced no
  real fiscal registration — confirming the reset-and-reattempt wiring, not
  a real submission). The genuinely cross-terminal path (a retry dispatched
  from one install and consumed by another) is exercised by the same
  already-proven pull-cache mechanics as `fiscalRegistrationPull.ts`/
  `staffPull.ts`, not independently re-verified live here, since doing so
  would require applying this migration to a real Supabase project first —
  a deployment step, same as every other migration in this codebase.

**Rationale**: a mailbox flag on the row Supabase already mirrors reuses
the exact pull-cache shape (DL-012/DL-013) this codebase already trusts for
"data authored on one terminal must reach others," rather than inventing a
live terminal-to-terminal RPC/push channel that doesn't exist anywhere else
in this architecture. Folding consumption into the *existing* 30s drain
tick (rather than a new interval) means a cross-terminal retry surfaces on
the same cadence a same-terminal one always has, and reuses the same
connectivity gate for free.

**Still not solved, by design**: a retry dispatched while the owning
terminal is offline simply waits — the flag sits in Supabase until that
terminal is next online and runs a drain tick, which is the same
online-dependency every other part of this fiscal-submission system already
has (DL-026: submission itself needs connectivity to claim a sequence
number and reach the fiscal authority). Not a new limitation this fix
introduces.

## CONSOLE, LICENSING & BILLING SUBSYSTEM ADDENDUM (2026-09-05)

This addendum captures the architectural decisions for a platform console
(vendor-side, staff-facing), a three-layer licensing/activation model, and a
composable billing model — none of it implemented yet. Per the prompt that
produced this addendum, **this is documentation only**: no code, schema, or
UI referenced below exists in the repository at the time of writing. These
decisions are binding for whichever future prompt(s) actually build this
subsystem, the same role Section 1's baseline and the MULTI-TENANT &
DELIVERY SUBSYSTEM ADDENDUM played for the work that followed them. Three
items are explicitly **not** decided here and must not be silently assumed
by later implementation work — see the Decision Log entries and Open items
below, both marked accordingly.

### DL-038: Console is a separate deployable, in-repo now, zero shared runtime, extraction-ready

**Decision**: the platform console lives at `apps/console/` — its own
`package.json`, own build, own top-level folder — with **zero shared
runtime code** with the Tauri POS/Head-Office apps (`src/`, `src-tauri/`,
`server/`) or with the existing PWAs (`executive-pwa/`, `rider-pwa/`).
Always-online, no offline durability requirement, not a Tauri install. The
"handshake" between console and every other surface is the shared Supabase
Postgres schema and Edge Functions **only** — never shared frontend code,
never a direct reach into POS-app internals (no importing from `src/` or
`server/`, no shared local process, no assumption of a shared filesystem
with the Express sidecar). Console-specific tables (DL-039/DL-041/DL-042/
DL-043 below) live in the same Supabase project as everything else, RLS-
scoped so only the console's own service-role/platform-admin path can
write to them; a tenant may only read narrow views of its own current
plan/activation status, never another tenant's and never the console's
operational tables directly.

Built in-repo first, for iteration speed, but with **explicit intent to
extract `apps/console/` into its own repository later** — every choice
above is designed against that eventual extraction, not just compatible
with it: no relative imports reaching outside `apps/console/`, no `@shared`
alias of the kind DL-002 established for the Executive/Rider PWAs' UI
component reuse, no dependency on anything running in the same process or
on the same machine as a POS install.

**Rationale**: DL-002 already established independent data-access layers
per surface as this platform's norm, and permitted sharing UI/type code
where practical via `@shared`. Console goes one step further and shares
*nothing* at the runtime level, specifically because — unlike the
Executive/Rider PWAs, which have no stated extraction plan — this surface
is explicitly slated to leave the monorepo. Any coupling accepted now
(a shared type import, a shared component) becomes extraction debt later;
zero coupling from day one is cheaper than untangling it retroactively.
Supabase-as-the-only-handshake mirrors the Executive PWA's own model (reads
Supabase directly under RLS, DL-013) but console sits on the *write* side
of that boundary for its own tables — the platform-operator-facing inverse
of DL-013's tenant-scoped read pattern, not a new integration style.

### DL-039: Three-layer licensing model — Tenant Identity, License Key, Activation Code

**Decision**: licensing is modeled as three distinct layers, each with a
different lifetime and scope:

1. **Tenant Identity** — created once at signup, tied to a primary email.
   Conceptually this is the existing `tenants` row (Section 1.6/DL-001),
   not a new parallel identity concept — whichever prompt implements this
   should extend `tenants`, not introduce a second "account" table.
2. **License Key** — bound to `tenant_id` + email, identifies the tenant's
   whole ecosystem (every branch/terminal) and encodes plan tier/
   entitlements. Long-lived, rarely changes, tenant-wide.
3. **Activation Code** — short-lived, cryptographically signed (JWT or
   equivalent), issued **per terminal, not per tenant** — payload contains
   `tenant_id`, `terminal_id`, `plan_tier`, `issued_at`, `expires_at`, and a
   signature. Terminal apps verify the signature **offline**, against a
   bundled public key — validating an already-issued code never requires a
   network call.

The License Key stays tenant-wide; only Activation Codes are
terminal-scoped, which is what lets one terminal be revoked (by simply not
renewing/reissuing its code) without invalidating the tenant's License Key
or any other terminal's already-valid code.

**Naming collision, flagged now rather than discovered mid-implementation**:
this document already uses "activation code" for a different, existing
concept — `LicenceInfo.activationCode` (format `ITR-PRO-XXXX-XXXX-202X`),
surfaced in `LicensingView` and in the pre-login `ACTIVATION` app stage
DL-028 introduced. DL-028 was explicit that this existing concept is a
*product/plan purchase credential issued by iTred support*, unrelated to
tenant identity, and deliberately kept separate from the Tenant Pairing
Code it introduced for exactly that reason — and that `LicensingView`
itself (renewal, entitlements, expiry countdown) remains **untouched and
still simulated**, not real. This new per-terminal Activation Code is a
third, different concept that happens to share the same English term. Not
resolved here — a future implementation prompt must explicitly decide
whether these two "activation code" concepts are unified, one subsumes the
other, or they coexist under different names, rather than two independent
code paths silently growing under the same name.

**Naming resolution**: to avoid exactly the ambiguity flagged above, the
per-terminal, signed, expiry-bearing token this addendum introduces is
named **`TerminalActivationToken`**, not "Activation Code," from this point
forward. This is a deliberate *naming separation*, not a merge,
supersession, or deprecation of DL-028 — `LicenceInfo.activationCode`
remains exactly as DL-028 left it: untouched, unrenamed, and unexamined by
this addendum or this note. Only the naming collision itself is resolved
here (so future prompts have one unambiguous term — `TerminalActivationToken`
— to build against); whether `LicenceInfo.activationCode` should eventually
be retired, merged into `TerminalActivationToken`, or kept permanently
distinct is still not decided (see the corresponding Open items entry).

**Rationale**: matching entity lifetime to entity scope (identity: once;
license: rarely; per-terminal activation: frequently) is what makes
per-terminal revocation possible at all without an all-or-nothing tenant
lockout. Offline signature verification (rather than a live entitlement
check) is required for the same reason DL-040's lock evaluation must be
offline-capable — a branch terminal that can't validate its own license
without connectivity would violate this platform's offline-first premise
(DL-002) the moment licensing became load-bearing to it.

### DL-040: Module-lock enforcement — 5 working-day grace period, offline-evaluated, narrow lock scope

**Decision**: when a TerminalActivationToken expires, a 5-working-day grace period
begins — the working-day calendar is a tenant setting (default Mon–Fri).
If the grace period elapses with no renewed code, the **Sales** and
**Purchasing** module menus lock on that terminal specifically. Reporting,
EOD reconciliation, and inventory viewing remain available regardless of
lock state. Lock/grace-period state is evaluated **entirely locally**, from
the signed TerminalActivationToken's own expiry field plus the local clock — this
must produce the correct lock state even if the terminal never reconnects
after the code expires, which is why DL-039 specified offline signature
verification in the first place.

**Rationale**: mirrors this codebase's existing offline-first discipline
(branch terminals must function without connectivity — Section 1.6, DL-002)
applied to licensing enforcement itself rather than only to business data;
a lock mechanism that needed a live network call to evaluate would defeat
the terminal's own offline-first premise at exactly the moment licensing
became load-bearing. Scoping the lock to Sales/Purchasing only — not the
whole app — treats this as a payment-enforcement mechanism, not a punitive
kill switch: a lapsed tenant can still reconcile, report on, and view the
stock/history that's already theirs.

### DL-041: WhatsApp activation-request flow — a `wa.me` deep link, not the Cloud API

**Decision**: when online, the Head Office app exposes a "Request
TerminalActivationToken" action that opens a `wa.me` deep link, pre-filled with
`tenant_id`/License Key context, sent through the user's **own** WhatsApp
client to a vendor support number. No Meta Cloud API involvement and no
template approval requirement for this specific flow — it is a distinct
mechanism from the existing WhatsApp Business Cloud API integration
(DL-021/DL-022) already built for delivery notifications, which is
unrelated and untouched by this decision. Every request that arrives this
way is logged in the console as an `activation_request` record (`tenant_id`,
`requested_at`, `terminal_id` if known, fulfillment status). Console staff
manually verify payment and issue a new signed TerminalActivationToken against the
specific tenant/terminal from the console UI — that console UI itself is
explicitly out of scope here (a later prompt's job, referenced in the
originating prompt as "Prompt 17").

**Rationale**: consistent with this document's established preference for
the structurally simplest mechanism that has no live external dependency
when one isn't yet warranted (DL-018's manually-entered FX rate, DL-024's
manual out-of-band key distribution) — a `wa.me` link needs no backend
integration, no Meta app review, and works today, matching the reality
that no console exists yet to receive an automated request. Logging every
request as a durable `activation_request` row regardless of the channel it
arrived through is what makes DL-042's two-ledger reconciliation possible
at all — a request that only ever existed as a WhatsApp message, with no
corresponding console-side record, would leave that ledger permanently
incomplete for every code issued this way.

### DL-042: Two-ledger reconciliation — independent issuance and activation logs, reconciled by (tenant_id, terminal_id, code)

**Decision**: the platform console keeps the authoritative log of
"TerminalActivationToken X issued to tenant Y for terminal Z, at time T, by console
operator O." The tenant's own SysAdmin (Head Office app) independently
keeps its own log of "TerminalActivationToken X received and activated on terminal
Z, at time T." The two are reconciled by `tenant_id` + `terminal_id` +
`code`, rather than one side treating the other as sole source of truth.

**Rationale**: an audit trail that exists on only one side — either the
vendor's issuance record or the tenant's own activation record — has a
single point of failure; if the console's record is lost or tampered with,
the tenant's own independently-kept record is still checkable, and vice
versa. This is the same general pattern this codebase already applies to
another compliance-relevant event with two interested parties: fiscal
submissions keep both a terminal-local record and a Supabase-mirrored one
(DL-023–DL-027, now DL-037), rather than trusting a single ledger — reused
here rather than inventing a new audit shape for a structurally similar
problem.

### DL-043: Composable billing model — `plan_components` + `tenant_subscriptions`, tenant-level UI only

**Decision**: billing lives entirely on the tenant SysAdmin's Billing page
(Head Office app) — **never** surfaced per-individual-terminal in the UI,
even though TerminalActivationTokens themselves are logged per terminal (DL-039/
DL-042). Modeled as composable line items: `plan_components`
(`component_type`, `unit_price`, `billing_unit`) describes what can be
billed; `tenant_subscriptions` records which components, and what
quantities, are active for a given tenant. Four component types are
named now: **base fee** (covers one default warehouse/branch), **per-branch
fee** (each additional branch beyond the default), **per-terminal fee**
(each terminal, regardless of branch), and **feature add-ons** (BI Brain,
Delivery, PoolWise, CashPlan, and future modules — each independently
toggled and priced).

**⚠ OPEN DECISION — feature add-on billing scope**: whether a feature
add-on (BI Brain, Delivery, etc.) bills as one tenant-wide flat fee or
scales per-branch/per-terminal is **not decided**. `plan_components.
billing_unit` is specified now specifically so it can express either shape
without a schema change once this is decided — implementers must not
default to one interpretation when populating it for a real add-on.

**⚠ OPEN DECISION — proration on mid-cycle additions**: whether adding a
branch or terminal mid-billing-cycle triggers an immediate prorated charge
or simply rolls into the next cycle's invoice is **not decided**. No
proration logic should be implemented until a future prompt revisits this
explicitly and confirms one.

**⚠ OPEN DECISION / PLACEHOLDER — PoolWise and CashPlan scope**: both are
named here only as billable feature add-ons; **neither module's functional
scope is defined anywhere in this document**. These are placeholder
entries so they aren't silently dropped from future planning, not a
commitment to any particular feature set — do not build feature logic for
either until its scope is defined in a future addendum.

**Rationale**: modeling billing as composable line items rather than a
single fixed per-plan price is what would let DL-004's versioning
discipline extend to billing later (a `plan_components` price change
should not retroactively alter an already-issued invoice) even though no
such versioning mechanism is built by this documentation-only pass. Keeping
the Billing UI entirely at the tenant level — never per-terminal — mirrors
DL-039's own split: terminals are where TerminalActivationTokens and module locks
live, but billing is inherently a tenant-level commercial relationship, not
a per-till one, the same distinction DL-001's Tenant → Branch → Terminal
hierarchy already draws for data ownership generally.

### DL-044: Payment integration — aggregator-mediated EcoCash, connectivity required by design

**Decision**: EcoCash acceptance goes through a payment gateway aggregator
(e.g. Paynow, or an equivalent Zimbabwe-market aggregator covering
EcoCash/OneMoney/cards) rather than a direct-to-EcoCash merchant
integration. **⚠ OPEN DECISION — which aggregator**: not chosen; documented
as open rather than defaulted to a specific vendor. Billing and payment
actions always require connectivity — an explicit, intentional exception
to this platform's offline-first principle (DL-002/DL-008), made because
payment processing has no meaningful offline mode to fall back to.

**Rationale**: an aggregator avoids taking on a direct EcoCash merchant
integration with no single published protocol until formally engaged with
the fiscal/payment authority in question — the same category of problem
DL-027 already hit with ZIMRA's hardware-fiscal path, resolved there by
picking the option with an actual published contract rather than guessing
at an unpublished one. Stating the offline-first exception explicitly,
rather than leaving it implicit, matches this document's own discipline of
naming every deliberate deviation from an established principle rather
than letting it be discovered later as an inconsistency (DL-023 did the
same for fiscal-registration sharing breaking the usual per-terminal
independence model).

### Open items (explicitly not decided here)

- **Feature add-on billing scope** (DL-043): tenant-wide flat fee vs.
  per-branch/per-terminal pricing — **unresolved**. `plan_components.
  billing_unit` is deliberately flexible enough to support either; do not
  implement against an assumed default.
- **Proration on mid-cycle branch/terminal additions** (DL-043): immediate
  prorated charge vs. rolled into the next cycle's invoice — **unresolved**.
  Do not implement proration logic until this is explicitly revisited.
- **PoolWise and CashPlan functional scope**: referenced only as billable
  placeholders (DL-043) — **scope pending**, do not build feature logic for
  either until defined in a future addendum.
- **Payment aggregator choice** (DL-044): Paynow vs. an equivalent
  alternative — **unresolved**, not defaulted.
- **"Activation Code" naming collision** (DL-039): the naming itself is
  now resolved — this addendum's per-terminal signed token is named
  `TerminalActivationToken` specifically so it no longer collides with
  DL-028's existing `LicenceInfo.activationCode`. What remains unresolved is
  the relationship between the two concepts, not what to call either of
  them.
- **DL-028's `LicenceInfo.activationCode` needs inspection** to determine
  whether it should later be retired, merged into `TerminalActivationToken`,
  or kept distinct — do not touch that field until this is explicitly
  revisited.
- **Console UI itself** (referenced in DL-041 as issuing
  `TerminalActivationToken`s and recording `activation_request`
  fulfillment): out of scope for this addendum entirely — a later prompt's
  job.

## CONSOLE-OPERATOR AUTH, TOKEN ISSUANCE & BILLING CALCULATION ADDENDUM (2026-09-05)

This addendum builds the real functionality the previous addendum
deliberately left as documentation/schema/placeholder-only: a working
console-operator identity and auth model (resolving DL-002's
"Platform Super-Admin View... scope deferred to a future addendum" and the
previous migration's own TODO against `app_is_super_admin()`),
TerminalActivationToken issuance with real cryptographic signing, and a
billing calculation engine. Two DL-043 open items — proration, and whether a
feature add-on bills flat or scaled — remain genuinely undecided; nothing
below resolves either, by design.

### DL-045: Console-operator identity, and `app_is_super_admin()` becomes real

**Decision**: a new `console_operators` table
(`supabase/migrations/20260905120000_console_operator_auth.sql`) — `id`,
`auth_user_id` (unique, references `auth.users`), `email`, `name`,
`is_active` — holds the platform's own operator roster. It gets the exact
same access model as the six Prompt-13 console tables: RLS enabled, zero
grants to `anon`/`authenticated`, service-role only. `access_token_hook()`
(built by Prompt 5, DL-011) gains a second lookup branch: if no `staff` row
matches the signed-in `auth_user_id` (the only case it previously handled),
it now also checks `console_operators` and, on a match, injects
`platform_role: 'platform_operator'` and `console_operator_id` claims
instead of the tenant-scoped `tenant_id`/`branch_id`/`staff_role`/`staff_id`
claims a staff match would inject. Same function name and signature, so the
Supabase dashboard's existing Auth Hook registration is untouched.
`app_is_super_admin()` — hardcoded `false` since Prompt 1, with an explicit
comment forbidding a real check "without a dedicated addendum describing how
platform-operator sessions are authenticated and audited" — now checks that
claim for real: `coalesce(app_jwt_claims() ->> 'platform_role', '') =
'platform_operator'`.

This one function is already wired as an `or app_is_super_admin()`
cross-tenant bypass clause into essentially every RLS policy in the schema
(sales, inventory, financial, purchasing, governance, identity, tax,
delivery, generic records, tenant/branch/terminal) — it was built in Prompt 1
specifically for this day. Making it real is therefore the entire
mechanism, not one piece of it: a genuine console operator now has
cross-tenant read/write everywhere that clause already appears, which is the
correct shape for a platform operator, not an expansion of scope beyond what
DL-002 already called for.

**Sign-in**: unlike staff/executive/rider (till-side PIN identities bridged
to a session via `verify_staff_pin` + the executive/rider-signin Edge
Functions), console operators are real people with real email addresses —
Supabase Auth's native `signInWithPassword` is used directly from
`apps/console`, with no PIN bridge and no new Edge Function needed for
sign-in itself. A thin `is_console_operator()` SQL function (`security
invoker`, wraps `app_is_super_admin()`, granted to `authenticated`) is the
one thing the console client calls right after sign-in to decide "show the
dashboard" vs. "sign out, not authorized" — safe to expose since it only
ever echoes back the caller's own claim.

**Provisioning**: out-of-band — create the `auth.users` row (Supabase
dashboard or `admin.auth.admin.createUser`) plus one `console_operators`
insert (service-role). No self-serve signup UI is built, the same category
of manual deployment step as `access_token_hook`'s dashboard registration
(DL-013) and the Meta WhatsApp credentials (Open items, prior addendum) —
each already established that some setup steps are legitimately manual
rather than something a migration can automate.

**Rationale**: reusing `access_token_hook()`/`app_is_super_admin()` rather
than inventing a parallel claims/authorization mechanism keeps exactly one
place in the schema deciding "is this session privileged," the same
discipline DL-011 already applied to PIN verification. Real email/password
auth (rather than forcing console operators through the PIN-bridge pattern
built for till-side staff) matches who they actually are — internal
platform staff, not a till operator — and avoids stretching a pattern
designed for a different identity shape.

### DL-046: TerminalActivationToken signing scheme

**Decision**: a TerminalActivationToken (DL-039 layer 3) is a compact
two-part string — `base64url(payload) + "." + base64url(signature)` — where
`payload` is the JSON object `{tenantId, terminalId, planTier, issuedAt,
expiresAt}` and `signature` is an ECDSA P-256 signature over the payload
bytes. Signing happens once, in the new
`console-issue-terminal-activation-token` Edge Function, using the Web
Crypto API (`crypto.subtle.sign`) with a private key held only as a Supabase
Edge Function secret (never committed, generated by a one-off local script,
`scripts/generate-terminal-token-keypair.mjs`). Verification happens
entirely offline, terminal-side, in `server/lib/terminalActivationToken.ts`,
using Node's `crypto.verify` against the corresponding public key (not
secret, committed as a constant) with `{ dsaEncoding: 'ieee-p1363' }` —
required because Web Crypto's ECDSA output and Node's default ECDSA output
use different signature encodings (raw IEEE P1363 r‖s versus DER), a
cross-runtime detail that would silently break verification if left at
defaults.

This is deliberately a fixed-algorithm, two-part token, not a generic JWT
(no header, no `alg` field, no library). A verifier that has to trust a
token's own claim about which algorithm signed it is exactly the shape of
the JWT "alg" confusion vulnerability class; a verifier hardcoded to one
algorithm and one key has no such decision to get wrong. This is also the
first cryptographic signing implementation anywhere in this codebase — no
prior JWT/asymmetric-crypto convention existed to follow or deviate from.

**Terminal-side primitives built now**: `verifyTerminalActivationToken()`
(signature + expiry check) and `evaluateModuleLock()` — a pure function
implementing DL-040's 5-working-day grace period math (default Mon–Fri
calendar; a tenant-configurable calendar is a follow-up, not built here) —
plus one new local endpoint pair (`POST /licensing/activate-terminal`,
`GET /licensing/status`) that verifies a pasted token against this specific
install's own `tenant_id`/`terminal_id` (via the existing
`getInstallationConfig()` helper, DL-005's Business Profile onboarding
work) and stores/reports it.

**Explicitly not done here**: wiring DL-040's Sales/Purchasing module lock
into every existing route and view, and rewiring the still-simulated
`LicensingView`/`LicenceInfo` UI (DL-028) to this real backend. Both are
flagged as follow-ups rather than silently left, the same discipline this
document already applies to the still-open Tauri-packaging gap and the
`access_token_hook` dashboard-registration step.

**Rationale**: offline verification against a bundled public key (rather
than a live entitlement check) is what DL-039/DL-040 already required — an
asymmetric scheme is what makes that safe, since a terminal that could only
verify with a symmetric secret would have to hold a secret capable of
forging its own tokens. Building the primitives and one thin endpoint pair
now, without rewiring every consuming view, keeps this addendum's surface
area to "the issuance mechanism actually works end-to-end for one path,"
which is what makes it verifiable, rather than a broad partial rollout
across the whole POS app's route surface.

### DL-047: Billing calculation engine — mechanical, and deliberately neutral on both open items

**Decision**: `calculateInvoiceLineItems(components, subscriptions)` — a
pure function (mirroring `server/lib/fareEngine.ts`'s "caller passes the
exact already-selected rows, never reads 'current' implicitly" discipline,
DL-004) — takes each tenant's active `tenant_subscriptions` row, multiplies
its `quantity` by the referenced `plan_components.unit_price`, and labels
the resulting line with that component's own `billing_unit` string. It never
branches on `component_type` or on the value of `billing_unit` — it has no
opinion on whether a `'feature'` component should be billed tenant-wide flat
or scaled per-branch/per-terminal, and no opinion on proration, because
neither question is decided (DL-043's open items, unchanged by this
addendum). The function's only real job is "sum configured line items
correctly"; deciding *what quantity should be configured* for any given
component is left entirely to whoever populates `tenant_subscriptions` — a
console operator today, potentially something automated later once the open
items are actually resolved.

The same ~25-line function exists in two places — `apps/console/src/lib/
billingEngine.ts` (a live invoice preview before generation) and inside
`console-generate-billing-invoice`'s Edge Function body (the authoritative
write) — duplicated rather than shared, because DL-038 already committed
`apps/console` to zero shared runtime with anything outside itself, and a
Deno Edge Function and a Vite-bundled browser app have no build pipeline in
common to share a single file through even if that constraint didn't exist.
Each copy comments a cross-reference to the other so the duplication is
visible, not accidental.

Once created, a `billing_invoices` row's `total`/`line_items` are
effectively immutable: the new RLS grant lets a console operator only
`update(status, paid_at, payment_reference)` directly — the computed
financial fields have no update path at all outside a service-role client.
`plan_components` and `tenant_subscriptions` themselves get ordinary direct
RLS-gated CRUD for `authenticated` console operators (no Edge Function
needed) since editing a price list or a subscription's quantity carries
neither a signing-key requirement nor a trusted-attribution requirement —
unlike issuing a token or resolving an activation request, where `issued_by`
/`fulfilled_by` must reflect who the server, not the client, verified was
signed in.

**Rationale**: a calculation engine that stays mechanically neutral on both
open items is safer than one that guesses at either — DL-043 was explicit
that implementers "must not default to one interpretation," and the way to
honor that literally is to write code that has no interpretation baked in
at all, rather than picking the interpretation that seems most likely and
documenting it as provisional. Making computed financial fields
effectively immutable post-creation (via grants, not application logic
that could have a bug) extends the same "don't let history get corrupted"
discipline DL-004/DL-010/DL-014 already established for rates and dispatch
classification to billing documents specifically.

### Open items (unchanged, still explicitly not decided here)

- **Feature add-on billing scope** and **proration on mid-cycle additions**
  (DL-043): both still unresolved; DL-047's calculation engine is
  deliberately built to not need either answer yet, not a resolution of
  either.
- **PoolWise and CashPlan functional scope**: unchanged, still pending.
- **Payment aggregator choice** (DL-044): unchanged, still unresolved.
- **`LicenceInfo.activationCode` vs. `TerminalActivationToken`**: unchanged
  — this addendum builds real issuance/verification for
  `TerminalActivationToken` specifically and does not touch
  `LicenceInfo.activationCode` or `LicensingView`.
- **Module-lock enforcement wiring** (new, from DL-046): the primitives and
  one endpoint pair exist; wiring the lock into every Sales/Purchasing
  route and view, and a tenant-configurable working-day calendar, are not
  built and are the natural next step for whichever prompt picks this back
  up.
