'use client';
import { useEffect, useRef, useState } from 'react';
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
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
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
      try {
        const [alertsRes, notifsRes] = await Promise.all([
          seesAlerts ? getOrderAlerts() : Promise.resolve({ data: [] }),
          getNotifications(),
        ]);
        if (mounted) {
          setAlerts(alertsRes.data || []);
          setNotifs(notifsRes.data || []);
        }
      } catch { /* ignore polling errors */ }
    };
    load();
    const t = setInterval(load, 15000);
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

  const handleMarkRead = async () => {
    try {
      await markNotificationsRead();
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  return (
    <div ref={ref} className="fixed top-4 right-6 z-40">
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
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
            {unread.length > 0 && (
              <button onClick={handleMarkRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Delayed-order alerts */}
          {visibleAlerts.length > 0 && (
            <ul className="divide-y divide-gray-50 border-b border-gray-100">
              {visibleAlerts.map((a) => (
                <li key={`alert-${a.orderId}-${a.status}`} className="px-4 py-3 flex gap-3 items-start hover:bg-gray-50">
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
                <li key={n.id} className={clsx('px-4 py-3 flex gap-3 items-start hover:bg-gray-50', !n.isRead && 'bg-brand-50/40')}>
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
