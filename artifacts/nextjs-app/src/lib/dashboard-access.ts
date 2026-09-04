import type { Role } from './types';

export const DASHBOARD_ROUTE_ROLES: Record<string, readonly Role[]> = {
  '/dashboard/orders': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'],
  '/dashboard/order-board': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'cashier', 'storekeeper'],
  '/dashboard/requests': ['admin', 'chef'],
  '/dashboard/kitchen': ['admin', 'owner', 'manager', 'coordinator', 'chef'],
  '/dashboard/tables': ['admin', 'owner', 'manager', 'coordinator', 'waiter'],
  '/dashboard/menu': ['admin', 'owner', 'manager'],
  '/dashboard/inventory': ['admin', 'owner', 'manager', 'storekeeper'],
  '/dashboard/main-store': ['owner', 'storekeeper'],
  '/dashboard/inventory-transfers': ['owner', 'manager', 'storekeeper'],
  '/dashboard/item-requests': ['admin', 'owner', 'manager', 'coordinator'],
  '/dashboard/staff': ['admin', 'owner', 'manager'],
  '/dashboard/branches': ['admin', 'owner', 'manager'],
  '/dashboard/summary': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'],
  '/dashboard/reports': ['admin', 'owner', 'manager', 'cashier'],
  '/dashboard': ['admin', 'owner', 'manager', 'chef', 'storekeeper'],
};

export function canAccessDashboardPath(pathname: string, role: Role, branchId?: number | null) {
  const route = Object.keys(DASHBOARD_ROUTE_ROLES)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));

  if (!route || !DASHBOARD_ROUTE_ROLES[route].includes(role)) {
    return false;
  }

  if (route === '/dashboard/main-store' && role === 'storekeeper' && branchId) {
    return false;
  }
  if (route === '/dashboard/inventory-transfers' && role === 'storekeeper' && !branchId) {
    return false;
  }
  if (route === '/dashboard/inventory' && role === 'storekeeper' && !branchId) {
    return false;
  }

  return true;
}

export function dashboardHomeForRole(role: Role) {
  return DASHBOARD_ROUTE_ROLES['/dashboard'].includes(role) ? '/dashboard' : '/dashboard/orders';
}
