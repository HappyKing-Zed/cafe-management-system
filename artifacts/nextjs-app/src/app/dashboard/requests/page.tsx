'use client';
import { useEffect, useState, useCallback } from 'react';
import { getOrders } from '@/lib/api';
import { Order } from '@/lib/types';
import { Send, RefreshCw, Check } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';

// The journey of a waiter's request to the kitchen
const STEPS = [
  { key: 'pending', label: 'Sent' },
  { key: 'confirmed', label: 'Received by Chef' },
  { key: 'preparing', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
];

const STEP_INDEX: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, ready: 3, served: 4 };
const ACTIVE_STATUSES = Object.keys(STEP_INDEX);

function minutesAgo(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

export default function RequestsPage() {
  const { user } = useAuthStore();
  const isWaiter = user?.role === 'waiter';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await getOrders();
      setOrders((res.data || []).filter((o: Order) => ACTIVE_STATUSES.includes(o.status)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [fetchData]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <Send className="text-brand-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isWaiter ? 'My Requests' : 'Waiter Requests'}</h1>
            <p className="text-gray-500 text-sm">
              {isWaiter
                ? 'Track your order requests to the kitchen — updates every 10 seconds'
                : 'Order requests sent by waiters and their progress — updates every 10 seconds'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-400 text-sm py-16 text-center">No active requests right now.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(o => {
            const current = STEP_INDEX[o.status] ?? 0;
            return (
              <div key={o.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <p className="font-bold text-gray-900">
                      Order #{o.id} · {o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Walk-in'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {o.waiter?.name ? `Sent by ${o.waiter.name} · ` : ''}{minutesAgo(o.createdAt)} min ago
                      {o.items?.length ? ` · ${o.items.length} item${o.items.length > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full bg-brand-100 text-brand-700">
                    {STEPS[current]?.label || o.status}
                  </span>
                </div>

                {/* Progress steps */}
                <div className="flex items-center">
                  {STEPS.map((step, i) => (
                    <div key={step.key} className={clsx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
                      <div className="flex flex-col items-center">
                        <div
                          className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                            i < current && 'bg-green-500 border-green-500 text-white',
                            i === current && 'bg-brand-500 border-brand-500 text-white animate-pulse',
                            i > current && 'bg-white border-gray-300 text-gray-400'
                          )}
                        >
                          {i < current ? <Check size={14} /> : i + 1}
                        </div>
                        <span className={clsx('text-[10px] mt-1 whitespace-nowrap', i <= current ? 'text-gray-700 font-medium' : 'text-gray-400')}>
                          {step.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={clsx('flex-1 h-0.5 mx-1 mb-4', i < current ? 'bg-green-500' : 'bg-gray-200')} />
                      )}
                    </div>
                  ))}
                </div>

                {o.items && o.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    {o.items.map((it: any) => (
                      <span key={it.id}>{it.quantity}× {it.menuItem?.name || 'Item'}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
