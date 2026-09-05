import type { Role } from './types';

export const DASHBOARD_ROUTE_ROLES: Record<string, readonly Role[]> = {
  '/dashboard/orders': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'],
  '/dashboard/order-board': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'cashier', 'branch_store_keeper', 'main_store_keeper'],
  '/dashboard/requests': ['admin', 'chef'],
  '/dashboard/kitchen': ['admin', 'owner', 'manager', 'coordinator', 'chef', 'chef_main_kitchen', 'bar_man', 'juice_maker', 'coffee_lady'],
  '/dashboard/tables': ['admin', 'owner', 'manager', 'coordinator', 'waiter'],
  '/dashboard/menu': ['admin', 'owner', 'manager'],
  '/dashboard/inventory': ['admin', 'owner', 'manager', 'branch_store_keeper'],
  '/dashboard/main-store': ['owner', 'main_store_keeper'],
  '/dashboard/inventory-transfers': ['owner', 'manager', 'branch_store_keeper', 'main_store_keeper'],
  '/dashboard/item-requests': ['admin', 'owner', 'manager', 'coordinator'],
  '/dashboard/staff': ['admin', 'owner', 'manager'],
  '/dashboard/branches': ['admin', 'owner', 'manager'],
  '/dashboard/summary': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'],
  '/dashboard/reports': ['admin', 'owner', 'manager', 'cashier'],
  '/dashboard': ['admin', 'owner', 'manager', 'chef', 'branch_store_keeper', 'main_store_keeper'],
};

export function canAccessDashboardPath(pathname: string, role: Role, branchId?: number | null) {
  const route = Object.keys(DASHBOARD_ROUTE_ROLES)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));

  if (!route || !DASHBOARD_ROUTE_ROLES[route].includes(role)) {
    return false;
  }

  return true;
}

export function dashboardHomeForRole(role: Role) {
  if (['chef_main_kitchen', 'bar_man', 'juice_maker', 'coffee_lady'].includes(role)) return '/dashboard/kitchen';
  return DASHBOARD_ROUTE_ROLES['/dashboard'].includes(role) ? '/dashboard' : '/dashboard/orders';
}
