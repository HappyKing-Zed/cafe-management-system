import api from './http-client';

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

export const getTables = (branchId?: number) =>
  api.get('/tables', { params: { branchId } });
export const createTable = (data: any) => api.post('/tables', data);
export const updateTableStatus = (id: number, status: string) =>
  api.patch(`/tables/${id}/status`, { status });
export const updateTable = (id: number, data: any) => api.patch(`/tables/${id}`, data);
export const deleteTable = (id: number) => api.delete(`/tables/${id}`);