import axios from 'axios';
import { getAccessToken } from '../utils/authHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/** Browser API calls stay same-origin and pass through the /api proxy. */
export function normalizeApiBaseUrl(value = API_BASE_URL) {
  const normalized = String(value || '/api').trim().replace(/\/+$/, '');
  return normalized || '/api';
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(),
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
