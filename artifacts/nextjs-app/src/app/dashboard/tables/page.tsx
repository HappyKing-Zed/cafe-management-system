'use client';
import { useEffect, useState } from 'react';
import { getTables, createTable, updateTable, deleteTable, updateTableStatus } from '@/lib/api';
import { RestaurantTable } from '@/lib/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';

const STATUS_ORDER = ['available', 'occupied', 'reserved', 'cleaning'] as const;

const STATUS_CONFIG: Record<string, { label: string; card: string; title: string; chip: string }> = {
  available: {
    label: 'AVAILABLE',
    card: 'bg-green-50 border-green-500 text-green-700',
    title: 'text-green-800',
    chip: 'border-green-500 text-green-700 bg-green-50',
  },
  occupied: {
    label: 'OCCUPIED',
    card: 'bg-red-50 border-red-400 text-red-700',
    title: 'text-red-800',
    chip: 'border-red-400 text-red-600 bg-red-50',
  },
  reserved: {
    label: 'RESERVED',
    card: 'bg-yellow-50 border-yellow-400 text-yellow-700',
    title: 'text-yellow-800',
    chip: 'border-yellow-400 text-yellow-700 bg-yellow-50',
  },
  cleaning: {
    label: 'CLEANING',
    card: 'bg-blue-50 border-blue-400 text-blue-700',
    title: 'text-blue-800',
    chip: 'border-blue-400 text-blue-700 bg-blue-50',
  },
};

export default function TablesPage() {
  const { user } = useAuthStore();
  const canManage = !!user && ['admin', 'owner', 'manager'].includes(user.role);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ number: '', capacity: '4', section: 'Main' });
  const [confirmDelete, setConfirmDelete] = useState<RestaurantTable | null>(null);

  const fetchData = async () => {
    try {
      const res = await getTables();
      setTables(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ number: '', capacity: '4', section: 'Main' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (t: RestaurantTable) => {
    setEditing(t);
    setForm({ number: t.number, capacity: String(t.capacity), section: t.section || 'Main' });
    setFormError('');
    setShowModal(true);
  };

  const saveTable = async () => {
    if (!form.number.trim()) { setFormError('Table number is required'); return; }
    setSubmitting(true);
    setFormError('');
    const payload = { number: form.number.trim(), capacity: parseInt(form.capacity) || 4, section: form.section.trim() || 'Main' };
    try {
      if (editing) {
        await updateTable(editing.id, payload);
      } else {
        await createTable({ ...payload, branchId: (user as any)?.branchId || 1 });
      }
      setShowModal(false);
      await fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Could not save table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSubmitting(true);
    try {
      await deleteTable(confirmDelete.id);
      setConfirmDelete(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const cycleStatus = async (t: RestaurantTable) => {
    const idx = STATUS_ORDER.indexOf(t.status as any);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    // Optimistic update for snappy feel
    setTables(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    try {
      await updateTableStatus(t.id, next);
    } catch {
      await fetchData();
    }
  };

  const visible = filter ? tables.filter(t => t.status === filter) : tables;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dining Tables</h1>
        {canManage && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Table
          </button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUS_ORDER.map(status => {
          const cfg = STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? null : status)}
              className={clsx(
                'px-4 py-1 rounded-full border text-xs font-semibold tracking-wide transition-all',
                cfg.chip,
                filter === status ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-90 hover:opacity-100'
              )}
            >
              {cfg.label}
            </button>
          );
        })}
        <span className="text-sm text-gray-400 ml-1">· Click a table card to cycle status</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-sm py-12 text-center">No tables{filter ? ` with status "${filter}"` : ''}.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {visible.map(table => {
            const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
            return (
              <div
                key={table.id}
                role="button"
                tabIndex={0}
                onClick={() => cycleStatus(table)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleStatus(table); } }}
                className={clsx(
                  'border-2 rounded-xl p-4 text-center transition-all hover:scale-105 hover:shadow-md cursor-pointer select-none',
                  cfg.card
                )}
              >
                <p className={clsx('font-extrabold text-xl', cfg.title)}>{table.number}</p>
                <p className="text-xs mt-1 opacity-70">{table.capacity} seats</p>
                <p className="text-xs font-semibold tracking-wide mt-2">{STATUS_CONFIG[table.status]?.label || table.status}</p>
                {canManage && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(table); }}
                      className="text-gray-500 hover:text-gray-800"
                      title="Edit table"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(table); }}
                      className="text-red-500 hover:text-red-700"
                      title="Delete table"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{editing ? `Edit Table ${editing.number}` : 'New Table'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Number / Name</label>
                <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className="input" placeholder="e.g. T12" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (seats)</label>
                  <input type="number" min={1} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} className="input" placeholder="Main / Terrace / VIP" />
                </div>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveTable} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
                {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete table {confirmDelete.number}?</h3>
            <p className="text-sm text-gray-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={submitting} className="flex-1 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
