'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, createUser, updateUser, deleteUser, getRestaurants, getBranches } from '@/lib/api';
import { User, Restaurant, Branch } from '@/lib/types';
import { Users, Plus, Pencil, Trash2, Power } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';

const ROLES = ['admin', 'owner', 'manager', 'coordinator', 'waiter', 'chef', 'chef_main_kitchen', 'bar_man', 'juice_maker', 'coffee_lady', 'cashier', 'branch_store_keeper', 'main_store_keeper'];

export default function StaffPage() {
  const router = useRouter();
  const { user: currentUser, updateProfile, logout } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter', phone: '', restaurantId: 1, branchId: '', isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [accessChangeUser, setAccessChangeUser] = useState<User | null>(null);
  const [filterRole, setFilterRole] = useState('all');
  const [error, setError] = useState('');

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
    setError('');
    setForm({ name: '', email: '', password: '', role: 'waiter', phone: '', restaurantId: currentUser?.restaurantId || restaurants[0]?.id || 1, branchId: currentUser?.branchId ? String(currentUser.branchId) : '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setError('');
    setForm({ name: user.name, email: user.email, password: '', role: user.role, phone: user.phone || '', restaurantId: user.restaurantId || 1, branchId: user.branchId ? String(user.branchId) : '', isActive: user.isActive !== false });
    setShowModal(true);
  };

  const save = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim() || (!editUser && form.password.length < 6)) {
      setError('Name, a valid email, and a password of at least 6 characters are required.');
      return;
    }
    if (form.role === 'branch_store_keeper' && !form.branchId) {
      setError('Select a branch for the Branch Store Keeper.');
      return;
    }
    setSubmitting(true);
    try {
      const data: any = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        restaurantId: +form.restaurantId,
        branchId: form.role === 'main_store_keeper' ? null : form.branchId ? +form.branchId : null,
      };
      if (!data.password) delete data.password;
      const response = editUser ? await updateUser(editUser.id, data) : await createUser(data);
      const saved = response.data as User;
      setUsers(previous => editUser
        ? previous.map(user => user.id === saved.id ? saved : user)
        : [...previous, saved]);

      if (editUser && currentUser?.id === editUser.id) {
        if (currentUser.role !== saved.role) {
          logout();
          window.alert('Your role was changed. Please sign in again so your new permissions take effect.');
          router.replace('/login');
          return;
        }
        updateProfile(saved);
      }
      setShowModal(false);
      await fetchData();
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not save this staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this staff member?')) return;
    setError('');
    try {
      await deleteUser(id);
      setUsers(previous => previous.filter(user => user.id !== id));
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not delete this staff member.');
    }
  };

  const toggleAccess = async (staffMember: User) => {
    const nextActive = !staffMember.isActive;
    const action = nextActive ? 'turn on' : 'turn off';
    setError('');
    setSubmitting(true);
    try {
      const response = await updateUser(staffMember.id, { isActive: nextActive });
      const saved = response.data as User;
      setUsers(previous => previous.map(member => member.id === saved.id ? saved : member));
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Could not ${action} this staff member.`);
    } finally {
      setSubmitting(false);
      setAccessChangeUser(null);
    }
  };

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);
  const availableBranches = branches.filter(branch => branch.restaurantId === +form.restaurantId);
  const assignableRoles = currentUser?.role === 'manager'
    ? ROLES.filter(role => !['admin', 'owner', 'manager'].includes(role))
    : currentUser?.role === 'owner'
      ? ROLES.filter(role => role !== 'admin')
      : ROLES;
  const availableRoles = editUser && !assignableRoles.includes(editUser.role)
    ? [editUser.role, ...assignableRoles]
    : assignableRoles;

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

      {error && !showModal && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}

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
                <button
                  type="button"
                  disabled={submitting || user.id === currentUser?.id}
                  onClick={() => setAccessChangeUser(user)}
                  title={user.id === currentUser?.id ? 'You cannot switch off your own account' : `Turn ${user.isActive ? 'OFF' : 'ON'} system access`}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    user.isActive ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800' : 'bg-red-100 text-red-800 hover:bg-green-100 hover:text-green-800',
                  )}
                >
                  <Power size={12} /> {user.isActive ? 'ON' : 'OFF'}
                </button>
              </div>
              {(user.branch || user.phone) && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 space-y-0.5">
                  {user.branch && <p> {user.branch.name}</p>}
                  {user.phone && <p> {user.phone}</p>}
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
                <select value={form.role} onChange={e => setForm(p => ({
                  ...p,
                  role: e.target.value,
                  branchId: e.target.value === 'main_store_keeper' ? '' : (e.target.value === 'branch_store_keeper' && currentUser?.branchId ? String(currentUser.branchId) : p.branchId),
                }))} className="input">
                  {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Restaurant</label>
                <select
                  value={form.restaurantId}
                  onChange={e => setForm(p => ({ ...p, restaurantId: +e.target.value, branchId: '' }))}
                  className="input"
                  disabled={currentUser?.role !== 'admin'}
                >
                  {restaurants
                    .filter(restaurant => currentUser?.role === 'admin' || restaurant.id === currentUser?.restaurantId)
                    .map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Branch {form.role === 'branch_store_keeper' && <span className="text-red-500">*</span>}</label>
                <select
                  value={form.branchId}
                  onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                  className="input"
                  disabled={form.role === 'main_store_keeper' || (currentUser?.role === 'manager' && !!currentUser.branchId)}
                >
                  <option value="">{form.role === 'branch_store_keeper' ? 'Select branch' : 'No branch'}</option>
                  {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">System access during working hours</span>
                    <span className="block text-xs text-gray-500">OFF staff cannot sign in or continue using an existing session.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="h-5 w-5 accent-green-600"
                  />
                </label>
              </div>
            </div>
            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessChangeUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-change-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className={clsx(
              'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
              accessChangeUser.isActive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
            )}>
              <Power size={22} />
            </div>
            <h3 id="access-change-title" className="text-lg font-bold text-gray-900">
              Turn {accessChangeUser.isActive ? 'OFF' : 'ON'} system access?
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {accessChangeUser.isActive
                ? `${accessChangeUser.name} will be signed out and will not be able to access the system.`
                : `${accessChangeUser.name} will be able to sign in during assigned working hours.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setAccessChangeUser(null)}
                disabled={submitting}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void toggleAccess(accessChangeUser)}
                disabled={submitting}
                className={clsx(
                  'flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50',
                  accessChangeUser.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
                )}
              >
                {submitting ? 'Updating...' : `Turn ${accessChangeUser.isActive ? 'OFF' : 'ON'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
