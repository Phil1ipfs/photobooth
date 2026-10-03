// Database access for billing (service-role client → bypasses RLS; server only).
// Kept behind this small interface so the billing logic can be unit-tested with an
// in-memory implementation (api/__tests__/billing.test.js).
const { getAdmin } = require('./clients');

const raise = (error) => {
  if (error) throw new Error(error.message);
};

function supabaseRepo(db = getAdmin()) {
  return {
    /** Remember a checkout session we created for a user. */
    async saveCheckout({ userId, sessionId, reference, plan }) {
      const { error } = await db
        .from('checkout_sessions')
        .insert({ user_id: userId, provider: 'paymongo', session_id: sessionId, reference, plan });
      raise(error);
    },

    async getCheckoutByReference(userId, reference) {
      const { data, error } = await db
        .from('checkout_sessions')
        .select('user_id, session_id, reference, plan, status')
        .eq('user_id', userId)
        .eq('reference', reference)
        .maybeSingle();
      raise(error);
      return data;
    },

    async getCheckoutBySession(sessionId) {
      const { data, error } = await db
        .from('checkout_sessions')
        .select('user_id, session_id, reference, plan, status')
        .eq('session_id', sessionId)
        .maybeSingle();
      raise(error);
      return data;
    },

    /** Atomically grant/extend Premium for one paid PayMongo payment (idempotent). */
    async grantPass({ userId, paymentId, plan, days, amount, currency, sessionId }) {
      const { data, error } = await db.rpc('grant_premium_pass', {
        p_user: userId,
        p_payment_id: paymentId,
        p_plan: plan,
        p_days: days,
        p_amount: amount,
        p_currency: currency,
        p_session_id: sessionId || null,
      });
      raise(error);
      return data; // { granted, currentPeriodEnd }
    },

    async getActiveSubscription(userId) {
      const { data, error } = await db
        .from('subscriptions')
        .select('external_id, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      raise(error);
      return data;
    },

    async currentTier(userId) {
      const { data, error } = await db.rpc('current_tier', { uid: userId });
      raise(error);
      return data;
    },

    /** Server-side analytics (billing events can only be written here). */
    async track(userId, eventName, metadata = {}) {
      const { error } = await db.from('analytics_events').insert({ user_id: userId, event_name: eventName, metadata, path: '/api/billing' });
      if (error) console.warn('[analytics]', error.message); // never fail billing because of analytics
    },
  };
}

module.exports = { supabaseRepo };
