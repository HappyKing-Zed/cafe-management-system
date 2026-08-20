'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { ROLE_LABELS } from '@/lib/auth';
import { DASHBOARD_ROUTE_ROLES } from '@/lib/dashboard-access';
import clsx from 'clsx';
import {
  LayoutDashboard, ShoppingCart, ChefHat, Table2, UtensilsCrossed,
  Package, Users, BarChart3, Building2, LogOut, Coffee, Columns3, Send, PackageOpen, Menu, X,
  ChevronsLeft, ChevronsRight, ClipboardList
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: DASHBOARD_ROUTE_ROLES['/dashboard'] },
  { href: '/dashboard/orders', label: 'Orders / POS', icon: ShoppingCart, roles: DASHBOARD_ROUTE_ROLES['/dashboard/orders'] },
  { href: '/dashboard/order-board', label: 'Order Board', icon: Columns3, roles: DASHBOARD_ROUTE_ROLES['/dashboard/order-board'] },
  { href: '/dashboard/requests', label: 'Requests', icon: Send, roles: DASHBOARD_ROUTE_ROLES['/dashboard/requests'] },
  { href: '/dashboard/kitchen', label: 'Kitchen Board', icon: ChefHat, roles: DASHBOARD_ROUTE_ROLES['/dashboard/kitchen'] },
  { href: '/dashboard/tables', label: 'Tables', icon: Table2, roles: DASHBOARD_ROUTE_ROLES['/dashboard/tables'] },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, roles: DASHBOARD_ROUTE_ROLES['/dashboard/menu'] },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package, roles: DASHBOARD_ROUTE_ROLES['/dashboard/inventory'] },
  { href: '/dashboard/item-requests', label: 'Item Requests', managerLabel: 'Item Requested', icon: PackageOpen, roles: DASHBOARD_ROUTE_ROLES['/dashboard/item-requests'] },
  { href: '/dashboard/staff', label: 'Staff', icon: Users, roles: DASHBOARD_ROUTE_ROLES['/dashboard/staff'] },
  { href: '/dashboard/branches', label: 'Branches and Restaurants', icon: Building2, roles: DASHBOARD_ROUTE_ROLES['/dashboard/branches'] },
  { href: '/dashboard/summary', label: 'Summary', icon: ClipboardList, roles: DASHBOARD_ROUTE_ROLES['/dashboard/summary'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: DASHBOARD_ROUTE_ROLES['/dashboard/reports'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Remember collapsed preference
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('sidebar-collapsed') === '1') {
      setCollapsed(true);
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const visible = navItems.filter((item) => user?.role && item.roles.includes(user.role));

  const renderNav = (isCollapsed: boolean) => (
    <>
      {/* Logo */}
      <div className={clsx('border-b border-gray-200', isCollapsed ? 'p-3' : 'p-5')}>
        <div className={clsx('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coffee size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-sm leading-tight text-gray-900">Jima Aba Jifar</h1>
              <p className="text-xs text-gray-500">Restaurant System</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 space-y-0.5 overflow-y-auto', isCollapsed ? 'p-2' : 'p-3')}>
        {visible.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
          const label = (item as any).managerLabel && user?.role && ['admin', 'owner', 'manager'].includes(user.role) ? (item as any).managerLabel : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? label : undefined}
              className={clsx(
                'sidebar-link',
                isCollapsed && 'justify-center !px-2',
                isActive ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={clsx('border-t border-gray-200', isCollapsed ? 'p-2' : 'p-3')}>
        {!isCollapsed && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
            <p className="font-medium text-sm truncate text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-sm',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!isCollapsed && 'Sign Out'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-gray-100 border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Coffee size={16} className="text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900">Jima Aba Jifar</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 text-gray-600 hover:text-gray-900">
          <Menu size={22} />
        </button>
      </div>
      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-gray-100 border-r border-gray-200 flex flex-col shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-900">
              <X size={20} />
            </button>
            {renderNav(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex bg-gray-100 text-gray-800 border-r border-gray-200 flex-col h-screen sticky top-0 transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {renderNav(collapsed)}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="flex items-center justify-center gap-2 py-2.5 border-t border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-sm"
        >
          {collapsed ? <ChevronsRight size={18} /> : (<><ChevronsLeft size={18} /> Collapse</>)}
        </button>
      </aside>
    </>
  );
}
