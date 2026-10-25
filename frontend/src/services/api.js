import axios from 'axios';
import { getAccessToken } from '../utils/authHelper';

const DEFAULT_API_ROOT = '/api';

/** Keep the Axios base at /api because API modules append /v1 themselves. */
export function normalizeApiBaseUrl(value) {
  const configured = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_API_ROOT;
  const withoutVersionSuffix = configured.replace(/\/+$/, '').replace(/(?:\/v1)+$/i, '');
  return /\/api$/i.test(withoutVersionSuffix) ? withoutVersionSuffix : `${withoutVersionSuffix}/api`;
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
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
