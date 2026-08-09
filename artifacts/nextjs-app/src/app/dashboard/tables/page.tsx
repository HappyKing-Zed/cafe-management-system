'use client';
import { useEffect, useState } from 'react';
import { getTables, updateTableStatus, getOrders } from '@/lib/api';
import { RestaurantTable, Order } from '@/lib/types';
import { Table2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'bg-green-100 border-green-300 text-green-800', dot: 'bg-green-500' },
  occupied: { label: 'Occupied', color: 'bg-red-100 border-red-300 text-red-800', dot: 'bg-red-500' },
  reserved: { label: 'Reserved', color: 'bg-blue-100 border-blue-300 text-blue-800', dot: 'bg-blue-500' },
  cleaning: { label: 'Cleaning', color: 'bg-yellow-100 border-yellow-300 text-yellow-800', dot: 'bg-yellow-500' },
};

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RestaurantTable | null>(null);

  const fetchData = async () => {
    try {
      const [tablesRes, ordersRes] = await Promise.all([getTables(), getOrders({ status: 'occupied' })]);
      setTables(tablesRes.data || []);
      setOrders(ordersRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getTableOrder = (tableId: number) =>
    orders.find(o => o.tableId === tableId && ['pending', 'confirmed', 'preparing', 'ready', 'served'].includes(o.status));

  const handleStatusChange = async (tableId: number, status: string) => {
    await updateTableStatus(tableId, status);
    await fetchData();
    setSelected(null);
  };

  const sections = [...new Set(tables.map(t => t.section || 'Main'))];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Table2 className="text-blue-600" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
            <p className="text-gray-500 text-sm">{tables.filter(t => t.status === 'available').length} of {tables.length} tables available</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 card py-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
            <span className="text-sm text-gray-600">{cfg.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{section} Section</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {tables.filter(t => (t.section || 'Main') === section).map((table) => {
                  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
                  const activeOrder = getTableOrder(table.id);
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelected(table)}
                      className={clsx(
                        'border-2 rounded-xl p-4 text-center transition-all hover:scale-105 hover:shadow-md cursor-pointer',
                        cfg.color
                      )}
                    >
                      <p className="font-bold text-lg">{table.number}</p>
                      <p className="text-xs mt-0.5 opacity-70">{table.capacity} seats</p>
                      <div className={`w-2.5 h-2.5 rounded-full mx-auto mt-2 ${cfg.dot}`} />
                      {activeOrder && (
                        <p className="text-xs mt-1 font-medium">#{activeOrder.id}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Table {selected.number}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Capacity: {selected.capacity} guests</p>
              <p className="text-sm text-gray-500">Section: {selected.section || 'Main'}</p>
              <p className="text-sm text-gray-500">Current status: <span className="font-semibold capitalize">{selected.status}</span></p>
              {getTableOrder(selected.id) && (
                <p className="text-sm text-brand-600 mt-1">Active Order #{getTableOrder(selected.id)?.id}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">Change Status</p>
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(selected.id, status)}
                  className={clsx('w-full py-2 px-4 rounded-lg text-sm font-medium border-2 transition-colors', cfg.color, 'hover:opacity-80')}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
