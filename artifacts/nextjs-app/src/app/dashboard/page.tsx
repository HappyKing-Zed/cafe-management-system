'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { getOrderStats, getDailyReport, getOrders, getKitchenBoard, getInventoryItems, getLowStockItems, seedDatabase } from '@/lib/api';
import { ShoppingCart, TrendingUp, Clock, CheckCircle, RefreshCw, ChefHat, Package, HandPlatter, Wallet } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-purple-100 text-purple-800',
  paid: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const iconBg: Record<string, string> = {
  brand: 'bg-brand-100 text-brand-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  blue: 'bg-blue-100 text-blue-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
};

function StatCards({ cards, loading }: { cards: Array<{ label: string; value: any; icon: any; color: string; sub: string }>; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {cards.map((s) => (
        <div key={s.label} className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">{s.label}</span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg[s.color] || iconBg.brand}`}>
              <s.icon size={18} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? <span className="text-gray-300">...</span> : s.value}</p>
          <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

function OrderList({ title, orders, linkLabel, href }: { title: string; orders: any[]; linkLabel: string; href: string }) {
  return (
    <div className="card lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <Link href={href} className="text-sm text-brand-600 hover:text-brand-700 font-medium">{linkLabel} →</Link>
      </div>
      {orders.length === 0 ? (
        <div className="text-center py-8"><p className="text-gray-400 text-sm">No orders yet</p></div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-xs">#{order.id}</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {order.table?.number ? `Table ${order.table.number}` : order.customerName || 'Walk-in'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.items?.length || 0} items · {new Date(order.createdAt).toLocaleTimeString()}
                    {order.waiter?.name ? ` · Waiter: ${order.waiter.name}` : ''}
                  </p>
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
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role || '';
  const [stats, setStats] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [board, setBoard] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const isManager = ['admin', 'owner', 'manager'].includes(role);
  const isKitchen = ['chef', 'coordinator'].includes(role);
  const isCashier = role === 'cashier';
  const isWaiter = role === 'waiter';
  const isStore = role === 'storekeeper';

  // Waiters land on Orders / POS — the Dashboard page is not part of their menu
  const router = useRouter();
  useEffect(() => { if (isWaiter || role === 'coordinator') router.replace('/dashboard/orders'); }, [isWaiter, role, router]);

  const fetchData = async () => {
    if (!role) return;
    try {
      const jobs: Promise<any>[] = [];
      jobs.push((isManager || isKitchen || isCashier || isWaiter) ? getOrderStats().then(r => setStats(r.data)).catch(() => {}) : Promise.resolve());
      jobs.push((isManager || isCashier) ? getDailyReport().then(r => setReport(r.data)).catch(() => {}) : Promise.resolve());
      jobs.push((isManager || isCashier || isWaiter) ? getOrders().then(r => setOrders(r.data || [])).catch(() => {}) : Promise.resolve());
      jobs.push((isManager || isKitchen) ? getKitchenBoard().then(r => setBoard(r.data || [])).catch(() => {}) : Promise.resolve());
      jobs.push((isManager || isStore) ? getInventoryItems().then(r => setInventory(r.data || [])).catch(() => {}) : Promise.resolve());
      jobs.push((isManager || isStore) ? getLowStockItems().then(r => setLowStock(r.data || [])).catch(() => {}) : Promise.resolve());
      await Promise.all(jobs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [role]);

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

  // Role-specific derived numbers (real transaction data)
  const myActive = orders.filter(o => !['paid', 'cancelled'].includes(o.status));
  const myReady = orders.filter(o => o.status === 'ready');
  const servedAwaitingPay = orders.filter(o => o.status === 'served');
  const paidToday = orders.filter(o => o.status === 'paid' && new Date(o.createdAt).toDateString() === new Date().toDateString());
  const boardNew = board.filter(o => o.status === 'pending');
  const boardCooking = board.filter(o => ['confirmed', 'preparing'].includes(o.status));
  const boardDone = board.filter(o => ['ready', 'served'].includes(o.status));

  let cards: Array<{ label: string; value: any; icon: any; color: string; sub: string }> = [];
  if (isManager) {
    cards = [
      { label: "Today's Orders", value: stats?.todayOrders ?? '—', icon: ShoppingCart, color: 'brand', sub: 'Total orders today' },
      { label: "Today's Revenue", value: stats?.todayRevenue ? `ETB ${Number(stats.todayRevenue).toLocaleString()}` : 'ETB 0', icon: TrendingUp, color: 'green', sub: 'Paid orders only' },
      { label: 'Pending Orders', value: stats?.pendingOrders ?? '—', icon: Clock, color: 'yellow', sub: 'Awaiting confirmation' },
      { label: 'In Kitchen', value: stats?.preparingOrders ?? '—', icon: CheckCircle, color: 'blue', sub: 'Currently preparing' },
    ];
  } else if (isWaiter) {
    cards = [
      { label: 'My Active Orders', value: myActive.length, icon: ShoppingCart, color: 'brand', sub: 'Orders in progress' },
      { label: 'Ready to Serve', value: myReady.length, icon: HandPlatter, color: 'green', sub: 'Pick up from kitchen now' },
      { label: 'Awaiting Payment', value: servedAwaitingPay.length, icon: Wallet, color: 'purple', sub: 'Served, cashier to confirm' },
      { label: 'Completed Today', value: paidToday.length, icon: CheckCircle, color: 'blue', sub: 'Paid orders today' },
    ];
  } else if (isKitchen) {
    cards = [
      { label: 'New Orders', value: boardNew.length, icon: ShoppingCart, color: 'red', sub: 'Waiting to be accepted' },
      { label: 'Cooking Now', value: boardCooking.length, icon: ChefHat, color: 'orange', sub: 'Accepted + preparing' },
      { label: 'Completed Today', value: boardDone.length, icon: CheckCircle, color: 'green', sub: 'Ready or served today' },
      { label: 'Pending Total', value: stats?.pendingOrders ?? '—', icon: Clock, color: 'yellow', sub: 'All unconfirmed orders' },
    ];
  } else if (isCashier) {
    cards = [
      { label: "Today's Revenue", value: report ? `ETB ${Number(report.totalRevenue || 0).toLocaleString()}` : 'ETB 0', icon: TrendingUp, color: 'green', sub: `${report?.transactionCount || 0} transactions` },
      { label: 'Awaiting Payment', value: servedAwaitingPay.length, icon: Wallet, color: 'purple', sub: 'Served orders to collect' },
      { label: "Today's Orders", value: stats?.todayOrders ?? '—', icon: ShoppingCart, color: 'brand', sub: 'Total orders today' },
      { label: 'Completed Today', value: paidToday.length, icon: CheckCircle, color: 'blue', sub: 'Paid orders today' },
    ];
  } else if (isStore) {
    const totalValue = inventory.reduce((s, i) => s + Number(i.currentStock || 0) * Number(i.costPerUnit || 0), 0);
    cards = [
      { label: 'Inventory Items', value: inventory.length, icon: Package, color: 'brand', sub: 'Items tracked' },
      { label: 'Low Stock', value: lowStock.length, icon: Clock, color: 'red', sub: 'Below reorder level' },
      { label: 'Stock Value', value: `ETB ${totalValue.toLocaleString()}`, icon: TrendingUp, color: 'green', sub: 'Estimated total value' },
      { label: 'Healthy Items', value: Math.max(inventory.length - lowStock.length, 0), icon: CheckCircle, color: 'blue', sub: 'Stock above reorder level' },
    ];
  }

  const quickActions = isWaiter
    ? [
        { href: '/dashboard/orders', icon: '🛒', label: 'New Order' },
        { href: '/dashboard/requests', icon: '📨', label: 'My Requests' },
        { href: '/dashboard/order-board', icon: '📋', label: 'Order Board' },
        { href: '/dashboard/tables', icon: '🪑', label: 'Tables' },
      ]
    : isKitchen
    ? [
        { href: '/dashboard/kitchen', icon: '👨‍🍳', label: 'Kitchen Board' },
        { href: '/dashboard/order-board', icon: '📋', label: 'Order Board' },
        { href: '/dashboard/requests', icon: '📨', label: 'Waiter Requests' },
        { href: '/dashboard/orders', icon: '🛒', label: 'Orders' },
      ]
    : isCashier
    ? [
        { href: '/dashboard/payments', icon: '💵', label: 'Payments' },
        { href: '/dashboard/orders', icon: '🛒', label: 'Orders' },
        { href: '/dashboard/order-board', icon: '📋', label: 'Order Board' },
        { href: '/dashboard/tables', icon: '🪑', label: 'Tables' },
      ]
    : isStore
    ? [
        { href: '/dashboard/inventory', icon: '📦', label: 'Inventory' },
        { href: '/dashboard/order-board', icon: '📋', label: 'Order Board' },
      ]
    : [
        { href: '/dashboard/orders', icon: '🛒', label: 'New Order' },
        { href: '/dashboard/kitchen', icon: '👨‍🍳', label: 'Kitchen Board' },
        { href: '/dashboard/tables', icon: '🪑', label: 'Table Status' },
        { href: '/dashboard/inventory', icon: '📦', label: 'Low Stock Alert' },
      ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selam, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 mt-1">
            {isWaiter ? 'Here is how your orders are doing' :
             isKitchen ? "Here is what's happening in the kitchen" :
             isCashier ? "Here is today's money flow" :
             isStore ? 'Here is your stock at a glance' :
             "Here's what's happening at Jima Aba Jifar today"}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
          {['admin', 'owner'].includes(role) && (
            <button onClick={handleSeed} disabled={seeding} className="btn-primary flex items-center gap-2">
              {seeding ? '⏳ Seeding...' : '🌱 Seed Data'}
            </button>
          )}
        </div>
      </div>

      {seedMsg && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">✓ {seedMsg}</div>
      )}

      <StatCards cards={cards} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel varies by role */}
        {(isManager || isCashier) && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Today's Revenue by Method</h2>
            {report?.byMethod && Object.keys(report.byMethod).length > 0 ? (
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
        )}

        {isKitchen && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Kitchen Queue</h2>
            {board.length === 0 ? (
              <p className="text-gray-400 text-sm">Kitchen is clear 🎉</p>
            ) : (
              <div className="space-y-3">
                {board.filter(o => !['ready', 'served'].includes(o.status)).slice(0, 6).map((o) => (
                  <div key={o.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">#{o.id} · {o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Walk-in'}</p>
                      <p className="text-xs text-gray-400">{o.waiter?.name ? `Waiter: ${o.waiter.name}` : ''}</p>
                    </div>
                    <span className={`status-badge text-xs ${statusColors[o.status]}`}>{o.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isWaiter && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Ready to Serve</h2>
            {myReady.length === 0 ? (
              <p className="text-gray-400 text-sm">Nothing waiting — great job!</p>
            ) : (
              <div className="space-y-3">
                {myReady.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-800">#{o.id} · {o.table?.number ? `Table ${o.table.number}` : o.customerName || 'Walk-in'}</p>
                    <Link href="/dashboard/orders" className="text-xs font-semibold text-green-700 hover:underline">Serve →</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isStore && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Low Stock Items</h2>
            {lowStock.length === 0 ? (
              <p className="text-gray-400 text-sm">All stock levels are healthy</p>
            ) : (
              <div className="space-y-3">
                {lowStock.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{i.name}</p>
                    <span className="text-xs font-semibold text-red-600">{Number(i.currentStock)} {i.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders list */}
        {(isManager || isCashier) && (
          <OrderList title="Recent Orders" orders={orders.slice(0, 5)} linkLabel="View all" href="/dashboard/orders" />
        )}
        {isWaiter && (
          <OrderList title="My Orders" orders={myActive.slice(0, 5)} linkLabel="View all" href="/dashboard/orders" />
        )}
        {isKitchen && (
          <OrderList title="Incoming Orders" orders={boardNew.slice(0, 5)} linkLabel="Open kitchen board" href="/dashboard/kitchen" />
        )}
        {isStore && (
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Inventory Overview</h2>
              <Link href="/dashboard/inventory" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Open inventory →</Link>
            </div>
            {inventory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No inventory items for your branch yet</p>
            ) : (
              <div className="space-y-2">
                {inventory.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-900">{i.name}</p>
                    <span className={`text-xs font-semibold ${lowStock.some(l => l.id === i.id) ? 'text-red-600' : 'text-gray-600'}`}>
                      {Number(i.currentStock)} {i.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 card">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickActions.map((a) => (
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
