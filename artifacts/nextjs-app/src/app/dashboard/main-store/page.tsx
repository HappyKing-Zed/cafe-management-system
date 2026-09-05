'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  getMainStoreItems,
  createMainStoreReceipt,
  getMainStoreTransfers,
  transferMainStoreTransfer,
  getApiErrorMessage,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Warehouse, ArrowDownToLine, ArrowRightLeft, Plus, AlertCircle, Package, CheckCircle2, XCircle, Search, Clock, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';

interface MainStoreItem {
  id: number;
  name: string;
  unit: string;
  category?: string;
  unitCost?: number;
  minStock: number;
  currentStock: number;
}

interface TransferLine {
  id: number;
  mainStoreItemId: number;
  quantity: number;
  name: string;
  unit: string;
  mainStoreBalanceAfter?: number;
  branchBalanceAfter?: number;
}

interface MainStoreTransfer {
  id: number;
  status: 'pending' | 'approved' | 'transferred' | 'rejected';
  destinationBranchId: number;
  destinationBranch?: { id: number; name: string };
  note?: string;
  requestedBy?: { name: string };
  approvedBy?: { name: string };
  transferredBy?: { name: string };
  rejectedBy?: { name: string };
  approvedAt?: string;
  rejectedAt?: string;
  transferredAt?: string;
  createdAt: string;
  lines: TransferLine[];
}

const TABS = ['Central Stock', 'Transfer Requests'];

export default function MainStorePage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner';
  const isStorekeeper = user?.role === 'main_store_keeper';

  const [tab, setTab] = useState('Central Stock');
  const [items, setItems] = useState<MainStoreItem[]>([]);
  const [transfers, setTransfers] = useState<MainStoreTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState<MainStoreTransfer | null>(null);

  const [searchStock, setSearchStock] = useState('');

  // Modals state
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Receive form
  const [receiveLines, setReceiveLines] = useState<{name: string; unit: string; category: string; quantity: string; unitCost: string; minStock: string}[]>([
    { name: '', unit: '', category: '', quantity: '', unitCost: '', minStock: '' }
  ]);
  const [receiveNote, setReceiveNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, transfersRes] = await Promise.all([
        getMainStoreItems(),
        getMainStoreTransfers()
      ]);
      setItems(itemsRes.data || []);
      setTransfers(transfersRes.data || []);
    } catch (e) {
      console.error('Failed to load main store data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const t = setInterval(() => { void fetchData(); }, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleReceiveStock = async () => {
    const validLines = receiveLines.filter(l => l.name && l.unit && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      alert('Add at least one valid item to receive.');
      return;
    }

    setSubmitting(true);
    try {
      await createMainStoreReceipt({
        note: receiveNote || undefined,
        lines: validLines.map(l => ({
          name: l.name,
          unit: l.unit,
          category: l.category || undefined,
          quantity: parseFloat(l.quantity),
          unitCost: l.unitCost ? parseFloat(l.unitCost) : undefined,
          minStock: l.minStock ? parseFloat(l.minStock) : undefined
        }))
      });
      setShowReceiveModal(false);
      setReceiveLines([{ name: '', unit: '', category: '', quantity: '', unitCost: '', minStock: '' }]);
      setReceiveNote('');
      await fetchData();
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, 'Failed to receive stock'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteTransfer = async (id: number) => {
    setBusyId(id);
    try {
      await transferMainStoreTransfer(id);
      await fetchData();
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, 'Failed to execute transfer'));
    } finally {
      setBusyId(null);
    }
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchStock.toLowerCase()) ||
    (i.category && i.category.toLowerCase().includes(searchStock.toLowerCase()))
  );

  const pendingOrApproved = transfers.filter(t => t.status === 'pending' || t.status === 'approved');
  const history = transfers.filter(t => t.status === 'transferred' || t.status === 'rejected');

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
            <Warehouse className="text-teal-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-teal-950">Main Store</h1>
            <p className="text-sm text-teal-800/70">Branch Store Keepers request stock, Managers/Owners approve or reject it, and the Main Store Keeper fulfills approved requests. Stock changes only when fulfillment is completed.</p>
          </div>
        </div>

        <div className="flex gap-3">
          {(isOwner || isStorekeeper) && (
            <button
              onClick={() => setShowReceiveModal(true)}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            >
              <ArrowDownToLine size={16} /> Receive Stock
            </button>
          )}
        </div>
      </div>

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
            {t === 'Central Stock' ? <Package size={16} /> : <ArrowRightLeft size={16} />}
            {t}
            {t === 'Transfer Requests' && pendingOrApproved.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full px-2 py-0.5 ml-1">
                {pendingOrApproved.length} active
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'Central Stock' && (
            <div className="card p-0 overflow-hidden">
              <div className="p-4 border-b border-cream-200 bg-cream-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-coffee-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search central stock..."
                    value={searchStock}
                    onChange={(e) => setSearchStock(e.target.value)}
                    className="input pl-9 w-full"
                  />
                </div>
                <div className="text-sm font-medium text-coffee-500">
                  {filteredItems.length} items
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-cream-50">
                    <tr>
                      <th className="table-header">Item</th>
                      <th className="table-header">Category</th>
                      <th className="table-header text-right">In Stock</th>
                      <th className="table-header text-right">Min Stock</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-coffee-400 text-sm">
                          No items found in central stock.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map(item => {
                        const isLow = Number(item.currentStock) <= Number(item.minStock);
                        return (
                          <tr key={item.id} className="hover:bg-cream-50/50 transition-colors">
                            <td className="table-cell">
                              <div className="font-medium text-teal-950">{item.name}</div>
                              <div className="text-xs text-coffee-400">Unit: {item.unit}</div>
                            </td>
                            <td className="table-cell">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
                                {item.category || 'Uncategorized'}
                              </span>
                            </td>
                            <td className="table-cell text-right font-semibold text-teal-950">
                              {Number(item.currentStock).toLocaleString()}
                            </td>
                            <td className="table-cell text-right text-coffee-500">
                              {Number(item.minStock).toLocaleString()}
                            </td>
                            <td className="table-cell">
                              {isLow ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                  <AlertCircle size={12} /> Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                  <CheckCircle2 size={12} /> Healthy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Transfer Requests' && (
            <div className="space-y-8">
              {/* Active Transfers */}
              <div>
                <h3 className="text-lg font-display font-medium text-teal-900 mb-4">Active Requests</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {pendingOrApproved.length === 0 ? (
                    <div className="col-span-full card py-12 text-center text-coffee-400 text-sm">
                      No active requests from branches.
                    </div>
                  ) : (
                    pendingOrApproved.map(t => {
                      const isApproved = t.status === 'approved';
                      return (
                        <div key={t.id} className={clsx("card p-5 border-l-4", isApproved ? "border-l-blue-500 bg-blue-50/10" : "border-l-amber-500 bg-amber-50/10")}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                                  REQ-{String(t.id).padStart(4, '0')}
                                </span>
                                <span className="text-xs text-coffee-400">
                                  {new Date(t.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <h4 className="font-semibold text-teal-950 flex items-center gap-2">
                                <ArrowUpRight size={16} className="text-teal-600" />
                                For: {t.destinationBranch?.name || `Branch #${t.destinationBranchId}`}
                              </h4>
                              {t.requestedBy && (
                                <p className="text-xs text-coffee-500 mt-1">Requested by {t.requestedBy.name}</p>
                              )}
                            </div>
                            <span className={clsx("status-badge", isApproved ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800")}>
                              {isApproved ? 'Approved' : 'Pending Approval'}
                            </span>
                          </div>

                          <div className="bg-white rounded-lg border border-cream-200 p-3 mb-4">
                            <h5 className="text-xs font-semibold text-coffee-400 uppercase tracking-wider mb-2">Items Requested</h5>
                            <ul className="space-y-2">
                              {t.lines.map(item => (
                                <li key={item.id} className="flex justify-between text-sm">
                                  <span className="font-medium text-teal-900">{item.name}</span>
                                  <span className="text-teal-700 font-semibold">{item.quantity} <span className="text-xs text-coffee-400 font-normal">{item.unit}</span></span>
                                </li>
                              ))}
                            </ul>
                            {t.note && (
                              <div className="mt-3 pt-3 border-t border-cream-100 text-sm text-coffee-600 italic">
                                "{t.note}"
                              </div>
                            )}
                          </div>

                          {isApproved && isStorekeeper && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => setTransferConfirmation(t)}
                                disabled={busyId === t.id}
                                className="btn-primary w-full flex justify-center items-center gap-2"
                              >
                                <ArrowRightLeft size={16} /> Execute Transfer
                              </button>
                            </div>
                          )}
                          {isApproved && isOwner && (
                            <div className="text-xs text-coffee-400 text-center bg-cream-50 py-2 rounded-lg border border-cream-100">
                              Approved; stock is unchanged. Waiting for the Main Store Keeper to fulfill the request.
                            </div>
                          )}
                          {!isApproved && (
                            <div className="text-xs text-coffee-400 text-center flex items-center justify-center gap-2 bg-cream-50 py-2 rounded-lg border border-cream-100">
                              <Clock size={14} /> Waiting for Manager/Owner decision. Stock remains unchanged.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Transfer History */}
              <div>
                <h3 className="text-lg font-display font-medium text-teal-900 mb-4">Completed Transfers</h3>
                <div className="card p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-cream-50">
                        <tr>
                          <th className="table-header">ID</th>
                          <th className="table-header">Date</th>
                          <th className="table-header">Destination</th>
                          <th className="table-header">Items</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Audit Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cream-100">
                        {history.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-coffee-400 text-sm">
                              No history found.
                            </td>
                          </tr>
                        ) : (
                          history.map(t => (
                            <tr key={t.id} className="hover:bg-cream-50/50">
                              <td className="table-cell font-mono text-xs text-teal-700 font-medium">
                                REQ-{String(t.id).padStart(4, '0')}
                              </td>
                              <td className="table-cell whitespace-nowrap">
                                {new Date(t.createdAt).toLocaleDateString()}
                              </td>
                              <td className="table-cell font-medium text-teal-900">
                                {t.destinationBranch?.name || `Branch #${t.destinationBranchId}`}
                              </td>
                              <td className="table-cell">
                                <div className="text-sm">
                                  {t.lines.length} item{t.lines.length !== 1 && 's'}
                                </div>
                                <div className="text-xs text-coffee-400 space-y-1">
                                  {t.lines.map(line => (
                                    <div key={line.id}>
                                      {line.name}
                                      {t.status === 'transferred' && line.mainStoreBalanceAfter != null && line.branchBalanceAfter != null
                                        ? ` · post-transfer balances: Main Store ${Number(line.mainStoreBalanceAfter)}, branch ${Number(line.branchBalanceAfter)} ${line.unit}`
                                        : ''}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="table-cell">
                                {t.status === 'transferred' ? (
                                  <span className="status-badge bg-green-100 text-green-800">Transferred</span>
                                ) : (
                                  <span className="status-badge bg-red-100 text-red-800">Rejected</span>
                                )}
                              </td>
                              <td className="table-cell text-xs text-coffee-500 space-y-1">
                                {t.status === 'transferred' && t.transferredBy && <div>Transferred by {t.transferredBy.name}</div>}
                                {t.status === 'rejected' && t.rejectedBy && <div>Rejected by {t.rejectedBy.name}</div>}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {transferConfirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-teal-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="transfer-confirm-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-cream-200 bg-cream-50 px-6 py-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                <ArrowRightLeft className="text-teal-700" size={23} />
              </div>
              <h2 id="transfer-confirm-title" className="font-display text-xl font-bold text-teal-950">Transfer Stock to Branch?</h2>
              <p className="mt-1 text-sm font-medium text-teal-700">
                REQ-{String(transferConfirmation.id).padStart(4, '0')} · {transferConfirmation.destinationBranch?.name || `Branch #${transferConfirmation.destinationBranchId}`}
              </p>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm leading-6 text-coffee-600">
              <p>Transfer the approved items from Main Store to this branch now?</p>
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-medium text-blue-900">
                This action immediately deducts Main Store stock and adds the quantities to branch stock. The transaction will be recorded in transfer history.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-cream-200 bg-cream-50 px-6 py-4">
              <button type="button" className="btn-secondary px-5" onClick={() => setTransferConfirmation(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary px-5"
                onClick={() => {
                  const id = transferConfirmation.id;
                  setTransferConfirmation(null);
                  void handleExecuteTransfer(id);
                }}
              >
                Transfer Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-teal-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-cream-200 flex justify-between items-center bg-cream-50">
              <h3 className="font-display font-bold text-lg text-teal-950 flex items-center gap-2">
                <ArrowDownToLine className="text-teal-600" /> Receive Bulk Stock
              </h3>
              <button onClick={() => setShowReceiveModal(false)} className="text-coffee-400 hover:text-teal-900 transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-cream-50/30">
              <div className="space-y-4">
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-6">
                  <p className="text-sm text-teal-800">
                    Add new inventory items or update quantities of existing ones. Items with the exact same name and unit will be merged in the main store.
                  </p>
                </div>

                {receiveLines.map((line, idx) => (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-start bg-white p-4 rounded-xl border border-cream-200 shadow-sm relative group">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 flex-1">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-coffee-500 mb-1">Item Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Basmati Coffee Beans"
                          value={line.name}
                          onChange={e => setReceiveLines(lines => lines.map((l, i) => i === idx ? { ...l, name: e.target.value } : l))}
                          className="input"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-coffee-500 mb-1">Unit *</label>
                        <input
                          type="text"
                          placeholder="kg, L, pcs"
                          value={line.unit}
                          onChange={e => setReceiveLines(lines => lines.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))}
                          className="input"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-coffee-500 mb-1">Category</label>
                        <input
                          type="text"
                          value={line.category}
                          onChange={e => setReceiveLines(lines => lines.map((l, i) => i === idx ? { ...l, category: e.target.value } : l))}
                          className="input"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-coffee-500 mb-1">Qty *</label>
                        <input
                          type="number"
                          min="0" step="0.01"
                          value={line.quantity}
                          onChange={e => setReceiveLines(lines => lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                          className="input"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-coffee-500 mb-1">Min Stock</label>
                        <input
                          type="number"
                          min="0" step="0.01"
                          value={line.minStock}
                          onChange={e => setReceiveLines(lines => lines.map((l, i) => i === idx ? { ...l, minStock: e.target.value } : l))}
                          className="input"
                        />
                      </div>
                    </div>
                    {receiveLines.length > 1 && (
                      <button
                        onClick={() => setReceiveLines(lines => lines.filter((_, i) => i !== idx))}
                        className="p-2 mt-5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setReceiveLines(lines => [...lines, { name: '', unit: '', category: '', quantity: '', unitCost: '', minStock: '' }])}
                  className="btn-secondary w-full border-dashed border-2 border-cream-300 bg-transparent hover:bg-cream-50 py-3 text-teal-700"
                >
                  <Plus size={16} className="inline mr-2" /> Add Another Item
                </button>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-coffee-500 mb-1">Receipt Note / Source (Optional)</label>
                  <input
                    type="text"
                    value={receiveNote}
                    onChange={e => setReceiveNote(e.target.value)}
                    placeholder="e.g. Delivery from Supplier X, Invoice #1234"
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-cream-200 bg-cream-50 flex justify-end gap-3">
              <button onClick={() => setShowReceiveModal(false)} className="btn-secondary px-6">Cancel</button>
              <button
                onClick={handleReceiveStock}
                disabled={submitting}
                className="btn-primary px-8 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
