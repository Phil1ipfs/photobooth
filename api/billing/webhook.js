// POST /api/billing/webhook — Stripe → PhotoBooth subscription sync.
// Configure in Stripe → Developers → Webhooks with these events:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted,
//   invoice.paid, invoice.payment_failed
const { getStripe } = require('../_lib/clients');
const { readRawBody, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');
const { handleStripeEvent } = require('../_lib/billing');

module.exports = async function webhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return send(res, 503, { error: 'Webhook not configured.' });

  let event;
  try {
    const stripe = getStripe();
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], secret);
  } catch (err) {
    // Bad / missing signature: reject without processing anything.
    return send(res, 400, { error: 'Invalid signature.' });
  }

  try {
    const result = await handleStripeEvent(event, { stripe: getStripe(), repo: supabaseRepo() });
    return send(res, 200, { received: true, ...result });
  } catch (err) {
    console.error('[billing webhook]', event.type, event.id, err);
    return send(res, 500, { error: 'Processing failed; Stripe will retry.' }); // non-2xx → Stripe retries
  }
};

// Stripe signatures need the raw body (disable any framework body parsing).
module.exports.config = { api: { bodyParser: false } };
