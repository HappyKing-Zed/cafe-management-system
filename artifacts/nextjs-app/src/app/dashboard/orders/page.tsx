'use client';
import { useEffect, useState } from 'react';
import { getOrders, getOrder, createOrder, addOrderItems, removeOrderItems, updateOrderStatus, updateOrderItemStatus, processPayment, getMenuCategories, getTables, getWaiters, getKitchenWorkers, assignOrderItems } from '@/lib/api';
import { Order, OrderItem, OrderItemStatus, MenuItem, MenuCategory, RestaurantTable, User } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { ShoppingCart, Plus, X, CreditCard, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-purple-100 text-purple-800',
  paid: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'New Orders',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready to Serve',
  served: 'Served',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const statusLabel = (status: string) => STATUS_LABELS[status] || status;
const fmtCurrency = (value: number) => `ETB ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const visibleOrderStatus = (order: Order) => {
  if (!['confirmed', 'preparing', 'ready'].includes(order.status)) return order.status;
  if (order.status === 'ready') return 'ready';
  const itemStatuses = (order.items || []).map(item => item.status || order.status);
  if (itemStatuses.some(status => status === 'preparing')) return 'preparing';
  if (itemStatuses.some(status => status === 'accepted')) return 'accepted';
  return 'confirmed';
};

const isItemPaid = (item: OrderItem) => Boolean(item.paymentItems?.length);
const payableItems = (order: Order) => (order.items || []).filter((item) => item.status === 'served' && !isItemPaid(item));

const itemPaymentAllocations = (order: Order) => {
  const items = [...(order.items || [])].sort((a, b) => a.id - b.id);
  const lineCents = items.map((item) => Math.round(Number(item.unitPrice) * item.quantity * 100));
  const subtotalCents = lineCents.reduce((sum, value) => sum + value, 0);
  const totalCents = Math.round(Number(order.totalAmount) * 100);
  if (!subtotalCents) return new Map<number, number>();
  const raw = lineCents.map((value) => totalCents * value / subtotalCents);
  const allocated = raw.map(Math.floor);
  const remainder = totalCents - allocated.reduce((sum, value) => sum + value, 0);
  const orderByRemainder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || items[a.index].id - items[b.index].id);
  for (let index = 0; index < remainder; index += 1) allocated[orderByRemainder[index].index] += 1;
  return new Map(items.map((item, index) => [item.id, allocated[index] / 100]));
};

interface CartItem { menuItem: MenuItem; quantity: number; notes?: string; }

const CAN_ASSIGN_WAITER = ['admin', 'owner', 'manager', 'coordinator'];
const CAN_PAY = ['cashier', 'admin', 'owner'];
const orderNumber = (order: Order) => order.orderNumber ?? order.id;

export default function OrdersPage() {
  const { user } = useAuthStore();
  const canAssignWaiter = !!user && CAN_ASSIGN_WAITER.includes(user.role);
  const canPay = !!user && CAN_PAY.includes(user.role);
  const isWaiter = user?.role === 'waiter';
  const isCoordinator = user?.role === 'coordinator';
  const isCashier = user?.role === 'cashier';
  const ownsOrder = (order: Order) => isWaiter && order.waiterId === user?.id;
  const canCreateOrder = !!user && !['coordinator', 'manager', 'owner', 'cashier'].includes(user.role);

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
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('all');
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [selectedPaymentItemIds, setSelectedPaymentItemIds] = useState<number[]>([]);
  const [verifyAuthenticity, setVerifyAuthenticity] = useState(false);
  const [verificationProvider, setVerificationProvider] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [expectedSenderName, setExpectedSenderName] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState<{
    orderNumber: number;
    amount: number;
    provider?: string;
    reference?: string;
    mode?: string;
    requestId?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, catsRes, tablesRes] = await Promise.all([
        getOrders(),
        getMenuCategories(),
        getTables(),
      ]);
      setOrders(ordersRes.data || []);
      // Keep the open order detail in sync with the latest data
      setDetailOrder(prev => {
        if (!prev) return prev;
        const fresh = (ordersRes.data || []).find((o: Order) => o.id === prev.id);
        return fresh ? { ...prev, ...fresh } : prev;
      });
      setCategories(catsRes.data || []);
      setTables(tablesRes.data?.filter((t: RestaurantTable) => t.status === 'available') || []);
      if (catsRes.data?.length) setSelectedCat(catsRes.data[0].id);
    } catch (error: any) {
      // The shared API client clears expired authentication and redirects to login.
      // Consume that expected rejection here so Next.js does not show its runtime overlay.
      if (error?.response?.status !== 401) throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore polling errors */ }); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isWaiter) return;
    getWaiters()
      .then(res => setWaiters(res.data || []))
      .catch(() => setWaiters([]));
  }, [isWaiter]);

  useEffect(() => {
    if (!isCoordinator) return;
    getKitchenWorkers()
      .then(res => {
        setKitchenWorkers(res.data || []);
        setKitchenWorkerError('');
      })
      .catch((e: any) => {
        setKitchenWorkers([]);
        const message = e?.response?.data?.message;
        setKitchenWorkerError(Array.isArray(message) ? message.join(', ') : message || 'Could not load eligible kitchen workers.');
      });
  }, [isCoordinator]);

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

  const [svcPct, setSvcPct] = useState('2');
  const svcAmount = Math.round(cartTotal * ((parseFloat(svcPct) || 0) / 100) * 100) / 100;
  const grandTotal = Math.round((cartTotal + svcAmount) * 100) / 100;
  // When set, the POS adds items to this existing order instead of creating a new one
  const [appendOrder, setAppendOrder] = useState<Order | null>(null);

  // Waiter list filters
  const [fTable, setFTable] = useState('');
  const [fItem, setFItem] = useState('');
  const [fDate, setFDate] = useState('');
  const [fTime, setFTime] = useState('');
  const [fPay, setFPay] = useState('');
  const [fWaiter, setFWaiter] = useState('');

  // Cancel dialog: whole order or selected items
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [kitchenWorkers, setKitchenWorkers] = useState<User[]>([]);
  const [kitchenWorkerError, setKitchenWorkerError] = useState('');
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [itemAssignments, setItemAssignments] = useState<Record<number, string>>({});
  const [cancelSel, setCancelSel] = useState<number[]>([]);

  // Clear all POS state so stale carts/amounts never leak into the next order
  const resetPOS = () => {
    setCart([]);
    setSelectedTable(null);
    setSelectedWaiter(null);
    setCustomerPhone('');
    setNotes('');
    setSvcPct('2');
    setAppendOrder(null);
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (!appendOrder && !selectedTable && !customerPhone.trim()) {
      alert('Please enter a client phone number for takeaway orders.');
      return;
    }
    setSubmitting(true);
    try {
      if (appendOrder) {
        await addOrderItems(appendOrder.id, cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.quantity, notes: c.notes })));
      } else {
        await createOrder({
          tableId: selectedTable,
          waiterId: canAssignWaiter ? selectedWaiter : user?.role === 'waiter' ? user.id : undefined,
          customerPhone: customerPhone.trim() || undefined,
          notes,
          serviceChargePct: parseFloat(svcPct) || 0,
          items: cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.quantity, notes: c.notes })),
        });
      }
      resetPOS();
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

  const handleItemStatusChange = async (orderId: number, itemId: number, status: OrderItemStatus) => {
    setSubmitting(true);
    try {
      await updateOrderItemStatus(orderId, itemId, status);
      const refreshed = (await getOrder(orderId)).data;
      setDetailOrder(refreshed);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not update the item status');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!payingOrder || selectedPaymentItemIds.length === 0) return;
    setPaymentError('');
    setSubmitting(true);
    try {
      const response = await processPayment({
        orderId: payingOrder.id,
        orderItemIds: selectedPaymentItemIds,
        method: payMethod,
        amount: parseFloat(payAmount) || selectedPaymentTotal,
        ...(verifyAuthenticity ? {
          authenticityVerification: {
            enabled: true,
            provider: verificationProvider,
            transactionId,
            ...(payerPhone.trim() ? { phoneNumber: payerPhone.trim() } : {}),
            ...(senderAccount.trim() ? { senderAccount: senderAccount.trim() } : {}),
            ...(expectedSenderName.trim() ? { expectedSenderName: expectedSenderName.trim() } : {}),
          },
        } : {}),
      });
      if (verifyAuthenticity && response.data?.authenticityVerified) {
        setVerificationSuccess({
          orderNumber: orderNumber(payingOrder),
          amount: Number(response.data.amount),
          provider: response.data.verificationProvider,
          reference: response.data.reference,
          mode: response.data.verificationMode,
          requestId: response.data.verificationRequestId,
        });
      }
      setPayingOrder(null);
      setPayAmount('');
      setSelectedPaymentItemIds([]);
      setVerifyAuthenticity(false);
      setVerificationProvider('');
      setTransactionId('');
      setPayerPhone('');
      setSenderAccount('');
      setExpectedSenderName('');
      await fetchData();
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setPaymentError(Array.isArray(message) ? message.join(', ') : message || 'Could not process this payment');
    } finally {
      setSubmitting(false);
    }
  };

  const roleOrders = isCashier
    ? orders.filter((order) => payableItems(order).length > 0)
    : orders;
  const selectedPaymentAllocations = payingOrder ? itemPaymentAllocations(payingOrder) : new Map<number, number>();
  const selectedPaymentTotal = selectedPaymentItemIds.reduce((sum, id) => sum + (selectedPaymentAllocations.get(id) || 0), 0);
  const openPayment = (order: Order) => {
    const ids = payableItems(order).map((item) => item.id);
    const allocations = itemPaymentAllocations(order);
    const total = ids.reduce((sum, id) => sum + (allocations.get(id) || 0), 0);
    setSelectedPaymentItemIds(ids);
    setPayAmount(total.toFixed(2));
    setPayMethod('cash');
    setVerifyAuthenticity(false);
    setVerificationProvider('');
    setTransactionId('');
    setPayerPhone('');
    setSenderAccount('');
    setExpectedSenderName('');
    setPaymentError('');
    setPayingOrder(order);
  };
  const togglePaymentItem = (itemId: number) => {
    setSelectedPaymentItemIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
      const total = next.reduce((sum, id) => sum + (selectedPaymentAllocations.get(id) || 0), 0);
      setPayAmount(total.toFixed(2));
      return next;
    });
  };
  const statusFiltered = filter === 'all' ? roleOrders : roleOrders.filter(o => o.status === filter);
  const filteredOrders = statusFiltered.filter((o) => {
    if (!isWaiter && fWaiter && String(o.waiterId || o.waiter?.id || '') !== fWaiter) return false;
    if (fTable) {
      if (fTable === 'takeaway') { if (o.table?.number) return false; }
      else if (String(o.table?.number || '') !== fTable) return false;
    }
    if (fItem && !o.items?.some(i => i.menuItem?.name?.toLowerCase().includes(fItem.toLowerCase()))) return false;
    if (fDate && new Date(o.createdAt).toLocaleDateString('en-CA') !== fDate) return false;
    if (fTime && new Date(o.createdAt).toTimeString().slice(0, 5) < fTime) return false;
    if (fPay) {
      const m = o.payments?.length ? o.payments[o.payments.length - 1].method : '';
      if (fPay === 'unpaid' ? !!m : m !== fPay) return false;
    }
    return true;
  });
  const currentCat = categories.find(c => c.id === selectedCat);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="text-brand-600" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 truncate">Orders & POS</h1>
        </div>
        {canCreateOrder && (
          <button onClick={() => { resetPOS(); setShowPOS(true); }} className="btn-primary self-start sm:self-auto flex items-center gap-2">
            <Plus size={18} /> New Order
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {!isCashier && <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors', filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
             {s === 'all' ? 'All' : statusLabel(s)} {s === 'all' ? `(${roleOrders.length})` : `(${roleOrders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>}

      {/* Filters — single compact row */}
      {(
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {!isWaiter && (
            <select value={fWaiter} onChange={e => setFWaiter(e.target.value)} title="Waiter"
              className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white w-32', fWaiter ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')}>
              <option value="">Waiter: All</option>
              {waiters.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
            </select>
          )}
          <select value={fTable} onChange={e => setFTable(e.target.value)} title="Table"
            className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white w-28', fTable ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')}>
            <option value="">Table: All</option>
            <option value="takeaway">Take Away</option>
            {tables.map(t => <option key={t.id} value={String(t.number)}>{t.number}</option>)}
          </select>
          <input list="filter-items" value={fItem} onChange={e => setFItem(e.target.value)} placeholder="Item…" title="Item"
            className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white w-32', fItem ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')} />
          <datalist id="filter-items">
            {categories.flatMap(c => c.items || []).map(i => <option key={i.id} value={i.name} />)}
          </datalist>
          <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} title="Order date"
            className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white', fDate ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')} />
          <input type="time" value={fTime} onChange={e => setFTime(e.target.value)} title="From time"
            className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white', fTime ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')} />
          <select value={fPay} onChange={e => setFPay(e.target.value)} title="Payment method"
            className={clsx('text-xs py-1.5 px-2 rounded-lg border bg-white w-28', fPay ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-500')}>
            <option value="">Payment: All</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile">Wallet</option>
            <option value="unpaid">Not paid yet</option>
          </select>
          {(fTable || fItem || fDate || fTime || fPay || fWaiter) && (
            <button onClick={() => { setFTable(''); setFItem(''); setFDate(''); setFTime(''); setFPay(''); setFWaiter(''); }}
              className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200" title="Clear all filters">✕ Clear</button>
          )}
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header !px-2.5 !py-2">#</th>
                <th className="table-header !px-2.5 !py-2">Table</th>
                 <th className="table-header !px-2.5 !py-2">Kitchen</th>
                <th className="table-header !px-2.5 !py-2">Items</th>
                <th className="table-header !px-2.5 !py-2">Time</th>
                <th className="table-header !px-2.5 !py-2">Total</th>
                <th className="table-header !px-2.5 !py-2">Status</th>
                <th className="table-header !px-2.5 !py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
              ) : filteredOrders.map((order) => (
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
                  <td className="table-cell !px-2.5 !py-2 text-xs font-semibold text-brand-600">#{orderNumber(order)}</td>
                  <td className="table-cell !px-2.5 !py-2">
                    {order.table?.number ? <span className="text-xs font-medium">{order.table.number}</span> : <span className="text-xs text-gray-500">Take Away</span>}
                    {!isWaiter && order.waiter?.name && <p className="text-[10px] text-gray-400 truncate max-w-[90px]">{order.waiter.name}</p>}
                  </td>
                   <td className="table-cell !px-2.5 !py-2 text-gray-500 text-xs max-w-[130px]">
                     {[...new Set(order.items?.map(item => item.assignedKitchenWorker?.name).filter(Boolean))].join(', ') || '—'}
                   </td>
                  <td className="table-cell !px-2.5 !py-2 text-gray-500 text-xs whitespace-nowrap">{order.items?.length || 0}</td>
                  <td className="table-cell !px-2.5 !py-2 text-xs whitespace-nowrap">
                    <p className="text-gray-700">{new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[10px] text-gray-400">Est: {estCompletion(order)}</p>
                  </td>
                  <td className="table-cell !px-2.5 !py-2 text-xs whitespace-nowrap">
                    <p className="font-semibold">ETB {Number(order.totalAmount).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{order.payments?.length ? (order.payments[order.payments.length - 1].method === 'mobile' ? 'wallet' : order.payments[order.payments.length - 1].method) : '—'}</p>
                  </td>
                  <td className="table-cell !px-2.5 !py-2" onClick={(e) => e.stopPropagation()}>
                    {order.status === 'paid' || order.status === 'cancelled' ? (
                      <span className={`status-badge ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel(order.status)}
                      </span>
                    ) : (
                      <div className="min-w-[190px] space-y-1.5">
                        {(order.items || []).map((item) => {
                          const itemStatus = isItemPaid(item) ? 'paid' : (item.status || order.status);
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2">
                              <span className="max-w-[120px] truncate text-[11px] text-gray-600" title={item.menuItem?.name}>
                                {item.quantity}× {item.menuItem?.name || `Item ${item.menuItemId}`}
                              </span>
                              <span className={`status-badge shrink-0 ${STATUS_COLORS[itemStatus] || 'bg-gray-100 text-gray-700'}`}>
                                {statusLabel(itemStatus)}
                              </span>
                            </div>
                          );
                        })}
                        {order.status === 'ready' && ownsOrder(order) && (
                          <button onClick={() => handleStatusChange(order.id, 'served')}
                            title="Click to mark ready items as served"
                            className={`status-badge ${STATUS_COLORS.ready} cursor-pointer hover:ring-2 hover:ring-purple-300`}>
                            Serve ready items
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="table-cell !px-2.5 !py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 flex-wrap">
                      {ownsOrder(order) && !['paid', 'cancelled'].includes(order.status) && !(order.payments?.length) && (
                        <button onClick={() => { resetPOS(); setAppendOrder(order); setShowPOS(true); }}
                          className="text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded hover:bg-brand-200 whitespace-nowrap">+ Add Items</button>
                      )}
                      {isCoordinator && order.status === 'pending' && (
                         <button onClick={() => { setItemAssignments({}); setConfirmOrder(order); }} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Confirm</button>
                      )}
                      {isCoordinator && order.status !== 'pending' && order.items?.some(item => item.status === 'pending') && (
                        <button
                          onClick={async () => {
                             try {
                               const fresh = (await getOrder(order.id)).data;
                               setItemAssignments({});
                               setConfirmOrder(fresh);
                             } catch {
                               setItemAssignments({});
                               setConfirmOrder(order);
                             }
                          }}
                          className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 whitespace-nowrap"
                        >
                          Review pending items
                        </button>
                      )}
                      {ownsOrder(order) && order.status === 'ready' && (
                        <button onClick={() => handleStatusChange(order.id, 'served')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Served</button>
                      )}
                      {!isWaiter && !isCoordinator && payableItems(order).length > 0 && (canPay ? (
                        <button onClick={() => openPayment(order)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                          <CreditCard size={12} /> Pay
                        </button>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">Awaiting cashier</span>
                      ))}
                      {!isWaiter && order.status === 'paid' && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-semibold flex items-center gap-1">
                          <CheckCircle size={12} /> Completed
                        </span>
                      )}
                      {ownsOrder(order) && order.status === 'pending' && order.items?.every(item => !item.status || item.status === 'pending') && (
                        <button onClick={async () => {
                          setCancelSel([]);
                          try { const res = await getOrder(order.id); setCancelOrder(res.data); } catch { setCancelOrder(order); }
                        }} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 whitespace-nowrap">Cancel</button>
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
          <div className="ml-auto w-full max-w-5xl bg-white flex h-[100dvh] min-h-0 flex-col overflow-hidden lg:h-full lg:flex-row">
            {/* Menu */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b p-3 sm:p-4">
                <h2 className="min-w-0 truncate text-lg font-bold">{appendOrder ? `Add Items to Order #${orderNumber(appendOrder)}` : 'Point of Sale'}</h2>
                <button onClick={() => { setShowPOS(false); resetPOS(); }} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Close order form"><X size={22} /></button>
              </div>
              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto border-b p-3">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                    className={clsx('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap', selectedCat === cat.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  >{cat.name}</button>
                ))}
              </div>
              {/* Items grid */}
              <div className="grid flex-1 content-start grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 sm:p-4">
                {currentCat?.items?.filter(i => i.isAvailable).map((item) => (
                  <button key={item.id} onClick={() => addToCart(item)}
                    className="min-w-0 rounded-xl border-2 border-gray-100 p-3 text-left transition-all hover:border-brand-400 hover:shadow-md sm:p-4"
                  >
                    {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-20 object-cover rounded-lg mb-2" />}
                    <p className="mb-1 break-words text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                    <p className="text-brand-600 font-bold">ETB {Number(item.price).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="flex max-h-[48dvh] min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t bg-gray-50 lg:max-h-none lg:w-80 lg:overflow-hidden lg:border-l lg:border-t-0">
              <div className="shrink-0 border-b bg-white p-3 sm:p-4">
                <h3 className="font-bold text-gray-900">Cart</h3>
                {!appendOrder && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <select value={selectedTable || ''} onChange={(e) => setSelectedTable(e.target.value ? +e.target.value : null)}
                    className="input text-xs py-1.5">
                    <option value="">Take Away</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.number}</option>)}
                  </select>
                  <input
                    placeholder={selectedTable ? 'Client phone number (optional)' : 'Client phone number (required)'}
                    aria-label="Client phone number"
                    required={!selectedTable}
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="input text-xs py-1.5"
                  />
                </div>
                )}
                {appendOrder && (
                  <p className="text-xs text-gray-500 mt-1">Adding to Order #{orderNumber(appendOrder)} · {appendOrder.table?.number || 'Take Away'}</p>
                )}
                {!appendOrder && canAssignWaiter && (
                  <select value={selectedWaiter || ''} onChange={(e) => setSelectedWaiter(e.target.value ? +e.target.value : null)}
                    className="input text-xs py-1.5 mt-2 w-full">
                    <option value="">Assign waiter (optional)</option>
                    {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
              </div>
              <div className="max-h-32 shrink-0 space-y-2 overflow-y-auto p-3 lg:max-h-none lg:min-h-0 lg:flex-1">
                {cart.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center mt-8">Add items from the menu</p>
                ) : cart.map((c) => (
                  <div key={c.menuItem.id} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words text-sm font-medium text-gray-900">{c.menuItem.name}</p>
                      <button onClick={() => removeFromCart(c.menuItem.id)} className="shrink-0 text-gray-300 hover:text-red-500" aria-label={`Remove ${c.menuItem.name} from cart`}><X size={14} /></button>
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
              <div className="shrink-0 border-t bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
                {!appendOrder && <input placeholder="Order notes..." value={notes} onChange={e => setNotes(e.target.value)} className="input text-sm mb-3" />}
                <div className="flex justify-between gap-3 text-sm mb-1">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-700">ETB {cartTotal.toLocaleString()}</span>
                </div>
                {!appendOrder && (
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm mb-1">
                  <span className="flex flex-wrap items-center gap-1 text-gray-500">
                    Service Charge
                    <input type="number" min={0} max={100} step={0.5} value={svcPct} onChange={e => setSvcPct(e.target.value)}
                      className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-right" />%
                  </span>
                  <span className="font-medium text-gray-700">ETB {svcAmount.toLocaleString()}</span>
                </div>
                )}
                <div className="flex justify-between gap-3 mb-3">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-bold text-xl text-brand-600">ETB {(appendOrder ? cartTotal : grandTotal).toLocaleString()}</span>
                </div>

                <button onClick={submitOrder} disabled={cart.length === 0 || submitting || (!appendOrder && !selectedTable && !customerPhone.trim())}
                  className="btn-primary w-full py-3 disabled:opacity-50">
                  {submitting ? 'Saving...' : appendOrder ? `Add to Order #${orderNumber(appendOrder)}` : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelOrder && ownsOrder(cancelOrder) && cancelOrder.status === 'pending' && cancelOrder.items?.every(item => !item.status || item.status === 'pending') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-bold">Cancel Order #{orderNumber(cancelOrder)}</h3>
              <button onClick={() => setCancelOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Cancel the whole order, or tick the items to remove.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {cancelOrder.items?.map((i) => (
                <label key={i.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 cursor-pointer">
                  <input type="checkbox" checked={cancelSel.includes(i.id)}
                    onChange={e => setCancelSel(s => e.target.checked ? [...s, i.id] : s.filter(x => x !== i.id))}
                    className="w-4 h-4 accent-brand-500" />
                  <span className="text-sm flex-1">{i.menuItem?.name || `Item #${i.menuItemId}`} × {i.quantity}</span>
                  <span className="text-sm font-semibold text-gray-600">ETB {(Number(i.unitPrice) * i.quantity).toLocaleString()}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <button disabled={cancelSel.length === 0 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await removeOrderItems(cancelOrder.id, cancelSel);
                    setCancelOrder(null);
                    await fetchData();
                  } catch (e: any) {
                    alert(e?.response?.data?.message || 'Could not remove the items');
                  } finally { setSubmitting(false); }
                }}
                className="btn-secondary w-full disabled:opacity-50">
                Remove Selected Items{cancelSel.length ? ` (${cancelSel.length})` : ''}
              </button>
              <button disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await updateOrderStatus(cancelOrder.id, 'cancelled');
                    setCancelOrder(null);
                    await fetchData();
                  } catch (e: any) {
                    alert(e?.response?.data?.message || 'Could not cancel the order');
                  } finally { setSubmitting(false); }
                }}
                className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50">
                Cancel Entire Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign each pending item to its kitchen worker (coordinator) */}
      {confirmOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Assign Order #{orderNumber(confirmOrder)}</h2>
              <button onClick={() => setConfirmOrder(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Choose an eligible kitchen worker for every pending item.</p>
            {kitchenWorkerError && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{kitchenWorkerError}</div>}
            <div className="space-y-3 mb-5">
              {confirmOrder.items?.filter(item => !item.status || item.status === 'pending').map(item => (
                <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{item.menuItem?.name || `Item ${item.menuItemId}`}</p>
                      {item.notes && <p className="text-xs text-amber-700 mt-0.5">{item.notes}</p>}
                    </div>
                    <span className="text-sm font-semibold text-gray-600">×{item.quantity}</span>
                  </div>
                  <select
                    required
                    aria-label={`Kitchen worker for ${item.menuItem?.name || `item ${item.id}`}`}
                    value={itemAssignments[item.id] || ''}
                    onChange={e => setItemAssignments(previous => ({ ...previous, [item.id]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select kitchen worker…</option>
                    {kitchenWorkers.map(worker => (
                      <option key={worker.id} value={String(worker.id)}>
                        {worker.name} — {worker.role === 'chef_main_kitchen' ? 'Chef – Main Kitchen' : worker.role === 'bar_man' ? 'Bar Man' : worker.role === 'juice_maker' ? 'Juice Maker' : worker.role === 'coffee_lady' ? 'Coffee Lady' : 'Chef'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button disabled={submitting || !confirmOrder.items?.some(item => !item.status || item.status === 'pending') || !confirmOrder.items?.filter(item => !item.status || item.status === 'pending').every(item => itemAssignments[item.id])}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const pendingItems = confirmOrder.items?.filter(item => !item.status || item.status === 'pending') || [];
                  await assignOrderItems(confirmOrder.id, pendingItems.map(item => ({
                    itemId: item.id,
                    workerId: Number(itemAssignments[item.id]),
                  })));
                  setConfirmOrder(null);
                  await fetchData();
                } catch (e: any) {
                  const message = e?.response?.data?.message;
                  alert(Array.isArray(message) ? message.join(', ') : message || 'Could not assign the pending items');
                } finally { setSubmitting(false); }
              }}
              className="btn-primary w-full disabled:opacity-50">
              {submitting ? 'Assigning…' : 'Confirm & Assign Items'}
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-bold">Order #{orderNumber(detailOrder)}</h3>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`status-badge ${STATUS_COLORS[visibleOrderStatus(detailOrder)]}`}>{detailOrder.status === 'paid' ? 'completed (paid)' : statusLabel(visibleOrderStatus(detailOrder))}</span>
              <span className="text-xs text-gray-400">{new Date(detailOrder.createdAt).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Table / Customer</p>
                 <p className="font-medium text-gray-900">{detailOrder.table?.number ? `Table ${detailOrder.table.number}` : detailOrder.customerPhone || detailOrder.customerName || 'Walk-in'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Waiter</p>
                <p className="font-medium text-gray-900">{detailOrder.waiter?.name || '—'}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Items</p>
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg mb-4">
              {detailOrder.items?.map((item: OrderItem) => {
                const itemStatus = item.status || detailOrder.status;
                const nextItemStatus: OrderItemStatus | null =
                  ownsOrder(detailOrder) && itemStatus === 'ready' ? 'served' : null;
                return (
                <div key={item.id} className="flex justify-between items-center gap-3 px-3 py-2 text-sm">
                  <div>
                    <p className="text-gray-800">{item.menuItem?.name || `Item ${item.menuItemId}`}</p>
                    {item.notes && <p className="text-xs text-amber-700"> {item.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">×{item.quantity}</p>
                    <p className="text-xs text-gray-400">ETB {(Number(item.unitPrice) * item.quantity).toLocaleString()}</p>
                    <span className={`status-badge mt-1 ${STATUS_COLORS[itemStatus] || 'bg-gray-100 text-gray-700'}`}>{statusLabel(itemStatus)}</span>
                    {isItemPaid(item) && <span className="status-badge mt-1 ml-1 bg-emerald-100 text-emerald-800">Paid</span>}
                    {item.assignedKitchenWorker && <p className="text-[10px] text-gray-500 mt-1">{item.assignedKitchenWorker.name}</p>}
                    {nextItemStatus && (
                      <button
                        disabled={submitting}
                        onClick={() => handleItemStatusChange(detailOrder.id, item.id, nextItemStatus)}
                        className="block ml-auto mt-1 text-[11px] px-2 py-1 rounded bg-brand-100 text-brand-700 hover:bg-brand-200 disabled:opacity-50"
                      >
                        Mark served
                      </button>
                    )}
                  </div>
                </div>
              )})}
            </div>
            {detailOrder.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-4"> {detailOrder.notes}</p>}
            {(detailOrder as any).payments?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm">
                <p className="text-xs text-green-700 font-semibold mb-1">Payment</p>
                {(detailOrder as any).payments.map((p: any) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-green-800">
                    <span>{p.method} · ETB {Number(p.amount).toLocaleString()}{Number(p.changeGiven) > 0 ? ` (change ETB ${Number(p.changeGiven).toLocaleString()})` : ''}</span>
                    {p.authenticityVerified && (
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        p.verificationMode === 'test' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800',
                      )}>
                        <CheckCircle size={12} /> ShegerPay {p.verificationMode === 'test' ? 'test verified' : 'verified'}
                      </span>
                    )}
                    {p.reference && <span className="w-full text-xs text-green-700">Reference: {p.reference}</span>}
                  </div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Process Payment</h3>
              <button onClick={() => setPayingOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Order #{orderNumber(payingOrder)} · select one served item or combine several</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Served items available for payment</label>
                {payingOrder.items.map((item) => {
                  const payable = item.status === 'served' && !isItemPaid(item);
                  const selected = selectedPaymentItemIds.includes(item.id);
                  return (
                    <label key={item.id} className={clsx('flex items-center justify-between gap-3 rounded-lg border p-3', payable ? 'cursor-pointer bg-white' : 'bg-gray-50 opacity-60')}>
                      <span className="flex items-center gap-3">
                        <input type="checkbox" checked={selected} disabled={!payable} onChange={() => togglePaymentItem(item.id)} />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">{item.quantity}× {item.menuItem?.name || `Item ${item.menuItemId}`}</span>
                          <span className="block text-xs text-gray-500">{isItemPaid(item) ? 'Paid' : statusLabel(item.status || payingOrder.status)}</span>
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{fmtCurrency(selectedPaymentAllocations.get(item.id) || 0)}</span>
                    </label>
                  );
                })}
                <div className="flex justify-between rounded-lg bg-brand-50 px-3 py-2 font-semibold text-brand-800">
                  <span>Selected total</span>
                  <span>{fmtCurrency(selectedPaymentTotal)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'mobile'] as const).map((m) => (
                    <button key={m} onClick={() => {
                      setPayMethod(m);
                      if (m === 'cash') setVerifyAuthenticity(false);
                    }}
                      className={clsx('py-2 rounded-lg text-sm font-medium border-2 transition-colors', payMethod === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      {m === 'cash' ? '' : m === 'card' ? '' : ''} {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input" placeholder="Enter amount" />
              </div>
              {payMethod === 'cash' && parseFloat(payAmount) > selectedPaymentTotal && (
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-700">Change: <span className="font-bold">ETB {(parseFloat(payAmount) - selectedPaymentTotal).toLocaleString()}</span></p>
                </div>
              )}
              {payMethod !== 'cash' && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={verifyAuthenticity}
                      onChange={e => setVerifyAuthenticity(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-brand-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Verify payment authenticity with ShegerPay</span>
                      <span className="block text-xs text-gray-500">The payment will only be confirmed if ShegerPay verifies the transaction and amount.</span>
                    </span>
                  </label>
                  {verifyAuthenticity && (
                    <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Payment provider</label>
                        <select value={verificationProvider} onChange={e => setVerificationProvider(e.target.value)} className="input">
                          <option value="">Select provider…</option>
                          <option value="cbe">CBE</option>
                          <option value="telebirr">Telebirr</option>
                          <option value="mpesa">M-Pesa</option>
                          <option value="boa">Bank of Abyssinia</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Transaction ID</label>
                        <input value={transactionId} onChange={e => setTransactionId(e.target.value)} className="input" placeholder="Enter the payment transaction ID" />
                      </div>
                      {verificationProvider === 'mpesa' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Payer phone number</label>
                          <input type="tel" value={payerPhone} onChange={e => setPayerPhone(e.target.value)} className="input" placeholder="Required for M-Pesa" />
                        </div>
                      )}
                      {verificationProvider === 'boa' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Sender account</label>
                          <input value={senderAccount} onChange={e => setSenderAccount(e.target.value)} className="input" placeholder="Required for Bank of Abyssinia" />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Expected sender name <span className="font-normal text-gray-400">(optional)</span></label>
                        <input value={expectedSenderName} onChange={e => setExpectedSenderName(e.target.value)} className="input" placeholder="Name shown on the payment" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {paymentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  <p className="font-semibold">Payment was not confirmed</p>
                  <p className="mt-0.5">{paymentError}</p>
                </div>
              )}
            </div>
            <button
              onClick={handlePayment}
              disabled={
                submitting ||
                selectedPaymentItemIds.length === 0 ||
                Number(payAmount) < selectedPaymentTotal ||
                (verifyAuthenticity && (!verificationProvider || !transactionId.trim() || (verificationProvider === 'mpesa' && !payerPhone.trim()) || (verificationProvider === 'boa' && !senderAccount.trim())))
              }
              className="btn-primary w-full mt-5 py-3 disabled:opacity-50"
            >
              {submitting ? (verifyAuthenticity ? 'Verifying...' : 'Processing...') : verifyAuthenticity ? 'Verify & Confirm Payment' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

      {verificationSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className={clsx(
              'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
              verificationSuccess.mode === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
            )}>
              <CheckCircle size={30} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {verificationSuccess.mode === 'test' ? 'Test verification passed' : 'Payment verified'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Order #{verificationSuccess.orderNumber} · {fmtCurrency(verificationSuccess.amount)}
            </p>
            {verificationSuccess.mode === 'test' ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
                <p className="font-semibold">Test mode only</p>
                <p className="mt-1">The test key returned a successful simulation. This does not prove that a real bank or mobile-money transfer occurred.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                ShegerPay confirmed the transaction and selected payment amount.
              </div>
            )}
            <dl className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3 text-left text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Provider</dt>
                <dd className="font-medium uppercase text-gray-900">{verificationSuccess.provider || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Transaction ID</dt>
                <dd className="break-all text-right font-medium text-gray-900">{verificationSuccess.reference || '—'}</dd>
              </div>
              {verificationSuccess.requestId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Request ID</dt>
                  <dd className="break-all text-right font-medium text-gray-900">{verificationSuccess.requestId}</dd>
                </div>
              )}
            </dl>
            <button onClick={() => setVerificationSuccess(null)} className="btn-primary mt-5 w-full py-3">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
