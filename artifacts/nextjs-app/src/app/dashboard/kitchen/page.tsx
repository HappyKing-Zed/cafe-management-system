'use client';
import { useEffect, useState, useCallback } from 'react';
import { getKitchenBoard, acceptOrder, startPreparing, markReady, updateOrderItemStatus, getChefs } from '@/lib/api';
import { Order, OrderItem, OrderItemStatus, User } from '@/lib/types';
import { Clock, RefreshCw, ChefHat } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import clsx from 'clsx';

const COLUMNS = [
  { key: 'pending', label: ' New Orders', color: 'border-red-400 bg-red-50', badge: 'bg-red-500' },
  { key: 'confirmed', label: ' Accepted', color: 'border-yellow-400 bg-yellow-50', badge: 'bg-yellow-500' },
  { key: 'preparing', label: ' Preparing', color: 'border-orange-400 bg-orange-50', badge: 'bg-orange-500' },
  { key: 'completed', label: ' Completed', color: 'border-green-400 bg-green-50', badge: 'bg-green-500' },
];

function elapsed(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  return d < 1 ? 'Just now' : `${d}m ago`;
}

const orderNumber = (order: Order) => order.orderNumber ?? order.id;
const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-purple-100 text-purple-800',
};

export default function KitchenPage() {
  const { user } = useAuthStore();
  const isChef = user?.role === 'chef';
  const isCoordinator = user?.role === 'coordinator';
  const canPickChef = !!user && ['admin', 'owner', 'manager', 'coordinator'].includes(user.role);
  const canAdvanceItems = !!user && ['chef', 'admin', 'owner'].includes(user.role);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [chefTabs, setChefTabs] = useState<User[]>([]);
  const [chefTab, setChefTab] = useState('');

  useEffect(() => {
    if (!canPickChef) return;
    getChefs().then(res => setChefTabs(res.data || [])).catch(() => setChefTabs([]));
  }, [canPickChef]);

  // Chefs only see their own orders (plus new unassigned ones); others can filter by chef tab
  const orders = isChef
    ? allOrders.filter(o => o.chefId === user?.id || !o.chefId)
    : chefTab
      ? allOrders.filter(o => String(o.chefId || '') === chefTab)
      : allOrders;

  const fetchBoard = useCallback(async () => {
    try {
      const res = await getKitchenBoard();
      setAllOrders(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 10000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const handleAction = async (orderId: number, action: 'accept' | 'preparing' | 'ready') => {
    setActionLoading(orderId);
    try {
      if (action === 'accept') await acceptOrder(orderId);
      else if (action === 'preparing') await startPreparing(orderId);
      else if (action === 'ready') await markReady(orderId);
      await fetchBoard();
    } finally {
      setActionLoading(null);
    }
  };

  const handleItemAction = async (orderId: number, itemId: number, status: OrderItemStatus) => {
    setActionLoading(itemId);
    try {
      await updateOrderItemStatus(orderId, itemId, status);
      await fetchBoard();
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = orders.filter((order) => {
      const itemStatuses = order.items?.map(item => item.status).filter(Boolean);
      if (itemStatuses?.length) {
        if (col.key === 'pending') return itemStatuses.includes('pending');
        if (col.key === 'confirmed') return itemStatuses.some(status => status === 'confirmed' || status === 'accepted');
        if (col.key === 'preparing') return itemStatuses.includes('preparing');
        if (col.key === 'completed') return itemStatuses.includes('ready');
      }
      // Legacy orders without item-level status continue through the order lifecycle.
      return col.key === 'completed' ? order.status === 'ready' : order.status === col.key;
    });
    return acc;
  }, {} as Record<string, Order[]>);

  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <ChefHat className="text-orange-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kitchen Display</h1>
            <p className="text-gray-500 text-sm">Auto-refreshes every 10 seconds</p>
          </div>
        </div>
      </div>

      {/* Chef tabs for coordinators/managers/owners/admins */}
      {canPickChef && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setChefTab('')}
            className={clsx('text-xs font-medium px-3 py-1.5 rounded-lg border', !chefTab ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
            All Chefs
          </button>
          {chefTabs.map(c => (
            <button key={c.id} onClick={() => setChefTab(String(c.id))}
              className={clsx('text-xs font-medium px-3 py-1.5 rounded-lg border', chefTab === String(c.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              ‍ {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Ready orders banner */}
      {readyOrders.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border-2 border-green-400 rounded-xl flex items-center justify-between">
          <p className="text-green-800 font-semibold">✅ {readyOrders.length} order(s) ready for serving!</p>
          <div className="flex gap-2">
            {readyOrders.map(o => (
              <span key={o.id} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                #{orderNumber(o)} awaiting waiter
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500">Loading kitchen board...</p></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-2.5`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-gray-800 text-sm">{col.label}</h2>
                <span className={`${col.badge} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center`}>
                  {grouped[col.key]?.length || 0}
                </span>
              </div>
              {grouped[col.key]?.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No orders</p>
              ) : (
                <div className="space-y-2">
                  {grouped[col.key].map((order) => (
                    <div key={order.id} className="bg-white rounded-lg shadow-sm px-2.5 py-2 border border-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-gray-900 text-sm">#{orderNumber(order)}</span>
                          {order.table && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full shrink-0"> {order.table.number}</span>}
                          {order.waiter?.name && <span className="text-[10px] text-gray-400 truncate"> {order.waiter.name}</span>}
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                          <Clock size={10} /> {elapsed(order.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {order.items?.map((item: OrderItem) => {
                          const status = item.status;
                          const nextStatus: OrderItemStatus | null =
                            status === 'confirmed' ? 'accepted'
                              : status === 'accepted' ? 'preparing'
                                : status === 'preparing' ? 'ready'
                                  : null;
                          return (
                            <div key={item.id} className="rounded-md bg-gray-50 px-1.5 py-1 text-xs text-gray-700">
                              <div className="flex items-center justify-between gap-1">
                                <span>{item.quantity}× {item.menuItem?.name || 'Item'}</span>
                                {status && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${ITEM_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>}
                              </div>
                              {nextStatus && canAdvanceItems && (
                                <button
                                  onClick={() => handleItemAction(order.id, item.id, nextStatus)}
                                  disabled={actionLoading === item.id}
                                  className="mt-1 w-full rounded bg-orange-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {actionLoading === item.id ? '...' : nextStatus === 'accepted' ? 'Accept item' : nextStatus === 'preparing' ? 'Start preparing' : 'Mark item ready'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {order.notes && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-1 mt-1"> {order.notes}</p>
                      )}
                      <div className="flex gap-2 mt-1.5">
                        {isCoordinator && col.key === 'pending' && !order.items?.some(item => item.status) && (
                          <button
                            onClick={() => handleAction(order.id, 'accept')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-2 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Accept'}
                          </button>
                        )}
                        {canAdvanceItems && col.key === 'confirmed' && !order.items?.some(item => item.status) && (
                          <button
                            onClick={() => handleAction(order.id, 'preparing')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1 px-2 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Start Preparing'}
                          </button>
                        )}
                        {canAdvanceItems && col.key === 'preparing' && !order.items?.some(item => item.status) && (
                          <button
                            onClick={() => handleAction(order.id, 'ready')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Mark Ready ✓'}
                          </button>
                        )}
                        {col.key === 'completed' && (
                          <span className={`flex-1 text-center py-1 px-2 rounded-lg text-xs font-medium ${order.status === 'served' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {order.status === 'served' ? 'Served ✓' : 'Ready — waiting'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
