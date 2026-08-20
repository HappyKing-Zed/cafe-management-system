'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrderAlerts, getNotifications, markNotificationsRead } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Bell, AlertTriangle, Clock, CheckCheck } from 'lucide-react';
import clsx from 'clsx';

interface OrderAlert {
  orderId: number;
  side: 'kitchen' | 'waiter';
  severity: 'warning' | 'critical';
  status: string;
  minutes: number;
  message: string;
}

interface AppNotification {
  id: number;
  message: string;
  orderId?: number;
  isRead: boolean;
  createdAt: string;
}

const ALERT_ROLES = ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef'];

function timeAgo(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const seesAlerts = !!user && ALERT_ROLES.includes(user.role);
  // Waiters see waiter-side alerts; chefs see kitchen-side; coordinators/managers see both
  const visibleAlerts = alerts.filter(a =>
    user?.role === 'waiter' ? a.side === 'waiter' :
    user?.role === 'chef' ? a.side === 'kitchen' : true
  );

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const [alertsRes, notifsRes] = await Promise.allSettled([
        seesAlerts ? getOrderAlerts() : Promise.resolve({ data: [] }),
        getNotifications(),
      ]);
      if (!mounted) return;
      if (alertsRes.status === 'fulfilled') setAlerts(Array.isArray(alertsRes.value.data) ? alertsRes.value.data : []);
      if (notifsRes.status === 'fulfilled') setNotifs(Array.isArray(notifsRes.value.data) ? notifsRes.value.data : []);
      setLoadError(alertsRes.status === 'rejected' || notifsRes.status === 'rejected'
        ? 'Notifications could not be refreshed.'
        : '');
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [user, seesAlerts]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const unread = notifs.filter(n => !n.isRead);
  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const badgeCount = unread.length + visibleAlerts.length;

  // Routes each role may open (mirrors the sidebar) — never navigate to a page the user can't access
  const ROUTE_ROLES: Record<string, string[]> = {
    '/dashboard/orders': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'],
    '/dashboard/order-board': ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'cashier', 'storekeeper'],
    '/dashboard/kitchen': ['admin', 'owner', 'manager', 'coordinator', 'chef'],
    '/dashboard/inventory': ['admin', 'owner', 'manager', 'storekeeper', 'cashier'],
    '/dashboard/item-requests': ['admin', 'owner', 'manager', 'coordinator'],
    '/dashboard/summary': ['admin', 'owner', 'manager', 'cashier', 'waiter'],
  };
  const allowed = (path: string) => ROUTE_ROLES[path]?.includes(user.role) ?? false;
  // Best order page for this role
  const orderPage = user.role === 'chef' ? '/dashboard/kitchen'
    : allowed('/dashboard/orders') ? '/dashboard/orders' : '/dashboard/order-board';
  // Where a notification should take the user, inferred from its content (null = not clickable)
  const notifTarget = (n: AppNotification): string | null => {
    const m = n.message.toLowerCase();
    let target: string | null = null;
    if (n.orderId) target = orderPage;
    else if (m.includes('service report') || m.includes('daily report') || m.includes('submission') || m.includes('confirmed your')) target = '/dashboard/summary';
    else if (m.includes('requisition') || m.includes('item request') || m.includes('request')) target = '/dashboard/item-requests';
    else if (m.includes('purchase order') || m.includes('po #') || m.includes('stock') || m.includes('expir') || m.includes('supplier') || m.includes('inventory')) target = '/dashboard/inventory';
    else if (m.includes('order') || m.includes('payment') || m.includes('paid')) target = orderPage;
    return target && allowed(target) ? target : null;
  };
  const goTo = (path: string | null) => {
    if (!path) return;
    setOpen(false);
    router.push(path);
  };

  const handleMarkRead = async () => {
    try {
      await markNotificationsRead();
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      setLoadError('');
    } catch {
      setLoadError('Notifications could not be marked as read.');
    }
  };

  return (
    <div ref={ref} className="fixed top-2 right-16 lg:top-4 lg:right-6 z-40">
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'relative w-11 h-11 rounded-full shadow-md border flex items-center justify-center transition-colors',
          criticalCount > 0 ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-gray-200 hover:bg-gray-50'
        )}
        aria-label="Notifications"
      >
        <Bell size={20} className={criticalCount > 0 ? 'text-red-600' : 'text-gray-600'} />
        {badgeCount > 0 && (
          <span className={clsx(
            'absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center',
            criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          )}>
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -right-12 lg:right-0 mt-2 w-96 max-w-[calc(100vw-1.5rem)] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
            {unread.length > 0 && (
              <button onClick={handleMarkRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          {loadError && <p role="alert" className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">{loadError}</p>}

          {/* Delayed-order alerts */}
          {visibleAlerts.length > 0 && (
            <ul className="divide-y divide-gray-50 border-b border-gray-100">
              {visibleAlerts.map((a) => (
                <li key={`alert-${a.orderId}-${a.status}`} onClick={() => goTo(a.side === 'kitchen' && allowed('/dashboard/kitchen') ? '/dashboard/kitchen' : orderPage)}
                  className="px-4 py-3 flex gap-3 items-start hover:bg-gray-50 cursor-pointer">
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    a.severity === 'critical' ? 'bg-red-100' : 'bg-amber-100'
                  )}>
                    {a.severity === 'critical'
                      ? <AlertTriangle size={16} className="text-red-600" />
                      : <Clock size={16} className="text-amber-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Delayed · {a.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Step-by-step notifications */}
          {notifs.length === 0 && visibleAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {notifs.map((n) => (
                <li key={n.id} onClick={() => goTo(notifTarget(n))}
                  className={clsx('px-4 py-3 flex gap-3 items-start hover:bg-gray-50', notifTarget(n) && 'cursor-pointer', !n.isRead && 'bg-brand-50/40')}>
                  <div className={clsx('w-2 h-2 rounded-full shrink-0 mt-2', n.isRead ? 'bg-gray-200' : 'bg-brand-500')} />
                  <div className="min-w-0">
                    <p className={clsx('text-sm', n.isRead ? 'text-gray-500' : 'text-gray-800 font-medium')}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
