import {
  BarChart3,
  Building2,
  ClipboardList,
  Columns3,
  Package,
  PackageOpen,
  ShoppingCart,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { Role } from '@/lib/types';

export const TABS: ReadonlyArray<{
  id: string;
  label: string;
  icon: typeof BarChart3;
  roles: readonly Role[];
}> = [
  { id: 'service', label: 'Service & Submissions', icon: ClipboardList, roles: ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'] },
  { id: 'overview', label: 'Overview', icon: BarChart3, roles: ['admin', 'owner', 'manager'] },
  { id: 'sales', label: 'Sales', icon: TrendingUp, roles: ['admin', 'owner', 'manager', 'cashier'] },
  { id: 'purchased', label: 'Items Purchased', icon: ShoppingCart, roles: ['admin', 'owner', 'manager', 'cashier'] },
  { id: 'orders', label: 'Order Board', icon: Columns3, roles: ['admin', 'owner', 'manager'] },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed, roles: ['admin', 'owner', 'manager'] },
  { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin', 'owner', 'manager'] },
  { id: 'requests', label: 'Item Requests', icon: PackageOpen, roles: ['admin', 'owner', 'manager'] },
  { id: 'staff', label: 'Staff', icon: Users, roles: ['admin', 'owner', 'manager'] },
  { id: 'branches', label: 'Branches', icon: Building2, roles: ['admin', 'owner', 'manager'] },
];

export const GENERIC_TABS = [
  'sales',
  'purchased',
  'orders',
  'menu',
  'inventory',
  'requests',
  'staff',
  'branches',
] as const;