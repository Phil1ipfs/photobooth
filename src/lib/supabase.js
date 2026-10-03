// Supabase client. Configure in .env.local (local) and in Vercel → Settings →
// Environment Variables (production):
//   REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
//   REACT_APP_SUPABASE_ANON_KEY=<anon / publishable key>
// The anon key is designed to be public; Row Level Security (supabase/schema.sql)
// is what protects each user's data.
import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// "Remember me": keep the session in localStorage (survives restarts) or, when
// unticked, in sessionStorage (ends when the tab closes).
const remember = () => {
  try {
    return localStorage.getItem('pb:remember') !== '0';
  } catch {
    return true;
  }
};

const sessionStore = {
  getItem: (k) => {
    try {
      return sessionStorage.getItem(k) ?? localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      const [keep, drop] = remember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(k, v);
      drop.removeItem(k);
    } catch {}
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch {}
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStore },
    })
  : null;

export const STRIPS_BUCKET = 'strips';
