import api from './http-client';

export const seedDatabase = () => api.post('/seed');