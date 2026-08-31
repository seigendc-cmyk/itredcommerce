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
