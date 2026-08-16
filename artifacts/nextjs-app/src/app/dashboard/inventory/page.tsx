'use client';
import { useEffect, useState } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder, updatePOStatus, approvePOItems, getStockAdjustments, getItemRequests, updateItemRequestStatus } from '@/lib/api';
import { InventoryItem, Supplier, PurchaseOrder } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { Package, Plus, AlertTriangle, Pencil, RefreshCw, ArrowDownToLine, ArrowUpFromLine, FileText, Trash2, Warehouse } from 'lucide-react';
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

interface POLine { category: string; inventoryItemId: string; quantity: string; unitPrice: string; }

export default function InventoryPage() {
  const { user } = useAuthStore();
  const canApprovePO = !!user && ['admin', 'owner', 'manager'].includes(user.role);
  const canReceivePO = !!user && ['admin', 'owner', 'storekeeper'].includes(user.role);
  const isCashier = user?.role === 'cashier';
  const isStorekeeper = user?.role === 'storekeeper';
  const visibleTabs = isCashier ? ['Purchase Orders'] : TABS;
  const [tab, setTab] = useState('Items');
  useEffect(() => { if (isCashier) setTab('Purchase Orders'); }, [isCashier]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [supSearch, setSupSearch] = useState('');
  const [poFilter, setPoFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', expiryDate: '', restaurantId: 1 });
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', restaurantId: 1 });
  const [customCat, setCustomCat] = useState(false);
  const [itemCatFilter, setItemCatFilter] = useState('');
  const [poForm, setPOForm] = useState<{ supplierId: string; notes: string; lines: POLine[] }>({ supplierId: '', notes: '', lines: [{ category: '', inventoryItemId: '', quantity: '', unitPrice: '' }] });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // Storekeeper Store Operations view
  const [requests, setRequests] = useState<any[]>([]);
  const [opTab, setOpTab] = useState<'out' | 'in' | 'items' | 'ledger' | 'report'>('out');
  const [opBusy, setOpBusy] = useState<string | null>(null);

  const fetchData = async () => {
    if (isCashier) {
      // Cashier only confirms PO payments — other inventory endpoints are restricted
      const posRes = await getPurchaseOrders();
      setPOs(posRes.data || []);
      setLoading(false);
      return;
    }
    const [itemsRes, suppRes, posRes, movRes, reqRes] = await Promise.all([
      getInventoryItems(), getSuppliers(), getPurchaseOrders(), getStockAdjustments(),
      isStorekeeper ? getItemRequests().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);
    setItems(itemsRes.data || []);
    setSuppliers(suppRes.data || []);
    setPOs(posRes.data || []);
    setMovements(movRes.data || []);
    setRequests(reqRes.data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore polling errors */ }); }, 10000);
    return () => clearInterval(t);
  }, [user?.role]);

  const saveItem = async () => {
    setSubmitting(true);
    const data: any = { ...itemForm, currentStock: parseFloat(itemForm.currentStock), minStock: parseFloat(itemForm.minStock), unitCost: parseFloat(itemForm.unitCost), expiryDate: itemForm.expiryDate || null };
    if (editItem) {
      delete data.currentStock; // stock only changes via stock in / stock out records
      await updateInventoryItem(editItem.id, data);
    } else await createInventoryItem(data);
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
    if (report.type === 'inventory' || report.type === 'low-stock') {
      const res = await getInventoryItems();
      let list: InventoryItem[] = res.data || [];
      if (report.type === 'low-stock') list = list.filter(i => Number(i.currentStock) <= Number(i.minStock));
      return {
        title: report.type === 'low-stock' ? 'Low Stock Items Report' : 'Available Items Report',
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
      setPOForm({ supplierId: '', notes: '', lines: [{ category: '', inventoryItemId: '', quantity: '', unitPrice: '' }] });
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

  const itemCategories = Array.from(new Set(items.map(i => i.category).filter(c => c && c !== '__none__'))).sort() as string[];
  const itemsForCategory = (cat: string) => cat ? items.filter(i => (cat === '__none__' ? !i.category : i.category === cat)) : items;

  const lowStockItems = items.filter(i => Number(i.currentStock) <= Number(i.minStock));
  const outOfStock = lowStockItems.filter(i => Number(i.currentStock) <= 0);

  // Add/Edit Item modal — shared between the main view and the storekeeper view
  const itemModal = showItemModal && (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{editItem ? 'Edit Item' : 'New Inventory Item'}</h3>
          <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            {!customCat ? (
              <select value={itemForm.category} className="input"
                onChange={e => { if (e.target.value === '__new__') { setCustomCat(true); setItemForm(p => ({ ...p, category: '' })); } else setItemForm(p => ({ ...p, category: e.target.value })); }}>
                <option value="">Select category...</option>
                {itemCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Add new category…</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} className="input flex-1" placeholder="New category name" />
                <button onClick={() => { setCustomCat(false); setItemForm(p => ({ ...p, category: '' })); }} className="btn-secondary px-3">✕</button>
              </div>
            )}
          </div>
          {[{ l: 'Name', k: 'name' }, { l: 'Unit (kg, pcs, liters)', k: 'unit' }].map(({ l, k }) => (
            <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input value={(itemForm as any)[k]} onChange={e => setItemForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            {[{ l: 'Stock', k: 'currentStock' }, { l: 'Min Stock', k: 'minStock' }, { l: 'Unit Cost', k: 'unitCost' }].map(({ l, k }) => (
              <div key={k}><label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
                <input type="number" value={(itemForm as any)[k]} onChange={e => setItemForm(p => ({ ...p, [k]: e.target.value }))} className="input text-sm disabled:bg-gray-100 disabled:text-gray-400" disabled={k === 'currentStock' && !!editItem} title={k === 'currentStock' && editItem ? 'Stock changes only through Stock In / Stock Out records' : undefined} /></div>
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
  );

  // ── Storekeeper: Store Operations view ────────────────────────────────────
  const doStockOut = async (id: number) => {
    setOpBusy(`req-${id}`);
    try { await updateItemRequestStatus(id, 'issued'); await fetchData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Stock out failed'); }
    finally { setOpBusy(null); }
  };
  const doStockIn = async (id: number) => {
    setOpBusy(`po-${id}`);
    try { await updatePOStatus(id, 'received'); await fetchData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Stock in failed'); }
    finally { setOpBusy(null); }
  };

  if (isStorekeeper) {
    const fulfillReqs = requests.filter((r: any) => r.status === 'approved');
    const inboundPOs = pos.filter(p => ['approved', 'paid', 'ordered'].includes(p.status));
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Warehouse className="text-blue-600" size={22} /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Store Operations</h1>
              <p className="text-sm text-gray-500">Manage inbound shipments and fulfill approved item requests. Stock updates automatically.</p>
            </div>
          </div>
          <button onClick={() => { setShowItemModal(true); setEditItem(null); setCustomCat(false); setItemForm({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', expiryDate: '', restaurantId: 1 }); }}
            className="btn-primary flex items-center gap-2 shrink-0"><Plus size={16} /> Manual Entry</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b mt-6 mb-6">
          <button onClick={() => setOpTab('out')} className={clsx('pb-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2', opTab === 'out' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <ArrowUpFromLine size={15} /> Stock Out (Fulfill Requests)
            {fulfillReqs.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{fulfillReqs.length}</span>}
          </button>
          <button onClick={() => setOpTab('in')} className={clsx('pb-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2', opTab === 'in' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <ArrowDownToLine size={15} /> Stock In (Inbound Shipments)
            {inboundPOs.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{inboundPOs.length}</span>}
          </button>
          <button onClick={() => setOpTab('items')} className={clsx('pb-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2', opTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <Package size={15} /> Available Items
            {items.length > 0 && <span className="bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full px-1.5 py-0.5">{items.length}</span>}
          </button>
          <button onClick={() => setOpTab('ledger')} className={clsx('pb-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2', opTab === 'ledger' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <FileText size={15} /> Inventory Ledger
          </button>
          <button onClick={() => setOpTab('report')} className={clsx('pb-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2', opTab === 'report' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <ArrowDownToLine size={15} /> Export Report
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {opTab === 'out' ? (
              <div className="card p-0 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpFromLine className="text-blue-600" size={18} />
                    <h2 className="font-bold text-gray-900">Fulfill Requests (Stock Out)</h2>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{fulfillReqs.length} Pending</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b"><tr>
                      <th className="table-header">Req ID</th><th className="table-header">Item</th>
                      <th className="table-header">Requestor</th><th className="table-header">Qty</th>
                      <th className="table-header">In Stock</th><th className="table-header">Approved</th>
                      <th className="table-header text-right">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {fulfillReqs.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400">No approved requests waiting for stock out</td></tr>
                      ) : fulfillReqs.map((r: any) => {
                        const name = r.requesterName || r.requestedBy?.name || '—';
                        const initials = name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                        const stockItem = items.find(i => i.id === r.inventoryItem?.id);
                        const enough = !!stockItem && Number(stockItem.currentStock) >= Number(r.quantity);
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="table-cell font-medium text-blue-600">REQ-{String(r.id).padStart(3, '0')}</td>
                            <td className="table-cell">
                              <p className="font-medium text-gray-900">{r.inventoryItem?.name || '—'}</p>
                              {r.reason && <p className="text-xs text-gray-400">{r.reason}</p>}
                            </td>
                            <td className="table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">{initials || '?'}</div>
                                <div>
                                  <p className="text-sm text-gray-900">{name}</p>
                                  {r.department && <p className="text-[10px] text-gray-400">{r.department}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="table-cell font-semibold">{Number(r.quantity)} {r.inventoryItem?.unit}</td>
                            <td className={clsx('table-cell', enough ? 'text-gray-500' : 'text-red-500 font-semibold')}>
                              {stockItem ? `${Number(stockItem.currentStock)} ${stockItem.unit}` : '—'}
                              {!enough && <p className="text-[10px]">Insufficient stock</p>}
                            </td>
                            <td className="table-cell text-xs text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                            <td className="table-cell">
                              <div className="flex justify-end">
                                <button onClick={() => doStockOut(r.id)} disabled={opBusy === `req-${r.id}` || !enough}
                                  className="btn-primary !py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50">
                                  <ArrowUpFromLine size={13} /> {opBusy === `req-${r.id}` ? 'Processing…' : 'Stock Out'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : opTab === 'in' ? (
              <div className="card p-0 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ArrowDownToLine className="text-blue-600" size={18} />
                    <h2 className="font-bold text-gray-900">Inbound Shipments (Stock In)</h2>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{inboundPOs.length} Pending</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b"><tr>
                      <th className="table-header">PO #</th><th className="table-header">Supplier</th>
                      <th className="table-header">Items</th><th className="table-header">Total</th>
                      <th className="table-header">Status</th><th className="table-header text-right">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {inboundPOs.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">No approved purchase orders waiting to be received</td></tr>
                      ) : inboundPOs.map(po => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium text-blue-600">PO-{String(po.id).padStart(3, '0')}</td>
                          <td className="table-cell">{po.supplier?.name || '—'}</td>
                          <td className="table-cell text-sm text-gray-600">
                            {(po.items || []).map((li: any) => `${li.inventoryItem?.name || '?'} × ${Number(li.quantity)}`).join(', ') || '—'}
                          </td>
                          <td className="table-cell font-semibold">ETB {Number(po.totalAmount || 0).toLocaleString()}</td>
                          <td className="table-cell"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', PO_STATUS_COLORS[po.status])}>{po.status}</span></td>
                          <td className="table-cell">
                            <div className="flex justify-end">
                              <button onClick={() => doStockIn(po.id)} disabled={opBusy === `po-${po.id}`}
                                className="btn-primary !py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50">
                                <ArrowDownToLine size={13} /> {opBusy === `po-${po.id}` ? 'Processing…' : 'Stock In'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : opTab === 'items' ? (
              <div className="card p-0 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <Package className="text-blue-600" size={18} />
                    <h2 className="font-bold text-gray-900">Available Items in Store</h2>
                  </div>
                  <select value={itemCatFilter} onChange={e => setItemCatFilter(e.target.value)} className="input text-sm !w-44 !py-1.5">
                    <option value="">All categories</option>
                    {itemCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    {items.some(i => !i.category) && <option value="__none__">Uncategorized</option>}
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b"><tr>
                      <th className="table-header">Item</th><th className="table-header">Category</th>
                      <th className="table-header">Available</th><th className="table-header">Min Stock</th>
                      <th className="table-header">Unit Cost</th><th className="table-header">Total Value</th>
                      <th className="table-header">Expiry</th><th className="table-header">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {itemsForCategory(itemCatFilter).length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-gray-400">No items in the store yet</td></tr>
                      ) : itemsForCategory(itemCatFilter).map(item => {
                        const low = Number(item.currentStock) <= Number(item.minStock);
                        const out = Number(item.currentStock) <= 0;
                        return (
                          <tr key={item.id} className={clsx('hover:bg-gray-50', low && 'bg-red-50/50')}>
                            <td className="table-cell font-medium">{item.name}</td>
                            <td className="table-cell text-sm text-gray-500">{item.category || '—'}</td>
                            <td className={clsx('table-cell font-semibold', out ? 'text-red-600' : low ? 'text-amber-600' : 'text-gray-900')}>{Number(item.currentStock)} {item.unit}</td>
                            <td className="table-cell text-gray-500">{Number(item.minStock)} {item.unit}</td>
                            <td className="table-cell">ETB {Number(item.unitCost).toLocaleString()}</td>
                            <td className="table-cell font-semibold">ETB {(Number(item.currentStock) * Number(item.unitCost)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="table-cell text-xs text-gray-500">{(item as any).expiryDate ? new Date((item as any).expiryDate).toLocaleDateString() : '—'}</td>
                            <td className="table-cell">
                              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', out ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                                {out ? 'Out of stock' : low ? 'Low stock' : 'In stock'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : opTab === 'ledger' ? (
            /* Inventory Ledger */
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <FileText className="text-gray-500" size={18} />
                  <h2 className="font-bold text-gray-900">Inventory Ledger</h2>
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {([['all', 'All'], ['addition', 'Stock In'], ['deduction', 'Stock Out']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setMoveFilter(v)}
                      className={clsx('px-3 py-1 rounded-md text-xs font-medium', moveFilter === v ? 'bg-white shadow text-gray-900' : 'text-gray-500')}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="table-header">Item</th><th className="table-header">Type</th>
                    <th className="table-header">Qty</th><th className="table-header">Date</th>
                    <th className="table-header">Reason</th><th className="table-header">Updated By</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredMovements.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400">No stock movements yet</td></tr>
                    ) : filteredMovements.slice(0, 30).map(m => {
                      const mv = MOVEMENT_LABELS[m.type] || { label: m.type, cls: 'bg-gray-100 text-gray-700' };
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium">{m.inventoryItem?.name || '—'}</td>
                          <td className="table-cell"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', mv.cls)}>{mv.label}</span></td>
                          <td className="table-cell">{Number(m.quantity)} {m.inventoryItem?.unit}</td>
                          <td className="table-cell text-xs text-gray-500 whitespace-nowrap">{new Date(m.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="table-cell text-xs text-gray-500">{m.reason || '—'}</td>
                          <td className="table-cell text-sm">{m.createdBy?.name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            ) : (
            /* Export Report */
            <div className="card max-w-3xl">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FileText size={18} /> Export Report</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select value={report.type} onChange={e => setReport(p => ({ ...p, type: e.target.value }))} className="input">
                    <option value="stock-in">Stock In</option>
                    <option value="stock-out">Stock Out</option>
                    <option value="inventory">Available Items</option>
                    <option value="low-stock">Low Stock Items</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={report.from} onChange={e => setReport(p => ({ ...p, from: e.target.value }))} className="input" disabled={['inventory', 'low-stock'].includes(report.type)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={report.to} onChange={e => setReport(p => ({ ...p, to: e.target.value }))} className="input" disabled={['inventory', 'low-stock'].includes(report.type)} /></div>
              </div>
              <p className="text-xs text-gray-400 mb-4">{['inventory', 'low-stock'].includes(report.type) ? 'Item reports are a snapshot of current stock levels and values.' : 'Leave the dates empty to include all records.'}</p>
              <div className="flex gap-3">
                <button onClick={exportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 disabled:opacity-50"><ArrowDownToLine size={16} /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
                <button onClick={exportPDF} disabled={exporting} className="btn-secondary flex items-center gap-2 disabled:opacity-50"><FileText size={16} /> {exporting ? 'Exporting…' : 'Export PDF'}</button>
              </div>
            </div>
            )}
          </>
        )}
        {itemModal}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
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
          {canApprovePO && tab === 'Purchase Orders' && (
            <button onClick={() => { setShowPOModal(true); setFormError(''); }} className="btn-primary flex items-center gap-2"><FileText size={16} /> New Purchase Order</button>
          )}
          {tab === 'Items' && <button onClick={() => { setShowItemModal(true); setEditItem(null); setCustomCat(false); setItemForm({ name: '', unit: '', currentStock: '', minStock: '', unitCost: '', category: '', expiryDate: '', restaurantId: 1 }); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Item</button>}
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
              <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
                <label className="text-xs font-medium text-gray-600">Category:</label>
                <select value={itemCatFilter} onChange={e => setItemCatFilter(e.target.value)} className="input text-sm !w-48 !py-1.5">
                  <option value="">All categories</option>
                  {itemCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  {items.some(i => !i.category) && <option value="__none__">Uncategorized</option>}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Item</th><th className="table-header">Category</th><th className="table-header">Unit</th>
                  <th className="table-header">Stock</th><th className="table-header">Min Stock</th><th className="table-header">Unit Cost</th><th className="table-header">Total Price</th><th className="table-header">Expiry</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {itemsForCategory(itemCatFilter).map((item) => (
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
                        <button onClick={() => { setEditItem(item); setCustomCat(false); setItemForm({ name: item.name, unit: item.unit, currentStock: String(item.currentStock), minStock: String(item.minStock), unitCost: String(item.unitCost || ''), category: item.category || '', expiryDate: (item as any).expiryDate ? String((item as any).expiryDate).slice(0, 10) : '', restaurantId: item.restaurantId }); setShowItemModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {tab === 'Suppliers' && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
                <label className="text-xs font-medium text-gray-600">Search:</label>
                <input value={supSearch} onChange={e => setSupSearch(e.target.value)} placeholder="Supplier name…" className="input text-sm !w-56 !py-1.5" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Name</th><th className="table-header">Contact</th><th className="table-header">Email</th><th className="table-header">Phone</th><th className="table-header">Rating</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {suppliers.filter(s => !supSearch || s.name?.toLowerCase().includes(supSearch.toLowerCase())).map((s) => (
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
            </div>
          )}

          {tab === 'Purchase Orders' && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
                <label className="text-xs font-medium text-gray-600">Status:</label>
                <select value={poFilter} onChange={e => setPoFilter(e.target.value)} className="input text-sm !w-44 !py-1.5">
                  <option value="all">All statuses</option>
                  {Object.keys(PO_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">PO #</th><th className="table-header">Supplier</th><th className="table-header">Items</th><th className="table-header">Total</th><th className="table-header">Status</th><th className="table-header">Requested By</th><th className="table-header">Date</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {pos.filter(po => poFilter === 'all' || po.status === poFilter).length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">No purchase orders found</td></tr> : pos.filter(po => poFilter === 'all' || po.status === poFilter).map((po) => {
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
            </div>
          )}

          {tab === 'Stock Movements' && (
            <div className="card p-0 overflow-hidden">
              <div className="flex gap-2 p-3 border-b bg-gray-50">
                {([['all', 'All'], ['addition', 'Stock In'], ['deduction', 'Stock Out']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setMoveFilter(v)} className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium', moveFilter === v ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100')}>{l}</button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="table-header">Date</th><th className="table-header">Item</th><th className="table-header">Type</th><th className="table-header">Quantity</th><th className="table-header">Reason</th><th className="table-header">By</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredMovements.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">No stock movements yet — stock in happens when a purchase order is received, stock out when an approved item request is issued</td></tr> : filteredMovements.map((m) => {
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
                    <option value="inventory">Available Items (current stock)</option>
                    <option value="low-stock">Low Stock Items</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={report.from} onChange={e => setReport(p => ({ ...p, from: e.target.value }))} className="input" disabled={['inventory', 'low-stock'].includes(report.type)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={report.to} onChange={e => setReport(p => ({ ...p, to: e.target.value }))} className="input" disabled={['inventory', 'low-stock'].includes(report.type)} /></div>
              </div>
              <p className="text-xs text-gray-400 mb-4">{['inventory', 'low-stock'].includes(report.type) ? 'Item reports are a snapshot of current stock levels and values.' : 'Leave the dates empty to include all records.'}</p>
              <div className="flex gap-3">
                <button onClick={exportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 disabled:opacity-50"><ArrowDownToLine size={16} /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
                <button onClick={exportPDF} disabled={exporting} className="btn-secondary flex items-center gap-2 disabled:opacity-50"><FileText size={16} /> {exporting ? 'Exporting…' : 'Export PDF'}</button>
              </div>
            </div>
          )}

          {tab === 'Alerts' && (
            <div className="flex gap-2 mb-4">
              {([['all', 'All'], ['critical', 'Critical'], ['warning', 'Warning']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setAlertFilter(v)} className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium', alertFilter === v ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100')}>{l}</button>
              ))}
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
                {lowStockItems
                  .filter(item => {
                    if (alertFilter === 'all') return true;
                    const critical = Number(item.currentStock) <= 0 || Number(item.currentStock) <= Number(item.minStock) / 2;
                    return alertFilter === 'critical' ? critical : !critical;
                  })
                  .sort((a, b) => Number(a.currentStock) - Number(b.currentStock)).map((item) => {
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
                        {canApprovePO && <button onClick={() => { setPOForm({ supplierId: '', notes: `Restock ${item.name}`, lines: [{ category: item.category || '__none__', inventoryItemId: String(item.id), quantity: '', unitPrice: item.unitCost ? String(item.unitCost) : '' }] }); setShowPOModal(true); setFormError(''); }}
                          className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 font-medium">Order from Supplier</button>}
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
      {itemModal}

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
            <div className="overflow-x-auto">
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
            </div>
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
                      <select value={line.category} onChange={e => setLine(idx, { category: e.target.value, inventoryItemId: '', unitPrice: '' })} className="input text-sm w-36">
                        <option value="">All categories</option>
                        {itemCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        {items.some(i => !i.category) && <option value="__none__">Uncategorized</option>}
                      </select>
                      <select value={line.inventoryItemId} onChange={e => onLineItemChange(idx, e.target.value)} className="input text-sm flex-1">
                        <option value="">Select item...</option>
                        {itemsForCategory(line.category).map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" min={0} placeholder="Qty" value={line.quantity} onChange={e => setLine(idx, { quantity: e.target.value })} className="input text-sm w-20" />
                      <input type="number" min={0} placeholder="Price" value={line.unitPrice} onChange={e => setLine(idx, { unitPrice: e.target.value })} className="input text-sm w-24" />
                      {poForm.lines.length > 1 && (
                        <button onClick={() => setPOForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setPOForm(p => ({ ...p, lines: [...p.lines, { category: '', inventoryItemId: '', quantity: '', unitPrice: '' }] }))}
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
