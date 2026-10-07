// Server-side plan map: what each purchasable plan costs and how many days of
// Premium it buys. This — not the browser — decides the amount charged. Keep the
// ids and prices in sync with src/config/plans.js (display config).
const PLANS = {
  premium_yearly: {
    tier: 'premium',
    name: 'PhotoBooth Premium — 1 year',
    description: 'All Premium templates, layouts, filters and HD downloads for 1 year. No auto-renewal.',
    amount: 9900, // centavos (₱99.00)
    currency: 'PHP',
    days: 365,
    purchasable: true,
  },
  // Retired: no longer sold, but kept so checkouts started before the switch still
  // grant exactly what was paid for (30 days).
  premium_monthly: {
    tier: 'premium',
    name: 'PhotoBooth Premium — 30 days',
    description: 'All Premium templates, layouts, filters and HD downloads for 30 days. No auto-renewal.',
    amount: 9900,
    currency: 'PHP',
    days: 30,
    purchasable: false,
  },
};

/** Plan config for a plan id (including retired plans), or null if unknown. */
const getPlan = (planId) => (Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null);

/** A plan that can be bought right now, or null. */
const getPurchasablePlan = (planId) => {
  const plan = getPlan(planId);
  return plan && plan.purchasable ? plan : null;
};

module.exports = { PLANS, getPlan, getPurchasablePlan };
