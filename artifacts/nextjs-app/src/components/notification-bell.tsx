'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrderAlerts, getNotifications, markNotificationsRead } from '@/lib/api';
import { canAccessDashboardPath } from '@/lib/dashboard-access';
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
      if (alertsRes.status === 'fulfilled') {
        setAlerts(Array.isArray(alertsRes.value.data) ? alertsRes.value.data : []);
      }
      if (notifsRes.status === 'fulfilled') {
        setNotifs(Array.isArray(notifsRes.value.data) ? notifsRes.value.data : []);
      }
      setLoadError(
        alertsRes.status === 'rejected' || notifsRes.status === 'rejected'
          ? 'Notifications could not be refreshed.'
          : '',
      );
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

  const allowed = (path: string) => canAccessDashboardPath(path, user.role);
  const orderPage = user.role === 'chef' ? '/dashboard/kitchen'
    : allowed('/dashboard/orders') ? '/dashboard/orders' : '/dashboard/order-board';

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
          'relative w-11 h-11 rounded-full shadow-md shadow-teal-900/5 flex items-center justify-center transition-all duration-300 active:scale-95',
          criticalCount > 0
            ? 'bg-red-50 border border-red-200 hover:bg-red-100 hover:shadow-red-900/10'
            : 'bg-white/80 backdrop-blur-md border border-cream-200 hover:bg-white hover:border-cream-300'
        )}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={1.5} className={criticalCount > 0 ? 'text-red-600' : 'text-teal-900'} />
        {badgeCount > 0 && (
          <span className={clsx(
            'absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm',
            criticalCount > 0 ? 'bg-red-500' : 'bg-gold-500'
          )}>
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -right-12 lg:right-0 mt-3 w-96 max-w-[calc(100vw-1.5rem)] max-h-[70vh] overflow-y-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-teal-900/10 border border-cream-200 origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl px-5 py-4 border-b border-cream-100 flex items-center justify-between">
            <h3 className="font-display font-medium text-teal-900 text-base">Notifications</h3>
            {unread.length > 0 && (
              <button onClick={handleMarkRead} className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1.5 transition-colors">
                <CheckCheck size={14} strokeWidth={2} /> Mark all read
              </button>
            )}
          </div>
          {loadError && (
            <p role="alert" className="px-5 py-2.5 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
              {loadError}
            </p>
          )}

          {/* Delayed-order alerts */}
          {visibleAlerts.length > 0 && (
            <ul className="divide-y divide-cream-100/50 border-b border-cream-100">
              {visibleAlerts.map((a) => (
                <li key={`alert-${a.orderId}-${a.status}`} onClick={() => goTo(a.side === 'kitchen' && allowed('/dashboard/kitchen') ? '/dashboard/kitchen' : orderPage)}
                  className="px-5 py-4 flex gap-4 items-start hover:bg-cream-50/50 transition-colors cursor-pointer group">
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-transform group-hover:scale-105',
                    a.severity === 'critical' ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-gold-50 border border-gold-100 text-gold-600'
                  )}>
                    {a.severity === 'critical'
                      ? <AlertTriangle size={18} strokeWidth={2} />
                      : <Clock size={18} strokeWidth={2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-coffee-800 leading-snug group-hover:text-teal-900 transition-colors">{a.message}</p>
                    <p className="text-xs text-coffee-400 mt-1 uppercase tracking-wider font-medium">Delayed · {a.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Step-by-step notifications */}
          {notifs.length === 0 && visibleAlerts.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-cream-100 rounded-full flex items-center justify-center mb-3">
                <Bell size={24} strokeWidth={1.5} className="text-cream-300" />
              </div>
              <p className="text-coffee-400 text-sm font-medium">All caught up</p>
            </div>
          ) : (
            <ul className="divide-y divide-cream-100/50">
              {notifs.map((n) => (
                <li key={n.id} onClick={() => goTo(notifTarget(n))}
                  className={clsx(
                    'px-5 py-4 flex gap-4 items-start transition-colors group',
                    notifTarget(n) && 'cursor-pointer hover:bg-cream-50/50',
                    !n.isRead ? 'bg-teal-50/30' : 'opacity-70 hover:opacity-100'
                  )}>
                  <div className={clsx('w-2 h-2 rounded-full shrink-0 mt-2 transition-colors', n.isRead ? 'bg-cream-300' : 'bg-teal-600')} />
                  <div className="min-w-0 flex-1">
                    <p className={clsx(
                      'text-sm leading-snug transition-colors',
                      n.isRead ? 'text-coffee-600 group-hover:text-coffee-800' : 'text-teal-950 font-medium'
                    )}>{n.message}</p>
                    <p className="text-xs text-coffee-400 mt-1.5 font-medium">{timeAgo(n.createdAt)}</p>
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
