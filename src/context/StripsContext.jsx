// Saved photo strips for the signed-in user (Supabase), shared by Dashboard,
// My Photos and Favorites.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import * as store from '../lib/photoStore';

const StripsContext = createContext(null);

export function StripsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [strips, setStrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const stripsRef = useRef([]);
  stripsRef.current = strips;
  // Object URLs created for freshly saved strips (until the next reload signs them).
  const localUrls = useRef([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      setStrips(await store.listStrips());
    } catch (err) {
      setError(err.message || 'Could not load your photos.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStrips([]);
      return;
    }
    reload();
  }, [userId, reload]);

  useEffect(
    () => () => {
      localUrls.current.forEach((u) => URL.revokeObjectURL(u));
      localUrls.current = [];
    },
    [userId]
  );

  const save = useCallback(
    async (data) => {
      if (!userId) throw new Error('Please log in to save your photos.');
      const rec = await store.saveStrip(userId, data);
      const url = URL.createObjectURL(data.blob);
      localUrls.current.push(url);
      const withBlob = { ...rec, url, blob: data.blob };
      setStrips((s) => [withBlob, ...s]);
      return withBlob;
    },
    [userId]
  );

  const toggleFavorite = useCallback(async (id) => {
    const s = stripsRef.current.find((x) => x.id === id);
    if (!s) return;
    const favorite = !s.favorite;
    setStrips((list) => list.map((x) => (x.id === id ? { ...x, favorite } : x))); // optimistic
    try {
      await store.updateStrip(id, { favorite });
    } catch (err) {
      setStrips((list) => list.map((x) => (x.id === id ? { ...x, favorite: !favorite } : x)));
      throw err;
    }
  }, []);

  const remove = useCallback(async (id) => {
    const s = stripsRef.current.find((x) => x.id === id);
    if (!s) return;
    await store.deleteStrip(s);
    setStrips((list) => list.filter((x) => x.id !== id));
  }, []);

  const getBlob = useCallback((s) => store.getStripBlob(s), []);

  const value = useMemo(
    () => ({ strips, loading, error, reload, save, toggleFavorite, remove, getBlob }),
    [strips, loading, error, reload, save, toggleFavorite, remove, getBlob]
  );
  return <StripsContext.Provider value={value}>{children}</StripsContext.Provider>;
}

export const useStrips = () => useContext(StripsContext);
