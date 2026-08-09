'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { getOrderStats, getDailyReport, getOrders, seedDatabase } from '@/lib/api';
import { ShoppingCart, TrendingUp, Clock, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const fetchData = async () => {
    try {
      const [statsRes, reportRes, ordersRes] = await Promise.all([
        getOrderStats(),
        getDailyReport(),
        getOrders({ status: undefined }),
      ]);
      setStats(statsRes.data);
      setReport(reportRes.data);
      setRecentOrders((ordersRes.data || []).slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedDatabase();
      setSeedMsg(res.data.message);
      fetchData();
    } catch (e: any) {
      setSeedMsg(e.response?.data?.message || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    served: 'bg-purple-100 text-purple-800',
    paid: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Selam, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening at Jima Aba Jifar today</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleSeed} disabled={seeding} className="btn-primary flex items-center gap-2">
            {seeding ? '⏳ Seeding...' : '🌱 Seed Data'}
          </button>
        </div>
      </div>

      {seedMsg && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✓ {seedMsg}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: "Today's Orders", value: stats?.todayOrders ?? '—', icon: ShoppingCart, color: 'brand', sub: 'Total orders today' },
          { label: "Today's Revenue", value: stats?.todayRevenue ? `ETB ${Number(stats.todayRevenue).toLocaleString()}` : '—', icon: TrendingUp, color: 'green', sub: 'Paid orders only' },
          { label: 'Pending Orders', value: stats?.pendingOrders ?? '—', icon: Clock, color: 'yellow', sub: 'Awaiting confirmation' },
          { label: 'In Kitchen', value: stats?.preparingOrders ?? '—', icon: CheckCircle, color: 'blue', sub: 'Currently preparing' },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{s.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color === 'brand' ? 'bg-brand-100' : s.color === 'green' ? 'bg-green-100' : s.color === 'yellow' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                <s.icon size={18} className={s.color === 'brand' ? 'text-brand-600' : s.color === 'green' ? 'text-green-600' : s.color === 'yellow' ? 'text-yellow-600' : 'text-blue-600'} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? <span className="text-gray-300">...</span> : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Payment breakdown + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Today's Revenue by Method</h2>
          {report?.byMethod ? (
            <div className="space-y-3">
              {Object.entries(report.byMethod).map(([method, amount]: any) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{method === 'cash' ? '💵' : method === 'card' ? '💳' : '📱'}</span>
                    <span className="text-sm text-gray-600 capitalize">{method}</span>
                  </div>
                  <span className="font-semibold text-gray-900">ETB {Number(amount).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="font-bold text-brand-600">ETB {Number(report?.totalRevenue || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No transactions today</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No orders yet. Click "Seed Data" to add sample data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-xs">
                      #{order.id}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {order.table?.number ? `Table ${order.table.number}` : order.customerName || 'Walk-in'}
                      </p>
                      <p className="text-xs text-gray-400">{order.items?.length || 0} items · {new Date(order.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">ETB {Number(order.totalAmount).toLocaleString()}</p>
                    <span className={`status-badge text-xs ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 card">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { href: '/dashboard/orders', icon: '🛒', label: 'New Order', color: 'bg-brand-500' },
            { href: '/dashboard/kitchen', icon: '👨‍🍳', label: 'Kitchen Board', color: 'bg-orange-500' },
            { href: '/dashboard/tables', icon: '🪑', label: 'Table Status', color: 'bg-blue-500' },
            { href: '/dashboard/inventory', icon: '📦', label: 'Low Stock Alert', color: 'bg-red-500' },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-sm font-medium text-gray-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
