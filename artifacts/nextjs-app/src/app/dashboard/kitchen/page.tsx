'use client';
import { useEffect, useState, useCallback } from 'react';
import { getKitchenBoard, acceptOrder, startPreparing, markReady, updateOrderStatus } from '@/lib/api';
import { Order } from '@/lib/types';
import { Clock, RefreshCw, ChefHat } from 'lucide-react';

const COLUMNS = [
  { key: 'pending', label: '🔴 New Orders', color: 'border-red-400 bg-red-50', badge: 'bg-red-500' },
  { key: 'confirmed', label: '🟡 Accepted', color: 'border-yellow-400 bg-yellow-50', badge: 'bg-yellow-500' },
  { key: 'preparing', label: '🟠 Preparing', color: 'border-orange-400 bg-orange-50', badge: 'bg-orange-500' },
  { key: 'completed', label: '🟢 Completed', color: 'border-green-400 bg-green-50', badge: 'bg-green-500' },
];

function elapsed(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  return d < 1 ? 'Just now' : `${d}m ago`;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await getKitchenBoard();
      setOrders(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 15000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const handleAction = async (orderId: number, action: 'accept' | 'preparing' | 'ready' | 'served') => {
    setActionLoading(orderId);
    try {
      if (action === 'accept') await acceptOrder(orderId);
      else if (action === 'preparing') await startPreparing(orderId);
      else if (action === 'ready') await markReady(orderId);
      else if (action === 'served') await updateOrderStatus(orderId, 'served');
      await fetchBoard();
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = col.key === 'completed'
      ? orders.filter(o => o.status === 'ready' || o.status === 'served')
      : orders.filter(o => o.status === col.key);
    return acc;
  }, {} as Record<string, Order[]>);

  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <ChefHat className="text-orange-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kitchen Display</h1>
            <p className="text-gray-500 text-sm">Auto-refreshes every 15 seconds</p>
          </div>
        </div>
        <button onClick={fetchBoard} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Ready orders banner */}
      {readyOrders.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border-2 border-green-400 rounded-xl flex items-center justify-between">
          <p className="text-green-800 font-semibold">✅ {readyOrders.length} order(s) ready for serving!</p>
          <div className="flex gap-2">
            {readyOrders.map(o => (
              <button key={o.id} onClick={() => handleAction(o.id, 'served')} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">
                Mark #{o.id} Served
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500">Loading kitchen board...</p></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800">{col.label}</h2>
                <span className={`${col.badge} text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center`}>
                  {grouped[col.key]?.length || 0}
                </span>
              </div>
              {grouped[col.key]?.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No orders</p>
              ) : (
                <div className="space-y-3">
                  {grouped[col.key].map((order) => (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm p-4 border border-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">Order #{order.id}</span>
                          {order.table && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🪑 {order.table.number}</span>}
                        </div>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} /> {elapsed(order.createdAt)}
                        </span>
                      </div>
                      {order.waiter?.name && (
                        <p className="text-xs text-gray-500 mb-2">👤 Waiter: {order.waiter.name}</p>
                      )}
                      <div className="space-y-1 mb-3">
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-700">• {item.menuItem?.name}</span>
                            <span className="font-semibold text-gray-900">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">📝 {order.notes}</p>
                      )}
                      <div className="flex gap-2">
                        {col.key === 'pending' && (
                          <button
                            onClick={() => handleAction(order.id, 'accept')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Accept'}
                          </button>
                        )}
                        {col.key === 'confirmed' && (
                          <button
                            onClick={() => handleAction(order.id, 'preparing')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Start Preparing'}
                          </button>
                        )}
                        {col.key === 'preparing' && (
                          <button
                            onClick={() => handleAction(order.id, 'ready')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '...' : 'Mark Ready ✓'}
                          </button>
                        )}
                        {col.key === 'completed' && (
                          <span className={`flex-1 text-center py-1.5 px-3 rounded-lg text-sm font-medium ${order.status === 'served' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {order.status === 'served' ? 'Served ✓' : 'Ready — waiting for waiter'}
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
