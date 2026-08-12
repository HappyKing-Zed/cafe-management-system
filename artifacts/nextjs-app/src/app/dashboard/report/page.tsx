'use client';
import { useEffect, useState } from 'react';
import { getItemRequests } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface ItemRequest {
  id: number;
  quantity: number;
  reason?: string;
  status: string;
  unitCost?: number;
  requesterName?: string;
  requestedBy?: { name?: string };
  inventoryItem?: { name?: string; unit?: string; unitCost?: number };
  createdAt?: string;
}
import { FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const ALLOWED_ROLES = ['admin', 'owner', 'manager', 'coordinator'];

export default function ReportPage() {
  const { user } = useAuthStore();
  const allowed = !!user && ALLOWED_ROLES.includes(user.role);
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState({ type: 'all', from: '', to: '' });
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await getItemRequests();
      setRequests(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (allowed) fetchData(); }, [allowed]);

  const unitPrice = (r: ItemRequest) => Number(r.unitCost ?? r.inventoryItem?.unitCost ?? 0);
  const totalPrice = (r: ItemRequest) => unitPrice(r) * Number(r.quantity);

  const reportData = () => {
    let list = requests;
    if (report.type !== 'all') list = list.filter(r => r.status === report.type);
    if (report.from) list = list.filter(r => new Date((r as any).createdAt) >= new Date(report.from));
    if (report.to) list = list.filter(r => new Date((r as any).createdAt) <= new Date(`${report.to}T23:59:59`));
    const title = report.type === 'all' ? 'Item Requests Report' : `Item Requests Report (${report.type})`;
    return {
      title,
      head: ['Date', 'Item', 'Quantity', 'Requester', 'Reason', 'Status', 'Unit Price (ETB)', 'Total (ETB)'],
      rows: list.map(r => [
        (r as any).createdAt ? new Date((r as any).createdAt).toLocaleString() : '—',
        r.inventoryItem?.name || '—',
        `${Number(r.quantity)} ${r.inventoryItem?.unit || ''}`.trim(),
        r.requesterName || r.requestedBy?.name || '—',
        r.reason || '—',
        r.status,
        unitPrice(r),
        totalPrice(r),
      ]),
    };
  };

  const rangeLabel = () => [report.from && `from ${report.from}`, report.to && `to ${report.to}`].filter(Boolean).join(' ') || 'all dates';

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { title, head, rows } = reportData();
      const XLSX = await import('xlsx');
      const safe = (v: string | number) => typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v;
      const ws = XLSX.utils.aoa_to_sheet([[`${title} (${rangeLabel()})`], head, ...rows.map(r => r.map(safe))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Item Requests');
      XLSX.writeFile(wb, `item_requests_${report.type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { title, head, rows } = reportData();
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Jima Aba Jifar — ${title}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`${rangeLabel()} · generated ${new Date().toLocaleString()}`, 14, 22);
      autoTable(doc, { head: [head], body: rows.map(r => r.map(String)), startY: 27, styles: { fontSize: 8 } });
      doc.save(`item_requests_${report.type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { alert('Export failed'); } finally { setExporting(false); }
  };

  if (!user) {
    return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!allowed) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto mt-16 card p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">No access to Reports</h1>
          <p className="text-sm text-gray-500 mb-4">This page is only available to managers, owners, admins and coordinators.</p>
          <Link href="/dashboard/orders" className="btn-primary inline-flex">Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText className="text-blue-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report</h1>
            <p className="text-sm text-gray-500">Item Requests — Export Report (Excel / PDF)</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 shrink-0"><RefreshCw size={16} /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card p-5 max-w-3xl">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><FileText className="text-blue-600" size={18} /></div>
            <h2 className="font-bold text-gray-900">Export Report</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Report Type</label>
              <select value={report.type} onChange={e => setReport(p => ({ ...p, type: e.target.value }))} className="input text-sm">
                <option value="all">All Requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="issued">Issued (stocked out)</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-gray-700 mb-1">From</label>
              <input type="date" value={report.from} onChange={e => setReport(p => ({ ...p, from: e.target.value }))} className="input text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-700 mb-1">To</label>
              <input type="date" value={report.to} onChange={e => setReport(p => ({ ...p, to: e.target.value }))} className="input text-sm" /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={exportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 disabled:opacity-50 text-sm">{exporting ? 'Exporting…' : 'Export Excel'}</button>
            <button onClick={exportPDF} disabled={exporting} className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm">{exporting ? 'Exporting…' : 'Export PDF'}</button>
          </div>
          <p className="text-xs text-gray-400 mt-3">{requests.length} request(s) loaded · filters apply before export</p>
        </div>
      )}
    </div>
  );
}
