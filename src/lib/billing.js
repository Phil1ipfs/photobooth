// Browser side of billing. All Stripe work happens in the server functions under
// /api/billing (they hold the Stripe secret key); the browser only sends the
// user's session token and gets back a Stripe-hosted URL to redirect to.
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

/** Start Stripe Checkout for a plan id from src/config/plans.js. */
export async function startCheckout(planId) {
  const { url } = await call('checkout', { planId });
  window.location.assign(url);
}

/** Open the Stripe customer portal. flow: undefined | 'cancel' | 'update_payment' */
export async function openBillingPortal(flow) {
  const { url } = await call('portal', { flow });
  window.location.assign(url);
}
