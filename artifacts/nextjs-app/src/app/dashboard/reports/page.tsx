'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { getDailyReport, getOrders, getPayments, getMenuCategories, getInventoryItems, getItemRequests, getStaffList, getBranches, getSummary, getServiceSubmissions, submitDailyService, confirmServiceSubmission, getWaiters } from '@/lib/api';
import { BarChart3, TrendingUp, RefreshCw, FileText, ArrowDownToLine, ClipboardList, ChevronDown, ChevronUp, Send, CheckCircle2, Clock, FileDown, FileSpreadsheet, Columns3, UtensilsCrossed, Package, PackageOpen, Users, Building2, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import { downloadExcelFile } from '@/lib/excel-export';
import type { Role } from '@/lib/types';

// --- Formatters & Date Utils ---
const fmt = (n: number) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDateTime = (d: Date, h = 0, m = 0) => `${localDate(d)}T${pad(h)}:${pad(m)}`;

// --- Generic PDF/Excel Helpers ---
async function exportPDF(title: string, file: string, head: string[], rows: any[][]) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.autoTable ?? autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const columnsPerPage = 8;
  const columnGroups = Array.from(
    { length: Math.max(1, Math.ceil(head.length / columnsPerPage)) },
    (_, index) => ({
      start: index * columnsPerPage,
      end: Math.min((index + 1) * columnsPerPage, head.length),
    }),
  );

  columnGroups.forEach((group, index) => {
    if (index > 0) doc.addPage();
    doc.setFontSize(14);
    doc.text(`Jima · CARAVAN Lounge — ${title}`, 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Generated ${new Date().toLocaleString()} · Columns ${group.start + 1}–${group.end} of ${head.length}`,
      14,
      22,
    );
    autoTable(doc, {
      head: [head.slice(group.start, group.end)],
      body: rows.map(row => row.slice(group.start, group.end).map(value => String(value ?? '—'))),
      startY: 27,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      margin: { left: 10, right: 10 },
    });
  });
  doc.save(`${file}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function exportGenericExcel(title: string, file: string, head: string[], rows: any[][]) {
  await downloadExcelFile(
    `${file}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: title, rows: [[title], head, ...rows] }],
  );
}

const SENSITIVE_EXPORT_FIELD = /(^|[._])(password|passwordhash|passcode|pin|secret|token|accesstoken|refreshtoken|apikey|credential|session|salt|hash)([._]|$)/i;

function flattenExportRecord(value: unknown, prefix = '', output: Record<string, string | number> = {}) {
  if (value === null || value === undefined) {
    if (prefix) output[prefix] = '—';
    return output;
  }
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) output[prefix] = '—';
    value.forEach((entry, index) => flattenExportRecord(entry, `${prefix}[${index + 1}]`, output));
    return output;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) output[prefix] = '—';
    entries.forEach(([key, entry]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      if (!SENSITIVE_EXPORT_FIELD.test(field)) flattenExportRecord(entry, field, output);
    });
    return output;
  }
  output[prefix || 'value'] = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value as string | number;
  return output;
}

function withCompleteDetails(data: { title: string; file: string; head: string[]; rows: any[][]; records?: unknown[] }) {
  const flattened = (data.records || []).map(record => flattenExportRecord(record));
  const detailFields = Array.from(new Set(flattened.flatMap(record => Object.keys(record))));
  const rowCount = Math.max(data.rows.length, flattened.length);
  return {
    ...data,
    head: [...data.head, ...detailFields.map(field => `Detail — ${field}`)],
    rows: Array.from({ length: rowCount }, (_, index) => [
      ...(data.rows[index] || data.head.map(() => '')),
      ...detailFields.map(field => flattened[index]?.[field] ?? '—'),
    ]),
  };
}

function itemRows(detail: any[]) {
  const rows: any[] = [];
  let total = 0;
  for (const d of detail || []) {
    total += Number(d.amount) || 0;
    const items = d.items || [];
    items.forEach((i: any, idx: number) => {
      rows.push({
        Order: idx === 0 ? `#${d.orderId}` : '',
        Table: idx === 0 ? d.table : '',
        Item: i.name,
        Qty: i.quantity,
        'Unit Price (ETB)': Number(i.unitPrice),
        'Amount (ETB)': Number(i.unitPrice) * i.quantity,
      });
    });
    if (!items.length) rows.push({ Order: `#${d.orderId}`, Table: d.table, Item: '—', Qty: '', 'Unit Price (ETB)': '', 'Amount (ETB)': Number(d.amount) });
  }
  return { rows, total: Math.round(total * 100) / 100 };
}

async function exportSummaryPdf(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const data = buildSummaryExportData(summary, range, waiterName);
  await exportPDF(data.title, data.file, data.head, data.rows);
}

async function exportSummaryExcel(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const data = buildSummaryExportData(summary, range, waiterName);
  await exportGenericExcel(data.title, data.file, data.head, data.rows);
}

async function exportReportsPdf(subs: any[], range: { start: string; end: string }, waiterName?: string) {
  const data = buildReportsExportData(subs, range, waiterName);
  await exportPDF(data.title, data.file, data.head, data.rows);
}

async function exportReportsExcel(subs: any[], range: { start: string; end: string }, waiterName?: string) {
  const data = buildReportsExportData(subs, range, waiterName);
  await exportGenericExcel(data.title, data.file, data.head, data.rows);
}

function buildSummaryExportData(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const filters = { periodStart: range.start, periodEnd: range.end, waiter: waiterName || 'All waiters' };
  const records: unknown[] = [
    { section: 'Totals', filters, totals: summary?.totals || {} },
    ...(summary?.byWaiter || []).map((waiter: any) => ({ section: 'Waiter', filters, waiter })),
    ...(summary?.byTable || []).flatMap((table: any) => {
      const items = table.itemDetail?.length ? table.itemDetail : [null];
      return items.map((item: any) => ({ section: 'Table and item', filters, table: { ...table, itemDetail: undefined }, item }));
    }),
  ];
  return withCompleteDetails({
    title: 'Service Summary — Complete Details',
    file: `service-summary-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}`,
    head: ['Section'],
    rows: records.map((record: any) => [record.section]),
    records,
  });
}

function buildReportsExportData(subs: any[], range: { start: string; end: string }, waiterName?: string) {
  const filters = { periodStart: range.start, periodEnd: range.end, waiter: waiterName || 'All waiters' };
  const records = subs.flatMap((submission: any) => {
    const details = submission.detail?.length ? submission.detail : [null];
    return details.flatMap((detail: any) => {
      const items = detail?.items?.length ? detail.items : [null];
      return items.map((item: any) => ({
        filters,
        submission: { ...submission, detail: undefined },
        orderDetail: detail ? { ...detail, items: undefined } : null,
        item,
      }));
    });
  });
  return withCompleteDetails({
    title: 'Daily Service Reports — Complete Details',
    file: `service-reports-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}`,
    head: ['Report', 'Service Date', 'Status'],
    rows: records.map((record: any) => [
      record.submission?.id ? `#${record.submission.id}` : '—',
      record.submission?.serviceDate || '—',
      record.submission?.status || '—',
    ]),
    records,
  });
}

// --- Constants & Config ---
const TABS: ReadonlyArray<{ id: string; label: string; icon: typeof BarChart3; roles: readonly Role[] }> = [
  { id: 'service', label: 'Service & Submissions', icon: ClipboardList, roles: ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'cashier'] },
  { id: 'overview', label: 'Overview', icon: BarChart3, roles: ['admin', 'owner', 'manager'] },
  { id: 'sales', label: 'Sales', icon: TrendingUp, roles: ['admin', 'owner', 'manager', 'cashier'] },
  { id: 'purchased', label: 'Items Purchased', icon: ShoppingCart, roles: ['admin', 'owner', 'manager', 'cashier'] },
  { id: 'orders', label: 'Order Board', icon: Columns3, roles: ['admin', 'owner', 'manager'] },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed, roles: ['admin', 'owner', 'manager'] },
  { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin', 'owner', 'manager'] },
  { id: 'requests', label: 'Item Requests', icon: PackageOpen, roles: ['admin', 'owner', 'manager'] },
  { id: 'staff', label: 'Staff', icon: Users, roles: ['admin', 'owner', 'manager'] },
  { id: 'branches', label: 'Branches', icon: Building2, roles: ['admin', 'owner', 'manager'] },
];

const GENERIC_TABS = ['sales', 'purchased', 'orders', 'menu', 'inventory', 'requests', 'staff', 'branches'] as const;

// --- Sub-components ---
function StatCard({ label, value, highlight = false }: { label: string, value: React.ReactNode, highlight?: boolean }) {
  return (
    <div className="bg-white border border-teal-900/10 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
      <p className="text-[10px] text-teal-800/60 uppercase tracking-widest font-semibold mb-1.5">{label}</p>
      <p className={clsx("text-2xl font-display font-medium", highlight ? "text-gold-600" : "text-teal-950")}>{value}</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// 1. Service Reports Tab
// ----------------------------------------------------------------------
function ServiceReportsTab({ user, branchId }: { user: any, branchId?: number }) {
  const isWaiter = user?.role === 'waiter';
  const isCoordinator = user?.role === 'coordinator';
  const isCashier = user?.role === 'cashier';
  const reportsOnly = isWaiter || isCashier || isCoordinator;
  const canConfirm = ['cashier', 'admin', 'owner', 'manager'].includes(user?.role || '');

  const [startDate, setStartDate] = useState(() => localDateTime(new Date(), 0, 0));
  const [endDate, setEndDate] = useState(() => localDateTime(new Date(), 23, 59));
  const [waiterFilter, setWaiterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'confirmed'>('all');
  const [waiters, setWaiters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(!reportsOnly);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subOpen, setSubOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchSummary = useCallback(async () => {
    if (reportsOnly) return;
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      if (waiterFilter) params.waiterId = +waiterFilter;
      if (branchId) params.branchId = branchId;
      const res = await getSummary(params);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, waiterFilter, branchId, reportsOnly]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await getServiceSubmissions(branchId ? { branchId } : undefined);
      setSubmissions(res.data || []);
    } catch { /* ignore */ }
  }, [branchId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => {
    fetchSubmissions();
    if (!isWaiter && !isCoordinator) getWaiters().then((r) => setWaiters(r.data || [])).catch(() => {});
  }, [fetchSubmissions, isWaiter, isCoordinator]);

  const visibleSubs = useMemo(() => {
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setMinutes(to.getMinutes() + 1);
    return submissions.filter((x) => {
      const t = x.createdAt ? new Date(x.createdAt) : new Date(`${x.serviceDate}T00:00`);
      if (t < from || t >= to) return false;
      if (statusFilter !== 'all' && x.status !== statusFilter) return false;
      if (!isWaiter && !isCoordinator && waiterFilter && String(x.waiterId) !== waiterFilter) return false;
      return true;
    });
  }, [submissions, startDate, endDate, statusFilter, waiterFilter, isWaiter, isCoordinator]);

  const PAGE_SIZE = 10;
  useEffect(() => { setPage(1); }, [startDate, endDate, statusFilter, waiterFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleSubs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSubs = useMemo(() => visibleSubs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [visibleSubs, safePage]);

  const aggregate = useMemo(() => visibleSubs.reduce(
    (a, s) => ({ reports: a.reports + 1, orders: a.orders + (s.ordersCount || 0), items: a.items + (s.itemsCount || 0), revenue: a.revenue + (Number(s.totalRevenue) || 0) }),
    { reports: 0, orders: 0, items: 0, revenue: 0 },
  ), [visibleSubs]);

  const handleSubmit = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await submitDailyService();
      setMessage('Your new served orders were sent to the cashier as a report.');
      await fetchSubmissions();
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not submit'); }
    finally { setBusy(false); }
  };

  const handleConfirm = async (id: number) => {
    setBusy(true); setError('');
    try {
      await confirmServiceSubmission(id);
      await fetchSubmissions();
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not confirm'); }
    finally { setBusy(false); }
  };

  const runExport = async (fn: () => Promise<void>) => {
    setError('');
    try { await fn(); } catch (e: any) { setError(`Download failed: ${e?.message || 'unknown error'}`); }
  };

  const waiterName = waiterFilter ? waiters.find((w) => String(w.id) === waiterFilter)?.name : (isWaiter ? user?.name : undefined);
  const range = { start: startDate, end: endDate };

  const setQuickRange = (kind: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    const d = new Date(now);
    if (kind === 'week') { const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); }
    else if (kind === 'month') d.setDate(1);
    else if (kind === 'year') d.setMonth(0, 1);
    setStartDate(localDateTime(d, 0, 0));
    setEndDate(localDateTime(now, 23, 59));
  };

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-teal-950">{reportsOnly ? 'Daily Service Reports' : 'Service Summary'}</h2>
          <p className="text-teal-800/60 text-sm mt-1">{isWaiter ? 'Send your served orders to the cashier' : isCashier ? 'Confirm reports received from waiters' : 'Served items and revenue by table'}</p>
        </div>
        {isWaiter && (
          <button onClick={handleSubmit} disabled={busy} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors">
            <Send size={16} /> Send new orders to cashier
          </button>
        )}
      </div>

      {message && <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">{message}</div>}
      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

      <div className="flex flex-wrap items-end gap-3 mb-6 bg-cream-50/50 p-4 rounded-2xl border border-cream-200/50">
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">From</label>
          <input type="datetime-local" value={startDate} max={endDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent shadow-sm transition-all h-[38px]" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">To</label>
          <input type="datetime-local" value={endDate} min={startDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent shadow-sm transition-all h-[38px]" />
        </div>
        <div className="flex gap-1">
          {([['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setQuickRange(k)} className="px-3 h-[38px] text-xs font-medium rounded-xl bg-white border border-teal-900/10 hover:bg-teal-50 text-teal-800 transition-colors shadow-sm">{label}</button>
          ))}
        </div>
        {!reportsOnly && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Waiter</label>
            <div className="relative">
              <select value={waiterFilter} onChange={(e) => setWaiterFilter(e.target.value)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent shadow-sm transition-all h-[38px]">
                <option value="">All waiters</option>
                {waiters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        <div className="min-w-[140px]">
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Status</label>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent shadow-sm transition-all h-[38px]">
              <option value="all">All statuses</option>
              <option value="submitted">Pending</option>
              <option value="confirmed">Confirmed</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
          </div>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => runExport(() => reportsOnly ? exportReportsPdf(visibleSubs, range, waiterName) : exportSummaryPdf(summary, range, waiterName))} disabled={reportsOnly ? visibleSubs.length === 0 : !summary} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 disabled:opacity-40 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors">
            <FileDown size={14} /> PDF
          </button>
          <button onClick={() => runExport(() => reportsOnly ? exportReportsExcel(visibleSubs, range, waiterName) : exportSummaryExcel(summary, range, waiterName))} disabled={reportsOnly ? visibleSubs.length === 0 : !summary} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 disabled:opacity-40 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors">
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>
      </div>

      {!reportsOnly && (loading ? (
        <div className="p-12 text-center text-teal-800/50 animate-pulse font-medium">Loading summary data...</div>
      ) : !summary ? (
        <div className="p-12 text-center text-teal-800/50">Could not load the summary.</div>
      ) : (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-teal-950 mb-4 border-b border-teal-900/10 pb-2">Live Service Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Served Orders" value={summary.totals.orders} />
            <StatCard label="Items Served" value={summary.totals.items} />
            <StatCard label="Revenue" value={fmt(summary.totals.revenue)} highlight />
          </div>

          {!waiterFilter && summary.byWaiter?.length > 0 && (
            <div className="bg-white border border-teal-900/10 rounded-2xl mb-6 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-teal-900/5 bg-cream-50/30 font-semibold text-sm text-teal-950">By Waiter</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-teal-50/50 text-teal-900 border-b border-teal-900/10">
                    <tr><th className="px-5 py-3 text-left font-semibold">Waiter</th><th className="px-5 py-3 text-left font-semibold">Orders</th><th className="px-5 py-3 text-left font-semibold">Items</th><th className="px-5 py-3 text-right font-semibold">Revenue</th></tr>
                  </thead>
                  <tbody className="divide-y divide-teal-900/5">
                    {summary.byWaiter.map((w: any) => (
                      <tr key={w.waiterId} className="hover:bg-cream-50/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-teal-950">{w.name}</td>
                        <td className="px-5 py-3 text-teal-800/80">{w.orders}</td>
                        <td className="px-5 py-3 text-teal-800/80">{w.items}</td>
                        <td className="px-5 py-3 text-right font-medium text-teal-950">{fmt(w.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white border border-teal-900/10 rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-teal-900/5 bg-cream-50/30 font-semibold text-sm text-teal-950">Table Detail</div>
            {summary.byTable.length === 0 ? (
              <p className="p-6 text-center text-sm text-teal-800/50">No served orders in this date range.</p>
            ) : summary.byTable.map((t: any) => (
              <details key={t.tableId ?? 'walkin'} className="group border-b border-teal-900/5 last:border-0">
                <summary className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-cream-50/50 cursor-pointer list-none transition-colors">
                  <span className="font-medium text-teal-950">{t.label}</span>
                  <span className="flex items-center gap-6 text-sm text-teal-800/70">
                    <span className="hidden sm:inline">{t.orders} orders</span>
                    <span className="hidden sm:inline">{t.items} items</span>
                    <span className="font-semibold text-teal-950 text-right">{fmt(t.revenue)}</span>
                    <ChevronDown size={16} className="text-teal-800/40 group-open:rotate-180 transition-transform" />
                  </span>
                </summary>
                <div className="px-5 pb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-teal-800/60 text-xs uppercase tracking-wider font-semibold border-b border-teal-900/5">
                      <tr><th className="pb-2 font-medium">Item</th><th className="pb-2 font-medium text-center">Qty</th><th className="pb-2 text-right font-medium">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-teal-900/5">
                      {t.itemDetail.map((d: any) => (
                        <tr key={d.menuItemId}>
                          <td className="py-2.5 text-teal-950">{d.name}</td>
                          <td className="py-2.5 text-teal-800/80 text-center">{d.quantity}</td>
                          <td className="py-2.5 text-right text-teal-950">{fmt(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="text-sm font-semibold text-teal-950 mb-4 border-b border-teal-900/10 pb-2">Submitted Reports Totals</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Reports" value={aggregate.reports} />
          <StatCard label="Orders" value={aggregate.orders} />
          <StatCard label="Items" value={aggregate.items} />
          <StatCard label="Total Revenue" value={fmt(aggregate.revenue)} highlight />
        </div>

        <div className="bg-white border border-teal-900/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-900/5 bg-cream-50/30">
            <p className="font-semibold text-sm text-teal-950">Daily Service Reports</p>
            <p className="text-xs text-teal-800/60 mt-1">{isWaiter ? 'Your reports to the cashier' : canConfirm ? 'Confirm reports received from waiters' : 'Reports from waiters'}</p>
          </div>
          {visibleSubs.length === 0 ? (
            <p className="p-8 text-center text-sm text-teal-800/50 font-medium">No reports in this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-teal-50/50 text-teal-900 border-b border-teal-900/10">
                  <tr><th className="px-5 py-3 text-left font-semibold">Report</th><th className="px-5 py-3 text-left font-semibold">Date</th><th className="px-5 py-3 text-left font-semibold">Waiter</th><th className="px-5 py-3 text-left font-semibold">Orders</th><th className="px-5 py-3 text-left font-semibold">Items</th><th className="px-5 py-3 text-right font-semibold">Revenue</th><th className="px-5 py-3 text-left font-semibold">Status</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-teal-900/5">
                  {pagedSubs.map((s) => {
                    const isOpen = subOpen === s.id;
                    return [
                      <tr key={s.id} onClick={() => setSubOpen(isOpen ? null : s.id)} className="hover:bg-cream-50/30 cursor-pointer transition-colors">
                        <td className="px-5 py-3 font-medium text-teal-950">#{s.id}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-teal-800/80">
                          {s.serviceDate}
                          {s.createdAt && <span className="text-teal-800/40 text-xs ml-1.5">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </td>
                        <td className="px-5 py-3 text-teal-950">{s.waiter?.name || `Waiter #${s.waiterId}`}</td>
                        <td className="px-5 py-3 text-teal-800/80">{s.ordersCount}</td>
                        <td className="px-5 py-3 text-teal-800/80">{s.itemsCount}</td>
                        <td className="px-5 py-3 text-right font-medium text-teal-950">{fmt(s.totalRevenue)}</td>
                        <td className="px-5 py-3">
                          <span className={clsx("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1", s.status === 'confirmed' ? "text-teal-700 bg-teal-50" : "text-amber-700 bg-amber-50")}>
                            {s.status === 'confirmed' ? <CheckCircle2 size={12} /> : <Clock size={12} />} {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={(e) => { e.stopPropagation(); setSubOpen(isOpen ? null : s.id); }} className="text-teal-800/40 hover:text-teal-900 transition-colors p-1">
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>
                      </tr>,
                      isOpen && (
                        <tr key={`${s.id}-detail`} className="bg-cream-50/30">
                          <td colSpan={8} className="p-5 border-t border-teal-900/5">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-teal-950 text-sm">Report Detail</h4>
                              {canConfirm && s.status !== 'confirmed' && (
                                <button onClick={() => handleConfirm(s.id)} disabled={busy} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-xl text-xs font-medium transition-colors shadow-sm disabled:opacity-50">
                                  Confirm receipt
                                </button>
                              )}
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-teal-900/10 shadow-sm bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-teal-50/50 text-teal-900 border-b border-teal-900/10">
                                  <tr><th className="px-4 py-2.5 text-left font-medium">Order</th><th className="px-4 py-2.5 text-left font-medium">Table</th><th className="px-4 py-2.5 text-left font-medium">Item</th><th className="px-4 py-2.5 text-center font-medium">Qty</th><th className="px-4 py-2.5 text-right font-medium">Unit Price</th><th className="px-4 py-2.5 text-right font-medium">Amount</th></tr>
                                </thead>
                                <tbody className="divide-y divide-teal-900/5">
                                  {itemRows(s.detail).rows.map((r: any, i: number) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2.5 text-teal-800/80">{r.Order}</td>
                                      <td className="px-4 py-2.5 text-teal-800/80">{r.Table}</td>
                                      <td className="px-4 py-2.5 text-teal-950">{r.Item}</td>
                                      <td className="px-4 py-2.5 text-teal-800/80 text-center">{r.Qty}</td>
                                      <td className="px-4 py-2.5 text-right text-teal-800/80">{r['Unit Price (ETB)'] === '' ? '' : fmt(r['Unit Price (ETB)'])}</td>
                                      <td className="px-4 py-2.5 text-right text-teal-950">{fmt(r['Amount (ETB)'])}</td>
                                    </tr>
                                  ))}
                                  <tr className="bg-teal-50/30">
                                    <td className="px-4 py-3 font-semibold text-teal-950 uppercase tracking-wider text-xs" colSpan={5}>Total</td>
                                    <td className="px-4 py-3 text-right font-semibold text-teal-950">{fmt(s.totalRevenue)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. Overview Tab
// ----------------------------------------------------------------------
function OverviewTab({ branchId, sharedData }: { branchId?: number, sharedData: { loading: boolean; data: any } }) {
  const [range, setRange] = useState({ from: localDate(), to: localDate() });
  const [method, setMethod] = useState('all');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDailyReport(range.from, branchId, range.to, method).then(r => {
      setReport(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [range.from, range.to, method, branchId]);

  if (sharedData.loading || loading) {
    return <div className="p-12 text-center text-teal-800/50 animate-pulse font-medium">Loading operations data...</div>;
  }

  const payments = sharedData.data?.payments || [];
  const orders = sharedData.data?.orders || [];
  
  const inRange = (value: string) => {
    const t = new Date(value);
    return t >= new Date(`${range.from}T00:00:00`) && t <= new Date(`${range.to}T23:59:59.999`);
  };

  const rangePayments = payments.filter((p: any) => inRange(p.createdAt));
  const filteredPayments = method === 'all' ? rangePayments : rangePayments.filter((p: any) => p.method === method);
  const matchingOrderIds = new Set(filteredPayments.map((p: any) => p.orderId));
  const rangeOrders = orders.filter((o: any) => inRange(o.createdAt) && (method === 'all' || matchingOrderIds.has(o.id)));
  
  const totalRevenue = filteredPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalOrders = rangeOrders.length;
  const paidOrders = rangeOrders.filter((o: any) => o.status === 'paid').length;
  const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;
  const outstanding = rangeOrders.filter((o: any) => o.status !== 'paid').reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

  const reportSummary = {
    filters: { from: range.from, to: range.to, branchId: branchId ?? 'all', paymentMethod: method },
    totalRevenue, totalOrders, paidOrders, averagePaidOrderValue: avgOrderValue, outstandingBalance: outstanding,
    backendDailyReport: report,
  };

  const exportData = withCompleteDetails({
    title: 'Sales Information Report', file: 'sales_information',
    head: ['Payment #', 'Order', 'Payment Type', 'Amount (ETB)', 'Change (ETB)', 'Date'],
    rows: filteredPayments.length ? filteredPayments.map((p: any) => [
      `#${p.id}`, `Order #${p.orderId}`, p.method === 'mobile' ? 'wallet' : p.method, Number(p.amount), Number(p.changeGiven || 0), new Date(p.createdAt).toLocaleString()
    ]) : [['Summary', '—', method, totalRevenue, 0, `${range.from} – ${range.to}`]],
    records: filteredPayments.length ? filteredPayments.map((p: any) => ({ reportSummary, payment: p, order: rangeOrders.find((o: any) => o.id === p.orderId) || p.order || null })) : [{ reportSummary }],
  });

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-teal-950">Operations Overview</h2>
        <div className="flex gap-2">
          <button onClick={() => exportPDF(exportData.title, exportData.file, exportData.head, exportData.rows)} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors"><FileDown size={14} /> PDF</button>
          <button onClick={() => exportGenericExcel(exportData.title, exportData.file, exportData.head, exportData.rows)} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors"><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 bg-cream-50/50 p-4 rounded-2xl border border-cream-200/50">
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Payment Type</label>
          <div className="relative">
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px] min-w-[140px]">
              <option value="all">All types</option><option value="cash">Cash</option><option value="card">Card</option><option value="mobile">Wallet</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
          </div>
        </div>
        <div><label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">From</label><input type="date" value={range.from} max={range.to} onChange={e => setRange(p => ({...p, from: e.target.value}))} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]" /></div>
        <div><label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">To</label><input type="date" value={range.to} min={range.from} onChange={e => setRange(p => ({...p, to: e.target.value}))} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]" /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} highlight />
        <StatCard label="Avg Order Value" value={fmt(avgOrderValue)} />
        <StatCard label="Total Orders" value={totalOrders} />
        <StatCard label="Outstanding Balance" value={fmt(outstanding)} />
      </div>

      <div className="bg-white border border-teal-900/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-teal-900/5 bg-cream-50/30">
          <p className="font-semibold text-sm text-teal-950">Recent Payments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-teal-50/50 text-teal-900 border-b border-teal-900/10">
              <tr>{exportData.head.slice(0,6).map((c,i) => <th key={i} className="px-5 py-3 text-left font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-teal-900/5">
              {exportData.rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="hover:bg-cream-50/30 transition-colors">
                  {r.slice(0,6).map((c, j) => <td key={j} className="px-5 py-3 whitespace-nowrap text-teal-950">{c}</td>)}
                </tr>
              ))}
              {exportData.rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-teal-800/50">No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. Generic Tab
// ----------------------------------------------------------------------
function GenericTab({ tabId, sharedData }: { tabId: string, sharedData: { loading: boolean; data: any } }) {
  const [filters, setFilters] = useState({
    method: 'all', category: 'all', status: 'all', availability: 'all', role: 'all',
    from: localDate(), to: localDate(), lowOnly: false
  });

  if (sharedData.loading || !sharedData.data) {
    return <div className="p-12 text-center text-teal-800/50 animate-pulse font-medium">Loading operations data...</div>;
  }

  const { orders, payments, menuCats, invItems, requests, staff, branches } = sharedData.data;

  const menuItems = menuCats.flatMap((c: any) => (c.items || []).map((i: any) => ({ ...i, categoryName: c.name })));
  const invCategories = Array.from(new Set(invItems.map((i: any) => i.category).filter(Boolean))).sort() as string[];
  const staffRoles = Array.from(new Set(staff.map((s: any) => s.role).filter(Boolean))).sort() as string[];
  const categoryByItemName: Record<string, string> = {};
  menuItems.forEach((i: any) => { categoryByItemName[i.name] = i.categoryName || '—'; });

  const getExportData = () => {
    const t = tabId;
    if (t === 'sales') {
      let list = payments;
      if (filters.method !== 'all') list = list.filter((p: any) => p.method === filters.method);
      if (filters.from) list = list.filter((p: any) => new Date(p.createdAt) >= new Date(filters.from));
      if (filters.to) list = list.filter((p: any) => new Date(p.createdAt) <= new Date(`${filters.to}T23:59:59`));
      return {
        title: 'Sales Report', file: 'sales', head: ['Payment #', 'Order', 'Type', 'Amount (ETB)', 'Change (ETB)', 'Date'],
        rows: list.map((p: any) => [`#${p.id}`, `Order #${p.orderId}`, p.method === 'mobile' ? 'wallet' : p.method, Number(p.amount), Number(p.changeGiven || 0), new Date(p.createdAt).toLocaleString()]),
        records: list.map((p: any) => ({ payment: p, order: orders.find((o: any) => o.id === p.orderId) || p.order || null })),
      };
    }
    if (t === 'purchased') {
      let list = orders.filter((o: any) => o.status === 'paid');
      if (filters.from) list = list.filter((o: any) => new Date(o.createdAt) >= new Date(filters.from));
      if (filters.to) list = list.filter((o: any) => new Date(o.createdAt) <= new Date(`${filters.to}T23:59:59`));
      let rows = list.flatMap((o: any) => (o.items || []).map((i: any) => ({ date: new Date(o.createdAt).toLocaleString(), name: i.menuItem?.name || 'Item', category: categoryByItemName[i.menuItem?.name] || '—', qty: Number(i.quantity), unit: Number(i.unitPrice ?? i.menuItem?.price ?? 0), order: `#${o.id}`, orderRecord: o, itemRecord: i })));
      if (filters.category !== 'all') rows = rows.filter(r => r.category === filters.category);
      return {
        title: 'Items Purchased Report', file: 'items_purchased', head: ['Date', 'Item', 'Category', 'Quantity', 'Unit Price (ETB)', 'Total (ETB)', 'Order'],
        rows: rows.map(r => [r.date, r.name, r.category, r.qty, r.unit, r.qty * r.unit, r.order]),
        records: rows.map(r => ({ order: r.orderRecord, item: r.itemRecord, payments: r.orderRecord.payments || [] })),
      };
    }
    if (t === 'orders') {
      let list = orders;
      if (filters.status !== 'all') list = list.filter((o: any) => o.status === filters.status);
      if (filters.from) list = list.filter((o: any) => new Date(o.createdAt) >= new Date(filters.from));
      if (filters.to) list = list.filter((o: any) => new Date(o.createdAt) <= new Date(`${filters.to}T23:59:59`));
      return {
        title: 'Order Board Report', file: 'order_board', head: ['Order #', 'Date', 'Table', 'Waiter', 'Items', 'Status', 'Total (ETB)'],
        rows: list.map((o: any) => [`#${o.id}`, new Date(o.createdAt).toLocaleString(), o.table?.number ? String(o.table.number) : 'Take Away', o.waiter?.name || '—', (o.items || []).map((i: any) => `${i.quantity}× ${i.menuItem?.name || 'Item'}`).join(', '), o.status, Number(o.totalAmount)]),
        records: list,
      };
    }
    if (t === 'menu') {
      let list = menuItems;
      if (filters.category !== 'all') list = list.filter((i: any) => i.categoryName === filters.category);
      if (filters.availability !== 'all') list = list.filter((i: any) => (filters.availability === 'available' ? i.isAvailable !== false : i.isAvailable === false));
      return {
        title: 'Menu Report', file: 'menu', head: ['Item', 'Category', 'Price (ETB)', 'Available'],
        rows: list.map((i: any) => [i.name, i.categoryName || '—', Number(i.price), i.isAvailable === false ? 'No' : 'Yes']),
        records: list,
      };
    }
    if (t === 'inventory') {
      let list = invItems;
      if (filters.category !== 'all') list = list.filter((i: any) => i.category === filters.category);
      if (filters.lowOnly) list = list.filter((i: any) => Number(i.currentStock) <= Number(i.minStock));
      return {
        title: 'Inventory Report', file: 'inventory', head: ['Item', 'Category', 'Unit', 'Stock', 'Min Stock', 'Unit Cost (ETB)', 'Total Value (ETB)', 'Expiry'],
        rows: list.map((i: any) => [i.name, i.category || '—', i.unit, Number(i.currentStock), Number(i.minStock), Number(i.unitCost || 0), Number(i.currentStock) * Number(i.unitCost || 0), i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : '—']),
        records: list,
      };
    }
    if (t === 'requests') {
      let list = requests;
      if (filters.status !== 'all') list = list.filter((r: any) => r.status === filters.status);
      if (filters.from) list = list.filter((r: any) => new Date(r.createdAt) >= new Date(filters.from));
      if (filters.to) list = list.filter((r: any) => new Date(r.createdAt) <= new Date(`${filters.to}T23:59:59`));
      return {
        title: 'Item Requested Report', file: 'item_requested', head: ['Date', 'Item', 'Quantity', 'Requester', 'Status', 'Total (ETB)'],
        rows: list.map((r: any) => {
          const unit = Number(r.unitCost ?? r.inventoryItem?.unitCost ?? 0);
          return [r.createdAt ? new Date(r.createdAt).toLocaleString() : '—', r.inventoryItem?.name || '—', `${Number(r.quantity)} ${r.inventoryItem?.unit || ''}`.trim(), r.requesterName || r.requestedBy?.name || '—', r.status, unit * Number(r.quantity)];
        }),
        records: list,
      };
    }
    if (t === 'staff') {
      let list = staff;
      if (filters.role !== 'all') list = list.filter((s: any) => s.role === filters.role);
      return {
        title: 'Staff Report', file: 'staff', head: ['Name', 'Role', 'Email', 'Phone', 'Branch', 'Active'],
        rows: list.map((s: any) => [s.name, s.role, s.email || '—', s.phone || '—', s.branch?.name || s.branchId || '—', s.isActive === false ? 'OFF' : 'ON']),
        records: list,
      };
    }
    return {
      title: 'Branches Report', file: 'branches', head: ['Branch', 'Address', 'Phone', 'Active'],
      rows: branches.map((b: any) => [b.name, b.address || b.location || '—', b.phone || '—', b.isActive === false ? 'No' : 'Yes']),
      records: branches,
    };
  };

  const rawData = getExportData();
  const exportData = withCompleteDetails(rawData);
  const info = TABS.find(x => x.id === tabId);

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-teal-950">{info?.label} Report</h2>
        <div className="flex gap-2">
          <button onClick={() => exportPDF(exportData.title, exportData.file, exportData.head, exportData.rows)} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors"><FileDown size={14} /> PDF</button>
          <button onClick={() => exportGenericExcel(exportData.title, exportData.file, exportData.head, exportData.rows)} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-teal-900/10 hover:bg-teal-50 text-teal-800 px-3 h-[38px] rounded-xl shadow-sm transition-colors"><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6 bg-cream-50/50 p-4 rounded-2xl border border-cream-200/50">
        {['sales'].includes(tabId) && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Payment Type</label>
            <div className="relative">
              <select value={filters.method} onChange={e => setFilters({...filters, method: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                <option value="all">All types</option><option value="cash">Cash</option><option value="card">Card</option><option value="mobile">Wallet</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        {['purchased', 'menu'].includes(tabId) && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Category</label>
            <div className="relative">
              <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                <option value="all">All categories</option>
                {menuCats.map((c:any) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        {['inventory'].includes(tabId) && (
          <>
            <div className="min-w-[140px]">
              <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Category</label>
              <div className="relative">
                <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                  <option value="all">All categories</option>
                  {invCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-teal-950 h-[38px] px-2 cursor-pointer select-none">
              <input type="checkbox" checked={filters.lowOnly} onChange={e => setFilters({...filters, lowOnly: e.target.checked})} className="w-4 h-4 text-gold-500 rounded border-teal-900/20 focus:ring-gold-400" />
              Low stock only
            </label>
          </>
        )}
        {['orders', 'requests'].includes(tabId) && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Status</label>
            <div className="relative">
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                <option value="all">All</option>
                {(tabId === 'orders' ? ['pending','confirmed','preparing','ready','served','paid','cancelled'] : ['pending','approved','rejected','issued','received']).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        {['menu'].includes(tabId) && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Availability</label>
            <div className="relative">
              <select value={filters.availability} onChange={e => setFilters({...filters, availability: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                <option value="all">All</option><option value="available">Available</option><option value="unavailable">Unavailable</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        {['staff'].includes(tabId) && (
          <div className="min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">Role</label>
            <div className="relative">
              <select value={filters.role} onChange={e => setFilters({...filters, role: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]">
                <option value="all">All roles</option>
                {staffRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
            </div>
          </div>
        )}
        {['sales', 'purchased', 'orders', 'requests'].includes(tabId) && (
          <>
            <div><label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">From</label><input type="date" value={filters.from} max={filters.to} onChange={e => setFilters({...filters, from: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]" /></div>
            <div><label className="block text-[10px] uppercase tracking-widest font-semibold text-teal-800/60 mb-1.5">To</label><input type="date" value={filters.to} min={filters.from} onChange={e => setFilters({...filters, to: e.target.value})} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm h-[38px]" /></div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-teal-900/10 shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-teal-50/50 text-teal-900 border-b border-teal-900/10">
            <tr>{rawData.head.map((col, i) => <th key={i} className="px-5 py-3 text-left font-semibold whitespace-nowrap">{col}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-teal-900/5">
            {rawData.rows.length === 0 ? (
              <tr><td colSpan={rawData.head.length} className="px-5 py-12 text-center text-teal-800/50 font-medium">No records found matching filters.</td></tr>
            ) : rawData.rows.map((row, i) => (
              <tr key={i} className="hover:bg-cream-50/30 transition-colors">
                {row.map((cell, j) => <td key={j} className="px-5 py-3 whitespace-nowrap text-teal-950">{String(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 4. Main Reports Page
// ----------------------------------------------------------------------
export default function ReportsPage() {
  const { user } = useAuthStore();
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const canPickBranch = ['admin', 'owner'].includes(user?.role || '');

  const tabs = useMemo(() => user?.role ? TABS.filter(t => t.roles.includes(user.role)) : [], [user?.role]);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'service');

  const [sharedData, setSharedData] = useState<{ loading: boolean; data: any; error: string }>({ loading: false, data: null, error: '' });

  useEffect(() => {
    if (canPickBranch) {
      getBranches().then(r => setBranchesList(r.data || [])).catch(() => {});
    }
  }, [canPickBranch]);

  const fetchSharedData = useCallback(async (bId?: number) => {
    setSharedData(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const [ordersRes, paymentsRes, catRes, invRes, reqRes, staffRes, brRes] = await Promise.allSettled([
        getOrders(bId ? { branchId: bId } : undefined),
        getPayments(bId),
        getMenuCategories(),
        getInventoryItems(),
        getItemRequests(),
        getStaffList(),
        getBranches()
      ]);
      setSharedData({
        loading: false,
        error: '',
        data: {
          orders: ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data) ? ordersRes.value.data : [],
          payments: paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value.data) ? paymentsRes.value.data : [],
          menuCats: catRes.status === 'fulfilled' && Array.isArray(catRes.value.data) ? catRes.value.data : [],
          invItems: invRes.status === 'fulfilled' && Array.isArray(invRes.value.data) ? invRes.value.data : [],
          requests: reqRes.status === 'fulfilled' && Array.isArray(reqRes.value.data) ? reqRes.value.data : [],
          staff: staffRes.status === 'fulfilled' && Array.isArray(staffRes.value.data) ? staffRes.value.data : [],
          branches: brRes.status === 'fulfilled' && Array.isArray(brRes.value.data) ? brRes.value.data : [],
        }
      });
    } catch {
      setSharedData(prev => ({ ...prev, loading: false, error: 'Failed to load operations data.' }));
    }
  }, []);

  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      if (tabs.length > 0) setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (activeTab !== 'service' && !sharedData.data) {
      fetchSharedData(branchId);
    }
  }, [activeTab, branchId, sharedData.data, fetchSharedData]);

  useEffect(() => {
    if (activeTab !== 'service' && sharedData.data) {
      fetchSharedData(branchId);
    }
    // Reload the selected branch without refetching on unrelated state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-start bg-cream-50 min-h-screen">
      <aside className="w-full lg:w-56 shrink-0 flex flex-col gap-6 lg:sticky lg:top-6">
        <div>
          <h1 className="text-2xl font-display font-medium text-teal-950 flex items-center gap-2.5 tracking-wide">
            <BarChart3 className="text-teal-700" size={24} /> Summary & Reports
          </h1>
          {canPickBranch && branchesList.length > 0 && (
            <div className="mt-5">
              <label className="text-[10px] font-semibold text-teal-800 uppercase tracking-widest mb-1.5 block">Branch</label>
              <div className="relative">
                <select value={branchId || ''} onChange={e => setBranchId(e.target.value ? +e.target.value : undefined)} className="w-full appearance-none bg-white border border-teal-900/10 rounded-xl pl-3 pr-8 py-2.5 text-sm text-teal-950 focus:outline-none focus:ring-2 focus:ring-gold-400 shadow-sm transition-all">
                  <option value="">All branches</option>
                  {branchesList.map(b => (
                    <option key={b.id} value={b.id}>{b.restaurant?.name ? `${b.restaurant.name} — ` : ''}{b.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-800/50 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
        <nav className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 custom-scrollbar">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={clsx(
                "flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm transition-all whitespace-nowrap outline-none",
                activeTab === t.id
                  ? "bg-teal-900 text-cream-50 shadow-md shadow-teal-900/20 font-medium"
                  : "text-teal-800/80 hover:bg-teal-100/50 hover:text-teal-900 font-medium"
              )}>
              <t.icon size={18} strokeWidth={activeTab === t.id ? 2 : 1.5} className={activeTab === t.id ? "text-gold-400" : "text-teal-700/70"} />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 bg-white rounded-3xl border border-teal-900/10 shadow-sm min-h-[600px]">
        {sharedData.error && activeTab !== 'service' && (
          <div className="m-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3">
            <span>{sharedData.error}</span>
            <button onClick={() => fetchSharedData(branchId)} className="text-xs bg-white px-2 py-1 border border-red-200 rounded text-red-700 hover:bg-red-100">Retry</button>
          </div>
        )}
        {activeTab === 'service' && <ServiceReportsTab user={user} branchId={branchId} />}
        {activeTab === 'overview' && <OverviewTab branchId={branchId} sharedData={sharedData} />}
        {GENERIC_TABS.includes(activeTab as any) && <GenericTab tabId={activeTab} sharedData={sharedData} />}
      </main>
    </div>
  );
}
