'use client';
import { useEffect, useState, useCallback } from 'react';
import { getKitchenBoard, getKitchenWorkers, assignOrderItems, updateOrderItemStatus } from '@/lib/api';
import { Order, OrderItem, OrderItemStatus, User } from '@/lib/types';
import { Clock, ChefHat } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { ROLE_LABELS } from '@/lib/auth';

const COLUMNS = [
  { key: 'confirmed', label: 'New Orders', color: 'border-yellow-400 bg-yellow-50', badge: 'bg-yellow-500' },
  { key: 'accepted', label: 'Accepted', color: 'border-indigo-400 bg-indigo-50', badge: 'bg-indigo-500' },
  { key: 'preparing', label: 'Preparing', color: 'border-orange-400 bg-orange-50', badge: 'bg-orange-500' },
  { key: 'ready', label: 'Ready to Serve', color: 'border-green-400 bg-green-50', badge: 'bg-green-500' },
] as const;

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
const KITCHEN_STATUS_LABELS: Record<string, string> = {
  confirmed: 'New Order',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready to Serve',
};

export default function KitchenPage() {
  const { user } = useAuthStore();
  const isCoordinator = user?.role === 'coordinator';
  const isKitchenWorker = !!user && ['chef', 'chef_main_kitchen', 'bar_man', 'juice_maker', 'coffee_lady'].includes(user.role);
  const canAdvanceItems = isCoordinator || isKitchenWorker;
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [kitchenWorkers, setKitchenWorkers] = useState<User[]>([]);
  const [assignmentSelections, setAssignmentSelections] = useState<Record<number, string>>({});

  // The API scopes workers to their own assignments. This extra filter prevents stale
  // responses from ever exposing another worker's items after a role/session change.
  const orders = isKitchenWorker
    ? allOrders.map(order => ({
        ...order,
        items: order.items?.filter(item => item.assignedKitchenWorkerId === user?.id) || [],
      })).filter(order => order.items.length > 0)
    : allOrders;

  useEffect(() => {
    if (!isCoordinator) return;
    getKitchenWorkers()
      .then(res => setKitchenWorkers(res.data || []))
      .catch((e: any) => {
        const message = e?.response?.data?.message;
        setError(Array.isArray(message) ? message.join(', ') : message || 'Could not load eligible kitchen workers.');
      });
  }, [isCoordinator]);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await getKitchenBoard();
      setAllOrders(res.data || []);
      setError('');
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not refresh the kitchen board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 10000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const handleItemAction = async (orderId: number, itemId: number, status: OrderItemStatus) => {
    setActionLoading(itemId);
    try {
      await updateOrderItemStatus(orderId, itemId, status);
      await fetchBoard();
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not update this item.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignment = async (orderId: number, itemId: number) => {
    const workerId = Number(assignmentSelections[itemId]);
    if (!workerId) return;
    setActionLoading(itemId);
    try {
      await assignOrderItems(orderId, [{ itemId, workerId }]);
      setAssignmentSelections(previous => ({ ...previous, [itemId]: '' }));
      await fetchBoard();
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not assign this item.');
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = orders.filter(order => order.items?.some(item => (item.status || order.status) === col.key));
    return acc;
  }, {} as Record<string, Order[]>);

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

       {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

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
                  {grouped[col.key]?.reduce((count, order) => count + (order.items?.filter(item => (item.status || order.status) === col.key).length || 0), 0) || 0}
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
                        {order.items?.filter(item => (item.status || order.status) === col.key).map((item: OrderItem) => {
                           const status = (item.status || order.status) as OrderItemStatus;
                          const nextStatus: OrderItemStatus | null =
                            status === 'confirmed' ? 'accepted'
                              : status === 'accepted' ? 'preparing'
                                : status === 'preparing' ? 'ready'
                                  : null;
                          return (
                            <div key={item.id} className="rounded-md bg-gray-50 px-1.5 py-1 text-xs text-gray-700">
                              <div className="flex items-center justify-between gap-1">
                                <span>{item.quantity}× {item.menuItem?.name || 'Item'}</span>
                                {status && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${ITEM_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>{KITCHEN_STATUS_LABELS[status] || status}</span>}
                              </div>
                               {item.notes && <p className="mt-1 text-[10px] text-amber-700">{item.notes}</p>}
                               <p className="mt-1 text-[10px] text-gray-500">
                                 {item.assignedKitchenWorker?.name || 'Unassigned'}
                                 {item.assignedKitchenWorker?.role ? ` · ${ROLE_LABELS[item.assignedKitchenWorker.role]}` : ''}
                               </p>
                               {isCoordinator && ['pending', 'confirmed', 'accepted'].includes(status || '') && (
                                 <div className="mt-1 flex gap-1">
                                   <select
                                     aria-label={`Assign ${item.menuItem?.name || 'item'}`}
                                     value={assignmentSelections[item.id] || ''}
                                     onChange={e => setAssignmentSelections(previous => ({ ...previous, [item.id]: e.target.value }))}
                                     className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-1 py-1 text-[10px]"
                                   >
                                     <option value="">Select worker…</option>
                                     {kitchenWorkers.map(worker => <option key={worker.id} value={String(worker.id)}>{worker.name} — {ROLE_LABELS[worker.role]}</option>)}
                                   </select>
                                   <button
                                     onClick={() => handleAssignment(order.id, item.id)}
                                     disabled={!assignmentSelections[item.id] || actionLoading === item.id}
                                     className="rounded bg-blue-500 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                                   >
                                     {item.assignedKitchenWorkerId ? 'Reassign' : 'Assign'}
                                   </button>
                                 </div>
                               )}
                               {nextStatus && canAdvanceItems && item.assignedKitchenWorkerId && (
                                <button
                                  onClick={() => handleItemAction(order.id, item.id, nextStatus)}
                                  disabled={actionLoading === item.id}
                                  className="mt-1 w-full rounded bg-orange-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {actionLoading === item.id ? '...' : nextStatus === 'accepted' ? 'Accept item' : nextStatus === 'preparing' ? 'Start preparing' : 'Mark ready to serve'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {order.notes && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-1 mt-1"> {order.notes}</p>
                      )}
                       {col.key === 'ready' && <p className="mt-1.5 rounded-lg bg-green-100 px-2 py-1 text-center text-xs font-medium text-green-700">Ready to serve — awaiting waiter</p>}
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
