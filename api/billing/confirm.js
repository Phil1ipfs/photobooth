// POST /api/billing/confirm  { reference } → { status, currentPeriodEnd }
// Called by /billing/success after PayMongo redirects back. Re-checks the
// session with PayMongo and grants Premium if it was paid — so activation doesn't
// depend on the webhook arriving first. Safe to call repeatedly.
const { getPaymongo } = require('../_lib/clients');
const { HttpError, handler, readJson, requireUser, send } = require('../_lib/http');
const { supabaseRepo } = require('../_lib/repo');
const { fulfilCheckoutSession, FulfilError } = require('../_lib/billing');

module.exports = handler(async (req, res) => {
  const user = await requireUser(req);
  const { reference } = await readJson(req);
  if (typeof reference !== 'string' || !/^PB-[\w-]{6,40}$/.test(reference)) throw new HttpError(400, 'Invalid checkout reference.');

  const repo = supabaseRepo();
  const checkout = await repo.getCheckoutByReference(user.id, reference);
  if (!checkout) throw new HttpError(404, 'We couldn’t find that checkout.');

  try {
    const result = await fulfilCheckoutSession({ paymongo: getPaymongo(), repo }, checkout.session_id, { expectedUserId: user.id });
    return send(res, 200, { status: result.status, currentPeriodEnd: result.currentPeriodEnd || null });
  } catch (err) {
    if (err instanceof FulfilError) {
      console.error('[billing confirm] rejected', checkout.session_id, err.message);
      throw new HttpError(409, 'We couldn’t verify this payment. Please contact support.');
    }
    throw err;
  }
});
