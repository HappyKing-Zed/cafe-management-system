'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { getSummary, getServiceSubmissions, submitDailyService, confirmServiceSubmission, getWaiters } from '@/lib/api';
import { ClipboardList, ChevronDown, ChevronUp, Send, CheckCircle2, Clock } from 'lucide-react';
import clsx from 'clsx';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual', label: 'Annual' },
];

const fmt = (n: number) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

export default function SummaryPage() {
  const { user } = useAuthStore();
  const isWaiter = user?.role === 'waiter';
  const canConfirm = ['cashier', 'admin', 'owner'].includes(user?.role || '');

  const [period, setPeriod] = useState('daily');
  const [waiterFilter, setWaiterFilter] = useState('');
  const [waiters, setWaiters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subOpen, setSubOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { period };
      if (!isWaiter && waiterFilter) params.waiterId = +waiterFilter;
      const res = await getSummary(params);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [period, waiterFilter, isWaiter]);

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                period === p.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900')}
            >
              {p.label}
            </button>
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
              <p className="p-4 text-sm text-gray-500">No served orders in this period.</p>
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

      {/* Daily service submissions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-sm text-gray-900">Daily Service Submissions</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isWaiter ? 'Your end-of-day reports to the cashier' : canConfirm ? 'Confirm reports received from waiters' : 'End-of-day reports from waiters to the cashier'}
          </p>
        </div>
        {submissions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No submissions yet.</p>
        ) : submissions.map((s) => (
          <div key={s.id} className="border-b border-gray-50 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-sm text-gray-900">{s.waiter?.name || `Waiter #${s.waiterId}`} — {s.serviceDate}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.ordersCount} orders · {s.itemsCount} items · {fmt(s.totalRevenue)}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.status === 'confirmed' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <CheckCircle2 size={13} /> Confirmed{s.cashier?.name ? ` by ${s.cashier.name}` : ''}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                    <Clock size={13} /> Awaiting cashier
                  </span>
                )}
                {canConfirm && s.status !== 'confirmed' && (
                  <button onClick={() => handleConfirm(s.id)} disabled={busy}
                    className="text-xs font-medium bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">
                    Confirm received
                  </button>
                )}
                <button onClick={() => setSubOpen(subOpen === s.id ? null : s.id)} className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5">
                  {subOpen === s.id ? 'Hide detail' : 'View detail'}
                </button>
              </div>
            </div>
            {subOpen === s.id && Array.isArray(s.detail) && (
              <div className="px-4 pb-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1.5">Order</th><th className="py-1.5">Table</th><th className="py-1.5">Items</th><th className="py-1.5 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {s.detail.map((d: any) => (
                      <tr key={d.orderId} className="border-b border-gray-50 last:border-0 align-top">
                        <td className="py-1.5">#{d.orderId}</td>
                        <td className="py-1.5">{d.table}</td>
                        <td className="py-1.5 text-gray-600">{(d.items || []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                        <td className="py-1.5 text-right">{fmt(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
