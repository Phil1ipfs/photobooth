// POST /api/billing/webhook — PayMongo → PhotoBooth Premium grants.
// Configure in PayMongo Dashboard → Developers → Webhooks (one endpoint for live
// mode, one for test mode) with the event:  checkout_session.payment.paid
const { env, getPaymongo } = require('../_lib/clients');
const { readRawBody, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');
const { handlePaymongoEvent } = require('../_lib/billing');
const { verifySignature } = require('../_lib/paymongo');

module.exports = async function webhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  const secret = env('PAYMONGO_WEBHOOK_SECRET');
  if (!secret) return send(res, 503, { error: 'Webhook not configured.' });

  // Verify the signature over the untouched bytes before parsing anything.
  const raw = await readRawBody(req);
  const { valid } = verifySignature(raw, req.headers['paymongo-signature'], secret);
  if (!valid) return send(res, 401, { error: 'Invalid signature.' });

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return send(res, 400, { error: 'Invalid JSON.' });
  }

  try {
    const result = await handlePaymongoEvent(payload, { paymongo: getPaymongo(), repo: supabaseRepo() });
    return send(res, 200, { received: true, ...result });
  } catch (err) {
    console.error('[billing webhook]', payload?.data?.id, err.message);
    return send(res, 500, { error: 'Processing failed; PayMongo will retry.' }); // non-2xx → retried
  }
};

// Signatures need the raw body (disable any framework body parsing).
module.exports.config = { api: { bodyParser: false } };
