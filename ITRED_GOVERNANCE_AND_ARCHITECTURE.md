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
