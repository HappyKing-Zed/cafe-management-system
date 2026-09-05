import api from './http-client';
import type { InventoryItem, Supplier } from '../types';

type InventoryItemPayload = Partial<Omit<InventoryItem, 'id'>> & {
  expiryDate?: string | null;
};

type SupplierPayload = Partial<Omit<Supplier, 'id'>>;

interface PurchaseOrderPayload {
  supplierId: number;
  notes?: string;
  items: Array<{
    inventoryItemId: number;
    quantity: number;
    unitPrice: number;
  }>;
}

interface StockAdjustmentPayload {
  inventoryItemId: number;
  type: string;
  quantity: number;
  reason?: string;
}

interface MainStoreReceiptPayload {
  note?: string;
  lines: Array<{
    name: string;
    unit: string;
    category?: string;
    quantity: number;
    unitCost?: number;
    minStock?: number;
  }>;
}

interface MainStoreTransferPayload {
  note?: string;
  lines: Array<{
    mainStoreItemId: number;
    quantity: number;
  }>;
}

export const getInventoryItems = (restaurantId?: number) =>
  api.get('/inventory/items', { params: { restaurantId } });
export const createInventoryItem = (data: InventoryItemPayload) => api.post('/inventory/items', data);
export const updateInventoryItem = (id: number, data: InventoryItemPayload) =>
  api.patch(`/inventory/items/${id}`, data);
export const getLowStockItems = () => api.get('/inventory/items/low-stock');
export const getSuppliers = (restaurantId?: number) =>
  api.get('/inventory/suppliers', { params: { restaurantId } });
export const createSupplier = (data: SupplierPayload) => api.post('/inventory/suppliers', data);
export const getPurchaseOrders = () => api.get('/inventory/purchase-orders');
export const createPurchaseOrder = (data: PurchaseOrderPayload) => api.post('/inventory/purchase-orders', data);
export const updatePOStatus = (id: number, status: string) =>
  api.patch(`/inventory/purchase-orders/${id}/status`, { status });
export const approvePOItems = (id: number, body: { itemIds?: number[]; all?: boolean }) =>
  api.patch(`/inventory/purchase-orders/${id}/items/approve`, body);
export const createStockAdjustment = (data: StockAdjustmentPayload) => api.post('/inventory/adjustments', data);
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
export const createMainStoreReceipt = (data: MainStoreReceiptPayload) => api.post('/inventory/main-store/receipts', data);
export const getMainStoreTransfers = () => api.get('/inventory/main-store/transfers');
export const createMainStoreTransfer = (data: MainStoreTransferPayload) => api.post('/inventory/main-store/transfers', data);
export const approveMainStoreTransfer = (id: number) => api.patch(`/inventory/main-store/transfers/${id}/approve`);
export const rejectMainStoreTransfer = (id: number) => api.patch(`/inventory/main-store/transfers/${id}/reject`);
export const transferMainStoreTransfer = (id: number) => api.patch(`/inventory/main-store/transfers/${id}/transfer`);
export const getMainStoreRequestableItems = () => api.get('/inventory/main-store/requestable-items');
