'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  getOrderStats, getOrders, getPayments, getInventoryItems, getLowStockItems, getStockAdjustments,
} from '@/lib/api';
import {
  TrendingUp, ShoppingCart, Wallet, Flame, Package, AlertTriangle, Timer, BarChart3, LayoutDashboard, ChefHat, Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';

const IN_PROGRESS = ['pending', 'confirmed', 'preparing'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308', confirmed: '#3B82F6', preparing: '#F97316', ready: '#22C55E', served: '#A855F7', paid: '#6B7280', cancelled: '#EF4444',
};

export default function ManagerDashboard() {
  const [tab, setTab] = useState<'Dashboard' | 'Analytics'>('Dashboard');
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
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 6);
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
  const topValueItems = [...inventory].sort((a: any, b: any) => Number(b.currentStock) * Number(b.unitCost || 0) - Number(a.currentStock) * Number(a.unitCost || 0)).slice(0, 5);

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
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([['Dashboard', LayoutDashboard], ['Analytics', BarChart3]] as const).map(([t, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors', tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={16} /> {t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <>
          {/* Hero + stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 mb-6">
            <div className="xl:col-span-1 rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #E8832A 0%, #C2611A 100%)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white/80">Today's Sales</span>
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><TrendingUp size={18} /></div>
              </div>
              <p className="text-3xl font-bold">{loading ? '…' : fmt(todaySales)}</p>
              <p className="text-xs text-white/70 mt-1">{todayPayments.length} payment{todayPayments.length === 1 ? '' : 's'} received</p>
            </div>
            {[
              { label: "Today's Orders", value: loading ? '…' : todayOrders, icon: ShoppingCart, grad: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', sub: 'All orders placed today' },
              { label: 'Average Order Value', value: loading ? '…' : fmt(avgOrderValue), icon: Wallet, grad: 'linear-gradient(135deg, #22C55E, #15803D)', sub: 'Per paid order today' },
              { label: 'Orders In Progress', value: loading ? '…' : inProgress.length, icon: Flame, grad: 'linear-gradient(135deg, #F97316, #C2410C)', sub: 'Pending · confirmed · preparing' },
              { label: 'Low Stock Items', value: loading ? '…' : lowStock.length, icon: AlertTriangle, grad: 'linear-gradient(135deg, #EF4444, #B91C1C)', sub: 'Below minimum level' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-5 text-white shadow-lg" style={{ background: c.grad }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white/80">{c.label}</span>
                  <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><c.icon size={18} /></div>
                </div>
                <p className="text-3xl font-bold">{c.value}</p>
                <p className="text-xs text-white/70 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Detail lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><Flame size={17} className="text-orange-500" /> Orders In Progress</h2>
                <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
              </div>
              {inProgress.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">No orders in progress right now</p> : (
                <div className="space-y-2.5">
                  {inProgress.slice(0, 7).map(o => (
                    <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 font-bold text-xs">#{o.id}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Take Away'}</p>
                          <p className="text-xs text-gray-400">{o.items?.length || 0} items · {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fmt(Number(o.totalAmount))}</p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: `${STATUS_COLORS[o.status]}20`, color: STATUS_COLORS[o.status] }}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle size={17} className="text-red-500" /> Low Stock Items</h2>
                <Link href="/dashboard/inventory" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Open inventory →</Link>
              </div>
              {lowStock.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">All stock levels are healthy 🎉</p> : (
                <div className="space-y-2.5">
                  {lowStock.slice(0, 7).map((i: any) => {
                    const pct = Number(i.minStock) > 0 ? Math.min(100, (Number(i.currentStock) / Number(i.minStock)) * 100) : 0;
                    const critical = Number(i.currentStock) <= Number(i.minStock) / 2;
                    return (
                      <div key={i.id} className="py-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">{i.name}</p>
                          <span className={clsx('text-xs font-bold', critical ? 'text-red-600' : 'text-amber-600')}>{Number(i.currentStock)} / {Number(i.minStock)} {i.unit}</span>
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
        </>
      )}

      {tab === 'Analytics' && (
        <div className="space-y-6">
          {/* Sales Trend */}
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><TrendingUp size={17} className="text-brand-500" /> Sales Trend</h2>
            <p className="text-xs text-gray-400 mb-4">Daily sales over the last 14 days</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8832A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#E8832A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <Tooltip formatter={(v: any) => [`ETB ${Number(v).toLocaleString()}`, 'Sales']} />
                  <Area type="monotone" dataKey="sales" stroke="#E8832A" strokeWidth={2.5} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top selling */}
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><Trophy size={17} className="text-yellow-500" /> Top-Selling Menu Items</h2>
              <p className="text-xs text-gray-400 mb-4">By quantity sold (all time)</p>
              {topItems.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">No sales yet</p> : (
                <div className="space-y-3">
                  {topItems.map((i, idx) => {
                    const max = topItems[0].qty || 1;
                    return (
                      <div key={i.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{idx + 1}. {i.name}</span>
                          <span className="text-xs text-gray-500 font-semibold">{i.qty} sold · {fmt(i.revenue)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(i.qty / max) * 100}%`, background: 'linear-gradient(90deg, #E8832A, #F5A623)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Profitability */}
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><Wallet size={17} className="text-green-600" /> Profitability / Gross Margin</h2>
              <p className="text-xs text-gray-400 mb-4">Revenue vs estimated ingredient cost (from stock usage)</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Revenue</p>
                  <p className="text-lg font-bold text-green-700">{fmt(totalRevenue)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Food Cost</p>
                  <p className="text-lg font-bold text-orange-700">{fmt(foodCost)}</p>
                </div>
                <div className="bg-brand-50 rounded-xl p-3 text-center" style={{ background: '#FDF3E7' }}>
                  <p className="text-xs text-gray-500 mb-1">Gross Margin</p>
                  <p className="text-lg font-bold text-brand-600">{fmt(grossMargin)}</p>
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">Gross margin</span>
                <span className="text-sm font-bold text-gray-900">{marginPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                <div className="h-3 rounded-full" style={{ width: `${Math.max(0, Math.min(100, marginPct))}%`, background: 'linear-gradient(90deg, #22C55E, #15803D)' }} />
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">Food cost ratio</span>
                <span className="text-sm font-bold text-gray-900">{foodCostPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="h-3 rounded-full" style={{ width: `${Math.max(0, Math.min(100, foodCostPct))}%`, background: 'linear-gradient(90deg, #F97316, #C2410C)' }} />
              </div>
            </div>

            {/* Inventory & Food Cost */}
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><Package size={17} className="text-blue-600" /> Inventory & Food Cost</h2>
              <p className="text-xs text-gray-400 mb-4">Current stock value and biggest holdings</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Stock Value</p>
                  <p className="text-lg font-bold text-blue-700">{fmt(stockValue)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Waste Cost</p>
                  <p className="text-lg font-bold text-red-600">{fmt(wasteCost)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Low Stock</p>
                  <p className="text-lg font-bold text-amber-600">{lowStock.length}</p>
                </div>
              </div>
              {topValueItems.length === 0 ? <p className="text-gray-400 text-sm text-center">No inventory yet</p> : (
                <div className="space-y-2">
                  {topValueItems.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <p className="text-sm text-gray-800">{i.name}</p>
                      <span className="text-xs font-semibold text-gray-600">{fmt(Number(i.currentStock) * Number(i.unitCost || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order & Kitchen performance */}
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><ChefHat size={17} className="text-purple-600" /> Order & Kitchen Performance</h2>
              <p className="text-xs text-gray-400 mb-4">Order pipeline and speed</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Timer size={12} /> Avg Fulfillment</p>
                  <p className="text-lg font-bold text-purple-700">{avgFulfillMins.toFixed(0)} min</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cancellation Rate</p>
                  <p className="text-lg font-bold text-red-600">{cancelRate.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, 'Orders']} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map(s => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
