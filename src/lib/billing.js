// Browser side of billing. All PayMongo work happens in the server functions
// under /api/billing (they hold the PayMongo secret key); the browser only sends
// the user's session token and gets back a PayMongo-hosted checkout URL.
import { isSupabaseConfigured, supabase } from './supabase';

export class BillingError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function call(path, body, { signal } = {}) {
  if (!isSupabaseConfigured) throw new BillingError('Billing isn’t available right now.', 503);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new BillingError('Please log in to manage your subscription.', 401);
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');

  let res;
  try {
    res = await fetch(`/api/billing/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new BillingError('Can’t reach the billing server. Check your connection and try again.');
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  if (!isJson) throw new BillingError('Billing isn’t available in this environment yet.', res.status || 503);
  const json = await res.json();
  if (!res.ok) throw new BillingError(json.error || 'Something went wrong with billing. Please try again.', res.status);
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
export function confirmCheckout(reference, options) {
  return call('confirm', { reference }, options);
}
