import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Tasks API endpoints
export const tasksAPI = {
  getAll: (search) => api.get('/tasks', { params: { search } }),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  toggle: (id) => api.post(`/tasks/${id}/toggle`),
  getMonthly: (year, month) => api.get('/tasks/monthly', { params: { year, month } }),
  getAnalytics: (year, month) => api.get('/tasks/analytics', { params: { year, month } }),
  getDashboard: () => api.get('/tasks/dashboard'),
  getHeatmap: () => api.get('/tasks/heatmap'),
  exportCSV: (year, month) => api.get('/tasks/export/csv', {
    params: { year, month },
    responseType: 'blob'
  }),
};

export default api;