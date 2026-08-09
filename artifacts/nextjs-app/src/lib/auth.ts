import { User } from './types';

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const storeAuth = (token: string, user: User) => {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'System Administrator',
  owner: 'Restaurant Owner',
  manager: 'Manager',
  coordinator: 'Order Coordinator',
  waiter: 'Waiter',
  chef: 'Chef',
  cashier: 'Cashier',
  storekeeper: 'Inventory Manager',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  owner: 'bg-orange-100 text-orange-800',
  manager: 'bg-yellow-100 text-yellow-800',
  coordinator: 'bg-green-100 text-green-800',
  waiter: 'bg-blue-100 text-blue-800',
  chef: 'bg-purple-100 text-purple-800',
  cashier: 'bg-gray-100 text-gray-800',
  storekeeper: 'bg-amber-100 text-amber-800',
};

export const canAccess = (userRole: string, allowedRoles: string[]): boolean => {
  return allowedRoles.includes(userRole);
};
