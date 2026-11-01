import { enabledPlans, getPlan } from './plans';
const server = require('../../api/_lib/plans');

test('the only purchasable Premium pass costs PHP 99 for 30 days in both UI and server', () => {
  expect(enabledPlans().map((p) => p.id)).toEqual(['premium_monthly']);
  const ui = getPlan('premium_monthly');
  const api = server.getPurchasablePlan('premium_monthly');
  expect(ui.days).toBe(30);
  expect(ui.interval).toBe('month');
  expect(api.days).toBe(30);
  expect(ui.price).toBe(99);
  expect(api.amount).toBe(9900);
  expect(api.currency).toBe('PHP');
});

test('the retired yearly pass is never offered for new purchases, but old checkouts keep 365 days', () => {
  expect(getPlan('premium_yearly').enabled).toBe(false);
  expect(server.getPurchasablePlan('premium_yearly')).toBeNull();
  expect(server.getPlan('premium_yearly').days).toBe(365);
});
