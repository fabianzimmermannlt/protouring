import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:3002`;

// Create axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('protouring_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('protouring_token');
      localStorage.removeItem('protouring_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/api/login', { username, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/api/register', userData);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('protouring_token');
    localStorage.removeItem('protouring_user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('protouring_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken: () => {
    return localStorage.getItem('protouring_token');
  },

  setAuth: (token, user) => {
    localStorage.setItem('protouring_token', token);
    localStorage.setItem('protouring_user', JSON.stringify(user));
  }
};

// Tour Data API
export const tourDataAPI = {
  get: async (dataType) => {
    const response = await api.get(`/api/tour-data/${dataType}`);
    return response.data;
  },

  save: async (dataType, data) => {
    const response = await api.post(`/api/tour-data/${dataType}`, data);
    return response.data;
  }
};

// Profile API
export const profileAPI = {
  get: async () => {
    const response = await api.get('/api/profile');
    return response.data;
  }
};

export default api;
