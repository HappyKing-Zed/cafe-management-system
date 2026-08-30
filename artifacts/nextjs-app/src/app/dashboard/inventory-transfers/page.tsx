'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, XCircle } from 'lucide-react';
import {
  approveMainStoreTransfer,
  getMainStoreTransfers,
  rejectMainStoreTransfer,
} from '@/lib/api';

interface TransferLine {
  id: number;
  name: string;
  unit: string;
  quantity: number;
}

interface Transfer {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  createdAt: string;
  requestedBy?: { name: string };
  lines: TransferLine[];
}

export default function IncomingTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getMainStoreTransfers();
      setTransfers(response.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    const prompt = decision === 'approve'
      ? 'Approve this transfer and add its stock to your branch inventory?'
      : 'Reject this transfer and return its stock to Main Store?';
    if (!window.confirm(prompt)) return;
    setBusyId(id);
    try {
      if (decision === 'approve') await approveMainStoreTransfer(id);
      else await rejectMainStoreTransfer(id);
      await load();
    } catch (error: any) {
      window.alert(error?.response?.data?.message || `Could not ${decision} transfer`);
    } finally {
      setBusyId(null);
    }
  };

  const pending = transfers.filter((transfer) => transfer.status === 'pending');
  const history = transfers.filter((transfer) => transfer.status !== 'pending');

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
          <ArrowDownToLine className="text-teal-700" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-teal-950">Incoming Transfers</h1>
          <p className="text-sm text-teal-800/70">Approve stock before it enters your branch inventory.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-9 h-9 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-teal-900 mb-3">Pending Approval</h2>
            <div className="grid gap-4">
              {pending.length === 0 ? (
                <div className="card py-10 text-center text-coffee-400 text-sm">No transfers are waiting for approval.</div>
              ) : pending.map((transfer) => (
                <article key={transfer.id} className="card p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-teal-950">Transfer TRN-{String(transfer.id).padStart(4, '0')}</p>
                      <p className="text-xs text-coffee-400 mt-1">
                        {new Date(transfer.createdAt).toLocaleString()}
                        {transfer.requestedBy?.name ? ` · Sent by ${transfer.requestedBy.name}` : ''}
                      </p>
                    </div>
                    <span className="status-badge bg-amber-100 text-amber-800 self-start">Pending</span>
                  </div>
                  <div className="border border-cream-200 rounded-lg divide-y divide-cream-100 mb-4">
                    {transfer.lines.map((line) => (
                      <div key={line.id} className="flex justify-between gap-4 px-3 py-2 text-sm">
                        <span className="font-medium text-teal-900">{line.name}</span>
                        <span className="text-teal-700 font-semibold whitespace-nowrap">{Number(line.quantity)} {line.unit}</span>
                      </div>
                    ))}
                  </div>
                  {transfer.note && <p className="text-sm text-coffee-500 mb-4">{transfer.note}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="btn-primary flex items-center justify-center gap-2"
                      disabled={busyId === transfer.id}
                      onClick={() => void decide(transfer.id, 'approve')}
                    >
                      <CheckCircle2 size={16} /> Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex items-center justify-center gap-2 text-red-700"
                      disabled={busyId === transfer.id}
                      onClick={() => void decide(transfer.id, 'reject')}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-900 mb-3">Transfer History</h2>
            <div className="card p-0 overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="table-header">Transfer</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Items</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {history.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-coffee-400 text-sm">No transfer history yet.</td></tr>
                  ) : history.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="table-cell font-medium">TRN-{String(transfer.id).padStart(4, '0')}</td>
                      <td className="table-cell">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                      <td className="table-cell">{transfer.lines.map((line) => line.name).join(', ')}</td>
                      <td className="table-cell capitalize">{transfer.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}