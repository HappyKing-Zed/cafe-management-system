'use client';
import { useEffect, useState } from 'react';
import { getDailyReport, getOrders, getPayments, getMenuCategories, getInventoryItems, getItemRequests, getStaffList, getBranches } from '@/lib/api';
import { BarChart3, TrendingUp, RefreshCw, FileText, ArrowDownToLine } from 'lucide-react';
import clsx from 'clsx';

const EXPORT_TABS = ['Overview', 'Order Board', 'Menu', 'Inventory', 'Item Requested', 'Staff', 'Branches'] as const;
type Tab = typeof EXPORT_TABS[number];

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [menuCats, setMenuCats] = useState<any[]>([]);
  const [invItems, setInvItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tab, setTab] = useState<Tab>('Overview');
  const [exporting, setExporting] = useState(false);

  // per-tab filters
  const [fOrder, setFOrder] = useState({ status: 'all', from: '', to: '' });
  const [fMenu, setFMenu] = useState({ category: 'all', availability: 'all' });
  const [fInv, setFInv] = useState({ category: 'all', lowOnly: false });
  const [fReq, setFReq] = useState({ status: 'all', from: '', to: '' });
  const [fStaff, setFStaff] = useState({ role: 'all' });

  const fetchData = async () => {
    try {
      const [reportRes, ordersRes, paymentsRes, catRes, invRes, reqRes, staffRes, brRes] = await Promise.all([
        getDailyReport(selectedDate).catch(() => ({ data: null })),
        getOrders().catch(() => ({ data: [] })),
        getPayments().catch(() => ({ data: [] })),
        getMenuCategories().catch(() => ({ data: [] })),
        getInventoryItems().catch(() => ({ data: [] })),
        getItemRequests().catch(() => ({ data: [] })),
        getStaffList().catch(() => ({ data: [] })),
        getBranches().catch(() => ({ data: [] })),
      ]);
      setReport(reportRes.data);
      setOrders(ordersRes.data || []);
      setPayments(paymentsRes.data || []);
      setMenuCats(catRes.data || []);
      setInvItems(invRes.data || []);
      setRequests(reqRes.data || []);
      setStaff(staffRes.data || []);
      setBranches(brRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore polling errors */ }); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ── Export data builders ─────────────────────────────────────────────
  const menuItems = menuCats.flatMap((c: any) => (c.items || []).map((i: any) => ({ ...i, categoryName: c.name })));
  const invCategories = Array.from(new Set(invItems.map((i: any) => i.category).filter(Boolean))).sort() as string[];
  const staffRoles = Array.from(new Set(staff.map((s: any) => s.role).filter(Boolean))).sort() as string[];

  const dataFor = (t: Tab) => {
    if (t === 'Order Board') {
      let list = orders;
      if (fOrder.status !== 'all') list = list.filter(o => o.status === fOrder.status);
      if (fOrder.from) list = list.filter(o => new Date(o.createdAt) >= new Date(fOrder.from));
      if (fOrder.to) list = list.filter(o => new Date(o.createdAt) <= new Date(`${fOrder.to}T23:59:59`));
      return {
        title: 'Order Board Report', file: 'order_board',
        head: ['Order #', 'Date', 'Table', 'Waiter', 'Chef', 'Items', 'Status', 'Payment', 'Total (ETB)'],
        rows: list.map(o => [
          `#${o.id}`, new Date(o.createdAt).toLocaleString(),
          o.table?.number ? String(o.table.number) : 'Take Away',
          o.waiter?.name || '—', o.chef?.name || '—',
          (o.items || []).map((i: any) => `${i.quantity}× ${i.menuItem?.name || 'Item'}`).join(', '),
          o.status,
          o.payments?.length ? (o.payments[o.payments.length - 1].method === 'mobile' ? 'wallet' : o.payments[o.payments.length - 1].method) : '—',
          Number(o.totalAmount),
        ]),
      };
    }
    if (t === 'Menu') {
      let list = menuItems;
      if (fMenu.category !== 'all') list = list.filter((i: any) => i.categoryName === fMenu.category);
      if (fMenu.availability !== 'all') list = list.filter((i: any) => (fMenu.availability === 'available' ? i.isAvailable !== false : i.isAvailable === false));
      return {
        title: 'Menu Report', file: 'menu',
        head: ['Item', 'Category', 'Price (ETB)', 'Available'],
        rows: list.map((i: any) => [i.name, i.categoryName || '—', Number(i.price), i.isAvailable === false ? 'No' : 'Yes']),
      };
    }
    if (t === 'Inventory') {
      let list = invItems;
      if (fInv.category !== 'all') list = list.filter((i: any) => i.category === fInv.category);
      if (fInv.lowOnly) list = list.filter((i: any) => Number(i.currentStock) <= Number(i.minStock));
      return {
        title: 'Inventory Report', file: 'inventory',
        head: ['Item', 'Category', 'Unit', 'Stock', 'Min Stock', 'Unit Cost (ETB)', 'Total Value (ETB)', 'Expiry'],
        rows: list.map((i: any) => [
          i.name, i.category || '—', i.unit, Number(i.currentStock), Number(i.minStock),
          Number(i.unitCost || 0), Number(i.currentStock) * Number(i.unitCost || 0),
          i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : '—',
        ]),
      };
    }
    if (t === 'Item Requested') {
      let list = requests;
      if (fReq.status !== 'all') list = list.filter((r: any) => r.status === fReq.status);
      if (fReq.from) list = list.filter((r: any) => new Date(r.createdAt) >= new Date(fReq.from));
      if (fReq.to) list = list.filter((r: any) => new Date(r.createdAt) <= new Date(`${fReq.to}T23:59:59`));
      return {
        title: 'Item Requested Report', file: 'item_requested',
        head: ['Date', 'Item', 'Quantity', 'Requester', 'Reason', 'Status', 'Unit Price (ETB)', 'Total (ETB)'],
        rows: list.map((r: any) => {
          const unit = Number(r.unitCost ?? r.inventoryItem?.unitCost ?? 0);
          return [
            r.createdAt ? new Date(r.createdAt).toLocaleString() : '—',
            r.inventoryItem?.name || '—',
            `${Number(r.quantity)} ${r.inventoryItem?.unit || ''}`.trim(),
            r.requesterName || r.requestedBy?.name || '—',
            r.reason || '—', r.status, unit, unit * Number(r.quantity),
          ];
        }),
      };
    }
    if (t === 'Staff') {
      let list = staff;
      if (fStaff.role !== 'all') list = list.filter((s: any) => s.role === fStaff.role);
      return {
        title: 'Staff Report', file: 'staff',
        head: ['Name', 'Role', 'Email', 'Phone', 'Branch', 'Active'],
        rows: list.map((s: any) => [s.name, s.role, s.email || '—', s.phone || '—', s.branch?.name || s.branchId || '—', s.isActive === false ? 'No' : 'Yes']),
      };
    }
    // Branches
    return {
      title: 'Branches Report', file: 'branches',
      head: ['Branch', 'Address', 'Phone', 'Active'],
      rows: branches.map((b: any) => [b.name, b.address || b.location || '—', b.phone || '—', b.isActive === false ? 'No' : 'Yes']),
    };
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { title, file, head, rows } = dataFor(tab);
      const XLSX = await import('xlsx');
      const safe = (v: string | number) => typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v;
      const ws = XLSX.utils.aoa_to_sheet([[title], head, ...rows.map(r => r.map(safe))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
      XLSX.writeFile(wb, `${file}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { title, file, head, rows } = dataFor(tab);
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Jima Aba Jifar — ${title}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`generated ${new Date().toLocaleString()}`, 14, 22);
      autoTable(doc, { head: [head], body: rows.map(r => r.map(String)), startY: 27, styles: { fontSize: 8 } });
      doc.save(`${file}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

  // ── Overview stats ───────────────────────────────────────────────────
  const statusBreakdown = orders.reduce((acc: any, o: any) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const totalRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o: any) => o.status === 'paid').length;
  const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;
  const methodBreakdown = payments.reduce((acc: any, p: any) => { acc[p.method] = (acc[p.method] || 0) + Number(p.amount); return acc; }, {});

  const rowCount = tab !== 'Overview' ? dataFor(tab).rows.length : 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-teal-600" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'Overview' && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-auto" />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {EXPORT_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-3.5 py-2 rounded-lg text-sm font-medium transition-colors', tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t}
          </button>
        ))}
      </div>

      {tab !== 'Overview' && (
        <div className="card max-w-3xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center"><FileText className="text-teal-600" size={18} /></div>
            <h2 className="font-bold text-gray-900">{tab} Report</h2>
          </div>

          {tab === 'Order Board' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select value={fOrder.status} onChange={e => setFOrder(p => ({ ...p, status: e.target.value }))} className="input text-sm">
                  <option value="all">All</option>
                  {['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">From</label>
                <input type="date" value={fOrder.from} onChange={e => setFOrder(p => ({ ...p, from: e.target.value }))} className="input text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">To</label>
                <input type="date" value={fOrder.to} onChange={e => setFOrder(p => ({ ...p, to: e.target.value }))} className="input text-sm" /></div>
            </div>
          )}

          {tab === 'Menu' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select value={fMenu.category} onChange={e => setFMenu(p => ({ ...p, category: e.target.value }))} className="input text-sm">
                  <option value="all">All categories</option>
                  {menuCats.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Availability</label>
                <select value={fMenu.availability} onChange={e => setFMenu(p => ({ ...p, availability: e.target.value }))} className="input text-sm">
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select></div>
            </div>
          )}

          {tab === 'Inventory' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 items-end">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select value={fInv.category} onChange={e => setFInv(p => ({ ...p, category: e.target.value }))} className="input text-sm">
                  <option value="all">All categories</option>
                  {invCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                <input type="checkbox" checked={fInv.lowOnly} onChange={e => setFInv(p => ({ ...p, lowOnly: e.target.checked }))} className="w-4 h-4 accent-brand-500" />
                Low stock items only
              </label>
            </div>
          )}

          {tab === 'Item Requested' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select value={fReq.status} onChange={e => setFReq(p => ({ ...p, status: e.target.value }))} className="input text-sm">
                  <option value="all">All</option>
                  {['pending', 'approved', 'rejected', 'issued', 'received'].map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">From</label>
                <input type="date" value={fReq.from} onChange={e => setFReq(p => ({ ...p, from: e.target.value }))} className="input text-sm" /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">To</label>
                <input type="date" value={fReq.to} onChange={e => setFReq(p => ({ ...p, to: e.target.value }))} className="input text-sm" /></div>
            </div>
          )}

          {tab === 'Staff' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                <select value={fStaff.role} onChange={e => setFStaff({ role: e.target.value })} className="input text-sm">
                  <option value="all">All roles</option>
                  {staffRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select></div>
            </div>
          )}

          {tab === 'Branches' && (
            <p className="text-sm text-gray-500 mb-4">Exports the full list of branches and restaurants.</p>
          )}

          <div className="flex gap-3">
            <button onClick={exportExcel} disabled={exporting || loading} className="btn-primary flex items-center gap-2 disabled:opacity-50 text-sm"><ArrowDownToLine size={15} /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
            <button onClick={exportPDF} disabled={exporting || loading} className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"><FileText size={15} /> {exporting ? 'Exporting…' : 'Export PDF'}</button>
          </div>
          <p className="text-xs text-gray-400 mt-3">{loading ? 'Loading…' : `${rowCount} record(s) match the current filter`}</p>
        </div>
      )}

      {tab === 'Overview' && (<>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total Orders', value: totalOrders },
          { label: 'Paid Orders', value: paidOrders },
          { label: 'Total Revenue', value: `ETB ${totalRevenue.toLocaleString()}` },
          { label: 'Avg Order Value', value: `ETB ${Math.round(avgOrderValue).toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Today's Report */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-500" /> Daily Report — {selectedDate}
          </h2>
          {report ? (
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-bold text-brand-600">ETB {Number(report.totalRevenue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-600">Transactions</span>
                <span className="font-bold">{report.transactionCount || 0}</span>
              </div>
              {report.byMethod && Object.entries(report.byMethod).map(([method, amount]: any) => (
                <div key={method} className="flex justify-between py-2">
                  <span className="text-gray-500 capitalize flex items-center gap-2">
                    <span>{method === 'cash' ? '💵' : method === 'card' ? '💳' : '📱'}</span> {method}
                  </span>
                  <span className="font-medium">ETB {Number(amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No transactions on this date</p>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">All-Time Payment Methods</h2>
          {Object.keys(methodBreakdown).length === 0 ? (
            <p className="text-gray-400">No payment records yet</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(methodBreakdown).map(([method, amount]: any) => {
                const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                return (
                  <div key={method}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm capitalize font-medium text-gray-700">
                        {method === 'cash' ? '💵' : method === 'card' ? '💳' : '📱'} {method}
                      </span>
                      <span className="text-sm font-bold">ETB {Number(amount).toLocaleString()} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Order Status Breakdown */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Order Status Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map((s) => {
            const count = statusBreakdown[s] || 0;
            const colors: Record<string, string> = {
              pending: 'bg-yellow-50 border-yellow-200 text-yellow-800',
              confirmed: 'bg-blue-50 border-blue-200 text-blue-800',
              preparing: 'bg-orange-50 border-orange-200 text-orange-800',
              ready: 'bg-green-50 border-green-200 text-green-800',
              served: 'bg-purple-50 border-purple-200 text-purple-800',
              paid: 'bg-gray-50 border-gray-200 text-gray-800',
              cancelled: 'bg-red-50 border-red-200 text-red-800',
            };
            return (
              <div key={s} className={`border-2 rounded-xl p-4 text-center ${colors[s]}`}>
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-xs capitalize mt-1">{s}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="card mt-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Payments</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="table-header">ID</th>
              <th className="table-header">Order</th>
              <th className="table-header">Method</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Change</th>
              <th className="table-header">Time</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No payments yet</td></tr>
              ) : payments.slice(0, 10).map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{p.id}</td>
                  <td className="table-cell font-medium">Order #{p.orderId}</td>
                  <td className="table-cell capitalize">
                    {p.method === 'cash' ? '💵' : p.method === 'card' ? '💳' : '📱'} {p.method}
                  </td>
                  <td className="table-cell font-semibold text-brand-600">ETB {Number(p.amount).toLocaleString()}</td>
                  <td className="table-cell text-gray-400">{Number(p.changeGiven) > 0 ? `ETB ${Number(p.changeGiven).toLocaleString()}` : '—'}</td>
                  <td className="table-cell text-gray-400 text-xs">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>)}
    </div>
  );
}
