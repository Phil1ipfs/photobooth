// PayMongo → Supabase Premium grants. Pure logic: `paymongo` and `repo` are
// injected so this is unit-testable without network access.
//
// Principles
//  • PayMongo is the source of truth: whether the trigger is the webhook or the
//    success page, we re-fetch the checkout session from PayMongo with our secret
//    key and only grant Premium if it shows a *paid* payment of the right amount.
//  • We only fulfil sessions we created (checkout_sessions table), for the user
//    who created them.
//  • Idempotent: grant_premium_pass() records each PayMongo payment id once, in
//    the same transaction that extends Premium.
const { getPlan } = require('./plans');

class FulfilError extends Error {}

/** The paid payment of a checkout session, if any. */
function paidPayment(session) {
  const payments = session?.attributes?.payments || session?.attributes?.payment_intent?.attributes?.payments || [];
  return payments.find((p) => p?.attributes?.status === 'paid') || null;
}

/**
 * Re-fetch a checkout session from PayMongo and grant Premium if it was paid.
 * Returns { status: 'granted' | 'already_granted' | 'unpaid' | 'unknown_session', ... }.
 * Throws FulfilError for sessions that must never grant anything (mismatches), and
 * any other error for transient failures (so the webhook is retried).
 */
async function fulfilCheckoutSession({ paymongo, repo }, sessionId, { expectedUserId } = {}) {
  const record = await repo.getCheckoutBySession(sessionId);
  if (!record) return { status: 'unknown_session' }; // e.g. a dashboard payment link — not ours
  if (expectedUserId && record.user_id !== expectedUserId) throw new FulfilError('Checkout belongs to another user.');

  const plan = getPlan(record.plan);
  if (!plan) throw new FulfilError(`Unknown plan ${record.plan}.`);

  const session = await paymongo.getCheckoutSession(sessionId);
  const attrs = session?.attributes || {};
  if (session?.id !== sessionId) throw new FulfilError('Session id mismatch.');
  if (typeof attrs.livemode === 'boolean' && attrs.livemode !== paymongo.livemode) {
    throw new FulfilError('Test/live mode mismatch.');
  }
  if (attrs.metadata?.user_id && attrs.metadata.user_id !== record.user_id) throw new FulfilError('Session user mismatch.');

  const payment = paidPayment(session);
  if (!payment) return { status: 'unpaid', userId: record.user_id };

  const amount = payment.attributes.amount;
  const currency = String(payment.attributes.currency || '').toUpperCase();
  // Amount can be higher than the plan price if pass-on fees are enabled, never lower.
  if (currency !== plan.currency || !(amount >= plan.amount)) {
    throw new FulfilError(`Paid ${amount} ${currency}, expected ${plan.amount} ${plan.currency}.`);
  }

  const result = await repo.grantPass({
    userId: record.user_id,
    paymentId: payment.id,
    plan: record.plan,
    days: plan.days,
    amount,
    currency,
    sessionId,
  });
  return {
    status: result?.granted ? 'granted' : 'already_granted',
    userId: record.user_id,
    currentPeriodEnd: result?.currentPeriodEnd || null,
  };
}

/** Event type + checkout session id from a webhook payload. */
function parseEvent(payload) {
  const attrs = payload?.data?.attributes || {};
  const resource = attrs.data || {};
  return {
    id: payload?.data?.id || null,
    type: attrs.type || null,
    livemode: typeof attrs.livemode === 'boolean' ? attrs.livemode : null,
    sessionId: resource.type === 'checkout_session' ? resource.id : null,
  };
}

/**
 * Process one verified PayMongo webhook. Unrecognised events are acknowledged
 * (PayMongo retries anything that isn't 2xx). Throws only on transient failures.
 */
async function handlePaymongoEvent(payload, deps) {
  const event = parseEvent(payload);
  if (event.livemode !== null && event.livemode !== deps.paymongo.livemode) {
    return { status: 'ignored', reason: 'mode_mismatch', type: event.type };
  }
  if (event.type !== 'checkout_session.payment.paid' || !event.sessionId) {
    return { status: 'ignored', type: event.type };
  }
  try {
    const result = await fulfilCheckoutSession(deps, event.sessionId);
    return { type: event.type, ...result };
  } catch (err) {
    if (err instanceof FulfilError) {
      // Permanent problem — log it for review, but don't make PayMongo retry forever.
      console.error('[billing webhook] rejected', event.id, err.message);
      return { status: 'rejected', type: event.type };
    }
    throw err;
  }
}

module.exports = { fulfilCheckoutSession, handlePaymongoEvent, parseEvent, paidPayment, FulfilError };
