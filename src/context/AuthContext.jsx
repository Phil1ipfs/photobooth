import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as auth from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // False until the stored session has been restored, so protected routes don't
  // bounce a signed-in user to /login on page load.
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    auth
      .getCurrentUser()
      .then((u) => alive && setUser(u))
      .catch(() => {})
      .finally(() => alive && setReady(true));
    const unsubscribe = auth.onAuthChange((event, u) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setUser(null);
      else if (u) setUser(u);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const logIn = useCallback(async (credentials) => {
    const u = await auth.logIn(credentials);
    setUser(u);
    return u;
  }, []);

  /** Resolves to { user, needsConfirmation, email }. */
  const signUp = useCallback(async (data) => {
    const res = await auth.signUp(data);
    if (res.user) setUser(res.user);
    return res;
  }, []);

  const logOut = useCallback(async () => {
    setUser(null);
    await auth.logOut();
  }, []);

  /** Resolves to { user, emailChangePending }. */
  const updateProfile = useCallback(
    async (patch) => {
      const res = await auth.updateProfile(user.id, patch);
      setUser(res.user);
      return res;
    },
    [user]
  );

  const changePassword = useCallback((current, next) => auth.changePassword(user.id, current, next), [user]);

  const deleteAccount = useCallback(
    async (password) => {
      await auth.deleteAccount(user.id, password);
      try {
        localStorage.removeItem(`pb:prefs:${user.id}`);
      } catch {}
      setUser(null);
    },
    [user]
  );

  const setNewPassword = useCallback(async (password) => {
    const u = await auth.setNewPassword(password);
    setRecovering(false);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      recovering,
      configured: isSupabaseConfigured,
      logIn,
      signUp,
      logOut,
      updateProfile,
      changePassword,
      deleteAccount,
      setNewPassword,
      requestPasswordReset: auth.requestPasswordReset,
      signInWithProvider: auth.signInWithProvider,
    }),
    [user, ready, recovering, logIn, signUp, logOut, updateProfile, changePassword, deleteAccount, setNewPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
