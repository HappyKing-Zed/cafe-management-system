import api from './http-client';

export const getOrderStats = (branchId?: number) =>
  api.get('/orders/stats', { params: { branchId } });

export const getOrders = (params?: { status?: string; tableId?: number; branchId?: number }) =>
  api.get('/orders', { params });
export const getOrder = (id: number) => api.get(`/orders/${id}`);
export const createOrder = (data: any) => api.post('/orders', data);
export const updateOrderStatus = (id: number, status: string, chefId?: number) =>
  api.patch(`/orders/${id}/status`, { status, ...(chefId ? { chefId } : {}) });
export const addOrderItems = (id: number, items: any[]) =>
  api.patch(`/orders/${id}/items`, { items });
export const removeOrderItems = (id: number, orderItemIds: number[]) =>
  api.patch(`/orders/${id}/items/remove`, { orderItemIds });
export const updateOrderItemStatus = (orderId: number, orderItemId: number, status: string) =>
  api.patch(`/orders/${orderId}/items/${orderItemId}/status`, { status });
export const assignOrderItems = (orderId: number, assignments: { itemId: number; workerId: number }[]) =>
  api.patch(`/orders/${orderId}/items/assignments`, { assignments });
export const getOrderAlerts = () => api.get('/orders/alerts');

export const getKitchenBoard = () => api.get('/kitchen/board');
export const acceptOrder = (id: number) => api.patch(`/kitchen/orders/${id}/accept`);
export const startPreparing = (id: number) => api.patch(`/kitchen/orders/${id}/preparing`);
export const markReady = (id: number) => api.patch(`/kitchen/orders/${id}/ready`);