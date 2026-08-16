'use client';
import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getRestaurants, getBranches } from '@/lib/api';
import { User, Restaurant, Branch } from '@/lib/types';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth';
import clsx from 'clsx';

const ROLES = ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'cashier', 'storekeeper'];

export default function StaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter', phone: '', restaurantId: 1, branchId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filterRole, setFilterRole] = useState('all');

  const fetchData = async () => {
    const [usersRes, restsRes, branchesRes] = await Promise.all([getUsers(), getRestaurants(), getBranches()]);
    setUsers(usersRes.data || []);
    setRestaurants(restsRes.data || []);
    setBranches(branchesRes.data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetchData();
    const t = setInterval(() => { fetchData().catch(() => { /* ignore polling errors */ }); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'waiter', phone: '', restaurantId: 1, branchId: '' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, phone: user.phone || '', restaurantId: user.restaurantId || 1, branchId: user.branchId ? String(user.branchId) : '' });
    setShowModal(true);
  };

  const save = async () => {
    setSubmitting(true);
    try {
      const data: any = { ...form, restaurantId: +form.restaurantId, branchId: form.branchId ? +form.branchId : undefined };
      if (!data.password) delete data.password;
      if (editUser) await updateUser(editUser.id, data);
      else await createUser(data);
      setShowModal(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this staff member?')) return;
    await deleteUser(id);
    await fetchData();
  };

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Users className="text-purple-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-500 text-sm">{filtered.length} {filterRole === 'all' ? 'staff members' : `${filterRole}${filtered.length === 1 ? '' : 's'}`}</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Staff
        </button>
      </div>

      {/* Role filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', ...ROLES].map((r) => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-colors', filterRole === r ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {r === 'all' ? 'All Roles' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user) => (
            <div key={user.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(user)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                  <button onClick={() => remove(user.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={clsx('status-badge', ROLE_COLORS[user.role])}>{ROLE_LABELS[user.role]}</span>
                <span className={clsx('status-badge', user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {(user.branch || user.phone) && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 space-y-0.5">
                  {user.branch && <p>📍 {user.branch.name}</p>}
                  {user.phone && <p>📞 {user.phone}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editUser ? 'Edit Staff Member' : 'Add New Staff'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? 'New Password (optional)' : 'Password'}</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))} className="input">
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
