'use client';
import { useEffect, useRef, useState } from 'react';
import { getOrderAlerts } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Bell, AlertTriangle, Clock } from 'lucide-react';
import clsx from 'clsx';

interface OrderAlert {
  orderId: number;
  side: 'kitchen' | 'waiter';
  severity: 'warning' | 'critical';
  status: string;
  minutes: number;
  message: string;
}

const ALERT_ROLES = ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef'];

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canSee = user && ALERT_ROLES.includes(user.role);
  // Waiters see waiter-side alerts; chefs see kitchen-side; coordinators/managers see both
  const visible = alerts.filter(a =>
    user?.role === 'waiter' ? a.side === 'waiter' :
    user?.role === 'chef' ? a.side === 'kitchen' : true
  );

  useEffect(() => {
    if (!canSee) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await getOrderAlerts();
        if (mounted) setAlerts(res.data || []);
      } catch { /* ignore polling errors */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [canSee]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!canSee) return null;

  const criticalCount = visible.filter(a => a.severity === 'critical').length;

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
        {visible.length > 0 && (
          <span className={clsx(
            'absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center',
            criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          )}>
            {visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
            <span className="text-xs text-gray-400">auto-refreshes every 30s</span>
          </div>
          {visible.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              No delayed orders — all on track
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {visible.map((a) => (
                <li key={`${a.orderId}-${a.status}`} className="px-4 py-3 flex gap-3 items-start hover:bg-gray-50">
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.side === 'kitchen' ? 'Kitchen side' : 'Waiter side'} · {a.status}
                    </p>
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
