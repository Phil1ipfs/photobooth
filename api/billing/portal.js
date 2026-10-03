// POST /api/billing/portal  { flow?: 'cancel' | 'update_payment' } → { url }
// Opens the Stripe customer portal (manage payment method, invoices, cancel,
// switch plan). Changes made there reach us through the webhook.
const { getStripe, siteUrl } = require('../_lib/clients');
const { HttpError, handler, readJson, requireUser, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');

module.exports = handler(async (req, res) => {
  const user = await requireUser(req);
  const { flow } = await readJson(req);
  const repo = supabaseRepo();
  const customer = await repo.getCustomerForUser(user.id);
  if (!customer) throw new HttpError(400, 'You don’t have a billing account yet.');

  const returnUrl = `${siteUrl(req)}/settings`;
  const params = { customer, return_url: returnUrl };

  if (flow === 'cancel') {
    const sub = await repo.getActiveSubscription(user.id);
    if (!sub) throw new HttpError(400, 'There’s no active subscription to cancel.');
    params.flow_data = {
      type: 'subscription_cancel',
      subscription_cancel: { subscription: sub.stripe_subscription_id },
      after_completion: { type: 'redirect', redirect: { return_url: returnUrl } },
    };
  } else if (flow === 'update_payment') {
    params.flow_data = { type: 'payment_method_update' };
  }

  const session = await getStripe().billingPortal.sessions.create(params);
  return send(res, 200, { url: session.url });
});
