// Shared by the browser and Vercel checkout handler. CommonJS keeps the server
// and UI on the same renewal rule without another build step.
const RENEW_WINDOW_DAYS = 30;

function getCheckoutEligibility({ tier = 'free', currentPeriodEnd } = {}, now = Date.now()) {
  if (tier === 'admin') return { allowed: false, reason: 'admin', opensAt: null };
  const end = currentPeriodEnd ? Date.parse(currentPeriodEnd) : null;
  if ((currentPeriodEnd && !Number.isFinite(end)) || (tier === 'premium' && end === null)) {
    return { allowed: false, reason: 'unknown', opensAt: null };
  }
  const opensAt = end === null ? null : end - RENEW_WINDOW_DAYS * 864e5;
  if (opensAt !== null && now < opensAt) {
    return { allowed: false, reason: 'early', opensAt: new Date(opensAt).toISOString() };
  }
  return { allowed: true, reason: null, opensAt: null };
}

module.exports = { RENEW_WINDOW_DAYS, getCheckoutEligibility };
