import api from './http-client';

export const getInventoryItems = (restaurantId?: number) =>
  api.get('/inventory/items', { params: { restaurantId } });
export const createInventoryItem = (data: any) => api.post('/inventory/items', data);
export const updateInventoryItem = (id: number, data: any) =>
  api.patch(`/inventory/items/${id}`, data);
export const getLowStockItems = () => api.get('/inventory/items/low-stock');
export const getSuppliers = (restaurantId?: number) =>
  api.get('/inventory/suppliers', { params: { restaurantId } });
export const createSupplier = (data: any) => api.post('/inventory/suppliers', data);
export const getPurchaseOrders = () => api.get('/inventory/purchase-orders');
export const createPurchaseOrder = (data: any) => api.post('/inventory/purchase-orders', data);
export const updatePOStatus = (id: number, status: string) =>
  api.patch(`/inventory/purchase-orders/${id}/status`, { status });
export const approvePOItems = (id: number, body: { itemIds?: number[]; all?: boolean }) =>
  api.patch(`/inventory/purchase-orders/${id}/items/approve`, body);
export const createStockAdjustment = (data: any) => api.post('/inventory/adjustments', data);
export const getStockAdjustments = (params?: { type?: string; from?: string; to?: string }) =>
  api.get('/inventory/adjustments', { params });

export const getItemRequests = () => api.get('/inventory/requests');
export const createItemRequest = (data: {
  inventoryItemId: number;
  quantity: number;
  notes?: string;
  requesterId?: number;
  reason?: string;
}) => api.post('/inventory/requests', data);
export const updateItemRequestStatus = (id: number, status: string, quantity?: number) =>
  api.patch(
    `/inventory/requests/${id}/status`,
    quantity !== undefined ? { status, quantity } : { status },
  );
export const getRequestableItems = () => api.get('/inventory/requestable-items');

// Main Store
export const getMainStoreItems = () => api.get('/inventory/main-store/items');
export const getMainStoreDestinations = () => api.get('/inventory/main-store/destinations');
export const createMainStoreReceipt = (data: any) => api.post('/inventory/main-store/receipts', data);
export const getMainStoreTransfers = () => api.get('/inventory/main-store/transfers');
export const createMainStoreTransfer = (data: any) => api.post('/inventory/main-store/transfers', data);
export const approveMainStoreTransfer = (id: number) => api.patch(`/inventory/main-store/transfers/${id}/approve`);
export const rejectMainStoreTransfer = (id: number) => api.patch(`/inventory/main-store/transfers/${id}/reject`);