// Server-only clients. These read SECRET environment variables that exist only
// on the server (Vercel → Settings → Environment Variables) — never in the browser.
const { createClient } = require('@supabase/supabase-js');
const { createPaymongo } = require('./paymongo');

class ConfigError extends Error {}

const env = (name) => (process.env[name] || '').trim();

let paymongo;
/** PayMongo REST client authenticated with the secret key (sk_live_… / sk_test_…). */
function getPaymongo() {
  const key = env('PAYMONGO_SECRET_KEY');
  if (!key) throw new ConfigError('Billing is not configured yet (missing PAYMONGO_SECRET_KEY).');
  if (!paymongo || paymongo.key !== key) paymongo = createPaymongo(key);
  return paymongo;
}

let admin;
/** Supabase client with the service-role key: bypasses RLS — server use only. */
function getAdmin() {
  const url = env('SUPABASE_URL') || env('REACT_APP_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ConfigError('Billing is not configured yet (missing SUPABASE_SERVICE_ROLE_KEY).');
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Public site URL for checkout redirects (falls back to the request host). */
function siteUrl(req) {
  if (env('SITE_URL')) return env('SITE_URL').replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

module.exports = { getPaymongo, getAdmin, siteUrl, env, ConfigError };
