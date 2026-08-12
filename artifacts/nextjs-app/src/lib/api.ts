import axios from 'axios';

const api = axios.create({
  baseURL: '/backend/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Only force a redirect when a real session expired (a token was present).
      // During sign-out the token is already cleared, so skip the slow full-page reload.
      const hadToken = !!localStorage.getItem('access_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (hadToken && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Dashboard
export const getOrderStats = () => api.get('/orders/stats');
export const getDailyReport = (date?: string) =>
  api.get('/payments/report', { params: { date } });

// Restaurants
export const getRestaurants = () => api.get('/restaurants');
export const createRestaurant = (data: any) => api.post('/restaurants', data);
export const updateRestaurant = (id: number, data: any) => api.patch(`/restaurants/${id}`, data);
export const deleteRestaurant = (id: number) => api.delete(`/restaurants/${id}`);

// Branches
export const getBranches = (restaurantId?: number) =>
  api.get('/branches', { params: { restaurantId } });
export const createBranch = (data: any) => api.post('/branches', data);
export const updateBranch = (id: number, data: any) => api.patch(`/branches/${id}`, data);

// Users
export const getUsers = (restaurantId?: number) =>
  api.get('/users', { params: { restaurantId } });
export const getWaiters = () => api.get('/users/waiters');
export const getChefs = () => api.get('/users/chefs');
export const getStaffList = () => api.get('/users/staff-list');
export const createUser = (data: any) => api.post('/users', data);
export const updateUser = (id: number, data: any) => api.patch(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);

// Menu
export const getMenuCategories = (restaurantId?: number) =>
  api.get('/menus/categories', { params: { restaurantId } });
export const createMenuCategory = (data: any) => api.post('/menus/categories', data);
export const updateMenuCategory = (id: number, data: any) => api.patch(`/menus/categories/${id}`, data);
export const deleteMenuCategory = (id: number) => api.delete(`/menus/categories/${id}`);
export const getMenuItems = (categoryId?: number) =>
  api.get('/menus/items', { params: { categoryId } });
export const createMenuItem = (data: any) => api.post('/menus/items', data);
export const updateMenuItem = (id: number, data: any) => api.patch(`/menus/items/${id}`, data);
export const deleteMenuItem = (id: number) => api.delete(`/menus/items/${id}`);

// Tables
export const getTables = (branchId?: number) =>
  api.get('/tables', { params: { branchId } });
export const createTable = (data: any) => api.post('/tables', data);
export const updateTableStatus = (id: number, status: string) =>
  api.patch(`/tables/${id}/status`, { status });
export const updateTable = (id: number, data: any) => api.patch(`/tables/${id}`, data);
export const deleteTable = (id: number) => api.delete(`/tables/${id}`);

// Orders
export const getOrders = (params?: { status?: string; tableId?: number }) =>
  api.get('/orders', { params });
export const getOrder = (id: number) => api.get(`/orders/${id}`);
export const createOrder = (data: any) => api.post('/orders', data);
export const updateOrderStatus = (id: number, status: string, chefId?: number) =>
  api.patch(`/orders/${id}/status`, { status, ...(chefId ? { chefId } : {}) });
export const addOrderItems = (id: number, items: any[]) =>
  api.patch(`/orders/${id}/items`, { items });
export const removeOrderItems = (id: number, orderItemIds: number[]) =>
  api.patch(`/orders/${id}/items/remove`, { orderItemIds });

export const getOrderAlerts = () => api.get('/orders/alerts');

// Notifications
export const getNotifications = () => api.get('/notifications');
export const markNotificationsRead = () => api.patch('/notifications/read');

// Kitchen
export const getKitchenBoard = () => api.get('/kitchen/board');
export const acceptOrder = (id: number) => api.patch(`/kitchen/orders/${id}/accept`);
export const startPreparing = (id: number) => api.patch(`/kitchen/orders/${id}/preparing`);
export const markReady = (id: number) => api.patch(`/kitchen/orders/${id}/ready`);

// Payments
export const getPayments = () => api.get('/payments');
export const processPayment = (data: any) => api.post('/payments', data);
export const getShifts = () => api.get('/payments/shifts');
export const openShift = (data: any) => api.post('/payments/shifts', data);
export const closeShift = (id: number, closingCash: number) =>
  api.patch(`/payments/shifts/${id}/close`, { closingCash });

// Inventory
export const getInventoryItems = (restaurantId?: number) =>
  api.get('/inventory/items', { params: { restaurantId } });
export const createInventoryItem = (data: any) => api.post('/inventory/items', data);
export const updateInventoryItem = (id: number, data: any) => api.patch(`/inventory/items/${id}`, data);
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

// Item Requests (any role can request; manager approves; storekeeper issues)
export const getItemRequests = () => api.get('/inventory/requests');
export const createItemRequest = (data: { inventoryItemId: number; quantity: number; notes?: string; requesterId?: number; reason?: string }) =>
  api.post('/inventory/requests', data);
export const updateItemRequestStatus = (id: number, status: string, quantity?: number) =>
  api.patch(`/inventory/requests/${id}/status`, quantity !== undefined ? { status, quantity } : { status });
export const getRequestableItems = () => api.get('/inventory/requestable-items');

// Seed
export const seedDatabase = () => api.post('/seed');
