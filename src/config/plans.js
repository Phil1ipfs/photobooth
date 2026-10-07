// Centralised plan / pricing configuration for the UI. Prices shown here are for
// display only — what PayMongo actually charges is decided on the server
// (api/_lib/plans.js). Keep the ids and prices of both files in sync.
//
// Premium is sold as a prepaid pass: each payment adds `days` of Premium, with no
// automatic renewal (PayMongo Hosted Checkout — GCash, Maya, cards…).

import { FREE_STRIP_LIMIT, FREE_TEMPLATE_IDS, PREMIUM_TEMPLATE_IDS } from './catalog';

export const CURRENCY = { code: 'PHP', symbol: '₱', locale: 'en-PH' };

/** Plan "levels" — entitlements compare these, so higher includes lower. */
export const LEVELS = { free: 0, premium: 1, admin: 2 };

export const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: `Try PhotoBooth with ${FREE_STRIP_LIMIT} free photostrips.`,
    features: [
      `${FREE_STRIP_LIMIT} photostrips to create — download, save & share them`,
      `${FREE_TEMPLATE_IDS.length} free templates to design them with`,
      'Classic 1 × 4 and 1 × 2 strip layouts',
      'Basic filters (Original, Black & white)',
      'Live photobooth with countdown & flash',
      'Always ad-free',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Unlock every look, layout and finish.',
    features: [
      'Everything in Free',
      'Unlimited photostrips',
      `All ${FREE_TEMPLATE_IDS.length + PREMIUM_TEMPLATE_IDS.length} templates — and every new collection`,
      'Advanced layouts: 2 × 2, 2 × 3, 3 × 2, editorial & comic panels',
      'Premium filters: Sepia, Warm glow, Cool tone, Faded film',
      'HD downloads at 2× resolution',
      'Early access to future Premium features',
      'Always ad-free',
    ],
  },
};

/** Purchasable plans. Only `enabled` ones are offered. */
export const PLANS = [
  {
    id: 'premium_yearly',
    tier: 'premium',
    name: 'Premium · 1 year',
    price: 99,
    interval: 'year', // "₱99 / year"
    period: '1 year', // "Extend 1 year"
    days: 365,
    enabled: true,
  },
  {
    // Retired 30-day pass — kept so existing passes still display correctly.
    id: 'premium_monthly',
    tier: 'premium',
    name: 'Premium · 30 days',
    price: 99,
    interval: '30 days',
    period: '30 days',
    days: 30,
    enabled: false,
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
