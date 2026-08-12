'use client';
import { useEffect, useState } from 'react';
import { getOrders, getOrder, createOrder, updateOrderStatus, processPayment, getMenuCategories, getTables, getWaiters } from '@/lib/api';
import { Order, MenuItem, MenuCategory, RestaurantTable, User } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { ShoppingCart, Plus, X, CreditCard, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-purple-100 text-purple-800',
  paid: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface CartItem { menuItem: MenuItem; quantity: number; notes?: string; }

const CAN_ASSIGN_WAITER = ['admin', 'owner', 'manager', 'coordinator'];
const CAN_PAY = ['cashier', 'admin', 'owner'];

export default function OrdersPage() {
  const { user } = useAuthStore();
  const canAssignWaiter = !!user && CAN_ASSIGN_WAITER.includes(user.role);
  const canPay = !!user && CAN_PAY.includes(user.role);
  const isWaiter = user?.role === 'waiter';

  // Estimated completion: order time + longest preparation time among its items (default 20 min)
  const estCompletion = (order: Order) => {
    if (['served', 'paid', 'cancelled'].includes(order.status)) return '—';
    const prep = Math.max(20, ...(order.items || []).map((i: any) => Number(i.menuItem?.preparationTime) || 0));
    return new Date(new Date(order.createdAt).getTime() + prep * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [waiters, setWaiters] = useState<User[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPOS, setShowPOS] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('all');
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, catsRes, tablesRes] = await Promise.all([
        getOrders(),
        getMenuCategories(),
        getTables(),
      ]);
      setOrders(ordersRes.data || []);
      setCategories(catsRes.data || []);
      setTables(tablesRes.data?.filter((t: RestaurantTable) => t.status === 'available') || []);
      if (catsRes.data?.length) setSelectedCat(catsRes.data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!canAssignWaiter) return;
    getWaiters()
      .then(res => setWaiters(res.data || []))
      .catch(() => setWaiters([]));
  }, [canAssignWaiter]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => setCart(prev => prev.filter(c => c.menuItem.id !== itemId));
  const updateQty = (itemId: number, qty: number) => {
    if (qty <= 0) return removeFromCart(itemId);
    setCart(prev => prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: qty } : c));
  };

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.menuItem.price) * c.quantity, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await createOrder({
        tableId: selectedTable,
        waiterId: canAssignWaiter ? selectedWaiter : user?.role === 'waiter' ? user.id : undefined,
        customerName,
        notes,
        items: cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.quantity, notes: c.notes })),
      });
      setCart([]);
      setSelectedTable(null);
      setSelectedWaiter(null);
      setCustomerName('');
      setNotes('');
      setShowPOS(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    await updateOrderStatus(orderId, status);
    await fetchData();
  };

  const handlePayment = async () => {
    if (!payingOrder) return;
    setSubmitting(true);
    try {
      await processPayment({ orderId: payingOrder.id, method: payMethod, amount: parseFloat(payAmount) || payingOrder.totalAmount });
      setPayingOrder(null);
      setPayAmount('');
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const currentCat = categories.find(c => c.id === selectedCat);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="text-brand-600" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Orders & POS</h1>
        </div>
        <button onClick={() => setShowPOS(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Order
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors', filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} {s === 'all' ? `(${orders.length})` : `(${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              {isWaiter ? (
                <tr>
                  <th className="table-header">Order #</th>
                  <th className="table-header">Table</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Order Date</th>
                  <th className="table-header">Order Time</th>
                  <th className="table-header">Est. Completion</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Payment Method</th>
                  <th className="table-header">Status</th>
                </tr>
              ) : (
              <tr>
                <th className="table-header">Order #</th>
                <th className="table-header">Table / Customer</th>
                <th className="table-header">Items</th>
                <th className="table-header">Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">Time</th>
                <th className="table-header">Actions</th>
              </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={isWaiter ? 9 : 7} className="text-center py-12 text-gray-400">No orders found</td></tr>
              ) : isWaiter ? filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={async () => {
                    try {
                      const res = await getOrder(order.id);
                      setDetailOrder(res.data);
                    } catch {
                      setDetailOrder(order);
                    }
                  }}
                >
                  <td className="table-cell font-semibold text-brand-600">#{order.id}</td>
                  <td className="table-cell">
                    {order.table?.number ? <span className="font-medium">Table {order.table.number}</span> : <span className="text-gray-500">Walk-in</span>}
                  </td>
                  <td className="table-cell text-gray-500">{order.items?.length || 0} items</td>
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">{estCompletion(order)}</td>
                  <td className="table-cell font-semibold">ETB {Number(order.totalAmount).toLocaleString()}</td>
                  <td className="table-cell text-sm text-gray-600 capitalize">{order.payments?.length ? order.payments[order.payments.length - 1].method : '—'}</td>
                  <td className="table-cell">
                    <span className={`status-badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                  </td>
                </tr>
              )) : filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={async () => {
                    try {
                      const res = await getOrder(order.id);
                      setDetailOrder(res.data);
                    } catch {
                      setDetailOrder(order);
                    }
                  }}
                >
                  <td className="table-cell font-semibold text-brand-600">#{order.id}</td>
                  <td className="table-cell">
                    {order.table?.number ? <span className="font-medium">Table {order.table.number}</span> : <span className="text-gray-500">{order.customerName || 'Walk-in'}</span>}
                    {order.waiter?.name && <p className="text-xs text-gray-400">Waiter: {order.waiter.name}</p>}
                  </td>
                  <td className="table-cell text-gray-500">{order.items?.length || 0} items</td>
                  <td className="table-cell font-semibold">ETB {Number(order.totalAmount).toLocaleString()}</td>
                  <td className="table-cell">
                    <span className={`status-badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">{new Date(order.createdAt).toLocaleTimeString()}</td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {order.status === 'pending' && (
                        <button onClick={() => handleStatusChange(order.id, 'confirmed')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Confirm</button>
                      )}
                      {order.status === 'ready' && (
                        <button onClick={() => handleStatusChange(order.id, 'served')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Served</button>
                      )}
                      {order.status === 'served' && (canPay ? (
                        <button onClick={() => { setPayingOrder(order); setPayAmount(String(order.totalAmount)); }} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                          <CreditCard size={12} /> Pay
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">Awaiting cashier</span>
                      ))}
                      {order.status === 'paid' && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-semibold flex items-center gap-1">
                          <CheckCircle size={12} /> Completed
                        </span>
                      )}
                      {['pending', 'confirmed'].includes(order.status) && (
                        <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* POS Modal */}
      {showPOS && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="ml-auto w-full max-w-5xl bg-white flex h-full">
            {/* Menu */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold">Point of Sale</h2>
                <button onClick={() => setShowPOS(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
              </div>
              {/* Category tabs */}
              <div className="flex gap-2 p-3 border-b overflow-x-auto">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                    className={clsx('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap', selectedCat === cat.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  >{cat.name}</button>
                ))}
              </div>
              {/* Items grid */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                {currentCat?.items?.filter(i => i.isAvailable).map((item) => (
                  <button key={item.id} onClick={() => addToCart(item)}
                    className="p-4 border-2 border-gray-100 hover:border-brand-400 rounded-xl text-left transition-all hover:shadow-md"
                  >
                    {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-20 object-cover rounded-lg mb-2" />}
                    <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                    <p className="text-brand-600 font-bold">ETB {Number(item.price).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="w-80 border-l flex flex-col bg-gray-50">
              <div className="p-4 border-b bg-white">
                <h3 className="font-bold text-gray-900">Cart</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={selectedTable || ''} onChange={(e) => setSelectedTable(e.target.value ? +e.target.value : null)}
                    className="input text-xs py-1.5">
                    <option value="">Walk-in</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Table {t.number}</option>)}
                  </select>
                  <input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="input text-xs py-1.5" />
                </div>
                {canAssignWaiter && (
                  <select value={selectedWaiter || ''} onChange={(e) => setSelectedWaiter(e.target.value ? +e.target.value : null)}
                    className="input text-xs py-1.5 mt-2 w-full">
                    <option value="">Assign waiter (optional)</option>
                    {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center mt-8">Add items from the menu</p>
                ) : cart.map((c) => (
                  <div key={c.menuItem.id} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-gray-900 flex-1 mr-2">{c.menuItem.name}</p>
                      <button onClick={() => removeFromCart(c.menuItem.id)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(c.menuItem.id, c.quantity - 1)} className="w-6 h-6 bg-gray-100 rounded text-gray-600 hover:bg-gray-200 font-medium">-</button>
                        <span className="text-sm font-bold w-6 text-center">{c.quantity}</span>
                        <button onClick={() => updateQty(c.menuItem.id, c.quantity + 1)} className="w-6 h-6 bg-gray-100 rounded text-gray-600 hover:bg-gray-200 font-medium">+</button>
                      </div>
                      <span className="text-sm font-bold text-brand-600">ETB {(Number(c.menuItem.price) * c.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white border-t">
                <input placeholder="Order notes..." value={notes} onChange={e => setNotes(e.target.value)} className="input text-sm mb-3" />
                <div className="flex justify-between mb-3">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-bold text-xl text-brand-600">ETB {cartTotal.toLocaleString()}</span>
                </div>
                <button onClick={submitOrder} disabled={cart.length === 0 || submitting}
                  className="btn-primary w-full py-3 disabled:opacity-50">
                  {submitting ? 'Placing Order...' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-bold">Order #{detailOrder.id}</h3>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`status-badge ${STATUS_COLORS[detailOrder.status]}`}>{detailOrder.status === 'paid' ? 'completed (paid)' : detailOrder.status}</span>
              <span className="text-xs text-gray-400">{new Date(detailOrder.createdAt).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Table / Customer</p>
                <p className="font-medium text-gray-900">{detailOrder.table?.number ? `Table ${detailOrder.table.number}` : detailOrder.customerName || 'Walk-in'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Waiter</p>
                <p className="font-medium text-gray-900">{detailOrder.waiter?.name || '—'}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Items</p>
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg mb-4">
              {detailOrder.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <div>
                    <p className="text-gray-800">{item.menuItem?.name || `Item ${item.menuItemId}`}</p>
                    {item.notes && <p className="text-xs text-amber-700">📝 {item.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">×{item.quantity}</p>
                    <p className="text-xs text-gray-400">ETB {(Number(item.unitPrice) * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            {detailOrder.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-4">📝 {detailOrder.notes}</p>}
            {(detailOrder as any).payments?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm">
                <p className="text-xs text-green-700 font-semibold mb-1">Payment</p>
                {(detailOrder as any).payments.map((p: any) => (
                  <p key={p.id} className="text-green-800">
                    {p.method} · ETB {Number(p.amount).toLocaleString()}{Number(p.changeGiven) > 0 ? ` (change ETB ${Number(p.changeGiven).toLocaleString()})` : ''}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-between border-t pt-3">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-lg text-brand-600">ETB {Number(detailOrder.totalAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Process Payment</h3>
              <button onClick={() => setPayingOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Order #{payingOrder.id} · ETB {Number(payingOrder.totalAmount).toLocaleString()}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'mobile'] as const).map((m) => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={clsx('py-2 rounded-lg text-sm font-medium border-2 transition-colors', payMethod === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      {m === 'cash' ? '💵' : m === 'card' ? '💳' : '📱'} {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input" placeholder="Enter amount" />
              </div>
              {payMethod === 'cash' && parseFloat(payAmount) > payingOrder.totalAmount && (
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-700">Change: <span className="font-bold">ETB {(parseFloat(payAmount) - Number(payingOrder.totalAmount)).toLocaleString()}</span></p>
                </div>
              )}
            </div>
            <button onClick={handlePayment} disabled={submitting} className="btn-primary w-full mt-5 py-3">
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
