// Browser side of billing. All PayMongo work happens in the server functions
// under /api/billing (they hold the PayMongo secret key); the browser only sends
// the user's session token and gets back a PayMongo-hosted checkout URL.
import { isSupabaseConfigured, supabase } from './supabase';

export class BillingError extends Error {}

async function call(path, body) {
  if (!isSupabaseConfigured) throw new BillingError('Billing isn’t available right now.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new BillingError('Please log in to manage your subscription.');

  let res;
  try {
    res = await fetch(`/api/billing/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch {
    throw new BillingError('Can’t reach the billing server. Check your connection and try again.');
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  if (!isJson) throw new BillingError('Billing isn’t available in this environment yet.');
  const json = await res.json();
  if (!res.ok) throw new BillingError(json.error || 'Something went wrong with billing. Please try again.');
  return json;
}

/** Start PayMongo Checkout (GCash, Maya, card…) for a plan id from src/config/plans.js. */
export async function startCheckout(planId) {
  const { url } = await call('checkout', { planId });
  window.location.assign(url);
}

/**
 * Ask the server to verify a returning checkout with PayMongo.
 * Resolves to { status: 'granted' | 'already_granted' | 'unpaid' | 'unknown_session', currentPeriodEnd }.
 */
export function confirmCheckout(reference) {
  return call('confirm', { reference });
}
