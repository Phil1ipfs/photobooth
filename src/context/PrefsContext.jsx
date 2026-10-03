// Per-user (or guest) preferences: theme, sounds, camera defaults and favourite templates.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_LAYOUT_ID, DEFAULT_TEMPLATE_ID } from '../templates/data';
import { track } from '../lib/analytics';

export const DEFAULT_PREFS = {
  theme: 'light',
  sound: true,
  mirror: true,
  flash: true,
  countdown: 3,
  filter: 'auto',
  hd: false,
  aspect: '4:3',
  layout: DEFAULT_LAYOUT_ID,
  cameraId: '',
  captureMode: 'auto',
  lastTemplate: DEFAULT_TEMPLATE_ID,
  favoriteTemplates: [],
};

const PrefsContext = createContext(null);
const keyFor = (user) => `pb:prefs:${user ? user.id : 'guest'}`;

const read = (key) => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(key)) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

export function PrefsProvider({ children }) {
  const { user } = useAuth();
  const key = keyFor(user);
  const [state, setState] = useState(() => ({ key, prefs: read(key) }));

  // Switch preference sets when the signed-in user changes.
  const prefs = state.key === key ? state.prefs : read(key);
  if (state.key !== key) setState({ key, prefs });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {}
  }, [key, prefs]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && media?.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#170F12' : '#FFF9F6');
    };
    apply();
    if (prefs.theme === 'system' && media) {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [prefs.theme]);

  const setPref = useCallback(
    (patch) => setState((s) => ({ key: s.key, prefs: { ...s.prefs, ...(typeof patch === 'function' ? patch(s.prefs) : patch) } })),
    []
  );

  const toggleFavoriteTemplate = useCallback(
    (id) => {
      track('template_favorited', { template: id, favorited: !prefs.favoriteTemplates.includes(id) });
      setPref((p) => ({
        favoriteTemplates: p.favoriteTemplates.includes(id)
          ? p.favoriteTemplates.filter((x) => x !== id)
          : [...p.favoriteTemplates, id],
      }));
    },
    [setPref, prefs.favoriteTemplates]
  );

  const value = useMemo(() => ({ prefs, setPref, toggleFavoriteTemplate }), [prefs, setPref, toggleFavoriteTemplate]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
