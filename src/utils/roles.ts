import { StaffMember, StaffRole } from '../types';

/**
 * Centralized role check, replacing the ad hoc per-view comparisons that had
 * drifted from the real StaffRole enum values (e.g. checking against
 * 'Store Manager' instead of the seeded 'STORE_MANAGER').
 */
export function hasRole(staff: StaffMember | null | undefined, ...allowed: StaffRole[]): boolean {
  if (!staff) return false;
  return allowed.includes(staff.role);
}

export const MANAGER_ROLES: StaffRole[] = ['STORE_MANAGER', 'SYS_ADMIN'];

export function isManager(staff: StaffMember | null | undefined): boolean {
  return hasRole(staff, ...MANAGER_ROLES);
}
