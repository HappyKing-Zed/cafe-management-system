import axios from 'axios';
import { clearAuth, getStoredToken } from '../auth';
import { BROWSER_API_BASE_PATH } from './config';

const api = axios.create({
  baseURL: BROWSER_API_BASE_PATH,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const hadToken = !!getStoredToken();
      clearAuth();
      if (hadToken && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export default api;