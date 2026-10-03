// Stripe → Supabase subscription sync. Pure logic: `stripe` and `repo` are
// injected so this is unit-testable without network access.
//
// Principles
//  • Stripe is the source of truth: for every subscription-related event we
//    re-fetch the subscription from Stripe and upsert its *current* state, so
//    out-of-order or repeated webhooks always converge to the right result.
//  • Idempotent: each Stripe event id is claimed once in billing_events; an event
//    that already finished processing is acknowledged and skipped.
const { planForPrice } = require('./plans');

const toIso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Subscription id from an invoice (handles both pre- and post-2025 API shapes). */
const invoiceSubscriptionId = (inv) =>
  (typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id) ||
  inv.parent?.subscription_details?.subscription ||
  null;

const customerId = (obj) => (typeof obj.customer === 'string' ? obj.customer : obj.customer?.id);

/** Map a Stripe subscription object to a subscriptions row. */
function subscriptionRow(sub, userId) {
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id || null;
  const plan = planForPrice(priceId);
  return {
    user_id: userId,
    stripe_customer_id: customerId(sub),
    stripe_subscription_id: sub.id,
    plan: plan?.planId || sub.metadata?.plan || 'unknown',
    // Unknown prices (e.g. another product in the same Stripe account) grant nothing.
    tier: plan ? plan.tier : 'none',
    price_id: priceId,
    status: sub.status,
    // 2025+ API: billing period lives on the subscription item
    current_period_start: toIso(sub.current_period_start ?? item?.current_period_start),
    current_period_end: toIso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: toIso(sub.canceled_at),
    ended_at: toIso(sub.ended_at),
  };
}

async function resolveUserId(repo, { hint, sub }) {
  return hint || sub?.metadata?.user_id || (sub ? await repo.getUserForCustomer(customerId(sub)) : null);
}

/** Fetch the latest state of a subscription from Stripe and store it. */
async function syncSubscription({ stripe, repo }, subscriptionId, userIdHint) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserId(repo, { hint: userIdHint, sub });
  if (!userId) {
    console.warn(`[billing] subscription ${sub.id}: no matching PhotoBooth user — skipped`);
    return { sub, userId: null };
  }
  await repo.saveCustomer(userId, customerId(sub));
  await repo.upsertSubscription(subscriptionRow(sub, userId));
  return { sub, userId };
}

/**
 * Process one verified Stripe event. Returns a short summary for logging/tests.
 * Throws on transient failures so Stripe retries (the event stays unprocessed).
 */
async function handleStripeEvent(event, deps) {
  const { repo } = deps;
  const claim = await repo.claimEvent(event.id, event.type);
  if (claim === 'processed') return { status: 'duplicate' };

  const obj = event.data.object;
  let userId = null;
  const extra = {};

  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription' || !obj.subscription) break;
      const hint = obj.client_reference_id || obj.metadata?.user_id || null;
      if (hint && obj.customer) await repo.saveCustomer(hint, customerId(obj));
      const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
      const res = await syncSubscription(deps, subId, hint);
      userId = res.userId;
      if (userId) await repo.track(userId, 'checkout_completed', { plan: obj.metadata?.plan || 'premium' });
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const res = await syncSubscription(deps, obj.id, null);
      userId = res.userId;
      if (!userId) break;
      if (event.type === 'customer.subscription.deleted') {
        await repo.track(userId, 'subscription_cancelled', { reason: obj.cancellation_details?.reason || 'ended' });
      } else if (event.type === 'customer.subscription.updated') {
        const prev = event.data.previous_attributes || {};
        if (prev.cancel_at_period_end === false && obj.cancel_at_period_end) {
          await repo.track(userId, 'subscription_cancel_scheduled', {});
        }
      }
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subId = invoiceSubscriptionId(obj);
      if (!subId) break; // one-off invoices aren't subscriptions
      const res = await syncSubscription(deps, subId, null);
      userId = res.userId;
      if (event.type === 'invoice.paid') {
        extra.amount = obj.amount_paid ?? null;
        extra.currency = obj.currency || null;
        if (userId) {
          const name = obj.billing_reason === 'subscription_create' ? 'subscription_started' : 'subscription_renewed';
          await repo.track(userId, name, { amount: obj.amount_paid, currency: obj.currency });
        }
      } else if (userId) {
        await repo.track(userId, 'subscription_payment_failed', { attempt: obj.attempt_count || 1 });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe doesn't retry them.
      break;
  }

  await repo.finishEvent(event.id, { user_id: userId, ...extra });
  return { status: 'processed', type: event.type, userId };
}

module.exports = { handleStripeEvent, subscriptionRow, invoiceSubscriptionId, syncSubscription };
