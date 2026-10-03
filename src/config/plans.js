// Centralised plan / pricing configuration for the UI. Prices shown here are for
// display only — what Stripe actually charges is the Stripe Price the server maps
// each plan to (api/_lib/plans.js, via STRIPE_PRICE_* environment variables).
//
// To add a plan (e.g. Premium Yearly): create the Price in Stripe, add an entry
// below with `enabled: true`, and add its env var mapping in api/_lib/plans.js.

export const CURRENCY = { code: 'PHP', symbol: '₱', locale: 'en-PH' };

/** Plan "levels" — entitlements compare these, so higher includes lower. */
export const LEVELS = { free: 0, premium: 1, admin: 2 };

export const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need to start making memories.',
    features: [
      'Live photobooth with countdown & flash',
      '16 free templates',
      'Classic 1 × 4 and 1 × 2 strips',
      'Basic filters (Original, Black & white)',
      'Download, save & favorite your strips',
      'Always ad-free',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Unlock every look, layout and finish.',
    features: [
      'Everything in Free',
      'All 24 Premium templates — and every new collection',
      'Advanced layouts: 2 × 2, 2 × 3, 3 × 2, editorial & comic panels',
      'Premium filters: Sepia, Warm glow, Cool tone, Faded film',
      'HD downloads at 2× resolution',
      'Early access to future Premium features',
      'Always ad-free',
    ],
  },
};

/** Purchasable plans (billing intervals). Only `enabled` ones are offered. */
export const PLANS = [
  {
    id: 'premium_monthly',
    tier: 'premium',
    name: 'Premium Monthly',
    price: 99,
    interval: 'month',
    enabled: true,
  },
  {
    id: 'premium_yearly',
    tier: 'premium',
    name: 'Premium Yearly',
    price: 990,
    interval: 'year',
    enabled: false, // turn on once the yearly Stripe Price + env var exist
  },
];

export const enabledPlans = () => PLANS.filter((p) => p.enabled);

export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

export const formatPrice = (amount, { cents = false } = {}) =>
  new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency: CURRENCY.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents ? amount / 100 : amount);
