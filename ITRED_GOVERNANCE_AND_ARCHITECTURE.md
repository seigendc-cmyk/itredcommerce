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

### Open items (explicitly not decided here)

- **Platform super-admin view scope**: referenced in DL-002 but deliberately
  undefined until the tenant-scoped surfaces are built and there's real
  tenant-scoped data to design a cross-tenant view against.
- **Distance threshold for "local" vs. "intercity" delivery routes**: pending
  confirmation before implementation (delivery subsystem prompts).
- **Confirmation code format, WhatsApp template wording, load-size tiers,
  ride-type categories, executive-PWA scoring methodologies, and code-recovery
  state machine**: each requires a proposal-and-sign-off step before
  implementation, per the individual implementation prompts that cover them.
  Do not implement any of these unilaterally.
