'use client';
import { useEffect, useState } from 'react';
import { getDailyReport, getOrders, getPayments } from '@/lib/api';
import { BarChart3, TrendingUp, RefreshCw } from 'lucide-react';

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportRes, ordersRes, paymentsRes] = await Promise.all([
        getDailyReport(selectedDate),
        getOrders(),
        getPayments(),
      ]);
      setReport(reportRes.data);
      setOrders(ordersRes.data || []);
      setPayments(paymentsRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  const statusBreakdown = orders.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const totalRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o: any) => o.status === 'paid').length;
  const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

  const methodBreakdown = payments.reduce((acc: any, p: any) => {
    acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
    return acc;
  }, {});

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
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-auto" />
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /></button>
        </div>
      </div>

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
    </div>
  );
}
