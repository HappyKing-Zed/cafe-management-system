'use client';
import { useEffect, useState, useCallback } from 'react';
import { getOrders } from '@/lib/api';
import { Order } from '@/lib/types';
import { ChefHat, Flame, CheckCircle2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';

const COLUMNS = [
  {
    key: 'received',
    title: 'Received by Chef',
    icon: ChefHat,
    statuses: ['pending', 'confirmed'],
    accent: 'border-t-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    key: 'progress',
    title: 'In Progress',
    icon: Flame,
    statuses: ['preparing'],
    accent: 'border-t-orange-500',
    badge: 'bg-orange-100 text-orange-800',
  },
  {
    key: 'completed',
    title: 'Completed',
    icon: CheckCircle2,
    statuses: ['ready', 'served'],
    accent: 'border-t-green-500',
    badge: 'bg-green-100 text-green-800',
  },
];

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served'];

function minutesAgo(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

export default function OrderBoardPage() {
  const { user } = useAuthStore();
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Progress Board</h1>
          <p className="text-gray-500 text-sm">
            {user?.role === 'waiter' ? 'Showing your orders only · ' : ''}Updates automatically every 10 seconds
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {COLUMNS.map(col => {
            const list = orders.filter(o => col.statuses.includes(o.status));
            return (
              <div key={col.key} className={clsx('bg-gray-50 rounded-xl border border-gray-200 border-t-4', col.accent)}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 font-semibold text-gray-800">
                    <col.icon size={18} />
                    {col.title}
                  </div>
                  <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', col.badge)}>{list.length}</span>
                </div>
                <div className="p-3 space-y-3 min-h-[120px]">
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No orders</p>
                  ) : (
                    list.map(o => (
                      <div key={o.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-gray-900">#{o.id} · {o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Walk-in'}</p>
                          <span className={clsx('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', col.badge)}>
                            {o.status}
                          </span>
                        </div>
                        {o.items && o.items.length > 0 && (
                          <ul className="text-xs text-gray-600 space-y-0.5 mb-1.5">
                            {o.items.slice(0, 4).map((it: any) => (
                              <li key={it.id}>{it.quantity}× {it.menuItem?.name || 'Item'}</li>
                            ))}
                            {o.items.length > 4 && <li className="text-gray-400">+{o.items.length - 4} more…</li>}
                          </ul>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{o.waiter?.name ? `Waiter: ${o.waiter.name}` : ''}</span>
                          <span>{minutesAgo(o.createdAt)} min ago</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
