'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine, CheckCircle2, XCircle, Plus, Search,
  ArrowRightLeft, AlertCircle, ShoppingBag
} from 'lucide-react';
import {
  approveMainStoreTransfer,
  getMainStoreTransfers,
  rejectMainStoreTransfer,
  getMainStoreRequestableItems,
  createMainStoreTransfer,
  transferMainStoreTransfer,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import clsx from 'clsx';

interface TransferLine {
  id: number;
  mainStoreItemId: number;
  name: string;
  unit: string;
  quantity: number;
  mainStoreBalanceAfter?: number;
  branchBalanceAfter?: number;
}

interface Transfer {
  id: number;
  status: 'pending' | 'approved' | 'transferred' | 'rejected';
  note?: string;
  createdAt: string;
  requestedBy?: { name: string };
  approvedBy?: { name: string };
  transferredBy?: { name: string };
  rejectedBy?: { name: string };
  destinationBranchId: number;
  destinationBranch?: { id: number; name: string };
  lines: TransferLine[];
}

interface RequestableItem {
  id: number;
  name: string;
  unit: string;
  category?: string;
  currentStock: number;
}

const TABS = ['Active Requests', 'History'];

export default function MainStoreRequestsPage() {
  const { user } = useAuthStore();
  const isBranchStoreKeeper = user?.role === 'branch_store_keeper';
  const isMainStoreKeeper = user?.role === 'main_store_keeper';
  const canApprove = user?.role === 'manager' || user?.role === 'owner';

  const [tab, setTab] = useState('Active Requests');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<{ action: 'approve' | 'reject' | 'fulfill'; transfer: Transfer } | null>(null);

  // Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestableItems, setRequestableItems] = useState<RequestableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [requestLines, setRequestLines] = useState<{ mainStoreItemId: string; quantity: string }[]>([{ mainStoreItemId: '', quantity: '' }]);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getMainStoreTransfers();
      setTransfers(response.data || []);
    } catch (e) {
      console.error('Failed to load transfers', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleOpenRequestModal = async () => {
    setShowRequestModal(true);
    setLoadingItems(true);
    try {
      const res = await getMainStoreRequestableItems();
      setRequestableItems(res.data || []);
    } catch (e) {
      console.error('Failed to load items', e);
      alert('Could not load requestable items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleCreateRequest = async () => {
    const validLines = requestLines.filter(l => l.mainStoreItemId && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      alert('Add at least one valid item to request.');
      return;
    }

    setSubmitting(true);
    try {
      await createMainStoreTransfer({
        note: requestNote || undefined,
        lines: validLines.map(l => ({
          mainStoreItemId: parseInt(l.mainStoreItemId),
          quantity: parseFloat(l.quantity)
        }))
      });
      setShowRequestModal(false);
      setRequestLines([{ mainStoreItemId: '', quantity: '' }]);
      setRequestNote('');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      if (decision === 'approve') await approveMainStoreTransfer(id);
      else await rejectMainStoreTransfer(id);
      setMessage(decision === 'approve'
        ? 'Request approved. The Main Store Keeper has been notified to prepare and transfer the approved items.'
        : 'Request rejected. The requesting branch has been notified.');
      await load();
    } catch (error: any) {
      window.alert(error?.response?.data?.message || `Could not ${decision} request`);
    } finally {
      setBusyId(null);
    }
  };

  const fulfill = async (id: number) => {
    setBusyId(id);
    setMessage('');
    try {
      await transferMainStoreTransfer(id);
      setMessage('Request fulfilled. Main Store and branch balances were updated and recorded in the audit history.');
      await load();
    } catch (error: any) {
      window.alert(error?.response?.data?.message || 'Could not fulfill request');
    } finally {
      setBusyId(null);
    }
  };

  const active = transfers.filter((transfer) => transfer.status === 'pending' || transfer.status === 'approved');
  const history = transfers.filter((transfer) => transfer.status === 'transferred' || transfer.status === 'rejected');

  const confirmSelectedAction = async () => {
    if (!confirmation) return;
    const { action, transfer } = confirmation;
    setConfirmation(null);
    if (action === 'fulfill') await fulfill(transfer.id);
    else await decide(transfer.id, action);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
            <ArrowRightLeft className="text-teal-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-teal-950">Main Store Requests</h1>
            <p className="text-sm text-teal-800/70">
              Branch Store Keepers request stock, Managers/Owners approve or reject it, and the Main Store Keeper fulfills approved requests. Stock changes only when fulfillment is completed.
            </p>
          </div>
        </div>

        {isBranchStoreKeeper && (
          <button
            onClick={handleOpenRequestModal}
            className="btn-primary flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
          >
            <Plus size={16} /> Request Stock
          </button>
        )}
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

      <div className="flex gap-6 border-b border-cream-200 mb-6 overflow-x-auto custom-scrollbar">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'pb-3 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition-colors',
              tab === t ? 'border-teal-700 text-teal-800' : 'border-transparent text-coffee-400 hover:text-coffee-600'
            )}
          >
            {t === 'Active Requests' ? <ArrowDownToLine size={16} /> : <ShoppingBag size={16} />}
            {t}
            {t === 'Active Requests' && active.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full px-2 py-0.5 ml-1">
                {active.length} active
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {tab === 'Active Requests' && (
            <div className="grid gap-4 md:grid-cols-2">
              {active.length === 0 ? (
                <div className="col-span-full card py-12 text-center text-coffee-400 text-sm">
                  No active requests.
                </div>
              ) : active.map((transfer) => {
                const isPending = transfer.status === 'pending';
                return (
                  <article key={transfer.id} className={clsx("card p-5 border-l-4", isPending ? "border-l-amber-500 bg-amber-50/10" : "border-l-blue-500 bg-blue-50/10")}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                            REQ-{String(transfer.id).padStart(4, '0')}
                          </span>
                          <span className="text-xs text-coffee-400">
                            {new Date(transfer.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="font-semibold text-teal-950 flex items-center gap-2">
                          Branch: {transfer.destinationBranch?.name || `Branch #${transfer.destinationBranchId}`}
                        </p>
                        {transfer.requestedBy?.name && (
                          <p className="text-xs text-coffee-500 mt-1">Requested by {transfer.requestedBy.name}</p>
                        )}
                      </div>
                      <span className={clsx("status-badge self-start", isPending ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")}>
                        {isPending ? 'Pending Approval' : 'Approved'}
                      </span>
                    </div>

                    <div className="bg-white rounded-lg border border-cream-200 p-3 mb-4">
                      <h5 className="text-xs font-semibold text-coffee-400 uppercase tracking-wider mb-2">Items</h5>
                      <ul className="space-y-2">
                        {transfer.lines.map((line) => (
                          <li key={line.id} className="flex justify-between text-sm">
                            <span className="font-medium text-teal-900">{line.name}</span>
                            <span className="text-teal-700 font-semibold">{Number(line.quantity)} <span className="text-xs text-coffee-400 font-normal">{line.unit}</span></span>
                          </li>
                        ))}
                      </ul>
                      {transfer.note && (
                        <div className="mt-3 pt-3 border-t border-cream-100 text-sm text-coffee-600 italic">
                          "{transfer.note}"
                        </div>
                      )}
                    </div>

                    {isPending && canApprove && (
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          className="btn-primary flex items-center justify-center gap-2"
                          disabled={busyId === transfer.id}
                          onClick={() => setConfirmation({ action: 'approve', transfer })}
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button
                          type="button"
                          className="btn-secondary flex items-center justify-center gap-2 text-red-700"
                          disabled={busyId === transfer.id}
                          onClick={() => setConfirmation({ action: 'reject', transfer })}
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    )}

                    {isPending && !canApprove && (
                      <div className="text-xs text-coffee-400 text-center bg-cream-50 py-2 rounded-lg border border-cream-100 flex items-center justify-center gap-2">
                        Waiting for Manager/Owner decision. Stock remains unchanged.
                      </div>
                    )}

                    {!isPending && isMainStoreKeeper && (
                      <button
                        type="button"
                        className="btn-primary mt-4 flex w-full items-center justify-center gap-2"
                        disabled={busyId === transfer.id}
                        onClick={() => setConfirmation({ action: 'fulfill', transfer })}
                      >
                        <ArrowRightLeft size={16} /> Fulfill Approved Request
                      </button>
                    )}

                    {!isPending && !isMainStoreKeeper && (
                      <div className="text-xs text-coffee-400 text-center bg-cream-50 py-2 rounded-lg border border-cream-100">
                        Approved; stock is unchanged. Waiting for the Main Store Keeper to fulfill the request.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {tab === 'History' && (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-cream-50">
                    <tr>
                      <th className="table-header">Request</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Branch</th>
                      <th className="table-header">Items</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {history.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-coffee-400 text-sm">No transfer history yet.</td></tr>
                    ) : history.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-cream-50/50">
                        <td className="table-cell font-mono text-xs text-teal-700 font-medium">REQ-{String(transfer.id).padStart(4, '0')}</td>
                        <td className="table-cell whitespace-nowrap">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                        <td className="table-cell font-medium text-teal-900">{transfer.destinationBranch?.name || `Branch #${transfer.destinationBranchId}`}</td>
                        <td className="table-cell">
                          <div className="text-sm">
                            {transfer.lines.length} item{transfer.lines.length !== 1 && 's'}
                          </div>
                          <div className="text-xs text-coffee-400 space-y-1">
                            {transfer.lines.map((line) => (
                              <div key={line.id}>
                                {line.name}
                                {transfer.status === 'transferred' && line.branchBalanceAfter != null
                                  ? ` · post-transfer branch balance ${Number(line.branchBalanceAfter)} ${line.unit}`
                                  : ''}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="table-cell">
                          {transfer.status === 'transferred' ? (
                            <span className="status-badge bg-green-100 text-green-800">Transferred</span>
                          ) : (
                            <span className="status-badge bg-red-100 text-red-800">Rejected</span>
                          )}
                        </td>
                        <td className="table-cell text-xs text-coffee-500 space-y-1">
                          {transfer.status === 'transferred' && transfer.transferredBy && <div>Transferred by {transfer.transferredBy.name}</div>}
                          {transfer.status === 'rejected' && transfer.rejectedBy && <div>Rejected by {transfer.rejectedBy.name}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="main-store-confirm-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-cream-200 bg-cream-50 px-6 py-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                {confirmation.action === 'reject'
                  ? <XCircle className="text-red-600" size={23} />
                  : <ArrowRightLeft className="text-teal-700" size={23} />}
              </div>
              <h2 id="main-store-confirm-title" className="font-display text-xl font-bold text-teal-950">
                {confirmation.action === 'approve' && 'Approve Main Store Request?'}
                {confirmation.action === 'reject' && 'Reject Main Store Request?'}
                {confirmation.action === 'fulfill' && 'Transfer Stock to Branch?'}
              </h2>
              <p className="mt-1 text-sm font-medium text-teal-700">
                REQ-{String(confirmation.transfer.id).padStart(4, '0')} · {confirmation.transfer.destinationBranch?.name || `Branch #${confirmation.transfer.destinationBranchId}`}
              </p>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm leading-6 text-coffee-600">
              {confirmation.action === 'approve' && (
                <>
                  <p>Approve this request and send it to the Main Store Keeper for transfer?</p>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900">
                    No stock will change during approval. Inventory changes only after the Main Store Keeper completes the transfer.
                  </p>
                </>
              )}
              {confirmation.action === 'reject' && (
                <p>Reject this request? The Branch Store Keeper will be notified and no stock will change.</p>
              )}
              {confirmation.action === 'fulfill' && (
                <>
                  <p>Transfer the approved items from Main Store to this branch now?</p>
                  <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-900">
                    This action immediately deducts Main Store stock and adds the quantities to branch stock. The transaction will be recorded in transfer history.
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-cream-200 bg-cream-50 px-6 py-4">
              <button type="button" className="btn-secondary px-5" onClick={() => setConfirmation(null)}>Cancel</button>
              <button
                type="button"
                className={clsx('px-5', confirmation.action === 'reject' ? 'btn-secondary text-red-700' : 'btn-primary')}
                onClick={() => void confirmSelectedAction()}
              >
                {confirmation.action === 'approve' && 'Approve Request'}
                {confirmation.action === 'reject' && 'Reject Request'}
                {confirmation.action === 'fulfill' && 'Transfer Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-cream-200 flex justify-between items-center bg-cream-50">
              <h3 className="font-display font-bold text-lg text-teal-950 flex items-center gap-2">
                <ArrowRightLeft className="text-teal-600" /> Request Stock from Main Store
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-coffee-400 hover:text-teal-900 transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-cream-50/30">
              {loadingItems ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-teal-900 mb-3">Items to Request *</label>
                    <div className="space-y-3">
                      {requestLines.map((line, idx) => (
                        <div key={idx} className="flex gap-3 items-end">
                          <div className="flex-1">
                            <select
                              value={line.mainStoreItemId}
                              onChange={e => setRequestLines(lines => lines.map((l, i) => i === idx ? { ...l, mainStoreItemId: e.target.value } : l))}
                              className="input bg-white"
                            >
                              <option value="">Select item...</option>
                              {requestableItems.map(i => (
                                <option key={i.id} value={i.id}>
                                  {i.name} (Main Store: {i.currentStock} {i.unit})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-32">
                            <input
                              type="number"
                              min="0.01" step="0.01"
                              placeholder="Qty"
                              value={line.quantity}
                              onChange={e => setRequestLines(lines => lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                              className="input bg-white"
                            />
                          </div>
                          {requestLines.length > 1 && (
                            <button
                              onClick={() => setRequestLines(lines => lines.filter((_, i) => i !== idx))}
                              className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 border border-transparent hover:border-red-100"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setRequestLines(lines => [...lines, { mainStoreItemId: '', quantity: '' }])}
                      className="mt-4 text-sm font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus size={16} /> Add another item
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-teal-900 mb-2">Note / Reason (Optional)</label>
                    <textarea
                      value={requestNote}
                      onChange={e => setRequestNote(e.target.value)}
                      placeholder="e.g. Need extra for weekend event"
                      className="input min-h-[80px] resize-y bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-cream-200 bg-cream-50 flex justify-end gap-3">
              <button onClick={() => setShowRequestModal(false)} className="btn-secondary px-6">Cancel</button>
              <button
                onClick={handleCreateRequest}
                disabled={submitting || loadingItems}
                className="btn-primary px-8 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
