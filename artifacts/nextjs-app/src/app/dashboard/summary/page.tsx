'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { getSummary, getServiceSubmissions, submitDailyService, confirmServiceSubmission, getWaiters } from '@/lib/api';
import { ClipboardList, ChevronDown, ChevronUp, Send, CheckCircle2, Clock, FileDown, FileSpreadsheet, History } from 'lucide-react';

const fmt = (n: number) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
// Local calendar date (never toISOString — that shifts to UTC and can be off by a day)
const localDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => localDate();

/* ---------- export helpers (lazy-load heavy libs) ---------- */

async function exportSummaryPdf(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Service Summary', 14, 16);
  doc.setFontSize(10);
  doc.text(`Period: ${range.start} to ${range.end}${waiterName ? `  ·  Waiter: ${waiterName}` : ''}`, 14, 23);
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
  doc.save(`service-summary-${range.start}-to-${range.end}.pdf`);
}

async function exportSummaryExcel(summary: any, range: { start: string; end: string }, waiterName?: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const totals = [
    ['Service Summary'],
    ['Period', `${range.start} to ${range.end}`],
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
    for (const d of t.itemDetail || []) {
      rows.push({ Table: t.label, Item: d.name, Qty: d.quantity, 'Amount (ETB)': Number(d.amount) });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length ? [Object.keys(rows[0]), ...rows.map(r => Object.values(r))] : [['No data']]), 'Table Detail');
  XLSX.writeFile(wb, `service-summary-${range.start}-to-${range.end}.xlsx`);
}

function submissionRows(detail: any[]) {
  return (detail || []).map((d: any) => ({
    Order: `#${d.orderId}`, Table: d.table,
    Items: (d.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', '),
    'Amount (ETB)': Number(d.amount),
  }));
}

async function exportSubmissionPdf(s: any) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Daily Service Report', 14, 16);
  doc.setFontSize(10);
  doc.text(`Waiter: ${s.waiter?.name || `#${s.waiterId}`}   Date: ${s.serviceDate}`, 14, 23);
  doc.text(`Orders: ${s.ordersCount}   Items: ${s.itemsCount}   Revenue: ${fmt(s.totalRevenue)}   Status: ${s.status === 'confirmed' ? `Confirmed${s.cashier?.name ? ` by ${s.cashier.name}` : ''}` : 'Awaiting cashier'}`, 14, 29);
  autoTable(doc, {
    startY: 34, head: [['Order', 'Table', 'Items', 'Amount (ETB)']],
    body: (s.detail || []).map((d: any) => [`#${d.orderId}`, d.table, (d.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', '), Number(d.amount).toFixed(2)]),
  });
  if (Array.isArray(s.revisions) && s.revisions.length) {
    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text('Earlier versions (before resubmission)', 14, y);
    for (const [idx, r] of s.revisions.entries()) {
      autoTable(doc, {
        startY: y + 3,
        head: [[`Version ${idx + 1} — ${r.ordersCount} orders · ${r.itemsCount} items · ${Number(r.totalRevenue).toFixed(2)} ETB`, '', '', '']],
        body: (r.detail || []).map((d: any) => [`#${d.orderId}`, d.table, (d.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', '), Number(d.amount).toFixed(2)]),
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }
  doc.save(`service-report-${s.serviceDate}-${(s.waiter?.name || s.waiterId).toString().replace(/\s+/g, '-')}.pdf`);
}

async function exportSubmissionExcel(s: any) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const info = [
    ['Daily Service Report'],
    ['Waiter', s.waiter?.name || `#${s.waiterId}`],
    ['Date', s.serviceDate],
    ['Orders', s.ordersCount], ['Items', s.itemsCount], ['Revenue (ETB)', Number(s.totalRevenue)],
    ['Status', s.status === 'confirmed' ? `Confirmed${s.cashier?.name ? ` by ${s.cashier.name}` : ''}` : 'Awaiting cashier'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Report');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(submissionRows(s.detail)), 'Orders');
  if (Array.isArray(s.revisions)) {
    s.revisions.forEach((r: any, idx: number) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(submissionRows(r.detail)), `Version ${idx + 1}`);
    });
  }
  XLSX.writeFile(wb, `service-report-${s.serviceDate}.xlsx`);
}

/* ---------- page ---------- */

export default function SummaryPage() {
  const { user } = useAuthStore();
  const isWaiter = user?.role === 'waiter';
  const canConfirm = ['cashier', 'admin', 'owner'].includes(user?.role || '');

  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [waiterFilter, setWaiterFilter] = useState('');
  const [waiters, setWaiters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subOpen, setSubOpen] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      if (!isWaiter && waiterFilter) params.waiterId = +waiterFilter;
      const res = await getSummary(params);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, waiterFilter, isWaiter]);

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

  const handleSubmit = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await submitDailyService();
      setMessage('Today\'s service was submitted to the cashier.');
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

  const waiterName = waiterFilter ? waiters.find((w) => String(w.id) === waiterFilter)?.name : (isWaiter ? user?.name : undefined);
  const range = { start: startDate, end: endDate };

  const setQuickRange = (kind: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    const end = todayStr();
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    if (kind === 'week') { const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); }
    else if (kind === 'month') d.setDate(1);
    else if (kind === 'year') d.setMonth(0, 1);
    setStartDate(localDate(d));
    setEndDate(end);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <ClipboardList className="text-brand-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Summary</h1>
            <p className="text-gray-500 text-sm">{isWaiter ? 'Your served orders and revenue' : 'Served items and revenue by table'}</p>
          </div>
        </div>
        {isWaiter && (
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Send size={16} /> Submit today&apos;s service to cashier
          </button>
        )}
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Filters: calendar date range */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={startDate} max={endDate} onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={endDate} min={startDate} max={todayStr()} onChange={(e) => e.target.value && setEndDate(e.target.value)}
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
        {summary && (
          <div className="flex gap-2 ml-auto">
            <button onClick={() => exportSummaryPdf(summary, range, waiterName)}
              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">
              <FileDown size={14} /> PDF
            </button>
            <button onClick={() => exportSummaryExcel(summary, range, waiterName)}
              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        )}
      </div>

      {loading ? (
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

          {/* By waiter (managers/coordinators/owners/admin, only when not filtering) */}
          {!isWaiter && !waiterFilter && summary.byWaiter?.length > 0 && (
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
              const isOpen = expanded === key;
              return (
                <div key={key} className="border-b border-gray-50 last:border-0">
                  <button onClick={() => setExpanded(isOpen ? null : key)} className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 text-left">
                    <span className="font-medium text-gray-900">{t.label}</span>
                    <span className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{t.orders} orders</span>
                      <span>{t.items} items</span>
                      <span className="font-semibold text-gray-900">{fmt(t.revenue)}</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                  {isOpen && (
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
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Daily service submissions — record list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-sm text-gray-900">Daily Service Reports</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isWaiter ? 'Your end-of-day reports to the cashier — click a record to see its detail' : canConfirm ? 'Click a record to see its detail; confirm reports received from waiters' : 'End-of-day reports from waiters — click a record to see its detail'}
          </p>
        </div>
        {submissions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Date</th><th className="px-4 py-2">Waiter</th><th className="px-4 py-2">Orders</th><th className="px-4 py-2">Items</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {submissions.map((s) => {
                  const isOpen = subOpen === s.id;
                  const hasVersions = Array.isArray(s.revisions) && s.revisions.length > 0;
                  return [
                    <tr key={s.id} onClick={() => { setSubOpen(isOpen ? null : s.id); setShowVersions(null); }}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{s.serviceDate}</td>
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
                        {hasVersions && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-gray-500" title="This report was resubmitted">
                            <History size={12} /> edited
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${s.id}-detail`} className="border-b border-gray-50 bg-gray-50/50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {canConfirm && s.status !== 'confirmed' && (
                              <button onClick={() => handleConfirm(s.id)} disabled={busy}
                                className="text-xs font-medium bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">
                                Confirm received
                              </button>
                            )}
                            <button onClick={() => exportSubmissionPdf(s)}
                              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg">
                              <FileDown size={13} /> Download PDF
                            </button>
                            <button onClick={() => exportSubmissionExcel(s)}
                              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg">
                              <FileSpreadsheet size={13} /> Download Excel
                            </button>
                            {hasVersions && (
                              <button onClick={() => setShowVersions(showVersions === s.id ? null : s.id)}
                                className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg">
                                <History size={13} /> {showVersions === s.id ? 'Hide earlier versions' : `Compare with earlier version${s.revisions.length > 1 ? 's' : ''}`}
                              </button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm bg-white rounded-lg border border-gray-100">
                              <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-3 py-1.5">Order</th><th className="px-3 py-1.5">Table</th><th className="px-3 py-1.5">Items</th><th className="px-3 py-1.5 text-right">Amount</th>
                              </tr></thead>
                              <tbody>
                                {(s.detail || []).map((d: any) => (
                                  <tr key={d.orderId} className="border-b border-gray-50 last:border-0 align-top">
                                    <td className="px-3 py-1.5">#{d.orderId}</td>
                                    <td className="px-3 py-1.5">{d.table}</td>
                                    <td className="px-3 py-1.5 text-gray-600">{(d.items || []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                                    <td className="px-3 py-1.5 text-right">{fmt(d.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {showVersions === s.id && hasVersions && (
                            <div className="mt-3 space-y-3">
                              {s.revisions.map((r: any, idx: number) => {
                                const revDiff = Math.round((Number(s.totalRevenue) - Number(r.totalRevenue)) * 100) / 100;
                                return (
                                  <div key={idx} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-amber-800 mb-1">
                                      Version {idx + 1} (before resubmission{r.submittedAt ? `, submitted ${new Date(r.submittedAt).toLocaleString()}` : ''})
                                    </p>
                                    <p className="text-xs text-gray-600 mb-2">
                                      {r.ordersCount} orders · {r.itemsCount} items · {fmt(r.totalRevenue)}
                                      <span className={revDiff === 0 ? 'text-gray-500' : revDiff > 0 ? 'text-green-700' : 'text-red-700'}>
                                        {'  '}(current version {revDiff === 0 ? 'has the same total' : `${revDiff > 0 ? '+' : ''}${revDiff.toFixed(2)} ETB`}{s.ordersCount !== r.ordersCount ? `, ${s.ordersCount - r.ordersCount > 0 ? '+' : ''}${s.ordersCount - r.ordersCount} orders` : ''})
                                      </span>
                                    </p>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs bg-white rounded border border-gray-100">
                                        <tbody>
                                          {(r.detail || []).map((d: any) => (
                                            <tr key={d.orderId} className="border-b border-gray-50 last:border-0">
                                              <td className="px-2 py-1">#{d.orderId}</td>
                                              <td className="px-2 py-1">{d.table}</td>
                                              <td className="px-2 py-1 text-gray-600">{(d.items || []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                                              <td className="px-2 py-1 text-right">{fmt(d.amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
