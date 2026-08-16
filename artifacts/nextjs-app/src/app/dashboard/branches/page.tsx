'use client';
import { useEffect, useState } from 'react';
import { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant, getBranches, createBranch, updateBranch, deleteBranch } from '@/lib/api';
import { Restaurant, Branch } from '@/lib/types';
import { Building2, Plus, MapPin, Phone, Pencil, Trash2 } from 'lucide-react';

export default function BranchesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestModal, setShowRestModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingRest, setEditingRest] = useState<Restaurant | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [restForm, setRestForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '', restaurantId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'restaurant' | 'branch'; id: number; name: string } | null>(null);

  const fetchData = async () => {
    const [restsRes, branchesRes] = await Promise.all([getRestaurants(), getBranches()]);
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

  const openNewRest = () => { setEditingRest(null); setRestForm({ name: '', address: '', phone: '', email: '' }); setError(''); setShowRestModal(true); };
  const openEditRest = (r: Restaurant) => { setEditingRest(r); setRestForm({ name: r.name || '', address: r.address || '', phone: r.phone || '', email: (r as any).email || '' }); setError(''); setShowRestModal(true); };
  const openNewBranch = () => { setEditingBranch(null); setBranchForm({ name: '', address: '', phone: '', restaurantId: '' }); setError(''); setShowBranchModal(true); };
  const openEditBranch = (b: Branch) => { setEditingBranch(b); setBranchForm({ name: b.name || '', address: b.address || '', phone: b.phone || '', restaurantId: String(b.restaurantId) }); setError(''); setShowBranchModal(true); };

  const saveRestaurant = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (editingRest) await updateRestaurant(editingRest.id, restForm);
      else await createRestaurant(restForm);
      setShowRestModal(false);
      setEditingRest(null);
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save the restaurant. Please try again.');
    }
    setSubmitting(false);
  };

  const saveBranch = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = { ...branchForm, restaurantId: +branchForm.restaurantId };
      if (editingBranch) await updateBranch(editingBranch.id, data);
      else await createBranch(data);
      setShowBranchModal(false);
      setEditingBranch(null);
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save the branch. Please try again.');
    }
    setSubmitting(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setSubmitting(true);
    setError('');
    try {
      if (confirmDelete.type === 'restaurant') await deleteRestaurant(confirmDelete.id);
      else await deleteBranch(confirmDelete.id);
      setConfirmDelete(null);
      await fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Could not delete this ${confirmDelete.type}. It may have staff, tables, or orders linked to it.`);
    }
    setSubmitting(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Building2 className="text-indigo-600" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurants & Branches</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewRest} className="btn-secondary flex items-center gap-2">
            <Plus size={18} /> Restaurant
          </button>
          <button onClick={openNewBranch} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Branch
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-8">
          {restaurants.map((rest) => {
            const restBranches = branches.filter(b => b.restaurantId === rest.id);
            return (
              <div key={rest.id} className="card">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{rest.name}</h2>
                    {rest.address && <p className="text-gray-500 text-sm flex items-center gap-1 mt-1"><MapPin size={14} /> {rest.address}</p>}
                    {rest.phone && <p className="text-gray-500 text-sm flex items-center gap-1"><Phone size={14} /> {rest.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-sm font-medium">
                      {restBranches.length} branch{restBranches.length !== 1 ? 'es' : ''}
                    </span>
                    <button onClick={() => openEditRest(rest)} title="Edit restaurant" className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete({ type: 'restaurant', id: rest.id, name: rest.name })} title="Delete restaurant" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {restBranches.map((branch) => (
                    <div key={branch.id} className="border border-gray-100 rounded-xl p-4 hover:border-brand-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                            <Building2 size={16} className="text-brand-600" />
                          </div>
                          <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditBranch(branch)} title="Edit branch" className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDelete({ type: 'branch', id: branch.id, name: branch.name })} title="Delete branch" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {branch.address && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {branch.address}</p>}
                      {branch.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={11} /> {branch.phone}</p>}
                      <div className="mt-3">
                        <span className={`status-badge text-xs ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {branch.isActive ? '● Active' : '● Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {restBranches.length === 0 && (
                    <p className="text-gray-400 text-sm col-span-full">No branches yet. Click "+ Branch" to add one.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Restaurant Modal */}
      {showRestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editingRest ? 'Edit Restaurant' : 'New Restaurant'}</h3>
              <button onClick={() => setShowRestModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[{ l: 'Restaurant Name', k: 'name' }, { l: 'Address', k: 'address' }, { l: 'Phone', k: 'phone' }, { l: 'Email', k: 'email' }].map(({ l, k }) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(restForm as any)[k]} onChange={e => setRestForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRestModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveRestaurant} disabled={submitting || !restForm.name.trim()} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editingBranch ? 'Edit Branch' : 'New Branch'}</h3>
              <button onClick={() => setShowBranchModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Restaurant</label>
                <select value={branchForm.restaurantId} onChange={e => setBranchForm(p => ({ ...p, restaurantId: e.target.value }))} className="input">
                  <option value="">Select restaurant</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {[{ l: 'Branch Name', k: 'name' }, { l: 'Address', k: 'address' }, { l: 'Phone', k: 'phone' }].map(({ l, k }) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(branchForm as any)[k]} onChange={e => setBranchForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveBranch} disabled={submitting || !branchForm.restaurantId || !branchForm.name.trim()} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Delete {confirmDelete.type}?</h3>
            <p className="text-gray-600 text-sm">
              Are you sure you want to delete <span className="font-semibold">{confirmDelete.name}</span>?
              {confirmDelete.type === 'restaurant' && ' All of its branches will also be removed.'} This cannot be undone.
            </p>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setConfirmDelete(null); setError(''); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={doDelete} disabled={submitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
