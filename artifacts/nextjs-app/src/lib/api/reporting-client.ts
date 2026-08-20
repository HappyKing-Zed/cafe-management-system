import api from './http-client';

export const getSummary = (params?: { period?: string; waiterId?: number; branchId?: number }) =>
  api.get('/summary', { params });
export const getServiceSubmissions = (params?: { waiterId?: number; branchId?: number }) =>
  api.get('/summary/submissions', { params });
export const submitDailyService = () => api.post('/summary/submissions');
export const confirmServiceSubmission = (id: number) =>
  api.patch(`/summary/submissions/${id}/confirm`);