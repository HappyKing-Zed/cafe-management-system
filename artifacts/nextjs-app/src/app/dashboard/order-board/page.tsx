'use client';
import { useEffect, useState, useCallback } from 'react';
import { getOrders } from '@/lib/api';
import { Order } from '@/lib/types';
import { ChefHat, Flame, CheckCircle2, ClipboardList, Clock, User } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';

const COLUMNS = [
  {
    key: 'requested',
    title: 'Requested',
    icon: ClipboardList,
    statuses: ['pending'],
    grad: 'linear-gradient(135deg, #0EA5E9, #0369A1)',
    ring: 'ring-sky-100',
    chip: 'bg-sky-50 text-sky-700',
    bar: 'bg-sky-500',
    step: 1,
  },
  {
    key: 'received',
    title: 'Received & Confirmed',
    icon: ChefHat,
    statuses: ['confirmed'],
    grad: 'linear-gradient(135deg, #F59E0B, #B45309)',
    ring: 'ring-amber-100',
    chip: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
    step: 2,
  },
  {
    key: 'progress',
    title: 'In Progress',
    icon: Flame,
    statuses: ['preparing'],
    grad: 'linear-gradient(135deg, #F97316, #C2410C)',
    ring: 'ring-orange-100',
    chip: 'bg-orange-50 text-orange-700',
    bar: 'bg-orange-500',
    step: 3,
  },
  {
    key: 'completed',
    title: 'Completed',
    icon: CheckCircle2,
    statuses: ['ready', 'served'],
    grad: 'linear-gradient(135deg, #22C55E, #15803D)',
    ring: 'ring-green-100',
    chip: 'bg-green-50 text-green-700',
    bar: 'bg-green-500',
    step: 4,
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
      <div className="rounded-2xl px-6 py-5 mb-6 text-white shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #1E293B 0%, #334155 55%, #E8832A 130%)' }}>
        <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute right-16 -bottom-14 w-36 h-36 rounded-full bg-white/5" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow" style={{ background: 'linear-gradient(135deg, #E8832A, #C2611A)' }}>
              <Flame size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Order Progress Board</h1>
              <p className="text-white/60 text-sm">
                {user?.role === 'waiter' ? 'Showing your orders only · ' : ''}Updates automatically every 10 seconds
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-white bg-white/10 border border-white/20 rounded-full px-3 py-1.5 backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => {
            const list = orders.filter(o => col.statuses.includes(o.status));
            return (
              <div key={col.key} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                {/* Column header */}
                <div className="px-4 py-3 text-white" style={{ background: col.grad }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><col.icon size={15} /></div>
                      {col.title}
                    </div>
                    <span className="text-xs font-bold bg-white/25 px-2.5 py-1 rounded-full">{list.length}</span>
                  </div>
                  {/* step dots */}
                  <div className="flex items-center gap-1 mt-2.5">
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} className={clsx('h-1 flex-1 rounded-full', s <= col.step ? 'bg-white/90' : 'bg-white/25')} />
                    ))}
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2.5 min-h-[120px] bg-gray-50/60 space-y-2">
                  {list.length === 0 ? (
                    <div className="text-center py-8">
                      <col.icon size={22} className="mx-auto text-gray-300 mb-1.5" />
                      <p className="text-xs text-gray-400">No orders here</p>
                    </div>
                  ) : (
                    list.map(o => {
                      const mins = minutesAgo(o.createdAt);
                      const slow = mins >= 20 && col.key !== 'completed';
                      return (
                        <div key={o.id} className={clsx('bg-white rounded-xl border shadow-sm px-3 py-2.5 ring-2 transition-shadow hover:shadow-md', col.ring, slow ? 'border-red-200' : 'border-gray-100')}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              #{o.id} · {o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Take Away'}
                            </p>
                            <span className={clsx('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0', col.chip)}>
                              {o.status}
                            </span>
                          </div>
                          {o.items && o.items.length > 0 && (
                            <p className="text-[11px] leading-snug text-gray-600 mb-1.5 line-clamp-2">
                              {o.items.map((it: any) => `${it.quantity}× ${it.menuItem?.name || 'Item'}`).join(', ')}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1 text-gray-400 truncate">
                              {o.waiter?.name && <><User size={10} className="shrink-0" /> {o.waiter.name}</>}
                            </span>
                            <span className={clsx('flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full shrink-0', slow ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500')}>
                              <Clock size={10} /> {mins}m{slow ? ' ⚠' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
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
