import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { getAccessToken, removeAccessToken, setAccessToken } from '../utils/authHelper';
import AuthContext from './auth-context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback((token, authenticatedUser) => {
    setAccessToken(token);
    setUser(authenticatedUser);
  }, []);

  const logout = useCallback(() => {
    removeAccessToken();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getAccessToken()) {
      logout();
      return null;
    }
    setLoading(true);
    try {
      const response = await api.get('/v1/auth/me');
      const currentUser = response.data?.data?.user;
      if (!currentUser) throw new Error('Invalid authentication response.');
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error.response?.status === 401) logout();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [logout]);

  const value = useMemo(() => ({ user, login, logout, refreshMe, loading }), [
    user, login, logout, refreshMe, loading,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
