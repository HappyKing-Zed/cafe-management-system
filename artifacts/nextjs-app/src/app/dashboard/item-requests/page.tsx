'use client';
import { useEffect, useState } from 'react';
import { getItemRequests, createItemRequest, updateItemRequestStatus, getRequestableItems } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PackageOpen, Plus, RefreshCw } from 'lucide-react';
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
  inventoryItem?: { id: number; name: string; unit: string; currentStock?: number; unitCost?: number };
  requestedBy?: { id: number; name: string };
  approvedBy?: { name: string };
  issuedBy?: { name: string };
}

interface Item { id: number; name: string; unit: string; currentStock: number; unitCost?: number; }

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending Approval', cls: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved — awaiting stock out', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  issued: { label: 'Issued — confirm receipt', cls: 'bg-blue-100 text-blue-800' },
  received: { label: 'Received ✓', cls: 'bg-emerald-100 text-emerald-800' },
};

export default function ItemRequestsPage() {
  const { user } = useAuthStore();
  const canApprove = !!user && ['admin', 'owner', 'manager'].includes(user.role);
  const canIssue = !!user && ['admin', 'owner', 'storekeeper'].includes(user.role);
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ inventoryItemId: '', quantity: '', requesterName: '', reason: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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

  const selectedItem = items.find(i => i.id === parseInt(form.inventoryItemId));
  const formTotal = selectedItem && parseFloat(form.quantity) > 0
    ? (Number(selectedItem.unitCost) || 0) * parseFloat(form.quantity) : 0;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await createItemRequest({
        inventoryItemId: parseInt(form.inventoryItemId),
        quantity: parseFloat(form.quantity),
        requesterName: form.requesterName || undefined,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      });
      setShowModal(false);
      setForm({ inventoryItemId: '', quantity: '', requesterName: '', reason: '', notes: '' });
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <PackageOpen className="text-teal-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Requests</h1>
            <p className="text-sm text-gray-500">Coordinator fills request details — manager approves, store keeper stocks out</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /></button>
          <button onClick={() => { setShowModal(true); setError(''); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Request Item</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="table-header">#</th><th className="table-header">Item</th><th className="table-header">Qty</th>
              <th className="table-header">Unit Price</th><th className="table-header">Total Price</th>
              <th className="table-header">Requester</th><th className="table-header">Reason</th>
              {canApprove && <th className="table-header">In Stock</th>}
              <th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {requests.length === 0 ? <tr><td colSpan={11} className="text-center py-10 text-gray-400">No item requests yet — click "Request Item" to make one</td></tr> : requests.map((r) => {
                const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
                const mine = r.requestedBy?.id === user?.id;
                const stockItem = items.find(i => i.id === r.inventoryItem?.id);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="table-cell font-semibold text-brand-600">#{r.id}</td>
                    <td className="table-cell font-medium">{r.inventoryItem?.name || '—'}{r.notes && <p className="text-xs text-gray-400 font-normal">{r.notes}</p>}</td>
                    <td className="table-cell">{Number(r.quantity)} {r.inventoryItem?.unit}</td>
                    <td className="table-cell text-gray-500">ETB {unitPrice(r).toLocaleString()}</td>
                    <td className="table-cell font-semibold">ETB {totalPrice(r).toLocaleString()}</td>
                    <td className="table-cell text-gray-500">{r.requesterName || r.requestedBy?.name || '—'}
                      {r.requesterName && r.requestedBy?.name && r.requesterName !== r.requestedBy.name && (
                        <p className="text-xs text-gray-400">via {r.requestedBy.name}</p>)}
                    </td>
                    <td className="table-cell text-gray-500 text-xs max-w-[160px]">{r.reason || '—'}</td>
                    {canApprove && <td className="table-cell text-gray-500">{stockItem ? `${Number(stockItem.currentStock)} ${stockItem.unit}` : '—'}</td>}
                    <td className="table-cell"><span className={clsx('status-badge', st.cls)}>{st.label}</span></td>
                    <td className="table-cell text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
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
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Request Item from Store</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select value={form.inventoryItemId} onChange={e => setForm(p => ({ ...p, inventoryItemId: e.target.value }))} className="input">
                  <option value="">Select item...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({Number(i.currentStock)} {i.unit} in stock)</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" min={0} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="input" /></div>
              {formTotal > 0 && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  Total price: <span className="font-semibold">ETB {formTotal.toLocaleString()}</span>
                  <span className="text-xs text-gray-400"> (ETB {Number(selectedItem?.unitCost || 0).toLocaleString()} / {selectedItem?.unit})</span>
                </p>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
                <input value={form.requesterName} onChange={e => setForm(p => ({ ...p, requesterName: e.target.value }))} className="input" placeholder="Who needs the items (defaults to you)" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="input" placeholder="e.g. for tonight's dinner service" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="input" /></div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submit} disabled={submitting || !form.inventoryItemId || !(parseFloat(form.quantity) > 0)} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Sending...' : 'Send Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
