import api from './http-client';
import type { MenuCategory, MenuItem, RestaurantTable, TableStatus } from '../types';

type MenuCategoryPayload = Partial<Omit<MenuCategory, 'id' | 'items'>>;
type MenuItemPayload = Partial<Omit<MenuItem, 'id' | 'category'>>;
type TablePayload = Partial<Omit<RestaurantTable, 'id' | 'branch'>>;

export const getMenuCategories = (restaurantId?: number) =>
  api.get('/menus/categories', { params: { restaurantId } });
export const createMenuCategory = (data: MenuCategoryPayload) => api.post('/menus/categories', data);
export const updateMenuCategory = (id: number, data: MenuCategoryPayload) => api.patch(`/menus/categories/${id}`, data);
export const deleteMenuCategory = (id: number) => api.delete(`/menus/categories/${id}`);
export const getMenuItems = (categoryId?: number) =>
  api.get('/menus/items', { params: { categoryId } });
export const createMenuItem = (data: MenuItemPayload) => api.post('/menus/items', data);
export const updateMenuItem = (id: number, data: MenuItemPayload) => api.patch(`/menus/items/${id}`, data);
export const deleteMenuItem = (id: number) => api.delete(`/menus/items/${id}`);

export const getTables = (branchId?: number) =>
  api.get('/tables', { params: { branchId } });
export const createTable = (data: TablePayload) => api.post('/tables', data);
export const updateTableStatus = (id: number, status: TableStatus) =>
  api.patch(`/tables/${id}/status`, { status });
export const updateTable = (id: number, data: TablePayload) => api.patch(`/tables/${id}`, data);
export const deleteTable = (id: number) => api.delete(`/tables/${id}`);