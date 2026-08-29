export type StaffRole =
  | 'SYS_ADMIN'
  | 'STORE_MANAGER'
  | 'SENIOR_CASHIER'
  | 'CASHIER'
  | 'INVENTORY_OFFICER'
  | 'ACCOUNTANT';

/** Roles considered "manager-or-above" for approval/override/config gates. */
export const MANAGER_ROLES: StaffRole[] = ['STORE_MANAGER', 'SYS_ADMIN'];

export function hasRole(role: string | undefined, ...allowed: StaffRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role as StaffRole);
}
