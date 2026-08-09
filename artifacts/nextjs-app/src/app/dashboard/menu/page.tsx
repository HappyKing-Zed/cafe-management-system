'use client';
import { useEffect, useState } from 'react';
import { getMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory, createMenuItem, updateMenuItem, deleteMenuItem } from '@/lib/api';
import { MenuCategory, MenuItem } from '@/lib/types';
import { UtensilsCrossed, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [catForm, setCatForm] = useState({ name: '', description: '', restaurantId: 1 });
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: 0, isAvailable: true, preparationTime: '' });
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedCatForItem, setSelectedCatForItem] = useState<number>(0);

  const fetchData = async () => {
    const res = await getMenuCategories();
    setCategories(res.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id: number) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveCat = async () => {
    if (editCat) await updateMenuCategory(editCat.id, catForm);
    else await createMenuCategory({ ...catForm, restaurantId: 1 });
    setShowCatModal(false);
    setEditCat(null);
    setCatForm({ name: '', description: '', restaurantId: 1 });
    await fetchData();
  };

  const deleteCat = async (id: number) => {
    if (!confirm('Delete this category and all its items?')) return;
    await deleteMenuCategory(id);
    await fetchData();
  };

  const openItemModal = (catId: number, item?: MenuItem) => {
    setSelectedCatForItem(catId);
    if (item) {
      setEditItem(item);
      setItemForm({ name: item.name, description: item.description || '', price: String(item.price), categoryId: item.categoryId, isAvailable: item.isAvailable, preparationTime: String(item.preparationTime || '') });
    } else {
      setEditItem(null);
      setItemForm({ name: '', description: '', price: '', categoryId: catId, isAvailable: true, preparationTime: '' });
    }
    setShowItemModal(true);
  };

  const saveItem = async () => {
    const data = { ...itemForm, price: parseFloat(itemForm.price), categoryId: selectedCatForItem, preparationTime: itemForm.preparationTime ? parseInt(itemForm.preparationTime) : undefined };
    if (editItem) await updateMenuItem(editItem.id, data);
    else await createMenuItem(data);
    setShowItemModal(false);
    setEditItem(null);
    await fetchData();
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this menu item?')) return;
    await deleteMenuItem(id);
    await fetchData();
  };

  const toggleAvailable = async (item: MenuItem) => {
    await updateMenuItem(item.id, { isAvailable: !item.isAvailable });
    await fetchData();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="text-green-600" size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
        </div>
        <button onClick={() => { setShowCatModal(true); setEditCat(null); setCatForm({ name: '', description: '', restaurantId: 1 }); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(cat.id)}>
                <div className="flex items-center gap-3">
                  {expanded.includes(cat.id) ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <div>
                    <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                    {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                  </div>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{cat.items?.length || 0} items</span>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openItemModal(cat.id)} className="text-xs px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 flex items-center gap-1">
                    <Plus size={12} /> Item
                  </button>
                  <button onClick={() => { setEditCat(cat); setCatForm({ name: cat.name, description: cat.description || '', restaurantId: cat.restaurantId }); setShowCatModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                  <button onClick={() => deleteCat(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                </div>
              </div>
              {expanded.includes(cat.id) && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-header">Name</th>
                        <th className="table-header">Description</th>
                        <th className="table-header">Price</th>
                        <th className="table-header">Prep Time</th>
                        <th className="table-header">Available</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cat.items?.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-sm">No items. Click + Item to add.</td></tr>
                      ) : cat.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium">{item.name}</td>
                          <td className="table-cell text-gray-400 max-w-xs truncate">{item.description}</td>
                          <td className="table-cell font-semibold text-brand-600">ETB {Number(item.price).toLocaleString()}</td>
                          <td className="table-cell text-gray-500">{item.preparationTime ? `${item.preparationTime}m` : '—'}</td>
                          <td className="table-cell">
                            <button onClick={() => toggleAvailable(item)} className={clsx('w-11 h-6 rounded-full transition-colors relative', item.isAvailable ? 'bg-green-500' : 'bg-gray-300')}>
                              <span className={clsx('absolute w-4 h-4 bg-white rounded-full top-1 transition-all', item.isAvailable ? 'right-1' : 'left-1')} />
                            </button>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-1">
                              <button onClick={() => openItemModal(cat.id, item)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                              <button onClick={() => deleteItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editCat ? 'Edit Category' : 'New Category'}</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} className="input" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCatModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveCat} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editItem ? 'Edit Item' : 'New Menu Item'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} className="input" rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Price (ETB)</label>
                  <input type="number" value={itemForm.price} onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))} className="input" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Prep (min)</label>
                  <input type="number" value={itemForm.preparationTime} onChange={e => setItemForm(p => ({ ...p, preparationTime: e.target.value }))} className="input" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveItem} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
