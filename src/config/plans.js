// Centralised plan / pricing configuration for the UI. Prices shown here are for
// display only — what PayMongo actually charges is decided on the server
// (api/_lib/plans.js). Keep the ids and prices of both files in sync.
//
// Premium is sold as a prepaid pass: each payment adds `days` of Premium, with no
// automatic renewal (PayMongo Hosted Checkout — GCash, Maya, cards…).

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
      'Unlimited downloads',
      'Save up to 2 strips to My Photos',
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
      'Unlimited saved strips in My Photos',
      'Early access to future Premium features',
      'Always ad-free',
    ],
  },
};

/** Purchasable plans. Only `enabled` ones are offered. */
export const PLANS = [
  {
    id: 'premium_monthly',
    tier: 'premium',
    name: 'Premium · 30 days',
    price: 99,
    interval: '30 days',
    days: 30,
    enabled: true,
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
