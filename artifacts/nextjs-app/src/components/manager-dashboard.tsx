'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  getOrderStats, getOrders, getPayments, getInventoryItems, getLowStockItems, getStockAdjustments,
} from '@/lib/api';
import {
  TrendingUp, ShoppingCart, Wallet, Flame, Package, AlertTriangle, Timer, ChefHat, Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';

const IN_PROGRESS = ['pending', 'confirmed', 'preparing'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308', confirmed: '#3B82F6', preparing: '#F97316', ready: '#22C55E', served: '#A855F7', paid: '#6B7280', cancelled: '#EF4444',
};

export default function ManagerDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [st, or, pa, inv, low, mov] = await Promise.all([
        getOrderStats().catch(() => ({ data: null })),
        getOrders().catch(() => ({ data: [] })),
        getPayments().catch(() => ({ data: [] })),
        getInventoryItems().catch(() => ({ data: [] })),
        getLowStockItems().catch(() => ({ data: [] })),
        getStockAdjustments().catch(() => ({ data: [] })),
      ]);
      setStats(st.data);
      setOrders(or.data || []);
      setPayments(pa.data || []);
      setInventory(inv.data || []);
      setLowStock(low.data || []);
      setMovements(mov.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore */ }); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snapshot numbers ─────────────────────────────────────────────
  const todayStr = new Date().toDateString();
  const todayPayments = payments.filter(p => new Date(p.createdAt).toDateString() === todayStr);
  const todaySales = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const todayOrders = stats?.todayOrders ?? orders.filter(o => new Date(o.createdAt).toDateString() === todayStr).length;
  const avgOrderValue = todayPayments.length > 0 ? todaySales / todayPayments.length : 0;
  const inProgress = orders.filter(o => IN_PROGRESS.includes(o.status));

  // ── Analytics ────────────────────────────────────────────────────
  const salesTrend = useMemo(() => {
    const days: { day: string; sales: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const sales = payments.filter(p => new Date(p.createdAt).toDateString() === key).reduce((s, p) => s + Number(p.amount), 0);
      days.push({ day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), sales });
    }
    return days;
  }, [payments]);

  const topItems = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => (o.items || []).forEach((i: any) => {
      const name = i.menuItem?.name || 'Unknown';
      map[name] = map[name] || { name, qty: 0, revenue: 0 };
      map[name].qty += Number(i.quantity);
      map[name].revenue += Number(i.quantity) * Number(i.unitPrice ?? i.menuItem?.price ?? 0);
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 4);
  }, [orders]);

  const unitCostByName = useMemo(() => {
    const m: Record<string, number> = {};
    inventory.forEach((i: any) => { m[i.name] = Number(i.unitCost || 0); });
    return m;
  }, [inventory]);

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const usageMovs = movements.filter((m: any) => ['deduction', 'waste'].includes(m.type));
  const foodCost = usageMovs.reduce((s: number, m: any) => s + Number(m.quantity) * (unitCostByName[m.inventoryItem?.name] || 0), 0);
  const wasteCost = movements.filter((m: any) => m.type === 'waste').reduce((s: number, m: any) => s + Number(m.quantity) * (unitCostByName[m.inventoryItem?.name] || 0), 0);
  const grossMargin = totalRevenue - foodCost;
  const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
  const foodCostPct = totalRevenue > 0 ? (foodCost / totalRevenue) * 100 : 0;

  const stockValue = inventory.reduce((s: number, i: any) => s + Number(i.currentStock || 0) * Number(i.unitCost || 0), 0);

  const statusData = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map(s => ({
    status: s, count: orders.filter(o => o.status === s).length,
  }));
  const doneOrders = orders.filter(o => ['ready', 'served', 'paid'].includes(o.status) && o.updatedAt);
  const avgFulfillMins = doneOrders.length > 0
    ? doneOrders.reduce((s, o) => s + Math.max(0, (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000), 0) / doneOrders.length
    : 0;
  const cancelRate = orders.length > 0 ? (orders.filter(o => o.status === 'cancelled').length / orders.length) * 100 : 0;

  const fmt = (n: number) => `ETB ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Row 1: compact stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Today's Sales", value: loading ? '…' : fmt(todaySales), icon: TrendingUp, grad: 'linear-gradient(135deg, #E8832A, #C2611A)' },
          { label: "Today's Orders", value: loading ? '…' : todayOrders, icon: ShoppingCart, grad: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' },
          { label: 'Avg Order Value', value: loading ? '…' : fmt(avgOrderValue), icon: Wallet, grad: 'linear-gradient(135deg, #22C55E, #15803D)' },
          { label: 'In Progress', value: loading ? '…' : inProgress.length, icon: Flame, grad: 'linear-gradient(135deg, #F97316, #C2410C)' },
          { label: 'Low Stock', value: loading ? '…' : lowStock.length, icon: AlertTriangle, grad: 'linear-gradient(135deg, #EF4444, #B91C1C)' },
          { label: 'Stock Value', value: loading ? '…' : fmt(stockValue), icon: Package, grad: 'linear-gradient(135deg, #6366F1, #4338CA)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl px-3.5 py-3 text-white shadow" style={{ background: c.grad }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/80 truncate">{c.label}</span>
              <c.icon size={14} className="shrink-0 opacity-80" />
            </div>
            <p className="text-lg font-bold leading-tight mt-1 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Sales trend + Orders in progress + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><TrendingUp size={15} className="text-brand-500" /> Sales Trend <span className="text-[11px] font-normal text-gray-400">14 days</span></h2>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8832A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E8832A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip formatter={(v: any) => [`ETB ${Number(v).toLocaleString()}`, 'Sales']} />
                <Area type="monotone" dataKey="sales" stroke="#E8832A" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card !p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Flame size={15} className="text-orange-500" /> Orders In Progress</h2>
            <Link href="/dashboard/orders" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
          </div>
          {inProgress.length === 0 ? <p className="text-gray-400 text-xs py-6 text-center">No orders in progress right now</p> : (
            <div>
              {inProgress.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 font-bold text-[10px] shrink-0">#{o.id}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Take Away'}</p>
                      <p className="text-[10px] text-gray-400">{o.items?.length || 0} items · {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{fmt(Number(o.totalAmount))}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ background: `${STATUS_COLORS[o.status]}20`, color: STATUS_COLORS[o.status] }}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card !p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><AlertTriangle size={15} className="text-red-500" /> Low Stock Items</h2>
            <Link href="/dashboard/inventory" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Inventory →</Link>
          </div>
          {lowStock.length === 0 ? <p className="text-gray-400 text-xs py-6 text-center">All stock levels are healthy 🎉</p> : (
            <div>
              {lowStock.slice(0, 4).map((i: any) => {
                const pct = Number(i.minStock) > 0 ? Math.min(100, (Number(i.currentStock) / Number(i.minStock)) * 100) : 0;
                const critical = Number(i.currentStock) <= Number(i.minStock) / 2;
                return (
                  <div key={i.id} className="py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{i.name}</p>
                      <span className={clsx('text-[10px] font-bold shrink-0 ml-2', critical ? 'text-red-600' : 'text-amber-600')}>{Number(i.currentStock)} / {Number(i.minStock)} {i.unit}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={clsx('h-1.5 rounded-full', critical ? 'bg-red-500' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Top sellers + Profitability + Kitchen performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card !p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Trophy size={15} className="text-yellow-500" /> Top-Selling Items</h2>
          {topItems.length === 0 ? <p className="text-gray-400 text-xs py-6 text-center">No sales yet</p> : (
            <div className="space-y-2.5">
              {topItems.map((i, idx) => {
                const max = topItems[0].qty || 1;
                return (
                  <div key={i.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-800 truncate">{idx + 1}. {i.name}</span>
                      <span className="text-[10px] text-gray-500 font-semibold shrink-0 ml-2">{i.qty} sold · {fmt(i.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(i.qty / max) * 100}%`, background: 'linear-gradient(90deg, #E8832A, #F5A623)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card !p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Wallet size={15} className="text-green-600" /> Profitability</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500">Revenue</p>
              <p className="text-sm font-bold text-green-700 truncate">{fmt(totalRevenue)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500">Food Cost</p>
              <p className="text-sm font-bold text-orange-700 truncate">{fmt(foodCost)}</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#FDF3E7' }}>
              <p className="text-[10px] text-gray-500">Margin</p>
              <p className="text-sm font-bold text-brand-600 truncate">{fmt(grossMargin)}</p>
            </div>
          </div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-600">Gross margin</span>
            <span className="text-xs font-bold text-gray-900">{marginPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, marginPct))}%`, background: 'linear-gradient(90deg, #22C55E, #15803D)' }} />
          </div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-600">Food cost ratio</span>
            <span className="text-xs font-bold text-gray-900">{foodCostPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, foodCostPct))}%`, background: 'linear-gradient(90deg, #F97316, #C2410C)' }} />
          </div>
          <div className="flex items-center justify-between text-xs bg-red-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-600">Waste cost</span>
            <span className="font-bold text-red-600">{fmt(wasteCost)}</span>
          </div>
        </div>

        <div className="card !p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><ChefHat size={15} className="text-purple-600" /> Kitchen Performance</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1"><Timer size={11} /> Avg Fulfillment</p>
              <p className="text-sm font-bold text-purple-700">{avgFulfillMins.toFixed(0)} min</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-500">Cancellation Rate</p>
              <p className="text-sm font-bold text-red-600">{cancelRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [v, 'Orders']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.map(s => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
