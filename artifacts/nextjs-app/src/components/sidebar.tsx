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
  Package, Users, BarChart3, Building2, LogOut, Columns3, Send, PackageOpen, Menu, X,
  ChevronsLeft, ClipboardList, Wine, Warehouse
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: DASHBOARD_ROUTE_ROLES['/dashboard'] },
  { href: '/dashboard/orders', label: 'Orders / POS', icon: ShoppingCart, roles: DASHBOARD_ROUTE_ROLES['/dashboard/orders'] },
  { href: '/dashboard/order-board', label: 'Order Board', icon: Columns3, roles: DASHBOARD_ROUTE_ROLES['/dashboard/order-board'] },
  { href: '/dashboard/requests', label: 'Requests', icon: Send, roles: DASHBOARD_ROUTE_ROLES['/dashboard/requests'] },
  { href: '/dashboard/kitchen', label: 'Kitchen Board', icon: ChefHat, roles: DASHBOARD_ROUTE_ROLES['/dashboard/kitchen'] },
  { href: '/dashboard/tables', label: 'Tables', icon: Table2, roles: DASHBOARD_ROUTE_ROLES['/dashboard/tables'] },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, roles: DASHBOARD_ROUTE_ROLES['/dashboard/menu'] },
  { href: '/dashboard/main-store', label: 'Main Store', icon: Warehouse, roles: DASHBOARD_ROUTE_ROLES['/dashboard/main-store'] },
  { href: '/dashboard/inventory', label: 'Branch Inventory', icon: Package, roles: DASHBOARD_ROUTE_ROLES['/dashboard/inventory'] },
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

  // Keep the drawer dismissible from the keyboard as well as its visible controls.
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

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
      {/* Logo Area */}
      <div className={clsx('relative flex items-center h-20 flex-shrink-0', isCollapsed ? 'px-4 justify-center' : 'px-6')}>
        <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-teal-700 to-transparent opacity-50" />
        <div className={clsx('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-gold-900/20">
            <Wine size={20} className="text-teal-950" strokeWidth={1.5} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="font-display font-medium text-lg leading-tight text-cream-50 tracking-wide">Jima</h1>
              <p className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">CARAVAN Lounge</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 space-y-1 overflow-y-auto custom-scrollbar py-6', isCollapsed ? 'px-3' : 'px-4')}>
        <div className={clsx("mb-4 px-2", isCollapsed && "hidden")}>
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest">Main Menu</p>
        </div>
        {visible.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
          const label = (item as any).managerLabel && user?.role && ['admin', 'owner', 'manager'].includes(user.role) ? (item as any).managerLabel : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? label : undefined}
              className={clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 relative overflow-hidden',
                isCollapsed && 'justify-center !px-0',
                isActive
                  ? 'bg-teal-800 text-cream-50 font-medium shadow-md shadow-teal-900/20'
                  : 'text-teal-100/70 hover:bg-teal-800/50 hover:text-cream-50'
              )}
            >
              {isActive && !isCollapsed && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold-400 rounded-r-full" />
              )}
              <item.icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className={clsx(
                  "flex-shrink-0 transition-transform duration-300",
                  isActive ? "text-gold-400" : "group-hover:scale-110 group-hover:text-gold-300"
                )}
              />
              {!isCollapsed && <span className="tracking-wide truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className={clsx('flex-shrink-0 border-t border-teal-800/50 bg-teal-900/50', isCollapsed ? 'p-3' : 'p-4')}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl bg-teal-800/30 border border-teal-700/30">
            <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0 border border-teal-600">
              <span className="text-xs font-medium text-cream-50">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-cream-50 truncate">{user?.name}</p>
              <p className="text-xs text-gold-400/80 truncate">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-teal-100/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 text-sm group',
            isCollapsed && 'justify-center !px-0'
          )}
        >
          <LogOut size={18} strokeWidth={1.5} className="flex-shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && <span className="font-medium tracking-wide">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-teal-950 border-b border-teal-900 flex items-center justify-between px-4 h-16 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg flex items-center justify-center shadow-sm">
            <Wine size={16} className="text-teal-950" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-medium text-lg text-cream-50 tracking-wide">Jima</span>
            <span className="text-[9px] uppercase tracking-widest text-gold-400 font-semibold">CARAVAN Lounge</span>
          </div>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 text-teal-100/70 hover:text-cream-50 transition-colors">
          <Menu size={24} strokeWidth={1.5} />
        </button>
      </div>

      {open && (
        <>
          {/* Mobile drawer overlay */}
          <div
            className="lg:hidden fixed inset-0 z-[60] bg-teal-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onPointerDown={() => setOpen(false)}
          />

          {/* Mobile drawer panel */}
          <aside className="lg:hidden fixed left-0 top-0 h-full w-[280px] bg-teal-950 flex flex-col shadow-2xl z-[60] animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onPointerDown={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-4 z-10 p-2 text-teal-100/50 hover:text-cream-50 transition-colors rounded-full hover:bg-teal-800/50"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            {renderNav(false)}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex bg-teal-950 text-cream-50 flex-col h-screen sticky top-0 transition-all duration-300 ease-out flex-shrink-0 border-r border-teal-900/50 shadow-xl shadow-teal-950/20 z-30',
          collapsed ? 'w-[80px]' : 'w-[280px]'
        )}
      >
        {renderNav(collapsed)}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className={clsx(
            "absolute -right-3 top-24 w-6 h-6 bg-teal-800 border border-teal-600 rounded-full flex items-center justify-center text-gold-400 hover:text-cream-50 hover:bg-teal-700 transition-all duration-300 shadow-md",
            collapsed && "rotate-180"
          )}
        >
          <ChevronsLeft size={14} strokeWidth={2} />
        </button>
      </aside>
    </>
  );
}
