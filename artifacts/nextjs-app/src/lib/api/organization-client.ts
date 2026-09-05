import api from './http-client';
import type { Branch, Restaurant, User } from '../types';

type RestaurantPayload = Partial<Omit<Restaurant, 'id' | 'branches'>>;
type BranchPayload = Partial<Omit<Branch, 'id' | 'restaurant'>>;
type UserPayload = Partial<Omit<User, 'id' | 'restaurant' | 'branch'>> & {
  password?: string;
};

export const getRestaurants = () => api.get('/restaurants');
export const createRestaurant = (data: RestaurantPayload) => api.post('/restaurants', data);
export const updateRestaurant = (id: number, data: RestaurantPayload) => api.patch(`/restaurants/${id}`, data);
export const deleteRestaurant = (id: number) => api.delete(`/restaurants/${id}`);

export const getBranches = (restaurantId?: number) =>
  api.get('/branches', { params: { restaurantId } });
export const createBranch = (data: BranchPayload) => api.post('/branches', data);
export const updateBranch = (id: number, data: BranchPayload) => api.patch(`/branches/${id}`, data);
export const deleteBranch = (id: number) => api.delete(`/branches/${id}`);

export const getUsers = (restaurantId?: number) =>
  api.get('/users', { params: { restaurantId } });
export const getWaiters = () => api.get('/users/waiters');
export const getChefs = () => api.get('/users/chefs');
export const getKitchenWorkers = () => api.get('/users/kitchen-workers');
export const getStaffList = () => api.get('/users/staff-list');
export const createUser = (data: UserPayload) => api.post('/users', data);
export const updateUser = (id: number, data: UserPayload) => api.patch(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);