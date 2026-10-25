import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import { getAccessToken, setAccessToken } from '../utils/authHelper';
import { mockAxiosAdapter } from './mockAdapter.js';

let accessToken = getAccessToken();

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    Authorization: `Bearer ${accessToken}`
  },
  adapter: mockAxiosAdapter
});

api.interceptors.request.use(async (req) => {
  accessToken = getAccessToken();

  if (!accessToken) return req;

  try {
    const decoded = jwtDecode(accessToken);
    const isExpired = dayjs.unix(decoded.exp).diff(dayjs()) < 1000;

    if (!isExpired) {
      req.headers.Authorization = `Bearer ${accessToken}`;
      return req;
    }

    // Token expired - attempt to refresh
    const res = await api.post('/auth/refresh');
    const newAccessToken = res.data.accessToken;
    setAccessToken(newAccessToken);
    req.headers.Authorization = `Bearer ${newAccessToken}`;
    return req;

  } catch (err) {
    console.warn('Auth interceptor check:', err);
    return req;
  }
});

export default api;
