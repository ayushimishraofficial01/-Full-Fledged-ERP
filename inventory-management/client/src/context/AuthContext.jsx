import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services';
import { setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | guest
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;
    authService
      .me()
      .then((res) => {
        if (!active) return;
        setUser(res.user);
        setStatus('authenticated');
      })
      .catch(() => active && setStatus('guest'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (current) setSessionExpired(true);
        return null;
      });
      setStatus('guest');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials);
    setUser(res.user);
    setStatus('authenticated');
    setSessionExpired(false);
    return res;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await authService.google({ credential });
    setUser(res.user);
    setStatus('authenticated');
    setSessionExpired(false);
    return res;
  }, []);

  const register = useCallback(async (body) => {
    const res = await authService.register(body);
    setUser(res.user);
    setStatus('authenticated');
    return res;
  }, []);

  const logout = useCallback(async ({ everywhere = false } = {}) => {
    try {
      if (everywhere) await authService.logoutAll();
      else await authService.logout();
    } finally {
      setUser(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      status,
      isAuthenticated: status === 'authenticated',
      permissions: user?.permissions || [],
      hasPermission: (permission) => user?.role === 'admin' || (user?.permissions || []).includes(permission),
      login,
      loginWithGoogle,
      register,
      logout,
      sessionExpired,
      setSessionExpired,
    }),
    [user, status, login, loginWithGoogle, register, logout, sessionExpired]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
