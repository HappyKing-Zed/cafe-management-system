import { User } from './types';

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    return null;
  }
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
  chef_main_kitchen: 'Chef – Main Kitchen',
  bar_man: 'Bar Man',
  juice_maker: 'Juice Maker',
  coffee_lady: 'Coffee Lady',
  cashier: 'Cashier',
  branch_store_keeper: 'Branch Store Keeper',
  main_store_keeper: 'Main Store Keeper',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  owner: 'bg-orange-100 text-orange-800',
  manager: 'bg-yellow-100 text-yellow-800',
  coordinator: 'bg-green-100 text-green-800',
  waiter: 'bg-blue-100 text-blue-800',
  chef: 'bg-purple-100 text-purple-800',
  chef_main_kitchen: 'bg-orange-100 text-orange-800',
  bar_man: 'bg-cyan-100 text-cyan-800',
  juice_maker: 'bg-lime-100 text-lime-800',
  coffee_lady: 'bg-amber-100 text-amber-800',
  cashier: 'bg-gray-100 text-gray-800',
  branch_store_keeper: 'bg-amber-100 text-amber-800',
  main_store_keeper: 'bg-teal-100 text-teal-800',
};

export const canAccess = (userRole: string, allowedRoles: string[]): boolean => {
  return allowedRoles.includes(userRole);
};
