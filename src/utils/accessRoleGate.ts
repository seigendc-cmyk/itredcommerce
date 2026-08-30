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
