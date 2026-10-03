// Server-only clients. These read SECRET environment variables that exist only
// on the server (Vercel → Settings → Environment Variables) — never in the browser.
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

class ConfigError extends Error {}

let stripe;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new ConfigError('Billing is not configured yet (missing STRIPE_SECRET_KEY).');
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: 'PhotoBooth' } });
  return stripe;
}

let admin;
/** Supabase client with the service-role key: bypasses RLS — server use only. */
function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ConfigError('Billing is not configured yet (missing SUPABASE_SERVICE_ROLE_KEY).');
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Public site URL for Stripe redirects (falls back to the request host). */
function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

module.exports = { getStripe, getAdmin, siteUrl, ConfigError };
