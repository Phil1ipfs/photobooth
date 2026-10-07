// POST /api/billing/checkout  { planId } → { url }
// Creates a PayMongo Checkout Session (GCash, Maya, cards…) for the signed-in
// user. Premium is NOT granted here — only a payment that PayMongo confirms as
// paid (webhook or /api/billing/confirm) activates it.
const crypto = require('node:crypto');
const { env, getPaymongo, siteUrl } = require('../_lib/clients');
const { HttpError, handler, readJson, requireUser, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');
const { getPurchasablePlan } = require('../_lib/plans');

const DEFAULT_METHODS = 'card,gcash,paymaya';
const RENEW_WINDOW_DAYS = 30; // Premium can be renewed in the last 30 days of the current pass

const paymentMethods = () =>
  (env('PAYMONGO_PAYMENT_METHODS') || DEFAULT_METHODS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

module.exports = handler(async (req, res) => {
  const user = await requireUser(req);
  const { planId } = await readJson(req);
  const plan = getPurchasablePlan(planId);
  if (!plan) throw new HttpError(400, 'That plan isn’t available.');

  const repo = supabaseRepo();
  const tier = await repo.currentTier(user.id);
  if (tier === 'admin') throw new HttpError(409, 'Admins already have every Premium feature.');
  const active = await repo.getActiveSubscription(user.id);
  if (active?.current_period_end && new Date(active.current_period_end) - Date.now() > RENEW_WINDOW_DAYS * 864e5) {
    const until = new Date(active.current_period_end).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    throw new HttpError(409, `Your Premium runs until ${until}. You can renew in its last ${RENEW_WINDOW_DAYS} days.`);
  }

  const reference = `PB-${crypto.randomBytes(9).toString('base64url')}`;
  const site = siteUrl(req);
  const session = await getPaymongo().createCheckoutSession({
    line_items: [{ name: plan.name, amount: plan.amount, currency: plan.currency, quantity: 1, description: plan.description }],
    payment_method_types: paymentMethods(),
    description: plan.name,
    reference_number: reference,
    send_email_receipt: true,
    show_description: true,
    show_line_items: true,
    metadata: { user_id: user.id, plan: planId, reference },
    success_url: `${site}/billing/success?ref=${reference}`,
    cancel_url: `${site}/pricing?checkout=cancelled`,
  });

  await repo.saveCheckout({ userId: user.id, sessionId: session.id, reference, plan: planId });
  await repo.track(user.id, 'checkout_started', { plan: planId, provider: 'paymongo' });
  return send(res, 200, { url: session.attributes.checkout_url });
});
