// POST /api/billing/checkout  { planId } → { url }
// Creates a Stripe Checkout Session for the signed-in user. Premium is NOT granted
// here — only the verified Stripe webhook activates it.
const { getStripe, siteUrl } = require('../_lib/clients');
const { HttpError, handler, readJson, requireUser, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');
const { priceIdFor } = require('../_lib/plans');

module.exports = handler(async (req, res) => {
  const user = await requireUser(req);
  const { planId } = await readJson(req);
  const price = priceIdFor(planId);
  if (!price) throw new HttpError(400, 'That plan isn’t available.');

  const repo = supabaseRepo();
  const tier = await repo.currentTier(user.id);
  if (tier === 'premium' || tier === 'admin') {
    throw new HttpError(409, 'You already have Premium — manage your plan from Settings → Billing.');
  }

  const stripe = getStripe();
  let customer = await repo.getCustomerForUser(user.id);
  if (!customer) {
    const created = await stripe.customers.create(
      { email: user.email, metadata: { user_id: user.id } },
      { idempotencyKey: `customer-${user.id}` }
    );
    await repo.saveCustomer(user.id, created.id);
    customer = (await repo.getCustomerForUser(user.id)) || created.id;
  }

  const site = siteUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { user_id: user.id, plan: planId },
    subscription_data: { metadata: { user_id: user.id, plan: planId } },
    success_url: `${site}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/pricing?checkout=cancelled`,
  });

  await repo.track(user.id, 'checkout_started', { plan: planId });
  return send(res, 200, { url: session.url });
});
