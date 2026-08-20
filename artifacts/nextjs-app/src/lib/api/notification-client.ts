import api from './http-client';

export const getNotifications = () => api.get('/notifications');
export const markNotificationsRead = () => api.patch('/notifications/read');