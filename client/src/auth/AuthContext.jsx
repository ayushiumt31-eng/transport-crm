import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearSession, getSession, saveSession, SESSION_EXPIRED_EVENT } from './session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession);
  const [checking, setChecking] = useState(() => Boolean(getSession()));
  // Shown on the login page after a forced sign-out (expired token, disabled login).
  const [notice, setNotice] = useState('');

  const endSession = useCallback((message = '') => {
    clearSession();
    setSession(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    const onExpired = (event) => endSession(event.detail?.message);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [endSession]);

  // Re-validate a stored session on app load: the login may have been disabled since.
  useEffect(() => {
    if (!getSession()) return;
    apiFetch('/auth/session')
      .then((result) => {
        const current = getSession();
        if (!current) return;
        const next = { ...current, role: result.data.role, user: result.data.user };
        saveSession(next);
        setSession(next);
      })
      .catch((error) => {
        if (error.status === 401 || error.status === 403) endSession(error.message);
      })
      .finally(() => setChecking(false));
  }, [endSession]);

  const startSession = useCallback((data) => {
    const next = { role: data.role, accessToken: data.accessToken, user: data.user };
    saveSession(next);
    setSession(next);
    setNotice('');
    return next;
  }, []);

  // The API is authoritative for account roles; reject a mismatched panel selection before signing in.
  const login = useCallback(async (loginId, password, expectedRole) => {
    const result = await apiFetch('/auth/login', { method: 'POST', body: { loginId, password }, auth: false });
    if (expectedRole && result.data.role !== expectedRole) {
      throw new Error(`This login belongs to the ${result.data.role} panel. Select the matching panel and try again.`);
    }
    return startSession(result.data);
  }, [startSession]);

  const registerCustomer = useCallback(async (details) => {
    const result = await apiFetch('/auth/register', { method: 'POST', body: details, auth: false });
    return startSession(result.data);
  }, [startSession]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const result = await apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    const current = getSession();
    // The API revokes older tokens, so keep this tab signed in with the new one.
    if (current) {
      const next = { ...current, accessToken: result.data.accessToken };
      saveSession(next);
      setSession(next);
    }
    return result.message;
  }, []);

  const logout = useCallback(() => endSession(''), [endSession]);

  const value = useMemo(() => ({
    session,
    role: session?.role || '',
    user: session?.user || null,
    checking,
    notice,
    login,
    registerCustomer,
    changePassword,
    logout,
    clearNotice: () => setNotice('')
  }), [session, checking, notice, login, registerCustomer, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
