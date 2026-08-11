'use client';
import { useEffect, useMemo, useState } from 'react';
import { getItemRequests, createItemRequest, updateItemRequestStatus, getRequestableItems } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { FilePlus2, PackageOpen, Plus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface ItemRequest {
  id: number;
  status: string;
  quantity: number;
  notes?: string;
  requesterName?: string;
  reason?: string;
  unitCost?: number;
  createdAt: string;
  inventoryItem?: { id: number; name: string; unit: string; currentStock?: number; unitCost?: number; category?: string };
  requestedBy?: { id: number; name: string };
  approvedBy?: { name: string };
  issuedBy?: { name: string };
}

interface Item { id: number; name: string; unit: string; currentStock: number; unitCost?: number; category?: string; }

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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ requesterName: '', category: '', inventoryItemId: '', quantity: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adjusting, setAdjusting] = useState<{ id: number; quantity: string } | null>(null);

  const fetchData = async () => {
    const [reqRes, itemRes] = await Promise.all([getItemRequests(), getRequestableItems()]);
    setRequests(reqRes.data || []);
    setItems(itemRes.data || []);
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
        requesterName: form.requesterName || undefined,
        reason: form.reason || undefined,
      });
      setForm({ requesterName: '', category: '', inventoryItemId: '', quantity: '', reason: '' });
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
            <h1 className="text-2xl font-bold text-gray-900">Item Requests</h1>
            <p className="text-sm text-gray-500">Submit new store requisitions and track the status of your pending approvals.</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 shrink-0"><RefreshCw size={16} /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
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
                <input value={form.requesterName} onChange={e => setForm(p => ({ ...p, requesterName: e.target.value }))} className="input text-sm" placeholder={user?.name || 'Who needs the items'} /></div>
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
                  {canApprove && <th className="table-header">In Stock</th>}
                  <th className="table-header">Status</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.length === 0 ? <tr><td colSpan={canApprove ? 7 : 6} className="text-center py-10 text-gray-400">No item requests yet — use the form to submit one</td></tr> : requests.map((r) => {
                    const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
                    const mine = r.requestedBy?.id === user?.id;
                    const stockItem = items.find(i => i.id === r.inventoryItem?.id);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="table-cell text-xs font-semibold text-gray-500">REQ-{String(r.id).padStart(3, '0')}</td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{r.inventoryItem?.name || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {r.requesterName || r.requestedBy?.name || '—'}
                            {r.reason ? ` · ${r.reason}` : ''}
                          </p>
                          <p className="text-[10px] text-gray-300">{new Date(r.createdAt).toLocaleString()}</p>
                        </td>
                        <td className="table-cell">{Number(r.quantity)} {r.inventoryItem?.unit}</td>
                        <td className="table-cell font-semibold">ETB {totalPrice(r).toLocaleString()}</td>
                        {canApprove && <td className="table-cell text-gray-500">{stockItem ? `${Number(stockItem.currentStock)} ${stockItem.unit}` : '—'}</td>}
                        <td className="table-cell">
                          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', st.cls)}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1 flex-wrap items-center">
                            {r.status === 'pending' && canApprove && (adjusting?.id === r.id ? <>
                              <input type="number" min={0} value={adjusting.quantity}
                                onChange={e => setAdjusting({ id: r.id, quantity: e.target.value })}
                                className="input !w-20 !py-1 text-xs" />
                              <button onClick={() => setStatus(r.id, 'approved', parseFloat(adjusting.quantity))}
                                disabled={!(parseFloat(adjusting.quantity) > 0)}
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50">Approve Adjusted</button>
                              <button onClick={() => setAdjusting(null)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Cancel</button>
                            </> : <>
                              <button onClick={() => setStatus(r.id, 'approved')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Approve</button>
                              <button onClick={() => setAdjusting({ id: r.id, quantity: String(Number(r.quantity)) })} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200">Adjust</button>
                              <button onClick={() => setStatus(r.id, 'rejected')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button>
                            </>)}
                            {r.status === 'pending' && !canApprove && <span className="text-xs text-gray-400">Awaiting manager</span>}
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
