'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getItemRequests, createItemRequest, updateItemRequestStatus, getRequestableItems, getStaffList, getLowStockItems } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AlertTriangle, Check, ClipboardCheck, FilePlus2, PackageOpen, Pencil, Plus, RefreshCw, ShoppingCart, X } from 'lucide-react';
import clsx from 'clsx';

interface ItemRequest {
  id: number;
  status: string;
  quantity: number;
  notes?: string;
  requesterName?: string;
  reason?: string;
  department?: string;
  unitCost?: number;
  createdAt: string;
  inventoryItem?: { id: number; name: string; unit: string; currentStock?: number; unitCost?: number; category?: string };
  requestedBy?: { id: number; name: string };
  approvedBy?: { name: string };
  issuedBy?: { name: string };
}

interface Item { id: number; name: string; unit: string; currentStock: number; unitCost?: number; category?: string; }
interface Staff { id: number; name: string; role: string; }

const ROLE_DEPARTMENT: Record<string, string> = {
  admin: 'Management', owner: 'Management', manager: 'Management',
  coordinator: 'Coordination', waiter: 'Service', chef: 'Kitchen',
  cashier: 'Finance', storekeeper: 'Store',
};
const departmentForRole = (role?: string) => (role && ROLE_DEPARTMENT[role]) || '';

const STATUS_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  pending: { label: 'Pending', cls: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  approved: { label: 'Approved', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  issued: { label: 'Issued', cls: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  received: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
};

const NONE_CAT = '__none__';

export default function ItemRequestsPage() {
  const { user } = useAuthStore();
  const canApprove = !!user && ['admin', 'owner', 'manager'].includes(user.role);
  const canIssue = !!user && ['admin', 'owner', 'storekeeper'].includes(user.role);
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [lowStock, setLowStock] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ requesterId: '', category: '', inventoryItemId: '', quantity: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adjusting, setAdjusting] = useState<{ id: number; quantity: string } | null>(null);
  const [reqTab, setReqTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fetchData = async () => {
    const [reqRes, itemRes, staffRes, lowRes] = await Promise.all([
      getItemRequests(), getRequestableItems(),
      getStaffList().catch(() => ({ data: [] })),
      getLowStockItems().catch(() => ({ data: [] })),
    ]);
    setRequests(reqRes.data || []);
    setItems(itemRes.data || []);
    setStaff(staffRes.data || []);
    setLowStock(lowRes.data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore polling errors */ }); }, 15000);
    return () => clearInterval(t);
  }, []);

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter((c): c is string => !!c && c !== NONE_CAT))).sort(), [items]);
  const hasUncategorized = items.some(i => !i.category);
  const itemsForCat = form.category
    ? items.filter(i => (form.category === NONE_CAT ? !i.category : i.category === form.category))
    : items;

  const selectedItem = items.find(i => i.id === parseInt(form.inventoryItemId));
  const formTotal = selectedItem && parseFloat(form.quantity) > 0
    ? (Number(selectedItem.unitCost) || 0) * parseFloat(form.quantity) : 0;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await createItemRequest({
        inventoryItemId: parseInt(form.inventoryItemId),
        quantity: parseFloat(form.quantity),
        requesterId: form.requesterId ? parseInt(form.requesterId) : undefined,
        reason: form.reason || undefined,
      });
      setForm({ requesterId: '', category: '', inventoryItemId: '', quantity: '', reason: '' });
      setSuccess('Request sent — the manager has been notified.');
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not create request');
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (id: number, status: string, quantity?: number) => {
    try {
      await updateItemRequestStatus(id, status, quantity);
      setAdjusting(null);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Action failed');
    }
  };

  const unitPrice = (r: ItemRequest) => Number(r.unitCost ?? r.inventoryItem?.unitCost ?? 0);
  const totalPrice = (r: ItemRequest) => unitPrice(r) * Number(r.quantity);

  return (
    <div className="p-8">
      {/* Hero banner */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <PackageOpen className="text-blue-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{canApprove ? 'Item Requested' : 'Item Requests'}</h1>
            <p className="text-sm text-gray-500">{canApprove ? 'Review and manage incoming item requests.' : 'Submit new store requisitions and track the status of your pending approvals.'}</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 shrink-0"><RefreshCw size={16} /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : canApprove ? (
        <div className="space-y-6">
          <div>
            {/* Pending Approvals */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><ClipboardCheck className="text-blue-600" size={18} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900">Item Requests</h2>
                    <p className="text-xs text-gray-500">Review and manage incoming item requests.</p>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {([['pending', 'Pending Approval'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const).map(([v, l]) => {
                    const count = v === 'pending' ? requests.filter(r => r.status === 'pending').length
                      : v === 'approved' ? requests.filter(r => ['approved', 'issued', 'received'].includes(r.status)).length
                      : requests.filter(r => r.status === 'rejected').length;
                    return (
                      <button key={v} onClick={() => setReqTab(v)}
                        className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5', reqTab === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                        {l}
                        {count > 0 && <span className={clsx('text-[10px] font-bold rounded-full px-1.5 py-0.5', v === 'pending' ? 'bg-amber-100 text-amber-700' : v === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="table-header">Requester</th><th className="table-header">Item Details</th>
                    <th className="table-header">Qty</th><th className="table-header">In Stock</th>
                    <th className="table-header">Total Est.</th><th className="table-header">Date &amp; Time</th>
                    <th className="table-header text-right">{reqTab === 'pending' ? 'Actions' : 'Status'}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const list = reqTab === 'pending' ? requests.filter(r => r.status === 'pending')
                        : reqTab === 'approved' ? requests.filter(r => ['approved', 'issued', 'received'].includes(r.status))
                        : requests.filter(r => r.status === 'rejected');
                      if (list.length === 0) return (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                          {reqTab === 'pending' ? 'No pending requests — all caught up' : reqTab === 'approved' ? 'No approved requests yet' : 'No rejected requests'}
                        </td></tr>
                      );
                      return list.map(r => {
                      const name = r.requesterName || r.requestedBy?.name || '—';
                      const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                      const stockItem = items.find(i => i.id === r.inventoryItem?.id);
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">{initials || '?'}</div>
                              <div>
                                <p className="font-medium text-gray-900">{name}</p>
                                <p className="text-xs text-gray-400">{r.department || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">
                            <p className="font-medium text-gray-900">{r.inventoryItem?.name || '—'}</p>
                            <p className="text-xs text-gray-400">REQ-{String(r.id).padStart(3, '0')}{r.reason ? ` · ${r.reason}` : ''}</p>
                          </td>
                          <td className="table-cell">{Number(r.quantity)} {r.inventoryItem?.unit}</td>
                          <td className="table-cell text-gray-500">{stockItem ? `${Number(stockItem.currentStock)} ${stockItem.unit}` : '—'}</td>
                          <td className="table-cell font-semibold">ETB {totalPrice(r).toLocaleString()}</td>
                          <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleDateString()}
                            <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="table-cell">
                            {r.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {adjusting?.id === r.id ? <>
                                  <input type="number" min={0} value={adjusting.quantity}
                                    onChange={e => setAdjusting({ id: r.id, quantity: e.target.value })}
                                    className="input !w-20 !py-1 text-xs" autoFocus />
                                  <button onClick={() => setStatus(r.id, 'approved', parseFloat(adjusting.quantity))}
                                    disabled={!(parseFloat(adjusting.quantity) > 0)}
                                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50">Approve</button>
                                  <button onClick={() => setAdjusting(null)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Cancel</button>
                                </> : <>
                                  <button onClick={() => setAdjusting({ id: r.id, quantity: String(Number(r.quantity)) })}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 tracking-wide px-1.5 py-1 flex items-center gap-1" title="Adjust quantity before approving"><Pencil size={12} /> ADJUST</button>
                                  <button onClick={() => setStatus(r.id, 'approved')} title="Approve"
                                    className="w-8 h-8 rounded-full border border-green-200 text-green-600 hover:bg-green-50 flex items-center justify-center"><Check size={15} /></button>
                                  <button onClick={() => setStatus(r.id, 'rejected')} title="Reject"
                                    className="w-8 h-8 rounded-full border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center"><X size={15} /></button>
                                </>}
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-1.5">
                                {(() => { const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending; return (
                                  <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', st.cls)}>
                                    <span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
                                  </span>
                                ); })()}
                                {r.status === 'approved' && canIssue && (
                                  <button onClick={() => setStatus(r.id, 'issued')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Stock Out</button>
                                )}
                                {r.status === 'approved' && !canIssue && <span className="text-[10px] text-gray-400">Awaiting store keeper</span>}
                                {r.status === 'issued' && r.requestedBy?.id === user?.id && (
                                  <button onClick={() => setStatus(r.id, 'received')} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Confirm Received</button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t text-xs text-gray-400">
                Showing {requests.filter(r => r.status === 'pending').length} pending request{requests.filter(r => r.status === 'pending').length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center"><AlertTriangle className="text-red-500" size={18} /></div>
                <h2 className="font-bold text-gray-900">Low Stock Alerts</h2>
              </div>
              {lowStock.length === 0 ? <p className="text-sm text-gray-400">No items are running low.</p> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStock.slice(0, 6).map((i: any) => {
                    const critical = Number(i.currentStock) <= Number(i.minStock) / 2;
                    return (
                      <div key={i.id} className={clsx('border rounded-xl p-4', critical ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40')}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={clsx('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded', critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700')}>{critical ? 'Critical' : 'Warning'}</span>
                          {i.category && <span className="text-[10px] text-gray-400">{i.category}</span>}
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">{i.name}</p>
                        <p className={clsx('text-2xl font-bold', critical ? 'text-red-600' : 'text-amber-600')}>{Number(i.currentStock)}</p>
                        <p className="text-xs text-gray-500 mb-3">{i.unit} remaining (Min: {Number(i.minStock)})</p>
                        <Link href="/dashboard/inventory" className="btn-primary w-full flex items-center justify-center gap-1.5 !py-1.5 text-xs"><ShoppingCart size={13} /> Initiate Purchase</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
          {/* New Requisition form */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center"><FilePlus2 className="text-blue-600" size={16} /></div>
              <h2 className="font-bold text-gray-900">New Requisition</h2>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Requester Name</label>
                <select value={form.requesterId} onChange={e => setForm(p => ({ ...p, requesterId: e.target.value }))} className="input text-sm">
                  <option value="">{user?.name ? `${user.name} (me)` : 'Select staff...'}</option>
                  {staff.filter(s => s.id !== user?.id).map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                <input value={departmentForRole(form.requesterId ? staff.find(s => s.id === parseInt(form.requesterId))?.role : user?.role)} readOnly disabled className="input text-sm bg-gray-100 text-gray-500" placeholder="Set automatically from staff role" /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Item Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value, inventoryItemId: '' }))} className="input text-sm">
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  {hasUncategorized && <option value={NONE_CAT}>Uncategorized</option>}
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Item</label>
                <select value={form.inventoryItemId} onChange={e => setForm(p => ({ ...p, inventoryItemId: e.target.value }))} className="input text-sm">
                  <option value="">Select an item...</option>
                  {itemsForCat.map(i => <option key={i.id} value={i.id}>{i.name} ({Number(i.currentStock)} {i.unit} in stock)</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Quantity{selectedItem ? ` (${selectedItem.unit})` : ''}</label>
                <input type="number" min={0} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="input text-sm" placeholder="0" /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Request</label>
                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3} className="input text-sm resize-none" placeholder="Explain the need..." /></div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Estimated Total</p>
                <p className="font-bold text-gray-900">ETB {formTotal.toLocaleString()}</p>
              </div>
              <button onClick={submit} disabled={submitting || !form.inventoryItemId || !(parseFloat(form.quantity) > 0)}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"><Plus size={16} /> {submitting ? 'Sending...' : 'Submit Request'}</button>
            </div>
          </div>

          {/* Sent Requests */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900">Sent Requests</h2>
              <p className="text-xs text-gray-500">Track the status of recent submissions.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Req ID</th><th className="table-header">Item Details</th><th className="table-header">Qty</th>
                  <th className="table-header">Value</th>
                  <th className="table-header">Date &amp; Time</th>
                  <th className="table-header">Status</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">No item requests yet — use the form to submit one</td></tr> : requests.map((r) => {
                    const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
                    const mine = r.requestedBy?.id === user?.id;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="table-cell text-xs font-semibold text-gray-500">REQ-{String(r.id).padStart(3, '0')}</td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{r.inventoryItem?.name || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {r.requesterName || r.requestedBy?.name || '—'}
                            {r.department ? ` (${r.department})` : ''}
                            {r.reason ? ` · ${r.reason}` : ''}
                          </p>
                        </td>
                        <td className="table-cell">{Number(r.quantity)} {r.inventoryItem?.unit}</td>
                        <td className="table-cell font-semibold">ETB {totalPrice(r).toLocaleString()}</td>
                        <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString()}
                          <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="table-cell">
                          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', st.cls)}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1 flex-wrap items-center">
                            {r.status === 'pending' && <span className="text-xs text-gray-400">Awaiting manager</span>}
                            {r.status === 'approved' && (canIssue
                              ? <button onClick={() => setStatus(r.id, 'issued')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Stock Out</button>
                              : <span className="text-xs text-gray-400">Awaiting store keeper</span>)}
                            {r.status === 'issued' && (mine
                              ? <button onClick={() => setStatus(r.id, 'received')} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Confirm Received</button>
                              : <span className="text-xs text-gray-400">Awaiting requester confirmation</span>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
