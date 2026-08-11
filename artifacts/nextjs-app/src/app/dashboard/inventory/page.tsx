'use client';
import { useEffect, useState } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder, updatePOStatus, approvePOItems, createStockAdjustment, getStockAdjustments } from '@/lib/api';
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

const TABS = ['Items', 'Purchase Orders', 'Stock Movements', 'Suppliers', 'Alerts', 'Reports'];

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
  const canReceivePO = !!user && ['admin', 'owner', 'manager', 'storekeeper'].includes(user.role);
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
    await createStockAdjustment({ ...adjForm, inventoryItemId: parseInt(adjForm.inventoryItemId), quantity: parseFloat(adjForm.quantity) });
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

  // ── Purchase order detail modal (per-item approval) ───────────────────────
  const [poDetail, setPODetail] = useState<PurchaseOrder | null>(null);
  const [poSelected, setPOSelected] = useState<number[]>([]);
  const [poBusy, setPOBusy] = useState(false);
  const openPODetail = (po: PurchaseOrder) => { setPODetail(po); setPOSelected([]); };
  const togglePOItem = (id: number) => setPOSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const refreshPODetail = async () => {
    const res = await getPurchaseOrders();
    setPOs(res.data || []);
    setPODetail(prev => prev ? (res.data || []).find((p: PurchaseOrder) => p.id === prev.id) || null : null);
    setPOSelected([]);
  };
  const doApproveItems = async (all: boolean) => {
    if (!poDetail) return;
    setPOBusy(true);
    try { await approvePOItems(poDetail.id, all ? { all: true } : { itemIds: poSelected }); await refreshPODetail(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Approval failed'); }
    finally { setPOBusy(false); }
  };
  const doPOStatus = async (status: string) => {
    if (!poDetail) return;
    setPOBusy(true);
    try {
      await updatePOStatus(poDetail.id, status);
      await fetchData(); // refreshes items, movements and POs so stock updates show immediately
      setPODetail(null);
    } catch (e: any) { alert(e?.response?.data?.message || 'Action failed'); }
    finally { setPOBusy(false); }
  };

  // Stock movements filter: All / Stock In / Stock Out
  const [moveFilter, setMoveFilter] = useState<'all' | 'addition' | 'deduction'>('all');
  const filteredMovements = moveFilter === 'all' ? movements : movements.filter(m => m.type === moveFilter);

  // ── Reports (Excel / PDF exports with date & type filters) ────────────────
  const [report, setReport] = useState({ type: 'stock-in', from: '', to: '' });
  const [exporting, setExporting] = useState(false);

  const reportRows = async (): Promise<{ title: string; head: string[]; rows: (string | number)[][] }> => {
    if (report.type === 'inventory') {
      const res = await getInventoryItems();
      const list: InventoryItem[] = res.data || [];
      return {
        title: 'Inventory Report',
        head: ['Item', 'Category', 'Unit', 'Current Stock', 'Min Stock', 'Unit Price (ETB)', 'Total Price (ETB)', 'Expiry Date'],
        rows: list.map(i => [i.name, (i as any).category || '—', i.unit, Number(i.currentStock), Number(i.minStock), Number(i.unitCost), Number(i.currentStock) * Number(i.unitCost), (i as any).expiryDate ? new Date((i as any).expiryDate).toLocaleDateString() : '—']),
      };
    }
    const type = report.type === 'stock-in' ? 'addition' : 'deduction';
    const res = await getStockAdjustments({ type, from: report.from || undefined, to: report.to || undefined });
    const list: StockMovement[] = res.data || [];
    return {
      title: report.type === 'stock-in' ? 'Stock In Report' : 'Stock Out Report',
      head: ['Date', 'Item', 'Quantity', 'Unit', 'Reason', 'Recorded By'],
      rows: list.map(m => [new Date(m.createdAt).toLocaleString(), m.inventoryItem?.name || '—', Number(m.quantity), m.inventoryItem?.unit || '', m.reason || '—', m.createdBy?.name || '—']),
    };
  };

  const rangeLabel = () => [report.from && `from ${report.from}`, report.to && `to ${report.to}`].filter(Boolean).join(' ') || 'all dates';

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { title, head, rows } = await reportRows();
      const XLSX = await import('xlsx');
      // Guard against spreadsheet formula injection: prefix risky leading chars in text cells
      const safe = (v: string | number) => typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v;
      const ws = XLSX.utils.aoa_to_sheet([[`${title} (${rangeLabel()})`], head, ...rows.map(r => r.map(safe))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
      XLSX.writeFile(wb, `${title.replace(/ /g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { title, head, rows } = await reportRows();
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Jima Aba Jifar — ${title}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`${rangeLabel()} · generated ${new Date().toLocaleString()}`, 14, 22);
      autoTable(doc, { head: [head], body: rows.map(r => r.map(String)), startY: 27, styles: { fontSize: 8 } });
      doc.save(`${title.replace(/ /g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

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
                  {pos.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">No purchase orders yet — click "New Purchase Order" to create one</td></tr> : pos.map((po) => {
                    const approvedCount = (po.items || []).filter((i: any) => i.approved).length;
                    return (
                    <tr key={po.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openPODetail(po)}>
                      <td className="table-cell font-semibold text-brand-600">#{po.id}</td>
                      <td className="table-cell">{po.supplier?.name}</td>
                      <td className="table-cell text-gray-500 text-xs">
                        {po.items?.map(i => `${i.inventoryItem?.name} ×${Number(i.quantity)}`).join(', ') || '—'}
                        {po.status === 'pending' && approvedCount > 0 && <span className="ml-2 text-amber-600 font-medium">({approvedCount}/{po.items.length} approved)</span>}
                      </td>
                      <td className="table-cell font-semibold">ETB {Number(po.totalAmount).toLocaleString()}</td>
                      <td className="table-cell"><span className={clsx('status-badge', PO_STATUS_COLORS[po.status] || 'bg-gray-100 text-gray-700')}>{po.status}</span></td>
                      <td className="table-cell text-gray-500 text-xs">
                        {(po as any).requestedBy?.name || '—'}
                        {(po as any).approvedBy?.name && <div className="text-green-600">approved by {(po as any).approvedBy.name}</div>}
                      </td>
                      <td className="table-cell text-gray-400 text-xs">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <span className="text-xs text-brand-600 font-medium">View details →</span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Stock Movements' && (
            <div className="card p-0 overflow-hidden">
              <div className="flex gap-2 p-3 border-b bg-gray-50">
                {([['all', 'All'], ['addition', 'Stock In'], ['deduction', 'Stock Out']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setMoveFilter(v)} className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium', moveFilter === v ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100')}>{l}</button>
                ))}
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Date</th><th className="table-header">Item</th><th className="table-header">Type</th><th className="table-header">Quantity</th><th className="table-header">Reason</th><th className="table-header">By</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredMovements.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">No stock movements yet — use "Stock In" or "Stock Out" to record one</td></tr> : filteredMovements.map((m) => {
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

          {tab === 'Reports' && (
            <div className="card max-w-2xl">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FileText size={18} /> Generate Report</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select value={report.type} onChange={e => setReport(p => ({ ...p, type: e.target.value }))} className="input">
                    <option value="stock-in">Stock In</option>
                    <option value="stock-out">Stock Out</option>
                    <option value="inventory">Inventory (current stock)</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={report.from} onChange={e => setReport(p => ({ ...p, from: e.target.value }))} className="input" disabled={report.type === 'inventory'} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={report.to} onChange={e => setReport(p => ({ ...p, to: e.target.value }))} className="input" disabled={report.type === 'inventory'} /></div>
              </div>
              <p className="text-xs text-gray-400 mb-4">{report.type === 'inventory' ? 'The inventory report is a snapshot of current stock levels and values.' : 'Leave the dates empty to include all records.'}</p>
              <div className="flex gap-3">
                <button onClick={exportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 disabled:opacity-50"><ArrowDownToLine size={16} /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
                <button onClick={exportPDF} disabled={exporting} className="btn-secondary flex items-center gap-2 disabled:opacity-50"><FileText size={16} /> {exporting ? 'Exporting…' : 'Export PDF'}</button>
              </div>
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

      {/* Purchase Order Detail Modal */}
      {poDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPODetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Purchase Order #{poDetail.id}</h3>
                <p className="text-sm text-gray-500">{poDetail.supplier?.name} · {new Date(poDetail.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={clsx('status-badge', PO_STATUS_COLORS[poDetail.status] || 'bg-gray-100 text-gray-700')}>{poDetail.status}</span>
            </div>
            <div className="text-sm text-gray-600 mb-4 space-y-1">
              <p>Requested by: <span className="font-medium">{(poDetail as any).requestedBy?.name || '—'}</span></p>
              {(poDetail as any).approvedBy?.name && <p className="text-green-700">Approved by: <span className="font-medium">{(poDetail as any).approvedBy.name}</span></p>}
              {poDetail.notes && <p>Notes: {poDetail.notes}</p>}
            </div>
            <table className="w-full mb-4">
              <thead className="bg-gray-50 border-b"><tr>
                {poDetail.status === 'pending' && canApprovePO && <th className="table-header w-8"></th>}
                <th className="table-header">Item</th><th className="table-header">Qty</th><th className="table-header">Unit Price</th><th className="table-header">Total</th><th className="table-header">Approval</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {(poDetail.items || []).map((it: any) => (
                  <tr key={it.id}>
                    {poDetail.status === 'pending' && canApprovePO && (
                      <td className="table-cell">
                        {!it.approved && <input type="checkbox" checked={poSelected.includes(it.id)} onChange={() => togglePOItem(it.id)} className="w-4 h-4 accent-brand-600" />}
                      </td>
                    )}
                    <td className="table-cell font-medium">{it.inventoryItem?.name || '—'}</td>
                    <td className="table-cell">{Number(it.quantity)} {it.inventoryItem?.unit || ''}</td>
                    <td className="table-cell">ETB {Number(it.unitPrice).toLocaleString()}</td>
                    <td className="table-cell font-semibold">ETB {(Number(it.quantity) * Number(it.unitPrice)).toLocaleString()}</td>
                    <td className="table-cell">
                      {it.approved
                        ? <span className="status-badge bg-green-100 text-green-800">approved</span>
                        : <span className="status-badge bg-yellow-100 text-yellow-800">pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-right font-bold text-gray-900 mb-4">Total: ETB {Number(poDetail.totalAmount).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {poDetail.status === 'pending' && canApprovePO && <>
                <button onClick={() => doApproveItems(false)} disabled={poBusy || poSelected.length === 0} className="text-sm px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium disabled:opacity-50">Approve Selected ({poSelected.length})</button>
                <button onClick={() => doApproveItems(true)} disabled={poBusy} className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">Approve All</button>
                <button onClick={() => doPOStatus('rejected')} disabled={poBusy} className="text-sm px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium disabled:opacity-50">Reject</button>
              </>}
              {['approved', 'paid'].includes(poDetail.status) && canReceivePO && (
                <button onClick={() => doPOStatus('received')} disabled={poBusy} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">{poBusy ? 'Updating…' : 'Stock In'}</button>
              )}
              {poDetail.status === 'pending' && !canApprovePO && <span className="text-sm text-gray-400 self-center">Awaiting manager/owner approval</span>}
              <button onClick={() => setPODetail(null)} className="text-sm px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">Close</button>
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
