# iTred Commerce — Console, Licensing & Billing Prompt Sequence (12–14)

## How to use this document

This is a companion to `iTred_Claude_Code_Prompt_Sequence.md`, continuing the
sequence from Prompt 11. Paste these into Claude Code **one at a time, in
order**, same discipline as the original sequence: governance → schema/RLS →
logic/tests → UI, never reversed.

Prompts 12, 12b, and 12c are documentation-only and have already been
committed to `ITRED_GOVERNANCE_AND_ARCHITECTURE.md` as of 2026-09-05, covering
Decision Log entries DL-038 through DL-044. Prompts 13 and 14 have since also
been run and committed — see their Result sections below, and the "Sequence
drift" note before Prompt 15, which flags where the actual repo has moved
ahead of (and slightly off) this document's original ordering.

---

## Prompt 12 — Console, Licensing & Billing Addendum ✅ Committed

```
Before writing any implementation code, update ITRED_GOVERNANCE_AND_ARCHITECTURE.md
with a new addendum section reflecting the following architectural decisions. Do not
implement anything yet — this prompt is documentation-only.

1. CONSOLE AS SEPARATE DEPLOYABLE
   - The platform console (vendor-side, staff-facing) is built inside this monorepo
     as apps/console/ — its own package.json, own build, own top-level folder, with
     zero shared runtime code with the Tauri POS/Head-Office apps.
   - Console is always-online, has no offline durability requirement, and is not a
     Tauri install.
   - The "handshake" between console and POS apps is the shared Supabase Postgres
     schema and Edge Functions — never shared frontend code or direct reach into
     POS-app internals.
   - Console-specific tables live in the same Supabase project, RLS-scoped so only
     the console's service-role/platform-admin role can write to them; tenants may
     only read narrow views (e.g., their own current plan/activation status).
   - This is being built in-repo first for iteration speed, with explicit intent to
     extract apps/console/ into its own repository later. Design for that eventual
     extraction (no shortcuts that couple it to POS-app internals).

2. THREE-LAYER LICENSING MODEL
   - Tenant Identity: created once at signup, tied to a primary email.
   - License Key: bound to tenant_id + email, identifies the tenant ecosystem
     across all branches/terminals, encodes plan tier/entitlements. Long-lived,
     rarely changes.
   - Activation Code: short-lived, cryptographically signed (JWT or equivalent),
     issued PER TERMINAL (not per tenant), containing tenant_id + terminal_id +
     plan_tier + issued_at + expires_at + signature. Terminal apps verify the
     signature offline using a bundled public key — no network call required to
     validate an already-issued code.
   - The tenant's License Key remains tenant-wide; only Activation Codes are
     terminal-scoped, allowing per-terminal revocation without invalidating the
     whole tenant.

3. MODULE-LOCK ENFORCEMENT
   - On Activation Code expiry, a 5-working-day grace period begins (working-day
     calendar stored as a tenant setting, default Mon–Fri).
   - After grace period elapses without a renewed code, the Sales and Purchasing
     module menus lock on that terminal. Reporting, EOD reconciliation, and
     inventory viewing remain available regardless of lock state.
   - Lock/grace-period state is evaluated locally via signature + expiry check —
     must function correctly even if the terminal never reconnects after expiry.

4. WHATSAPP ACTIVATION-REQUEST FLOW (NO META CLOUD API)
   - When online, the Head Office app exposes a "Request Activation Code" action
     that opens a wa.me deep link pre-filled with tenant_id/license key context,
     sending a message via the user's own WhatsApp client to a vendor support
     number. No Cloud API, no template approval required for this flow.
   - Every request arriving this way is logged in the console as an
     activation_request record (tenant_id, requested_at, terminal_id if known,
     fulfillment status).
   - Console staff manually verify payment and issue a new signed Activation Code
     against the specific tenant/terminal from the console UI (built in Prompt 17).

5. TWO-LEDGER RECONCILIATION
   - Platform console maintains the authoritative log of "Activation Code X issued
     to tenant Y for terminal Z, at time T, by console operator O."
   - Tenant SysAdmin (Head Office app) maintains its own local/synced log of
     "Activation Code X received and activated on terminal Z, at time T."
   - These two logs reconcile by tenant_id + terminal_id + code, giving an audit
     trail on both sides independent of a single point of failure.

6. COMPOSABLE BILLING MODEL
   - Billing lives entirely under the tenant SysAdmin's Billing page (Head Office
     app) — never surfaced per-individual-terminal in the UI, even though
     Activation Codes themselves are logged per terminal.
   - Invoice line items, modeled via plan_components (component_type, unit_price,
     billing_unit) and tenant_subscriptions (active components + quantities per
     tenant):
     - Base fee: covers one default warehouse/branch.
     - Per-branch fee: each additional branch beyond the default.
     - Per-terminal fee: each terminal, regardless of branch.
     - Feature add-ons: BI Brain, Delivery, PoolWise, CashPlan, and future
       modules — each independently toggled and priced.
   - ⚠ OPEN DECISION — feature add-on billing scope (tenant-wide flat fee vs.
     per-branch/per-terminal pricing) is NOT decided. Document plan_components
     with a billing_unit field flexible enough to support either, and flag this
     as unresolved in the Decision Log rather than defaulting to one.
   - ⚠ OPEN DECISION — proration on mid-cycle branch/terminal additions
     (immediate prorated charge vs. rolled into next cycle's invoice) is NOT
     decided. Flag as unresolved; do not implement proration logic until this
     prompt sequence revisits it.
   - ⚠ OPEN DECISION — PoolWise and CashPlan are referenced as billable feature
     add-ons but their functional scope has not been defined anywhere in the
     governance doc. Add a placeholder entry for each in the addendum noting
     "scope pending — do not build feature logic until defined," so they are not
     silently dropped from later planning.

7. PAYMENT INTEGRATION
   - EcoCash acceptance is via a payment gateway aggregator (e.g. Paynow or
     equivalent Zimbabwe-market aggregator supporting EcoCash/OneMoney/cards)
     rather than a direct-to-EcoCash merchant integration. Confirm specific
     aggregator choice is still open — document as unresolved, not defaulted.
   - Billing and payment actions always require connectivity — this is an
     explicit, intentional exception to offline-first, since payment processing
     cannot function offline.

Write this as a new dated section at the end of the governance doc, under a
"CONSOLE, LICENSING & BILLING SUBSYSTEM ADDENDUM" heading. Include a short
rationale for each decision, consistent with the existing Decision Log format.
Clearly mark all three ⚠ OPEN DECISION items as unresolved in the Decision Log
itself (not just in this prompt), so future prompts don't silently assume an
answer. Do not modify any existing sections of the document.
```

**Result:** Committed as DL-038 through DL-044, 266 lines, pure addition, no
existing content touched.

---

## Prompt 12b — Naming Collision Resolution ✅ Committed

```
Update ITRED_GOVERNANCE_AND_ARCHITECTURE.md — documentation only, no implementation.

Under DL-039, add a short resolution note: the new per-terminal, signed,
expiry-bearing licensing token introduced in this addendum is named
TerminalActivationToken (not "Activation Code") specifically to avoid colliding
with the existing, still-simulated LicenceInfo.activationCode field from DL-028.

Record that this is a deliberate naming separation, not a merge or a deprecation
of DL-028 — LicenceInfo.activationCode remains untouched and unexamined for now.
Add a follow-up item to the addendum's "Open items" section: "DL-028's
LicenceInfo.activationCode needs inspection to determine whether it should later
be retired, merged into, or kept distinct from TerminalActivationToken — do not
touch that field until this is explicitly revisited."

Do not rename or modify LicenceInfo anywhere in the codebase in this prompt —
documentation only.
```

**Result:** Committed. Resolution note added under DL-039; Open items section
updated with the DL-028 inspection follow-up; console-UI bullet updated to
reference `TerminalActivationToken`.

---

## Prompt 12c — Terminology Sweep (DL-040–044) ✅ Committed

```
Update ITRED_GOVERNANCE_AND_ARCHITECTURE.md — documentation only, no implementation.

In DL-040 through DL-044 of the CONSOLE, LICENSING & BILLING SUBSYSTEM ADDENDUM,
replace all prose references to "Activation Code" (referring to the signed,
per-terminal, expiry-bearing token defined in DL-039) with "TerminalActivationToken",
for consistency with DL-039's naming resolution.

Do NOT rename or alter:
- "activation-request" / "activation_request" (DL-041, DL-042) — this refers to
  the WhatsApp request for a new token, a distinct concept from the token itself.
- Any reference to DL-028's LicenceInfo.activationCode — that remains untouched
  and unexamined per the existing Open items note.

Show me a summary of exactly which lines changed before considering this done.
```

**Result:** Committed. 7 replacements across DL-040, DL-041 (×2), DL-042 (×2),
DL-043 (×2). `activation-request`/`activation_request` and `LicenceInfo`
references confirmed untouched.

---

## Prompt 13 — Console App Scaffold & Schema ✅ Committed (`61f901d`)

```
Scaffold the platform console as a separate deployable within this monorepo, per
the governance doc's CONSOLE, LICENSING & BILLING SUBSYSTEM ADDENDUM (DL-038).
Scope for this prompt is app scaffold + schema/RLS only — no business logic, no
licensing/issuance logic (that's Prompt 14), no UI wiring beyond a bare shell.

1. APP SCAFFOLD
   - Create apps/console/ as its own package: own package.json, own build
     config, own entry point. Zero shared runtime code with the Tauri POS/
     Head-Office apps.
   - Console is a standard always-online web app — no offline durability
     engineering, no service worker/PWA requirement (unlike the Executive and
     Rider PWAs).
   - Reuse src/types/index.ts for shared domain types where applicable, but the
     console's data-access layer is entirely its own — it talks to Supabase
     directly via the same client/Edge Function contract the tenant apps use,
     never by importing from or reaching into the Tauri apps' source.
   - Bare shell only for this prompt: routing skeleton and placeholder pages
     for the screens named in DL-041/DL-042/DL-043 (activation requests queue,
     tenant billing overview, plan component management) with no real data
     wired yet.

2. SUPABASE SCHEMA (Postgres) — console-owned tables
   - license_keys: tenant_id, email, plan_tier, created_at, status.
   - terminal_activation_tokens: tenant_id, terminal_id, plan_tier, issued_at,
     expires_at, signature, status (active/expired/revoked), issued_by
     (console operator reference).
   - activation_requests: tenant_id, terminal_id (nullable if not yet known),
     requested_at, channel (default 'whatsapp'), fulfillment_status,
     fulfilled_by, fulfilled_at.
   - billing_invoices: tenant_id, billing_period, line items (reference
     plan_components), total, currency, status (pending/paid/overdue), paid_at,
     payment_reference.
   - plan_components: component_type (base/branch/terminal/feature), feature_key
     (nullable, e.g. 'bi_brain', 'delivery', 'poolwise', 'cashplan'), unit_price,
     currency, billing_unit — leave billing_unit flexible enough to support
     either tenant-wide or per-branch/per-terminal pricing, since that's still
     an open decision per DL-043; do not assume one.
   - tenant_subscriptions: tenant_id, plan_component_id, quantity, active_since,
     active_until (nullable).

3. RLS POLICIES
   - All six tables above: only a console service-role/platform-admin role may
     read or write. Tenants have NO direct read/write access to these tables
     from their Tauri apps or Executive PWA.
   - Where a tenant needs visibility (e.g., "my current plan status," "my
     terminal's token expiry"), create narrow, explicitly-scoped VIEWs that
     expose only the minimal fields needed, readable by that tenant's own
     authenticated role — never raw table access.
   - Leave a clear TODO comment on tenant_subscriptions and billing_invoices
     specifically noting these views are not yet built — that's part of a
     later prompt once the tenant-facing billing page (Head Office app) is
     scoped.

4. NAMING
   - Use TerminalActivationToken / terminal_activation_tokens consistently —
     do not use "activation code" anywhere in schema, code, or comments, per
     DL-039's naming resolution. Do not touch or reference LicenceInfo.
     activationCode anywhere in this prompt.

Show me the full schema, RLS policies, and the view definitions before wiring
any console app logic to them. Do not implement issuance logic, signature
generation, or billing calculation yet — that's Prompt 14 onward.
```

**Result:** Committed in full, matching the spec closely on every point:

- `apps/console/` scaffolded with its own `package.json`, `vite.config.ts`,
  `tsconfig.json`, own `node_modules` — no npm workspace linkage, no PWA/
  service-worker config. The `@shared` alias reaches `src/types` type-only,
  documented as never for runtime values.
- All six tables created with exactly the fields specified, plus well-reasoned
  extras (indexes, `updated_at`, a jsonb `line_items` array, `billing_unit`
  left as unconstrained free text specifically to avoid pre-deciding DL-043).
- RLS: all six tables enabled, zero grants to `anon`/`authenticated` (service-
  role only), with the rationale documented inline (`app_is_super_admin()`
  was still hardcoded `false` at this point — see Prompt 14/DL-045 below).
  The two tenant-facing views (`v_tenant_license_status`,
  `v_tenant_terminal_activation_tokens`) match the two examples the prompt
  named, excluding PII and the token signature. TODO comments placed exactly
  on `tenant_subscriptions` and `billing_invoices`, as instructed.
- Naming: no "activation code" anywhere in the console app, migration, or
  related files; `LicenceInfo.activationCode` untouched.

**One gap found and fixed afterward:** the root `tsconfig.json` excludes
`executive-pwa`, `rider-pwa`, and `src-tauri` as isolated sibling apps, but
had not added `apps/console` to that list — so the root `lint` script
(`tsc --noEmit`) was sweeping `apps/console/vite.config.ts` into the root
TypeScript project and throwing spurious errors from a Vite version mismatch.
Fixed by adding `apps/console` to the root exclude list.

---

## Prompt 14 — TerminalActivationToken Issuance & Offline Verification ✅ Committed (`bfea8ff`, `c4b6e90`)

```
Implement the issuance and verification logic for TerminalActivationToken, per
DL-039 of the governance doc. Scope is this logic ONLY — no console UI wiring
(that's Prompt 17), no billing calculation (Prompt 15), no WhatsApp flow
(Prompt 16).

1. SIGNING KEY SETUP
   - Propose a signing scheme (e.g. Ed25519 or RSA) for my review before
     implementing — do not pick unilaterally, since this is a long-lived
     cryptographic decision that's expensive to change later.
   - Private key lives server-side only, used exclusively inside a Supabase
     Edge Function. Public key is bundled into the Tauri app builds (both
     Branch Terminal and Head Office) for local verification.
   - Document key rotation strategy: propose an approach for my review (e.g.
     versioned keys with a key_id embedded in the token, so old tokens remain
     verifiable after rotation). Do not implement rotation now — just make sure
     the token format supports it from day one so we're not backed into a
     corner.

2. ISSUANCE (Supabase Edge Function)
   - Given tenant_id, terminal_id, plan_tier: generate a TerminalActivationToken
     containing tenant_id, terminal_id, plan_tier, issued_at, expires_at,
     key_id, signature.
   - Write the issued token to terminal_activation_tokens (from Prompt 13),
     status = active.
   - This function is only callable by the console's service-role/platform-admin
     context (per Prompt 13's RLS) — never directly by a tenant app.
   - Default validity period: 30 days, clearly marked in code as a PLACEHOLDER
     pending the billing engine (Prompt 15), which will determine whether
     validity should instead be tied precisely to each tenant's actual billing
     cycle length. Do not treat 30 days as final — leave a TODO comment at the
     point of use referencing this.

3. OFFLINE VERIFICATION (Tauri apps — Branch Terminal + Head Office)
   - Implement a verification module (separate, testable unit — not inlined
     into UI code) that:
     - Verifies the token's signature against the bundled public key.
     - Checks expires_at against local system time.
     - Confirms tenant_id and terminal_id in the token match this installation's
       bound identity (from Prompt 1's activation/setup flow).
     - Returns a clear status: valid / expired-in-grace / expired-locked /
       invalid-signature / identity-mismatch.
   - This must work with ZERO network calls — pure local computation.
   - Wire this status into the 5-working-day grace period logic from DL-040:
     on expiry, compute working days elapsed using the tenant's configured
     working-day calendar (from the governance doc), and only transition to
     expired-locked once that window closes.

4. MODULE LOCK ENFORCEMENT
   - When verification status is expired-locked: disable Sales and Purchasing
     menu entries in the UI. Reporting, EOD reconciliation, and inventory
     viewing remain fully available regardless of status.
   - This check should run at app launch and periodically (propose a sensible
     interval, e.g. on each menu navigation or every N minutes) — not just once
     at startup, since a terminal could stay open across the expiry boundary.

5. TOKEN SYNC-DOWN
   - When a terminal has connectivity, it should check for and pull down any
     newly-issued token for its terminal_id from Supabase (via the narrow view
     from Prompt 13, not raw table access) and replace its locally-cached token
     if the new one is valid and newer.
   - This sync should piggyback on the existing outbox/connectivity-signal
     infrastructure from Prompt 2 rather than introducing a separate polling
     mechanism.

Write tests for: signature verification against a tampered token, expiry +
grace-period boundary behavior (just inside vs. just outside the 5-working-day
window), identity-mismatch detection (token for a different terminal_id), and
the sync-down replacing a stale local token.

Stop and show me the signing scheme proposal and key rotation approach before
writing the Edge Function.
```

**Result:** The stop-and-wait gate held as intended — before any Edge Function
code was written, Claude Code flagged that a signing scheme had, in fact,
already been implemented one prompt earlier than this document expected (see
"Sequence drift" below), and presented three concrete decisions for review
rather than proceeding:

1. **Signing scheme** — keep ECDSA P-256 (already implemented and working
   end-to-end) rather than switching to Ed25519 or RSA. Rationale: tokens are
   relayed by hand over WhatsApp (DL-041), so signature/token compactness
   matters concretely — RSA in particular would roughly quadruple the pasted
   token's length for no functional gain. **Confirmed.**
2. **Key rotation** — embed a `keyId` field in the signed payload; the
   verification module holds a `{keyId: publicKey}` registry instead of a
   single constant. Rotating later means adding a new key without invalidating
   tokens already issued under the old one. **Confirmed.**
3. **Default validity** — 30 days, tied to the monthly billing cycle shape
   already used by `tenant_subscriptions`/`billing_invoices`. **Confirmed**,
   and per a follow-up instruction, explicitly marked as a **placeholder** in
   both the code comment (`DEFAULT_VALIDITY_DAYS` in
   `console-issue-terminal-activation-token`) and the governance doc — not a
   final answer, pending Prompt 15's billing engine deciding whether validity
   should instead be computed from each tenant's actual cycle length.

Once confirmed, the full scope was implemented and committed as DL-048/049/050:

- **Verification module** (`server/lib/terminalActivationToken.ts`) — a single
  `verifyTerminalActivationToken()` returning the exact five-way status
  (`valid` / `expired-in-grace` / `expired-locked` / `invalid-signature` /
  `identity-mismatch`), checking signature → identity → expiry/grace in that
  order, zero network calls, with an injectable public-key registry so tests
  never need the real private key.
- **Module-lock UI enforcement** — wired into the actual Tauri app, not left
  as an unused primitive: `handleNavigate`/`renderActiveView` in `src/App.tsx`
  gate on the lock (mirroring the existing role-gate defense-in-depth
  pattern), `HeaderNav` hides locked menu entries, and a new `useModuleLock()`
  hook polls every 15 minutes plus re-checks on navigation into a
  Sales/Purchasing view. `SALES_HISTORY` was deliberately excluded from the
  lock since it doubles as a Reports entry. Terminals that have *never* been
  activated are deliberately **not** locked by this — DL-040 frames the lock
  as engaging on an issued token's *expiry*, not as a gate on ever having had
  one, and the WhatsApp/console issuance loop that would let a fresh install
  obtain its first token isn't built yet (Prompt 16/17) — locking every
  existing/dev/demo install by default would have been a large, unrequested
  regression.
- **Token sync-down** — triggers off the existing `connectivityMonitor`'s
  ONLINE signal (the same hook `drainLoop.ts` already subscribes to), not a
  new poll. **One deliberate deviation from the letter of this prompt**: it
  reads the raw `terminal_activation_tokens` table via the service-role admin
  client rather than the Prompt 13 tenant view — that view intentionally
  excludes the token `signature` to protect *browser-facing* authenticated
  sessions, a protection that doesn't apply to this trusted, server-side-only
  puller (identical trust model to the existing `staffPull.ts`/
  `tenantPull.ts`). Following the view instruction literally would have made
  sync-down unable to fetch the one field it exists to fetch.
- **Tests** — 19 passing (`server/lib/terminalActivationToken.test.ts`,
  `server/sync/terminalActivationTokenPull.test.ts`), covering all four
  requested categories: signature tampering (mutated payload, mutated
  signature, unregistered `keyId`), expiry/grace boundaries (just inside,
  exactly at, and well past the 5-working-day lock boundary, plus a
  weekend-exclusion check), identity mismatch (different `tenantId` and
  different `terminalId`), and sync-down replacement (stale-vs-newer,
  invalid-signature, identity-mismatch — all correctly refuse to replace).
  No test framework existed in this codebase before; added `node:test` via
  `tsx --test` (`npm test`) rather than pulling in a new dependency.

---

## Sequence drift — read before drafting anything past Prompt 14

Between Prompt 13 and Prompt 14 landing, one additional, undrafted prompt was
run in this session (commit `bc264b6`, "Build console-operator auth, terminal
token issuance, and billing engine") that this document doesn't account for.
It built, ahead of where this sequence placed them:

- **Real console-operator authentication** (DL-045) — `console_operators`
  table, `access_token_hook()` extended, `app_is_super_admin()` now a real
  check instead of hardcoded `false`, Supabase-Auth-backed sign-in wired into
  `apps/console`'s actual UI (`ConsoleAuthProvider`, `SignInPage`). This is a
  prerequisite this document never scoped as its own prompt, but Prompt 14's
  issuance Edge Function depends on it (it needs a real operator identity to
  attribute `issued_by` to).
- **A first cut of the billing calculation engine** (DL-047) —
  `calculateInvoiceLineItems()`, `billing_invoices` RLS, and a working
  `BillingOverviewPage` in `apps/console`. Full DL-047 record below (it was
  never actually captured in this companion doc at the time it landed —
  backfilled here rather than left as a permanent gap).

### DL-047, backfilled

`calculateInvoiceLineItems(components, subscriptions)` — a pure function
(mirroring `server/lib/fareEngine.ts`'s "caller passes the exact
already-selected rows" discipline) that takes each tenant's active
`tenant_subscriptions` row, multiplies `quantity` by the referenced
`plan_components.unit_price`, and labels the line with that component's own
`billing_unit`. It never branched on `component_type` or `billing_unit`'s
value — no opinion on flat-vs-scaled feature billing or proration, because
neither was decided yet (both were DL-043 open items at the time). The same
~25-line function exists in two places — `apps/console/src/lib/
billingEngine.ts` (live preview) and inside `console-generate-billing-invoice`
(the authoritative write) — duplicated rather than shared, per DL-038's
zero-shared-runtime rule between `apps/console` and everything else. Once
created, a `billing_invoices` row's `total`/`line_items` were made effectively
immutable: the RLS grant lets a console operator only
`update(status, paid_at, payment_reference)` directly. `plan_components` and
`tenant_subscriptions` got ordinary direct RLS-gated CRUD for `authenticated`
console operators (no Edge Function needed), since editing a price list or a
subscription's quantity carries neither a signing-key nor a
trusted-attribution requirement. Rationale: a calculator that stays
mechanically neutral on undecided questions is safer than one that guesses —
DL-043 required implementers to "not default to one interpretation," and
writing code with no interpretation baked in is how that's honored literally.

**Implication that held until the detour below**: `plan_components`/
`tenant_subscriptions` CRUD, `billing_invoices` RLS, and a mechanically-neutral
line-item calculator already existed, wired into `apps/console`'s UI, before
any prompt calling itself "Prompt 15" ever ran.

---

## Detour — feature add-on billing scope resolved via DL-051, not by Prompt 15

Before a "Prompt 15" could run as originally drafted, a premise check on the
existing `calculateInvoiceLineItems` revealed it did **not** already implement
tenant-wide flat fee for feature add-ons as had been assumed — it never
branched on `component_type` at all, and was mechanically neutral by design
(exactly as DL-047 above documents). Rather than record that as a settled
fact it wasn't, the decision was made explicitly and implemented:

- **Migration** `20260905140000_feature_addon_flat_fee.sql` — a
  `BEFORE INSERT OR UPDATE` trigger on `tenant_subscriptions` rejecting any
  feature-type row with `quantity ≠ 1`. Enforced at the database level, not
  client-side, since `tenant_subscriptions` has direct RLS-gated CRUD for any
  console operator — a UI-only or calculator-only check could be bypassed via
  a direct Supabase REST write.
- `calculateInvoiceLineItems` itself was **not modified** — still never
  branches on `component_type`. Its header comment in both copies now states
  the scope question is resolved, and that it's resolved by the trigger, not
  by the calculator gaining an opinion.
- `BillingOverviewPage.tsx` — quantity inputs lock to `1` and disable
  themselves when a feature component is selected.
- Governance doc: DL-043's feature-billing-scope paragraph and its Open Items
  bullet now say resolved; **DL-051** added recording the decision,
  enforcement mechanism, and rationale.
- **✅ Committed** — `5fa3d6e`.

---

## Step 0 audit — proration and a deeper billing-period gap

Before implementing proration, both copies of `calculateInvoiceLineItems` and
everything feeding them were audited. Findings:

- **Proration was completely unhandled** — not partial, not stubbed. The
  calculation was `quantity × unit_price` per active subscription, full stop.
  No time dimension anywhere in either input.
- `tenant_subscriptions.active_since` existed in schema but was **never
  read** anywhere in the codebase (confirmed via repo-wide grep) — not even
  included in the row shape `calculateInvoiceLineItems` received.
- `tenant_subscriptions.active_until` was read, but only as a binary
  include/exclude filter for "is this subscription active right now" — never
  used to compute a partial-period amount.
- Concrete implication: a branch or feature added mid-cycle was billed at
  full `unit_price` with no reduction (confirmed via repo-wide grep for
  "prorat" — no hits outside governance-doc prose).
- **Deeper gap surfaced**: `billing_invoices.billing_period` was free text
  (e.g. `'YYYY-MM'`), typed by hand by whoever called the generate-invoice
  function. No stored per-tenant billing-cycle-length setting existed
  anywhere — `tenants.fiscal_year_start_month` only anchors fiscal-year
  reporting, not billing recurrence length. Confirmed separately: billing
  cycle is genuinely tenant-configurable (monthly/quarterly/yearly), not
  uniform — making this a real prerequisite, not a side issue.

---

## Prompt 15 (revised) — Billing Cycle Schema + Proration ✅ Both steps implemented, not yet committed

```
Before implementing proration, address a prerequisite gap surfaced during the
Step 0 audit: billing_invoices.billing_period is currently free-text, typed by
hand, with no stored per-tenant billing-cycle-length setting. Proration cannot
be computed correctly without a real cycle length to measure a partial period
against.

1. BILLING CYCLE SCHEMA
   - Add a billing_cycle field to tenants: enum of 'monthly', 'quarterly',
     'yearly'. This is distinct from the existing fiscal_year_start_month,
     which anchors fiscal year start, not billing recurrence.
   - Propose whether billing_period on billing_invoices should become a
     derived/computed value (e.g. actual start/end dates stored per invoice,
     computed from active_since + billing_cycle at generation time) rather
     than free text, for my review before implementing — this is a schema
     change beyond Prompt 15's original scope, so show me the migration
     before applying it.
   - Confirm: does changing a tenant's billing_cycle mid-relationship need any
     special handling (e.g. an existing monthly tenant switching to annual),
     or is that out of scope for now? Flag if you think it needs a decision
     from me rather than assuming.

2. MID-CYCLE PRORATION
   - With a real cycle length available, propose a proration approach
     (immediate prorated charge vs. rolled into next invoice) for my review
     before implementing — do not decide unilaterally, per DL-043.
   - Proration math should use the tenant's actual billing_cycle length (30/90/
     365-ish days depending on monthly/quarterly/yearly) against
     tenant_subscriptions.active_since, not a hardcoded assumption of monthly.

Stop after step 1's schema proposal and again after step 2's proration
proposal — do not proceed past either without my confirmation.
```

**Step 1 result (DL-052)** — proposed and confirmed before writing the
migration:

- `tenants.billing_cycle` (text + check, `'monthly'|'quarterly'|'yearly'`,
  default `'monthly'`) — confirmed.
- Anchor for a tenant's first period: **`tenants.onboarding_completed_at`**,
  reused rather than adding a new column — confirmed over a dedicated
  `billing_anchor_at` field.
- Period math: **calendar-based** (`+1`/`+3`/`+12` months via
  `compute_billing_period_end()`) — confirmed over fixed 30/90/365-day
  cycles, so "your March invoice" stays the actual calendar March
  indefinitely rather than drifting.
- `billing_period` **kept**, not dropped — becomes a computed display label
  (e.g. `'2026-09'`), no longer accepted as caller input — confirmed over
  dropping it entirely. `billing_invoices` gains `period_start`/`period_end`
  (`timestamptz`, nullable) as the actual source of truth.
- Mid-relationship `billing_cycle` changes: **out of scope, confirmed rather
  than assumed** — applies prospectively only; no retroactive transition
  rule built.
- Migration: `supabase/migrations/20260905150000_billing_cycle_and_periods.sql`.
- Governance doc: **DL-052** added.

**Step 2 result (DL-053)** — proposed and confirmed before implementing:

- Proration **rolled into the next invoice** — confirmed over an immediate
  out-of-band charge (which would need a new triggering mechanism and
  double-billing-avoidance bookkeeping the rolled-in approach doesn't).
  Formula: `fraction = (effectiveEnd - effectiveStart) / (period_end -
  period_start)`, clipped to `[active_since, active_until ?? period_end] ∩
  [period_start, period_end)`. Applies uniformly to every `component_type`
  including `'feature'` rows — DL-051 is about scale, not an exemption from
  proration.
- A related gap surfaced and fixed alongside it, **confirmed rather than
  assumed**: `tenant_subscriptions`' hard `DELETE` would silently under-bill
  a mid-period removal (the row, and its `active_since`, would be gone
  before that period's invoice ever generates). `deleteTenantSubscription`
  was renamed to `endTenantSubscription` and now soft-deletes via
  `active_until = now()`; the `DELETE` grant/policy on the table was revoked
  at the database level so this is an enforced invariant, not a client
  convention.
- `console-generate-billing-invoice` no longer accepts `billingPeriod` as
  input at all — it chains periods itself (previous invoice's `period_end`,
  or the onboarding anchor for a first invoice) and queries subscriptions
  overlapping `[period_start, period_end)` rather than "active right now"
  (which was only ever correct by coincidence for whatever period happened
  to be current).
- Explicitly **not built**: a guard against generating an invoice for a
  period that hasn't elapsed yet in real time — flagged as a natural
  companion to the not-yet-built scheduled generator, not decided here.
- Migration: `supabase/migrations/20260905160000_tenant_subscription_soft_delete.sql`.
- Tests: `apps/console/src/lib/billingEngine.test.ts` (13 new tests — full
  period, mid-start, mid-end, both, excluded-entirely both directions,
  feature-type parity, multi-line summation, period-math including the
  Jan-31 calendar-overflow quirk, period chaining). `npm test` now covers
  `apps/console/src/lib/**/*.test.ts` alongside the existing server tests —
  **32/32 passing**, both `apps/console` and root typechecks clean.
- Governance doc: **DL-053** added.

**Not yet committed** — this is implemented and verified but sitting in the
working tree as of this writing; commit when ready.

Sections 3–5 of the original Prompt 15 draft are still ahead, unaffected by
this detour:

- **TerminalActivationToken renewal linkage** — trigger issuance of a
  renewed token on successful invoice payment, replacing the 30-day
  placeholder with a period tied to the tenant's actual `billing_cycle`.
- **`PaymentProvider` abstraction** — EcoCash/aggregator integration
  (Paynow or otherwise) behind an interface, so the still-unresolved
  aggregator choice (DL-044) doesn't touch invoice-generation logic.
- **Renewal/retry scheduling** — failed/declined payment handling, an
  overdue-status escalation path, and the handoff into the existing
  grace-period/module-lock logic from Prompt 14 (an unrenewed token simply
  expires and the existing lock takes over — no separate lock mechanism).
- Tests still owed per the original ask: invoice generation against a known
  `tenant_subscriptions` set (partially covered now by the proration tests
  above, but not yet an end-to-end generation test), and the
  failed-payment → no-renewal → grace-period handoff.

---

## Still open (carried forward from the governance doc)

- ~~Feature add-on billing scope~~ — **Resolved via DL-051.** No longer open.
- ~~Proration approach~~ — **Resolved via DL-053** (rolled into next
  invoice). No longer open.
- ~~Billing cycle length not represented in schema~~ — **Resolved via
  DL-052.** No longer open.
- ~~Whether `billing_period` should be derived~~ — **Resolved via DL-052**
  (kept as a derived label, `period_start`/`period_end` added as source of
  truth). No longer open.
- Mid-relationship `billing_cycle` change transition rule — explicitly out
  of scope per DL-052, not decided.
- Guard against generating a not-yet-elapsed period's invoice — flagged in
  DL-053 as a companion to the scheduled generator, not built.
- PoolWise / CashPlan functional scope — undefined, placeholder only.
- Specific EcoCash payment aggregator selection — DL-044.
- DL-028's `LicenceInfo.activationCode` — needs inspection to decide
  retire/merge/keep-distinct relative to `TerminalActivationToken`. Still
  untouched.
- TerminalActivationToken default validity period (30 days) — still an
  explicit placeholder pending TerminalActivationToken renewal linkage
  (Prompt 15 section 3) computing it from the tenant's actual `billing_cycle`
  instead.
- Tenant-configurable working-day calendar (DL-040) — still hardcoded to
  Mon–Fri; a per-tenant calendar remains unbuilt.
- WhatsApp activation-request flow (DL-041) and `apps/console`'s issuance UI
  wiring to the real backend for that flow — unchanged, still pending Prompt
  16/17.

## Next in sequence

- ~~**Prompt 13** — Console scaffold + schema/RLS.~~ ✅ Committed (`61f901d`).
- ~~**Prompt 14** — Token issuance + offline verification.~~ ✅ Committed
  (`bfea8ff`, `c4b6e90`).
- *(unnumbered)* Console-operator auth + first billing engine cut — ✅
  Committed (`bc264b6`), ahead of plan.
- *(unnumbered, via DL-051)* Feature add-on billing scope resolved + enforced
  via DB trigger — ✅ Committed (`5fa3d6e`).
- **Prompt 15 (revised), steps 1–2** — Billing cycle schema (DL-052) +
  mid-cycle proration (DL-053). ✅ Implemented and tested, **not yet
  committed**.
- **Prompt 15, sections 3–5** — TerminalActivationToken renewal linkage,
  `PaymentProvider` abstraction, renewal/retry scheduling. Not yet drafted.
- **Prompt 16** — WhatsApp deep-link request flow + console-side fulfillment
  screen + two-ledger reconciliation logging — not yet drafted.
- **Prompt 17** — Console UI wiring for the remaining pieces (activation
  requests issuance UI already exists from the `bc264b6` work; confirm what's
  left before drafting) — only after 15–16 are logic-tested.
