// Saved photo strips for the signed-in user, with object URLs managed for display.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import * as store from '../lib/photoStore';

const StripsContext = createContext(null);

const withUrl = (rec) => ({ ...rec, url: URL.createObjectURL(rec.blob) });

export function StripsProvider({ children }) {
  const { user } = useAuth();
  const [strips, setStrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const stripsRef = useRef([]);
  stripsRef.current = strips;

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStrips([]);
      return undefined;
    }
    setLoading(true);
    setError('');
    store
      .listStrips(user.id)
      .then((rows) => {
        if (!cancelled) setStrips(rows.map(withUrl));
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load your photos.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Revoke object URLs on unmount / user switch.
  useEffect(() => () => stripsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), [user]);

  const save = useCallback(
    async (data) => {
      if (!user) throw new Error('Please log in to save your photos.');
      const rec = withUrl(await store.saveStrip(user.id, data));
      setStrips((s) => [rec, ...s]);
      return rec;
    },
    [user]
  );

  const update = useCallback(async (id, patch) => {
    const next = await store.updateStrip(id, patch);
    setStrips((s) => s.map((x) => (x.id === id ? { ...x, ...patch, blob: next.blob } : x)));
  }, []);

  const toggleFavorite = useCallback(
    (id) => {
      const s = stripsRef.current.find((x) => x.id === id);
      return s ? update(id, { favorite: !s.favorite }) : Promise.resolve();
    },
    [update]
  );

  const remove = useCallback(async (id) => {
    await store.deleteStrip(id);
    setStrips((s) => {
      const gone = s.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return s.filter((x) => x.id !== id);
    });
  }, []);

  const value = useMemo(
    () => ({ strips, loading, error, save, update, toggleFavorite, remove }),
    [strips, loading, error, save, update, toggleFavorite, remove]
  );
  return <StripsContext.Provider value={value}>{children}</StripsContext.Provider>;
}

export const useStrips = () => useContext(StripsContext);
