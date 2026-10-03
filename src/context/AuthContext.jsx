import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as auth from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { setAnalyticsUser, track } from '../lib/analytics';

// Did this page load come back from a Google (OAuth) sign-in redirect?
const cameFromOAuth =
  typeof window !== 'undefined' &&
  (/[#&]access_token=/.test(window.location.hash) || new URLSearchParams(window.location.search).has('code'));

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
      .then((u) => {
        if (!alive) return;
        setUser(u);
        // Google sign-in returns here via redirect: a brand-new account is a signup.
        if (u && cameFromOAuth) {
          const fresh = u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 5 * 60 * 1000;
          track(fresh ? 'signup' : 'login', { method: 'google' });
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    const unsubscribe = auth.onAuthChange((event, u) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setUser(null);
      else if (u) setUser(u);
    });
    // Keep analytics tagged with the current user (id only) and their token (for RLS).
    let unsubAnalytics = () => {};
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => setAnalyticsUser(data.session?.user?.id, data.session?.access_token));
      const { data } = supabase.auth.onAuthStateChange((_e, session) =>
        setAnalyticsUser(session?.user?.id, session?.access_token)
      );
      unsubAnalytics = () => data.subscription.unsubscribe();
    }
    return () => {
      alive = false;
      unsubscribe();
      unsubAnalytics();
    };
  }, []);

  const logIn = useCallback(async (credentials) => {
    const u = await auth.logIn(credentials);
    setUser(u);
    track('login', { method: 'email' });
    return u;
  }, []);

  /** Resolves to { user, needsConfirmation, email }. */
  const signUp = useCallback(async (data) => {
    const res = await auth.signUp(data);
    if (res.user) setUser(res.user);
    track('signup', { method: 'email', confirmed: !res.needsConfirmation });
    return res;
  }, []);

  const logOut = useCallback(async () => {
    track('logout');
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
