'use client';
import { useEffect, useState } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder, updatePOStatus, createStockAdjustment, getStockAdjustments } from '@/lib/api';
import { InventoryItem, Supplier, PurchaseOrder } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { Package, Plus, AlertTriangle, Pencil, RefreshCw, ArrowDownToLine, ArrowUpFromLine, FileText, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface StockMovement {
  id: number;
  type: string;
  quantity: number;
  reason?: string;
  createdAt: string;
  inventoryItem?: { name: string; unit: string };
  createdBy?: { name: string };
}

const TABS = ['Items', 'Purchase Orders', 'Stock Movements', 'Suppliers', 'Alerts'];

const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  paid: 'bg-purple-100 text-purple-800',
  ordered: 'bg-blue-100 text-blue-800',
  received: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

const MOVEMENT_LABELS: Record<string, { label: string; cls: string }> = {
  addition: { label: 'Stock In', cls: 'bg-green-100 text-green-800' },
  deduction: { label: 'Stock Out', cls: 'bg-orange-100 text-orange-800' },
  waste: { label: 'Waste', cls: 'bg-red-100 text-red-800' },
  transfer: { label: 'Transfer', cls: 'bg-blue-100 text-blue-800' },
  adjustment: { label: 'Adjustment', cls: 'bg-gray-100 text-gray-700' },
};

interface POLine { inventoryItemId: string; quantity: string; unitPrice: string; }

export default function InventoryPage() {
  const { user } = useAuthStore();
  const canApprovePO = !!user && ['admin', 'owner', 'manager'].includes(user.role);
  const canPayPO = !!user && ['admin', 'owner', 'cashier'].includes(user.role);
  const canReceivePO = !!user && ['admin', 'owner', 'storekeeper'].includes(user.role);
  const isCashier = user?.role === 'cashier';
  const visibleTabs = isCashier ? ['Purchase Orders'] : TABS;
  const [tab, setTab] = useState('Items');
  useEffect(() => { if (isCashier) setTab('Purchase Orders'); }, [isCashier]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', expiryDate: '', restaurantId: 1 });
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', restaurantId: 1 });
  const [adjForm, setAdjForm] = useState({ inventoryItemId: '', type: 'addition', quantity: '', reason: '' });
  const [poForm, setPOForm] = useState<{ supplierId: string; notes: string; lines: POLine[] }>({ supplierId: '', notes: '', lines: [{ inventoryItemId: '', quantity: '', unitPrice: '' }] });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    if (isCashier) {
      // Cashier only confirms PO payments — other inventory endpoints are restricted
      const posRes = await getPurchaseOrders();
      setPOs(posRes.data || []);
      setLoading(false);
      return;
    }
    const [itemsRes, suppRes, posRes, movRes] = await Promise.all([
      getInventoryItems(), getSuppliers(), getPurchaseOrders(), getStockAdjustments(),
    ]);
    setItems(itemsRes.data || []);
    setSuppliers(suppRes.data || []);
    setPOs(posRes.data || []);
    setMovements(movRes.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [isCashier]);

  const saveItem = async () => {
    setSubmitting(true);
    const data = { ...itemForm, currentStock: parseFloat(itemForm.currentStock), minStock: parseFloat(itemForm.minStock), unitCost: parseFloat(itemForm.unitCost), expiryDate: itemForm.expiryDate || null };
    if (editItem) await updateInventoryItem(editItem.id, data);
    else await createInventoryItem(data);
    setShowItemModal(false);
    setEditItem(null);
    setSubmitting(false);
    await fetchData();
  };

  const saveSupplier = async () => {
    setSubmitting(true);
    await createSupplier(supplierForm);
    setShowSupplierModal(false);
    setSubmitting(false);
    await fetchData();
  };

  const saveAdj = async () => {
    setSubmitting(true);
    await createStockAdjustment({ ...adjForm, inventoryItemId: parseInt(adjForm.inventoryItemId), quantity: parseFloat(adjForm.quantity), createdById: user?.id });
    setShowAdjModal(false);
    setAdjForm({ inventoryItemId: '', type: 'addition', quantity: '', reason: '' });
    setSubmitting(false);
    await fetchData();
  };

  const openAdj = (type: 'addition' | 'deduction') => {
    setAdjForm({ inventoryItemId: '', type, quantity: '', reason: '' });
    setShowAdjModal(true);
  };

  const poTotal = poForm.lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);

  const savePO = async () => {
    const validLines = poForm.lines.filter(l => l.inventoryItemId && parseFloat(l.quantity) > 0);
    if (!poForm.supplierId) { setFormError('Select a supplier'); return; }
    if (validLines.length === 0) { setFormError('Add at least one item with a quantity'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      await createPurchaseOrder({
        supplierId: parseInt(poForm.supplierId),
        notes: poForm.notes || undefined,
        items: validLines.map(l => ({ inventoryItemId: parseInt(l.inventoryItemId), quantity: parseFloat(l.quantity), unitPrice: parseFloat(l.unitPrice) || 0 })),
      });
      setShowPOModal(false);
      setPOForm({ supplierId: '', notes: '', lines: [{ inventoryItemId: '', quantity: '', unitPrice: '' }] });
      await fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Could not create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const setLine = (idx: number, patch: Partial<POLine>) =>
    setPOForm(p => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, ...patch } : l) }));

  const onLineItemChange = (idx: number, id: string) => {
    const item = items.find(i => String(i.id) === id);
    setLine(idx, { inventoryItemId: id, unitPrice: item?.unitCost ? String(item.unitCost) : '' });
  };

  const lowStockItems = items.filter(i => Number(i.currentStock) <= Number(i.minStock));
  const outOfStock = lowStockItems.filter(i => Number(i.currentStock) <= 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Package className="text-amber-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            {lowStockItems.length > 0 && (
              <button onClick={() => setTab('Alerts')} className="text-red-500 text-sm flex items-center gap-1 hover:underline">
                <AlertTriangle size={14} /> {lowStockItems.length} alert{lowStockItems.length > 1 ? 's' : ''} — view details
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /></button>
          {!isCashier && <>
            <button onClick={() => openAdj('addition')} className="btn-secondary flex items-center gap-2 !text-green-700"><ArrowDownToLine size={16} /> Stock In</button>
            <button onClick={() => openAdj('deduction')} className="btn-secondary flex items-center gap-2 !text-orange-700"><ArrowUpFromLine size={16} /> Stock Out</button>
            <button onClick={() => { setShowPOModal(true); setFormError(''); }} className="btn-primary flex items-center gap-2"><FileText size={16} /> New Purchase Order</button>
          </>}
          {tab === 'Items' && <button onClick={() => { setShowItemModal(true); setEditItem(null); setItemForm({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', expiryDate: '', restaurantId: 1 }); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Item</button>}
          {tab === 'Suppliers' && <button onClick={() => setShowSupplierModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Supplier</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {visibleTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5', tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t}
            {t === 'Alerts' && lowStockItems.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{lowStockItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {tab === 'Items' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Item</th><th className="table-header">Category</th><th className="table-header">Unit</th>
                  <th className="table-header">Stock</th><th className="table-header">Min Stock</th><th className="table-header">Unit Cost</th><th className="table-header">Total Price</th><th className="table-header">Expiry</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className={clsx('hover:bg-gray-50', Number(item.currentStock) <= Number(item.minStock) && 'bg-red-50')}>
                      <td className="table-cell font-medium">
                        <div className="flex items-center gap-2">
                          {Number(item.currentStock) <= Number(item.minStock) && <AlertTriangle size={14} className="text-red-500" />}
                          {item.name}
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{item.category || '—'}</td>
                      <td className="table-cell text-gray-500">{item.unit}</td>
                      <td className={clsx('table-cell font-semibold', Number(item.currentStock) <= Number(item.minStock) ? 'text-red-600' : 'text-green-600')}>
                        {Number(item.currentStock).toFixed(2)}
                      </td>
                      <td className="table-cell text-gray-500">{Number(item.minStock).toFixed(2)}</td>
                      <td className="table-cell">{item.unitCost ? `ETB ${Number(item.unitCost).toLocaleString()}` : '—'}</td>
                      <td className="table-cell font-semibold">{item.unitCost ? `ETB ${(Number(item.currentStock) * Number(item.unitCost)).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="table-cell text-xs">
                        {(item as any).expiryDate ? (() => {
                          const exp = new Date((item as any).expiryDate); const today = new Date(); today.setHours(0,0,0,0);
                          const soon = new Date(today); soon.setDate(soon.getDate() + 7);
                          const expired = exp < today; const expSoon = !expired && exp <= soon;
                          return <span className={clsx('status-badge', expired ? 'bg-red-100 text-red-700' : expSoon ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600')}>
                            {exp.toLocaleDateString()}{expired ? ' — expired' : expSoon ? ' — soon' : ''}
                          </span>;
                        })() : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell">
                        <button onClick={() => { setEditItem(item); setItemForm({ name: item.name, unit: item.unit, currentStock: String(item.currentStock), minStock: String(item.minStock), unitCost: String(item.unitCost || ''), category: item.category || '', expiryDate: (item as any).expiryDate ? String((item as any).expiryDate).slice(0, 10) : '', restaurantId: item.restaurantId }); setShowItemModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Suppliers' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Name</th><th className="table-header">Contact</th><th className="table-header">Email</th><th className="table-header">Phone</th><th className="table-header">Rating</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{s.name}</td>
                      <td className="table-cell text-gray-500">{s.contactPerson || '—'}</td>
                      <td className="table-cell text-gray-500">{s.email || '—'}</td>
                      <td className="table-cell text-gray-500">{s.phone || '—'}</td>
                      <td className="table-cell">{'⭐'.repeat(s.rating || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Purchase Orders' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">PO #</th><th className="table-header">Supplier</th><th className="table-header">Items</th><th className="table-header">Total</th><th className="table-header">Status</th><th className="table-header">Requested By</th><th className="table-header">Date</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {pos.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">No purchase orders yet — click "New Purchase Order" to create one</td></tr> : pos.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="table-cell font-semibold text-brand-600">#{po.id}</td>
                      <td className="table-cell">{po.supplier?.name}</td>
                      <td className="table-cell text-gray-500 text-xs">
                        {po.items?.map(i => `${i.inventoryItem?.name} ×${Number(i.quantity)}`).join(', ') || '—'}
                      </td>
                      <td className="table-cell font-semibold">ETB {Number(po.totalAmount).toLocaleString()}</td>
                      <td className="table-cell"><span className={clsx('status-badge', PO_STATUS_COLORS[po.status] || 'bg-gray-100 text-gray-700')}>{po.status}</span></td>
                      <td className="table-cell text-gray-500 text-xs">{(po as any).requestedBy?.name || '—'}</td>
                      <td className="table-cell text-gray-400 text-xs">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {po.status === 'pending' && canApprovePO && <>
                            <button onClick={() => updatePOStatus(po.id, 'approved').then(fetchData)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Approve</button>
                            <button onClick={() => updatePOStatus(po.id, 'rejected').then(fetchData)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button>
                          </>}
                          {po.status === 'pending' && !canApprovePO && <span className="text-xs text-gray-400">Awaiting approval</span>}
                          {po.status === 'approved' && (canPayPO
                            ? <button onClick={() => updatePOStatus(po.id, 'paid').then(fetchData)} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Confirm Payment</button>
                            : <span className="text-xs text-gray-400">Awaiting cashier payment</span>)}
                          {po.status === 'paid' && (canReceivePO
                            ? <button onClick={() => updatePOStatus(po.id, 'received').then(fetchData)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Fill Stock In</button>
                            : <span className="text-xs text-gray-400">Awaiting store keeper</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Stock Movements' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Date</th><th className="table-header">Item</th><th className="table-header">Type</th><th className="table-header">Quantity</th><th className="table-header">Reason</th><th className="table-header">By</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">No stock movements yet — use "Stock In" or "Stock Out" to record one</td></tr> : movements.map((m) => {
                    const cfg = MOVEMENT_LABELS[m.type] || MOVEMENT_LABELS.adjustment;
                    const isIn = m.type === 'addition';
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="table-cell text-gray-400 text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                        <td className="table-cell font-medium">{m.inventoryItem?.name || '—'}</td>
                        <td className="table-cell"><span className={clsx('status-badge', cfg.cls)}>{cfg.label}</span></td>
                        <td className={clsx('table-cell font-semibold', isIn ? 'text-green-600' : 'text-orange-600')}>
                          {isIn ? '+' : '−'}{Number(m.quantity)} {m.inventoryItem?.unit || ''}
                        </td>
                        <td className="table-cell text-gray-500">{m.reason || '—'}</td>
                        <td className="table-cell text-gray-500 text-xs">{m.createdBy?.name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Alerts' && (
            lowStockItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package size={48} className="mx-auto mb-4 opacity-40" />
                <p className="font-medium text-gray-500">All stock levels are healthy</p>
                <p className="text-sm mt-1">Alerts appear here when an item falls to or below its minimum stock</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {lowStockItems.sort((a, b) => Number(a.currentStock) - Number(b.currentStock)).map((item) => {
                  const isOut = Number(item.currentStock) <= 0;
                  return (
                    <div key={item.id} className={clsx('card flex items-center justify-between gap-4 border-l-4', isOut ? 'border-l-red-500 bg-red-50/50' : 'border-l-amber-500 bg-amber-50/50')}>
                      <div className="flex items-center gap-3">
                        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', isOut ? 'bg-red-100' : 'bg-amber-100')}>
                          <AlertTriangle size={20} className={isOut ? 'text-red-600' : 'text-amber-600'} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {isOut ? 'Out of stock' : `Only ${Number(item.currentStock).toFixed(2)} ${item.unit} left`} · minimum is {Number(item.minStock).toFixed(2)} {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setAdjForm({ inventoryItemId: String(item.id), type: 'addition', quantity: '', reason: 'Restock' }); setShowAdjModal(true); }}
                          className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium">Stock In</button>
                        <button onClick={() => { setPOForm({ supplierId: '', notes: `Restock ${item.name}`, lines: [{ inventoryItemId: String(item.id), quantity: '', unitPrice: item.unitCost ? String(item.unitCost) : '' }] }); setShowPOModal(true); setFormError(''); }}
                          className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 font-medium">Order from Supplier</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editItem ? 'Edit Item' : 'New Inventory Item'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[{ l: 'Name', k: 'name' }, { l: 'Category', k: 'category' }, { l: 'Unit (kg, pcs, liters)', k: 'unit' }].map(({ l, k }) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(itemForm as any)[k]} onChange={e => setItemForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                {[{ l: 'Stock', k: 'currentStock' }, { l: 'Min Stock', k: 'minStock' }, { l: 'Unit Cost', k: 'unitCost' }].map(({ l, k }) => (
                  <div key={k}><label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
                    <input type="number" value={(itemForm as any)[k]} onChange={e => setItemForm(p => ({ ...p, [k]: e.target.value }))} className="input text-sm" /></div>
                ))}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
                <input type="date" value={itemForm.expiryDate} onChange={e => setItemForm(p => ({ ...p, expiryDate: e.target.value }))} className="input" /></div>
              <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-gray-600">Total Price (stock × unit cost)</span>
                <span className="font-bold text-gray-900">ETB {((parseFloat(itemForm.currentStock) || 0) * (parseFloat(itemForm.unitCost) || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveItem} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[{ l: 'Company Name', k: 'name' }, { l: 'Contact Person', k: 'contactPerson' }, { l: 'Email', k: 'email' }, { l: 'Phone', k: 'phone' }, { l: 'Address', k: 'address' }].map(({ l, k }) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(supplierForm as any)[k]} onChange={e => setSupplierForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSupplierModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveSupplier} disabled={submitting} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock In / Stock Out Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{adjForm.type === 'addition' ? 'Stock In' : adjForm.type === 'deduction' ? 'Stock Out' : 'Stock Movement'}</h3>
              <button onClick={() => setShowAdjModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select value={adjForm.inventoryItemId} onChange={e => setAdjForm(p => ({ ...p, inventoryItemId: e.target.value }))} className="input">
                  <option value="">Select item...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({Number(i.currentStock)} {i.unit})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value }))} className="input">
                  <option value="addition">Stock In (+)</option>
                  <option value="deduction">Stock Out (−)</option>
                  <option value="waste">Waste (−)</option>
                  <option value="adjustment">Adjustment (−)</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" min={0} value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} className="input" placeholder="e.g. delivery, spoilage, kitchen use" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdjModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveAdj} disabled={submitting || !adjForm.inventoryItemId || !(parseFloat(adjForm.quantity) > 0)} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">New Purchase Order</h3>
              <button onClick={() => setShowPOModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select value={poForm.supplierId} onChange={e => setPOForm(p => ({ ...p, supplierId: e.target.value }))} className="input">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
                <div className="space-y-2">
                  {poForm.lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={line.inventoryItemId} onChange={e => onLineItemChange(idx, e.target.value)} className="input text-sm flex-1">
                        <option value="">Select item...</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" min={0} placeholder="Qty" value={line.quantity} onChange={e => setLine(idx, { quantity: e.target.value })} className="input text-sm w-20" />
                      <input type="number" min={0} placeholder="Price" value={line.unitPrice} onChange={e => setLine(idx, { unitPrice: e.target.value })} className="input text-sm w-24" />
                      {poForm.lines.length > 1 && (
                        <button onClick={() => setPOForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setPOForm(p => ({ ...p, lines: [...p.lines, { inventoryItemId: '', quantity: '', unitPrice: '' }] }))}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-2 flex items-center gap-1"><Plus size={14} /> Add another item</button>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={poForm.notes} onChange={e => setPOForm(p => ({ ...p, notes: e.target.value }))} className="input" /></div>
              <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="font-bold text-gray-900">ETB {poTotal.toLocaleString()}</span>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPOModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={savePO} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
