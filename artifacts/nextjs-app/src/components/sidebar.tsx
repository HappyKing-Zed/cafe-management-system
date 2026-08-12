'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { ROLE_LABELS } from '@/lib/auth';
import clsx from 'clsx';
import {
  LayoutDashboard, ShoppingCart, ChefHat, Table2, UtensilsCrossed,
  Package, Users, BarChart3, Building2, LogOut, Coffee, Columns3, Send, PackageOpen
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'owner', 'manager', 'chef', 'cashier', 'storekeeper'] },
  { href: '/dashboard/orders', label: 'Orders / POS', icon: ShoppingCart, roles: ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'] },
  { href: '/dashboard/order-board', label: 'Order Board', icon: Columns3, roles: ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'cashier', 'storekeeper'] },
  { href: '/dashboard/requests', label: 'Requests', icon: Send, roles: ['admin', 'owner', 'manager', 'coordinator', 'chef'] },
  { href: '/dashboard/kitchen', label: 'Kitchen Board', icon: ChefHat, roles: ['admin', 'owner', 'manager', 'coordinator', 'chef'] },
  { href: '/dashboard/tables', label: 'Tables', icon: Table2, roles: ['admin', 'owner', 'manager', 'coordinator', 'waiter'] },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['admin', 'owner', 'manager'] },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'owner', 'manager', 'storekeeper', 'cashier'] },
  { href: '/dashboard/item-requests', label: 'Item Requests', managerLabel: 'Item Requested', icon: PackageOpen, roles: ['admin', 'owner', 'manager', 'coordinator'] },
  { href: '/dashboard/staff', label: 'Staff', icon: Users, roles: ['admin', 'owner', 'manager'] },
  { href: '/dashboard/branches', label: 'Branches', icon: Building2, roles: ['admin', 'owner', 'manager'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'owner', 'manager', 'cashier'] },
  { href: '/dashboard/report', label: 'Report', icon: BarChart3, roles: ['admin', 'owner', 'manager', 'coordinator'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const visible = navItems.filter((item) => user?.role && item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-earth-900 text-white flex flex-col h-screen sticky top-0" style={{ background: '#28180E' }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coffee size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Jima Aba Jifar</h1>
            <p className="text-xs text-white/50">Restaurant System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'sidebar-link',
                isActive ? 'bg-brand-500 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon size={18} />
              <span>{(item as any).managerLabel && user?.role && ['admin', 'owner', 'manager'].includes(user.role) ? (item as any).managerLabel : item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10">
        <div className="bg-white/5 rounded-lg p-3 mb-2">
          <p className="font-medium text-sm truncate">{user?.name}</p>
          <p className="text-xs text-white/50 mt-0.5">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
