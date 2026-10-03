// Database access for billing (service-role client → bypasses RLS; server only).
// Kept behind this small interface so the webhook logic can be unit-tested with an
// in-memory implementation (api/__tests__/billing.test.js).
const { getAdmin } = require('./clients');

const raise = (error) => {
  if (error) throw new Error(error.message);
};

function supabaseRepo(db = getAdmin()) {
  return {
    /** Claim a Stripe event id. Returns 'new' | 'processed' | 'retry'. */
    async claimEvent(eventId, eventType) {
      const { data, error } = await db
        .from('billing_events')
        .upsert({ stripe_event_id: eventId, event_type: eventType }, { onConflict: 'stripe_event_id', ignoreDuplicates: true })
        .select('id');
      raise(error);
      if (data && data.length) return 'new';
      const { data: row, error: e2 } = await db.from('billing_events').select('processed_at').eq('stripe_event_id', eventId).maybeSingle();
      raise(e2);
      return row?.processed_at ? 'processed' : 'retry';
    },

    async finishEvent(eventId, patch) {
      const { error } = await db
        .from('billing_events')
        .update({ ...patch, processed_at: new Date().toISOString() })
        .eq('stripe_event_id', eventId);
      raise(error);
    },

    async getCustomerForUser(userId) {
      const { data, error } = await db.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
      raise(error);
      return data?.stripe_customer_id || null;
    },

    async getUserForCustomer(customerId) {
      const { data, error } = await db.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
      raise(error);
      return data?.user_id || null;
    },

    async saveCustomer(userId, customerId) {
      const { error } = await db
        .from('billing_customers')
        .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id', ignoreDuplicates: true });
      raise(error);
    },

    async upsertSubscription(row) {
      const { error } = await db
        .from('subscriptions')
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'stripe_subscription_id' });
      raise(error);
    },

    async getActiveSubscription(userId) {
      const { data, error } = await db
        .from('subscriptions')
        .select('stripe_subscription_id, status, current_period_end, cancel_at_period_end')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due'])
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
