import api from './http-client';

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const getMe = () => api.get('/auth/me');