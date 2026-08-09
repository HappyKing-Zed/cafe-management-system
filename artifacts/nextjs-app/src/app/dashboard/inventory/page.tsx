'use client';
import { useEffect, useState } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder, updatePOStatus, createStockAdjustment } from '@/lib/api';
import { InventoryItem, Supplier, PurchaseOrder } from '@/lib/types';
import { Package, Plus, AlertTriangle, Pencil, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const TABS = ['Items', 'Suppliers', 'Purchase Orders', 'Adjustments'];

export default function InventoryPage() {
  const [tab, setTab] = useState('Items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', restaurantId: 1 });
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', restaurantId: 1 });
  const [adjForm, setAdjForm] = useState({ inventoryItemId: '', type: 'addition', quantity: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const [itemsRes, suppRes, posRes] = await Promise.all([getInventoryItems(), getSuppliers(), getPurchaseOrders()]);
    setItems(itemsRes.data || []);
    setSuppliers(suppRes.data || []);
    setPOs(posRes.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const saveItem = async () => {
    setSubmitting(true);
    const data = { ...itemForm, currentStock: parseFloat(itemForm.currentStock), minStock: parseFloat(itemForm.minStock), unitCost: parseFloat(itemForm.unitCost) };
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
    await createStockAdjustment({ ...adjForm, inventoryItemId: parseInt(adjForm.inventoryItemId), quantity: parseFloat(adjForm.quantity) });
    setShowAdjModal(false);
    setAdjForm({ inventoryItemId: '', type: 'addition', quantity: '', reason: '' });
    setSubmitting(false);
    await fetchData();
  };

  const lowStockItems = items.filter(i => i.currentStock <= i.minStock);

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
              <p className="text-red-500 text-sm flex items-center gap-1">
                <AlertTriangle size={14} /> {lowStockItems.length} items below minimum stock
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /></button>
          {tab === 'Items' && <button onClick={() => { setShowItemModal(true); setEditItem(null); setItemForm({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', restaurantId: 1 }); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Item</button>}
          {tab === 'Suppliers' && <button onClick={() => setShowSupplierModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Supplier</button>}
          {tab === 'Adjustments' && <button onClick={() => setShowAdjModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Adjust Stock</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >{t}</button>
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
                  <th className="table-header">Stock</th><th className="table-header">Min Stock</th><th className="table-header">Unit Cost</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className={clsx('hover:bg-gray-50', item.currentStock <= item.minStock && 'bg-red-50')}>
                      <td className="table-cell font-medium">
                        <div className="flex items-center gap-2">
                          {item.currentStock <= item.minStock && <AlertTriangle size={14} className="text-red-500" />}
                          {item.name}
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{item.category || '—'}</td>
                      <td className="table-cell text-gray-500">{item.unit}</td>
                      <td className={clsx('table-cell font-semibold', item.currentStock <= item.minStock ? 'text-red-600' : 'text-green-600')}>
                        {Number(item.currentStock).toFixed(2)}
                      </td>
                      <td className="table-cell text-gray-500">{Number(item.minStock).toFixed(2)}</td>
                      <td className="table-cell">{item.unitCost ? `ETB ${Number(item.unitCost).toLocaleString()}` : '—'}</td>
                      <td className="table-cell">
                        <button onClick={() => { setEditItem(item); setItemForm({ name: item.name, unit: item.unit, currentStock: String(item.currentStock), minStock: String(item.minStock), unitCost: String(item.unitCost || ''), category: item.category || '', restaurantId: item.restaurantId }); setShowItemModal(true); }}
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
                  <th className="table-header">PO #</th><th className="table-header">Supplier</th><th className="table-header">Items</th><th className="table-header">Total</th><th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {pos.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No purchase orders yet</td></tr> : pos.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="table-cell font-semibold text-brand-600">#{po.id}</td>
                      <td className="table-cell">{po.supplier?.name}</td>
                      <td className="table-cell text-gray-500">{po.items?.length} items</td>
                      <td className="table-cell font-semibold">ETB {Number(po.totalAmount).toLocaleString()}</td>
                      <td className="table-cell"><span className="status-badge bg-blue-100 text-blue-800">{po.status}</span></td>
                      <td className="table-cell text-gray-400 text-xs">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="table-cell">
                        {po.status === 'pending' && <button onClick={() => updatePOStatus(po.id, 'approved').then(fetchData)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Approve</button>}
                        {po.status === 'approved' && <button onClick={() => updatePOStatus(po.id, 'received').then(fetchData)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Receive</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Adjustments' && (
            <div className="text-center py-16 text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-40" />
              <p>Click "+ Adjust Stock" to record inventory changes</p>
            </div>
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

      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Stock Adjustment</h3>
              <button onClick={() => setShowAdjModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select value={adjForm.inventoryItemId} onChange={e => setAdjForm(p => ({ ...p, inventoryItemId: e.target.value }))} className="input">
                  <option value="">Select item...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value }))} className="input">
                  <option value="addition">Addition (+)</option>
                  <option value="deduction">Deduction (-)</option>
                  <option value="waste">Waste (-)</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} className="input" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdjModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveAdj} disabled={submitting || !adjForm.inventoryItemId} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
