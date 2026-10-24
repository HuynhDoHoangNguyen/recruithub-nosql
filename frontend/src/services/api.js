import axios from 'axios';
import { getAccessToken } from '../utils/authHelper';

// The base is the /api root. Versioned service modules add /v1 themselves.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5002/api',
  timeout: 10000,
});

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  return Promise.reject(error);
});

export default api;
