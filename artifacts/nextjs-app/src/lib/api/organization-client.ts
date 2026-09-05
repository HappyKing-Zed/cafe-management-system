import api from './http-client';

export const getRestaurants = () => api.get('/restaurants');
export const createRestaurant = (data: any) => api.post('/restaurants', data);
export const updateRestaurant = (id: number, data: any) => api.patch(`/restaurants/${id}`, data);
export const deleteRestaurant = (id: number) => api.delete(`/restaurants/${id}`);

export const getBranches = (restaurantId?: number) =>
  api.get('/branches', { params: { restaurantId } });
export const createBranch = (data: any) => api.post('/branches', data);
export const updateBranch = (id: number, data: any) => api.patch(`/branches/${id}`, data);
export const deleteBranch = (id: number) => api.delete(`/branches/${id}`);

export const getUsers = (restaurantId?: number) =>
  api.get('/users', { params: { restaurantId } });
export const getWaiters = () => api.get('/users/waiters');
export const getChefs = () => api.get('/users/chefs');
export const getKitchenWorkers = () => api.get('/users/kitchen-workers');
export const getStaffList = () => api.get('/users/staff-list');
export const createUser = (data: any) => api.post('/users', data);
export const updateUser = (id: number, data: any) => api.patch(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);