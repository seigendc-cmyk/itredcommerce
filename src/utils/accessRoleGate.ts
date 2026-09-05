import type { ActiveView, StaffAccessRole, MenuGroup } from '../types';

// The branch-terminal app's restricted surface (Prompt 3 / DL-002:
// "sell, view products, returns, EOD, simple cart only"). Everything else
// in the ActiveView union is head-office-only. "View products" is satisfied
// inline inside the sell/cart screens (SalesView already fetches
// /inventory/items) — there's no separate product-catalog *management* nav
// destination for till operators, only the full-CRUD ITEM_LIST view, which
// stays head-office. LAYAWAY is included because it shares the till's Cart
// menu group and its own F8 hotkey alongside the other cart operations.
// CUSTOMERS (the full account/credit-management view) and the standalone
// ITEM_LIST catalog are deliberately excluded — those are back-office
// account/catalog administration, not "simple cart" till scope; a till
// operator still resolves a customer via the in-cart selector modal.
// OPERATIONAL_READINESS is included because HeaderNav's top-bar status
// badge links there unconditionally for every session, regardless of role.
export const BRANCH_TERMINAL_VIEWS: ReadonlySet<ActiveView> = new Set<ActiveView>([
  'LANDING',
  'SALES_CASH',
  'SALES_CREDIT',
  'SALES_RETURN',
  'SALES_HISTORY',
  'DELIVERY_DISPATCH',
  'HELD_SALES',
  'HELD_RECEIPTS',
  'LAYAWAY',
  'SHIFT_MANAGEMENT',
  'EOD_REPORT',
  'OPERATIONAL_READINESS',
]);

const BACK_OFFICE_ROLES: StaffAccessRole[] = ['HEAD_OFFICE_STAFF', 'EXECUTIVE', 'PLATFORM_SUPER_ADMIN'];

export function isBackOfficeAccessRole(accessRole: StaffAccessRole | undefined): boolean {
  return !!accessRole && BACK_OFFICE_ROLES.includes(accessRole);
}

export function canAccessView(accessRole: StaffAccessRole | undefined, view: ActiveView): boolean {
  if (isBackOfficeAccessRole(accessRole)) return true;
  return BRANCH_TERMINAL_VIEWS.has(view);
}

export function filterMenuGroupsForRole(groups: MenuGroup[], accessRole: StaffAccessRole | undefined): MenuGroup[] {
  if (isBackOfficeAccessRole(accessRole)) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((item) => BRANCH_TERMINAL_VIEWS.has(item.viewTarget)) }))
    .filter((g) => g.items.length > 0);
}

// DL-040/DL-048: the Sales/Purchasing views a module lock disables when a
// TerminalActivationToken has expired past its grace period. Deliberately
// excludes SALES_HISTORY — that ActiveView doubles as a Reports entry
// ("Sales Performance & Margins", src/data/mockData.ts) — and every
// Reporting/EOD/Inventory-viewing view, since DL-040 requires those to stay
// available regardless of lock status; only actions that create or resume a
// sale or purchase transaction are in scope.
export const MODULE_LOCKED_VIEWS: ReadonlySet<ActiveView> = new Set<ActiveView>([
  'SALES_CASH',
  'SALES_CREDIT',
  'SALES_RETURN',
  'LAYAWAY',
  'HELD_SALES',
  'HELD_RECEIPTS',
  'PURCHASING',
  'PURCHASE_MEMO',
  'PURCHASE_ORDER',
]);

export function isModuleLockedView(view: ActiveView): boolean {
  return MODULE_LOCKED_VIEWS.has(view);
}

export function canAccessViewWithModuleLock(
  accessRole: StaffAccessRole | undefined,
  view: ActiveView,
  moduleLocked: boolean
): boolean {
  if (moduleLocked && isModuleLockedView(view)) return false;
  return canAccessView(accessRole, view);
}

export function filterMenuGroupsForRoleAndLock(
  groups: MenuGroup[],
  accessRole: StaffAccessRole | undefined,
  moduleLocked: boolean
): MenuGroup[] {
  const roleFiltered = filterMenuGroupsForRole(groups, accessRole);
  if (!moduleLocked) return roleFiltered;
  return roleFiltered
    .map((g) => ({ ...g, items: g.items.filter((item) => !isModuleLockedView(item.viewTarget)) }))
    .filter((g) => g.items.length > 0);
}
