import api from './http-client';

export const getDailyReport = (from?: string, branchId?: number, to?: string) =>
  api.get('/payments/report', { params: { from, to, branchId } });
export const getPayments = (branchId?: number) =>
  api.get('/payments', { params: { branchId } });
export const processPayment = (data: any) => api.post('/payments', data);
export const getShifts = () => api.get('/payments/shifts');
export const openShift = (data: any) => api.post('/payments/shifts', data);
export const closeShift = (id: number, closingCash: number) =>
  api.patch(`/payments/shifts/${id}/close`, { closingCash });