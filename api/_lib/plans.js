// Server-side plan map: which Stripe Price each purchasable plan uses. Price IDs
// come from environment variables so test/live mode and price changes never need
// a code change. Keep the ids in sync with src/config/plans.js (display config).
const PLANS = {
  premium_monthly: { tier: 'premium', priceEnv: 'STRIPE_PRICE_PREMIUM_MONTHLY' },
  premium_yearly: { tier: 'premium', priceEnv: 'STRIPE_PRICE_PREMIUM_YEARLY' },
};

/** Stripe Price id for a plan, or null if the plan is unknown / not configured. */
function priceIdFor(planId) {
  const plan = PLANS[planId];
  return (plan && process.env[plan.priceEnv]) || null;
}

/** Reverse lookup used by the webhook: Stripe Price id → { planId, tier }. */
function planForPrice(priceId) {
  const entry = Object.entries(PLANS).find(([, p]) => priceId && process.env[p.priceEnv] === priceId);
  return entry ? { planId: entry[0], tier: entry[1].tier } : null;
}

module.exports = { PLANS, priceIdFor, planForPrice };
