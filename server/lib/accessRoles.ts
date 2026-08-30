// DL-005 auth-scope role (server mirror of src/types/index.ts's StaffAccessRole)
// — distinct from server/lib/roles.ts's StaffRole, which is a free-form
// job-title role. This is the controlled vocabulary that drives which of
// the five app surfaces a staff member's session gets. See
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-002/DL-005.
export type StaffAccessRole =
  | 'TILL_OPERATOR'
  | 'HEAD_OFFICE_STAFF'
  | 'EXECUTIVE'
  | 'RIDER'
  | 'PLATFORM_SUPER_ADMIN';

// Mirrors Supabase's app_is_back_office_role() (supabase/migrations/
// 20260829120000_extensions_and_rls_helpers.sql) — same role set, kept in
// sync by hand since there's no shared runtime between the two today.
export const BACK_OFFICE_READ_ROLES: StaffAccessRole[] = [
  'HEAD_OFFICE_STAFF',
  'EXECUTIVE',
  'PLATFORM_SUPER_ADMIN',
];

// Narrower than the read set: EXECUTIVE is read-only per DL-002 (the
// Executive PWA is a separate, future, read-only surface) — never grant it
// a mutation route even though it can see back-office data.
export const BACK_OFFICE_WRITE_ROLES: StaffAccessRole[] = ['HEAD_OFFICE_STAFF', 'PLATFORM_SUPER_ADMIN'];

export function hasAccessRole(role: string | undefined, ...allowed: StaffAccessRole[]): boolean {
  return !!role && allowed.includes(role as StaffAccessRole);
}
