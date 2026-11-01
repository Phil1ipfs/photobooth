import { getCheckoutEligibility } from './checkoutPolicy';

const now = Date.parse('2026-11-01T00:00:00Z');
const end = (days) => new Date(now + days * 864e5).toISOString();

test('the 30-day pass can be renewed throughout its current period', () => {
  expect(getCheckoutEligibility({ tier: 'premium', currentPeriodEnd: end(30) }, now).allowed).toBe(true);
  expect(getCheckoutEligibility({ tier: 'premium', currentPeriodEnd: end(1) }, now).allowed).toBe(true);
});
test('a yearly or stacked balance waits until exactly the final 30 days', () => {
  expect(getCheckoutEligibility({ tier: 'premium', currentPeriodEnd: end(200) }, now)).toEqual({ allowed: false, reason: 'early', opensAt: end(170) });
  expect(getCheckoutEligibility({ tier: 'premium', currentPeriodEnd: end(30) }, now - 1).allowed).toBe(false);
});
test('Free and expired accounts can buy, admins cannot, and unknown paid details remain disabled', () => {
  expect(getCheckoutEligibility({ tier: 'free' }, now).allowed).toBe(true);
  expect(getCheckoutEligibility({ tier: 'free', currentPeriodEnd: end(-1) }, now).allowed).toBe(true);
  expect(getCheckoutEligibility({ tier: 'admin' }, now).reason).toBe('admin');
  expect(getCheckoutEligibility({ tier: 'premium' }, now).reason).toBe('unknown');
  expect(getCheckoutEligibility({ tier: 'premium', currentPeriodEnd: 'invalid' }, now).reason).toBe('unknown');
});
