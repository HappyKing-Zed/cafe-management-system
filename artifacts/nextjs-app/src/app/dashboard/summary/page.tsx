'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { getSummary, getServiceSubmissions, submitDailyService, confirmServiceSubmission, getWaiters } from '@/lib/api';
import { ClipboardList, ChevronDown, ChevronUp, Send, CheckCircle2, Clock, FileDown, FileSpreadsheet } from 'lucide-react';

const fmt = (n: number) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
// Local calendar date/time (never toISOString — that shifts to UTC and can be off by a day)
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDateTime = (d: Date, h = 0, m = 0) => `${localDate(d)}T${pad(h)}:${pad(m)}`;
const prettyRange = (start: string, end: string) => `${start.replace('T', ' ')} to ${end.replace('T', ' ')}`;

/* ---------- export helpers (lazy-load heavy libs) ---------- */

async function loadPdf() {
  const { default: jsPDF } = await import('jspdf');
  const at: any = await import('jspdf-autotable');
  const autoTable = at.autoTable ?? at.default;
  return { jsPDF, autoTable };
}
async function loadXlsx() {
  const m: any = await import('xlsx');
  return m.default?.utils ? m.default : m;
}

// One spreadsheet-style row per item, plus a TOTAL row
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

const PDF_HEAD = ['Order', 'Table', 'Item', 'Qty', 'Unit Price (ETB)', 'Amount (ETB)'];
const toPdfBody = (rows: any[]) => rows.map((r) => [r.Order, r.Table, r.Item, r.Qty, r['Unit Price (ETB)'] === '' ? '' : Number(r['Unit Price (ETB)']).toFixed(2), Number(r['Amount (ETB)'] || 0).toFixed(2)]);

async function exportSummaryPdf(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Service Summary', 14, 16);
  doc.setFontSize(10);
  doc.text(`Period: ${prettyRange(range.start, range.end)}${waiterName ? `  ·  Waiter: ${waiterName}` : ''}`, 14, 23);
  doc.text(`Orders: ${summary.totals.orders}   Items: ${summary.totals.items}   Revenue: ${fmt(summary.totals.revenue)}`, 14, 29);
  let y = 34;
  if (summary.byWaiter?.length) {
    autoTable(doc, {
      startY: y, head: [['Waiter', 'Orders', 'Items', 'Revenue (ETB)']],
      body: summary.byWaiter.map((w: any) => [w.name, w.orders, w.items, Number(w.revenue).toFixed(2)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  const body: any[] = [];
  for (const t of summary.byTable || []) {
    body.push([{ content: `${t.label} — ${t.orders} orders · ${t.items} items · ${Number(t.revenue).toFixed(2)} ETB`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }]);
    for (const d of t.itemDetail || []) body.push([d.name, d.quantity, Number(d.amount).toFixed(2)]);
  }
  autoTable(doc, { startY: y, head: [['Item', 'Qty', 'Amount (ETB)']], body });
  doc.save(`service-summary-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}.pdf`);
}

async function exportSummaryExcel(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const totals = [
    ['Service Summary'],
    ['Period', prettyRange(range.start, range.end)],
    ...(waiterName ? [['Waiter', waiterName]] : []),
    [],
    ['Orders', summary.totals.orders],
    ['Items', summary.totals.items],
    ['Revenue (ETB)', Number(summary.totals.revenue)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totals), 'Totals');
  if (summary.byWaiter?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary.byWaiter.map((w: any) => ({
      Waiter: w.name, Orders: w.orders, Items: w.items, 'Revenue (ETB)': Number(w.revenue),
    }))), 'By Waiter');
  }
  const rows: any[] = [];
  for (const t of summary.byTable || []) {
    for (const d of t.itemDetail || []) rows.push({ Table: t.label, Item: d.name, Qty: d.quantity, 'Amount (ETB)': Number(d.amount) });
  }
  XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No data']]), 'Table Detail');
  XLSX.writeFile(wb, `service-summary-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}.xlsx`);
}

// Export several reports (waiter view, filtered by date) into one document
async function exportReportsPdf(subs: any[], range: { start: string; end: string }, waiterName?: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Daily Service Reports', 14, 16);
  doc.setFontSize(10);
  doc.text(`Period: ${prettyRange(range.start, range.end)}${waiterName ? `  ·  Waiter: ${waiterName}` : ''}`, 14, 23);
  let y = 28;
  let grand = 0;
  for (const s of subs) {
    const { rows, total } = itemRows(s.detail);
    grand += total;
    autoTable(doc, {
      startY: y + 3,
      head: [[{ content: `Report #${s.id} — ${s.serviceDate} · ${s.ordersCount} orders · ${s.status === 'confirmed' ? 'Confirmed' : 'Awaiting cashier'}`, colSpan: 6, styles: { fillColor: [240, 240, 240], textColor: 30 } }], PDF_HEAD],
      body: [...toPdfBody(rows), ['', '', '', '', 'TOTAL', total.toFixed(2)]],
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }
  doc.setFontSize(11);
  doc.text(`Grand total: ${fmt(grand)}`, 14, y + 8);
  doc.save(`service-reports-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}.pdf`);
}

async function exportReportsExcel(subs: any[], range: { start: string; end: string }, waiterName?: string) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const aoa: any[] = [
    ['Daily Service Reports'],
    ['Period', prettyRange(range.start, range.end)],
    ...(waiterName ? [['Waiter', waiterName]] : []),
    [],
  ];
  let grand = 0;
  for (const s of subs) {
    const { rows, total } = itemRows(s.detail);
    grand += total;
    aoa.push([`Report #${s.id}`, s.serviceDate, s.status === 'confirmed' ? 'Confirmed' : 'Awaiting cashier']);
    aoa.push(PDF_HEAD);
    for (const r of rows) aoa.push([r.Order, r.Table, r.Item, r.Qty, r['Unit Price (ETB)'], r['Amount (ETB)']]);
    aoa.push(['', '', '', '', 'TOTAL', total]);
    aoa.push([]);
  }
  aoa.push(['', '', '', '', 'GRAND TOTAL', Math.round(grand * 100) / 100]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Reports');
  XLSX.writeFile(wb, `service-reports-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}.xlsx`);
}

async function exportSubmissionPdf(s: any) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  const { rows, total } = itemRows(s.detail);
  doc.setFontSize(16);
  doc.text(`Service Report #${s.id}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Waiter: ${s.waiter?.name || `#${s.waiterId}`}   Date: ${s.serviceDate}`, 14, 23);
  doc.text(`Orders: ${s.ordersCount}   Items: ${s.itemsCount}   Revenue: ${fmt(s.totalRevenue)}   Status: ${s.status === 'confirmed' ? `Confirmed${s.cashier?.name ? ` by ${s.cashier.name}` : ''}` : 'Awaiting cashier'}`, 14, 29);
  autoTable(doc, { startY: 34, head: [PDF_HEAD], body: [...toPdfBody(rows), ['', '', '', '', 'TOTAL', total.toFixed(2)]] });
  doc.save(`service-report-${s.serviceDate}-no${s.id}.pdf`);
}

async function exportSubmissionExcel(s: any) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const { rows, total } = itemRows(s.detail);
  const info = [
    [`Service Report #${s.id}`],
    ['Waiter', s.waiter?.name || `#${s.waiterId}`],
    ['Date', s.serviceDate],
    ['Orders', s.ordersCount], ['Items', s.itemsCount], ['Revenue (ETB)', Number(s.totalRevenue)],
    ['Status', s.status === 'confirmed' ? `Confirmed${s.cashier?.name ? ` by ${s.cashier.name}` : ''}` : 'Awaiting cashier'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Report');
  const aoa = [PDF_HEAD, ...rows.map((r: any) => [r.Order, r.Table, r.Item, r.Qty, r['Unit Price (ETB)'], r['Amount (ETB)']]), ['', '', '', '', 'TOTAL', total]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Orders');
  XLSX.writeFile(wb, `service-report-${s.serviceDate}-no${s.id}.xlsx`);
}

/* ---------- page ---------- */

export default function SummaryPage() {
  const { user } = useAuthStore();
  const isWaiter = user?.role === 'waiter';
  const isCashier = user?.role === 'cashier';
  // Waiters and cashiers work with the reports list only (no summary analytics)
  const reportsOnly = isWaiter || isCashier;
  const canConfirm = ['cashier', 'admin', 'owner'].includes(user?.role || '');

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

  const fetchSummary = useCallback(async () => {
    if (reportsOnly) return; // waiters & cashiers only see the reports list
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      if (waiterFilter) params.waiterId = +waiterFilter;
      const res = await getSummary(params);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, waiterFilter, reportsOnly]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await getServiceSubmissions();
      setSubmissions(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => {
    fetchSubmissions();
    if (!isWaiter) getWaiters().then((r) => setWaiters(r.data || [])).catch(() => {});
  }, [fetchSubmissions, isWaiter]);

  // Reports within the selected date & time range (by when the report was sent)
  const visibleSubs = useMemo(() => {
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setMinutes(to.getMinutes() + 1); // inclusive up to the selected minute
    return submissions.filter((x) => {
      const t = x.createdAt ? new Date(x.createdAt) : new Date(`${x.serviceDate}T00:00`);
      if (t < from || t >= to) return false;
      if (statusFilter !== 'all' && x.status !== statusFilter) return false;
      if (!isWaiter && waiterFilter && String(x.waiterId) !== waiterFilter) return false;
      return true;
    });
  }, [submissions, startDate, endDate, statusFilter, waiterFilter, isWaiter]);

  // Aggregate totals of the filtered reports
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
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not submit');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (id: number) => {
    setBusy(true); setError('');
    try {
      await confirmServiceSubmission(id);
      await fetchSubmissions();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not confirm');
    } finally {
      setBusy(false);
    }
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

  const detailTable = (detail: any[], revenue: number) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
        <thead>
          <tr className="text-left text-gray-600 bg-gray-100 border-b border-gray-200">
            <th className="px-3 py-1.5 border-r border-gray-200">Order</th>
            <th className="px-3 py-1.5 border-r border-gray-200">Table</th>
            <th className="px-3 py-1.5 border-r border-gray-200">Item</th>
            <th className="px-3 py-1.5 border-r border-gray-200 text-center">Qty</th>
            <th className="px-3 py-1.5 border-r border-gray-200 text-right">Unit Price</th>
            <th className="px-3 py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {itemRows(detail).rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-3 py-1.5 border-r border-gray-100">{r.Order}</td>
              <td className="px-3 py-1.5 border-r border-gray-100">{r.Table}</td>
              <td className="px-3 py-1.5 border-r border-gray-100">{r.Item}</td>
              <td className="px-3 py-1.5 border-r border-gray-100 text-center">{r.Qty}</td>
              <td className="px-3 py-1.5 border-r border-gray-100 text-right">{r['Unit Price (ETB)'] === '' ? '' : fmt(r['Unit Price (ETB)'])}</td>
              <td className="px-3 py-1.5 text-right">{fmt(r['Amount (ETB)'])}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold text-gray-900">
            <td className="px-3 py-1.5" colSpan={5}>TOTAL</td>
            <td className="px-3 py-1.5 text-right">{fmt(revenue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <ClipboardList className="text-brand-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{reportsOnly ? 'Daily Service Reports' : 'Service Summary'}</h1>
            <p className="text-gray-500 text-sm">{isWaiter ? 'Send your served orders to the cashier — each report covers only orders not yet sent' : isCashier ? 'Reports received from waiters — confirm them as you receive the cash' : 'Served items and revenue by table'}</p>
          </div>
        </div>
        {isWaiter && (
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Send size={16} /> Send new orders to cashier
          </button>
        )}
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Filters: date & time range */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="datetime-local" value={startDate} max={endDate} onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="datetime-local" value={endDate} min={startDate} onChange={(e) => e.target.value && setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div className="flex gap-1">
          {([['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setQuickRange(k)}
              className="px-3 py-2 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{label}</button>
          ))}
        </div>
        {!isWaiter && (
          <select
            value={waiterFilter}
            onChange={(e) => setWaiterFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All waiters</option>
            {waiters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="submitted">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => runExport(() => reportsOnly ? exportReportsPdf(visibleSubs, range, waiterName) : exportSummaryPdf(summary, range, waiterName))}
            disabled={reportsOnly ? visibleSubs.length === 0 : !summary}
            className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-gray-700 px-3 py-2 rounded-lg">
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={() => runExport(() => reportsOnly ? exportReportsExcel(visibleSubs, range, waiterName) : exportSummaryExcel(summary, range, waiterName))}
            disabled={reportsOnly ? visibleSubs.length === 0 : !summary}
            className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-gray-700 px-3 py-2 rounded-lg">
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>
      </div>

      {!reportsOnly && (loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !summary ? (
        <p className="text-gray-500 text-sm">Could not load the summary.</p>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Served Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totals.orders}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Items Served</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totals.items}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Revenue</p>
              <p className="text-2xl font-bold text-brand-600 mt-1">{fmt(summary.totals.revenue)}</p>
            </div>
          </div>

          {/* By waiter (only when not filtering) */}
          {!waiterFilter && summary.byWaiter?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl mb-6 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-900">By Waiter</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2">Waiter</th><th className="px-4 py-2">Orders</th><th className="px-4 py-2">Items</th><th className="px-4 py-2 text-right">Revenue</th>
                  </tr></thead>
                  <tbody>
                    {summary.byWaiter.map((w: any) => (
                      <tr key={w.waiterId} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{w.name}</td>
                        <td className="px-4 py-2">{w.orders}</td>
                        <td className="px-4 py-2">{w.items}</td>
                        <td className="px-4 py-2 text-right font-medium">{fmt(w.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table detail */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-900">Table Detail</div>
            {summary.byTable.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No served orders in this date range.</p>
            ) : summary.byTable.map((t: any) => {
              const key = String(t.tableId ?? 'walkin');
              const isOpen = false;
              return (
                <details key={key} className="border-b border-gray-50 last:border-0">
                  <summary className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer list-none">
                    <span className="font-medium text-gray-900">{t.label}</span>
                    <span className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{t.orders} orders</span>
                      <span>{t.items} items</span>
                      <span className="font-semibold text-gray-900">{fmt(t.revenue)}</span>
                      <ChevronDown size={16} />
                    </span>
                  </summary>
                  <div className="px-4 pb-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-1.5">Item</th><th className="py-1.5">Qty</th><th className="py-1.5 text-right">Amount</th>
                      </tr></thead>
                      <tbody>
                        {t.itemDetail.map((d: any) => (
                          <tr key={d.menuItemId} className="border-b border-gray-50 last:border-0">
                            <td className="py-1.5 text-gray-900">{d.name}</td>
                            <td className="py-1.5">{d.quantity}</td>
                            <td className="py-1.5 text-right">{fmt(d.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ))}

      {/* Aggregate totals of the filtered reports */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {([['Reports', String(aggregate.reports)], ['Orders', String(aggregate.orders)], ['Items', String(aggregate.items)], ['Total Revenue', fmt(aggregate.revenue)]] as const).map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500 uppercase">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${label === 'Total Revenue' ? 'text-brand-600' : 'text-gray-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Daily service reports — record list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-sm text-gray-900">Daily Service Reports</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isWaiter ? 'Your reports to the cashier — click a record to see its detail' : canConfirm ? 'Click a record to see its detail; confirm reports received from waiters' : 'Reports from waiters — click a record to see its detail'}
          </p>
        </div>
        {visibleSubs.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No reports in this date range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Report</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Waiter</th><th className="px-4 py-2">Orders</th><th className="px-4 py-2">Items</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {visibleSubs.map((s) => {
                  const isOpen = subOpen === s.id;
                  return [
                    <tr key={s.id} onClick={() => setSubOpen(isOpen ? null : s.id)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-2.5 font-medium text-gray-900">#{s.id}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {s.serviceDate}
                        {s.createdAt && <span className="text-gray-400 text-xs ml-1">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </td>
                      <td className="px-4 py-2.5">{s.waiter?.name || `Waiter #${s.waiterId}`}</td>
                      <td className="px-4 py-2.5">{s.ordersCount}</td>
                      <td className="px-4 py-2.5">{s.itemsCount}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(s.totalRevenue)}</td>
                      <td className="px-4 py-2.5">
                        {s.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                            <CheckCircle2 size={13} /> Confirmed{s.cashier?.name ? ` by ${s.cashier.name}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                            <Clock size={13} /> Awaiting cashier
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${s.id}-detail`} className="border-b border-gray-50 bg-gray-50/50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {canConfirm && s.status !== 'confirmed' && (
                              <button onClick={() => handleConfirm(s.id)} disabled={busy}
                                className="text-xs font-medium bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">
                                Confirm received
                              </button>
                            )}
                            <button onClick={() => runExport(() => exportSubmissionPdf(s))}
                              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg">
                              <FileDown size={13} /> Download PDF
                            </button>
                            <button onClick={() => runExport(() => exportSubmissionExcel(s))}
                              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg">
                              <FileSpreadsheet size={13} /> Download Excel
                            </button>
                          </div>
                          {detailTable(s.detail, Number(s.totalRevenue))}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
