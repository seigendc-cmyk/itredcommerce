-- Adds the DL-005 auth-scope role to the local staff table, mirroring the
-- Postgres app_staff_role column that already exists on Supabase's staff
-- table (supabase/migrations/20260829120200_identity_and_parties.sql) and
-- its enum (supabase/migrations/20260829120000_extensions_and_rls_helpers.sql).
-- SQLite has no enum type, so this is a plain TEXT column using the same
-- UPPER_SNAKE_CASE values as the StaffAccessRole TypeScript union (matching
-- this codebase's existing convention of storing enum-like fields verbatim,
-- e.g. shifts.status = 'OPEN'/'CLOSED'), not Postgres's lowercase enum
-- literals. Reconciling that casing difference is deferred to whichever
-- prompt builds the real Supabase push adapter (server/sync/drainLoop.ts's
-- RemoteSyncClient is still an injected, unimplemented interface).
--
-- See ITRED_GOVERNANCE_AND_ARCHITECTURE.md, DL-002/DL-005, and the Prompt 4
-- addendum for how this column is enforced (server/lib/accessRoles.ts,
-- server/middleware/auth.ts's requireAccessRole, src/utils/accessRoleGate.ts).

ALTER TABLE staff ADD COLUMN access_role TEXT NOT NULL DEFAULT 'TILL_OPERATOR';
