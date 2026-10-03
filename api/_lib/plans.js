// Server-side plan map: what each purchasable plan costs and how many days of
// Premium it buys. This — not the browser — decides the amount charged. Keep the
// ids and prices in sync with src/config/plans.js (display config).
const PLANS = {
  premium_monthly: {
    tier: 'premium',
    name: 'PhotoBooth Premium — 30 days',
    description: 'All Premium templates, layouts, filters and HD downloads for 30 days. No auto-renewal.',
    amount: 9900, // centavos (₱99.00)
    currency: 'PHP',
    days: 30,
  },
};

/** Plan config for a plan id, or null if unknown. */
const getPlan = (planId) => (Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null);

module.exports = { PLANS, getPlan };
