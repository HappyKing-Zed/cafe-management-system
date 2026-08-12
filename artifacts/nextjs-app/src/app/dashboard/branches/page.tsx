'use client';
import { useEffect, useState } from 'react';
import { getRestaurants, createRestaurant, getBranches, createBranch, updateBranch } from '@/lib/api';
import { Restaurant, Branch } from '@/lib/types';
import { Building2, Plus, MapPin, Phone } from 'lucide-react';

export default function BranchesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestModal, setShowRestModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [restForm, setRestForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '', restaurantId: '' });
  const [submitting, setSubmitting] = useState(false);

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

  const saveRestaurant = async () => {
    setSubmitting(true);
    await createRestaurant(restForm);
    setShowRestModal(false);
    setRestForm({ name: '', address: '', phone: '', email: '' });
    setSubmitting(false);
    await fetchData();
  };

  const saveBranch = async () => {
    setSubmitting(true);
    await createBranch({ ...branchForm, restaurantId: +branchForm.restaurantId });
    setShowBranchModal(false);
    setBranchForm({ name: '', address: '', phone: '', restaurantId: '' });
    setSubmitting(false);
    await fetchData();
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
          <button onClick={() => setShowRestModal(true)} className="btn-secondary flex items-center gap-2">
            <Plus size={18} /> Restaurant
          </button>
          <button onClick={() => setShowBranchModal(true)} className="btn-primary flex items-center gap-2">
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
                  <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-sm font-medium">
                    {restBranches.length} branch{restBranches.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {restBranches.map((branch) => (
                    <div key={branch.id} className="border border-gray-100 rounded-xl p-4 hover:border-brand-300 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                          <Building2 size={16} className="text-brand-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">{branch.name}</h3>
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
              <h3 className="font-bold text-gray-900">New Restaurant</h3>
              <button onClick={() => setShowRestModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[{ l: 'Restaurant Name', k: 'name' }, { l: 'Address', k: 'address' }, { l: 'Phone', k: 'phone' }, { l: 'Email', k: 'email' }].map(({ l, k }) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(restForm as any)[k]} onChange={e => setRestForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRestModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveRestaurant} disabled={submitting} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">New Branch</h3>
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
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowBranchModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveBranch} disabled={submitting || !branchForm.restaurantId} className="btn-primary flex-1 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
