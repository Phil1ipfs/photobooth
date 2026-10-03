import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as auth from '../lib/auth';
import { deleteAllStrips } from '../lib/photoStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.getCurrentUser());

  const logIn = useCallback(async (credentials) => {
    const u = await auth.logIn(credentials);
    setUser(u);
    return u;
  }, []);

  const signUp = useCallback(async (data) => {
    const u = await auth.signUp(data);
    setUser(u);
    return u;
  }, []);

  const logOut = useCallback(() => {
    auth.logOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      const u = await auth.updateProfile(user.id, patch);
      setUser(u);
      return u;
    },
    [user]
  );

  const changePassword = useCallback((current, next) => auth.changePassword(user.id, current, next), [user]);

  const deleteAccount = useCallback(
    async (password) => {
      await auth.deleteAccount(user.id, password);
      await deleteAllStrips(user.id).catch(() => {});
      try {
        localStorage.removeItem(`pb:prefs:${user.id}`);
      } catch {}
      setUser(null);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, logIn, signUp, logOut, updateProfile, changePassword, deleteAccount }),
    [user, logIn, signUp, logOut, updateProfile, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
