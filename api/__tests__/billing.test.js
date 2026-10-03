// Run: npm run test:api   (node:test — no network, no real Stripe/Supabase)
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const path = require('node:path');
const Stripe = require('stripe');

process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_monthly_test';
const { handleStripeEvent, subscriptionRow } = require('../_lib/billing');

const NOW = 1_800_000_000; // unix seconds
const USER = '11111111-1111-4111-8111-111111111111';

/** In-memory stand-in for api/_lib/repo.js */
function memoryRepo({ failUpsertOnce = false } = {}) {
  const s = { events: new Map(), customers: new Map(), subs: new Map(), analytics: [] };
  let fail = failUpsertOnce;
  return {
    s,
    async claimEvent(id, type) {
      if (!s.events.has(id)) {
        s.events.set(id, { type, processed_at: null });
        return 'new';
      }
      return s.events.get(id).processed_at ? 'processed' : 'retry';
    },
    async finishEvent(id, patch) {
      Object.assign(s.events.get(id), patch, { processed_at: new Date().toISOString() });
    },
    async getCustomerForUser(uid) {
      return [...s.customers].find(([, u]) => u === uid)?.[0] || null;
    },
    async getUserForCustomer(cid) {
      return s.customers.get(cid) || null;
    },
    async saveCustomer(uid, cid) {
      if (![...s.customers.values()].includes(uid)) s.customers.set(cid, uid);
    },
    async upsertSubscription(row) {
      if (fail) {
        fail = false;
        throw new Error('db temporarily unavailable');
      }
      s.subs.set(row.stripe_subscription_id, { ...row });
    },
    async track(uid, name, meta) {
      s.analytics.push({ uid, name, meta });
    },
  };
}

/** Fake Stripe client: subscriptions.retrieve returns the current stored state. */
function fakeStripe(subs) {
  return { subscriptions: { retrieve: async (id) => structuredClone(subs[id]) } };
}

const baseSub = (over = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  canceled_at: null,
  ended_at: null,
  metadata: { user_id: USER, plan: 'premium_monthly' },
  items: { data: [{ price: { id: 'price_monthly_test' }, current_period_start: NOW, current_period_end: NOW + 30 * 86400 }] },
  ...over,
});

const ev = (id, type, object, extra = {}) => ({ id, type, data: { object, ...extra } });

test('checkout.session.completed activates Premium and links the customer', async () => {
  const repo = memoryRepo();
  const stripe = fakeStripe({ sub_1: baseSub() });
  const r = await handleStripeEvent(
    ev('evt_1', 'checkout.session.completed', {
      mode: 'subscription',
      subscription: 'sub_1',
      customer: 'cus_1',
      client_reference_id: USER,
      metadata: { user_id: USER, plan: 'premium_monthly' },
    }),
    { stripe, repo }
  );
  assert.equal(r.status, 'processed');
  const row = repo.s.subs.get('sub_1');
  assert.equal(row.user_id, USER);
  assert.equal(row.status, 'active');
  assert.equal(row.tier, 'premium');
  assert.equal(row.plan, 'premium_monthly');
  assert.equal(row.current_period_end, new Date((NOW + 30 * 86400) * 1000).toISOString()); // 2025 API: period on item
  assert.equal(repo.s.customers.get('cus_1'), USER);
  assert.deepEqual(repo.s.analytics.map((a) => a.name), ['checkout_completed']);
});

test('the same event delivered twice is processed once (idempotent)', async () => {
  const repo = memoryRepo();
  const stripe = fakeStripe({ sub_1: baseSub() });
  const event = ev('evt_dup', 'checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: USER, metadata: {} });
  await handleStripeEvent(event, { stripe, repo });
  const second = await handleStripeEvent(event, { stripe, repo });
  assert.equal(second.status, 'duplicate');
  assert.equal(repo.s.subs.size, 1);
  assert.equal(repo.s.analytics.length, 1);
});

test('a failed attempt is retried and completes (no lost events)', async () => {
  const repo = memoryRepo({ failUpsertOnce: true });
  const stripe = fakeStripe({ sub_1: baseSub() });
  const event = ev('evt_retry', 'customer.subscription.created', baseSub());
  await assert.rejects(handleStripeEvent(event, { stripe, repo }));
  assert.equal(repo.s.events.get('evt_retry').processed_at, null);
  const r = await handleStripeEvent(event, { stripe, repo });
  assert.equal(r.status, 'processed');
  assert.equal(repo.s.subs.get('sub_1').status, 'active');
});

test('invoice.paid records revenue and started / renewed events', async () => {
  const repo = memoryRepo();
  const stripe = fakeStripe({ sub_1: baseSub() });
  // 2025 API shape: invoice.parent.subscription_details.subscription
  await handleStripeEvent(
    ev('evt_inv1', 'invoice.paid', { amount_paid: 9900, currency: 'php', billing_reason: 'subscription_create', parent: { subscription_details: { subscription: 'sub_1' } } }),
    { stripe, repo }
  );
  // legacy shape: invoice.subscription
  await handleStripeEvent(ev('evt_inv2', 'invoice.paid', { amount_paid: 9900, currency: 'php', billing_reason: 'subscription_cycle', subscription: 'sub_1' }), { stripe, repo });
  assert.equal(repo.s.events.get('evt_inv1').amount, 9900);
  assert.equal(repo.s.events.get('evt_inv1').currency, 'php');
  assert.equal(repo.s.events.get('evt_inv1').user_id, USER);
  assert.deepEqual(repo.s.analytics.map((a) => a.name), ['subscription_started', 'subscription_renewed']);
});

test('cancellation at period end keeps Premium until the period ends, then deletion ends it', async () => {
  const subs = { sub_1: baseSub() };
  const repo = memoryRepo();
  const stripe = fakeStripe(subs);
  subs.sub_1 = baseSub({ cancel_at_period_end: true });
  await handleStripeEvent(
    ev('evt_upd', 'customer.subscription.updated', subs.sub_1, { previous_attributes: { cancel_at_period_end: false } }),
    { stripe, repo }
  );
  let row = repo.s.subs.get('sub_1');
  assert.equal(row.status, 'active'); // still Premium until current_period_end
  assert.equal(row.cancel_at_period_end, true);
  assert.equal(repo.s.analytics.at(-1).name, 'subscription_cancel_scheduled');

  subs.sub_1 = baseSub({ status: 'canceled', ended_at: NOW + 30 * 86400, canceled_at: NOW });
  await handleStripeEvent(ev('evt_del', 'customer.subscription.deleted', subs.sub_1), { stripe, repo });
  row = repo.s.subs.get('sub_1');
  assert.equal(row.status, 'canceled');
  assert.ok(row.ended_at);
  assert.equal(repo.s.analytics.at(-1).name, 'subscription_cancelled');
});

test('payment failure marks the subscription past_due and is tracked', async () => {
  const subs = { sub_1: baseSub({ status: 'past_due' }) };
  const repo = memoryRepo();
  await handleStripeEvent(ev('evt_fail', 'invoice.payment_failed', { subscription: 'sub_1', attempt_count: 2 }), { stripe: fakeStripe(subs), repo });
  assert.equal(repo.s.subs.get('sub_1').status, 'past_due');
  assert.deepEqual(repo.s.analytics.at(-1), { uid: USER, name: 'subscription_payment_failed', meta: { attempt: 2 } });
});

test('out-of-order events converge to Stripe’s current state', async () => {
  // An old "created" event arrives after the subscription was already cancelled.
  const subs = { sub_1: baseSub({ status: 'canceled' }) };
  const repo = memoryRepo();
  await handleStripeEvent(ev('evt_old', 'customer.subscription.created', baseSub({ status: 'active' })), { stripe: fakeStripe(subs), repo });
  assert.equal(repo.s.subs.get('sub_1').status, 'canceled');
});

test('user is resolved from the Stripe customer when metadata is missing', async () => {
  const repo = memoryRepo();
  repo.s.customers.set('cus_1', USER);
  const sub = baseSub({ metadata: {} });
  await handleStripeEvent(ev('evt_cus', 'customer.subscription.updated', sub, { previous_attributes: {} }), { stripe: fakeStripe({ sub_1: sub }), repo });
  assert.equal(repo.s.subs.get('sub_1').user_id, USER);
});

test('unknown prices never grant Premium', () => {
  const row = subscriptionRow(baseSub({ items: { data: [{ price: { id: 'price_other_product' }, current_period_end: NOW }] } }), USER);
  assert.equal(row.tier, 'none');
});

test('unrelated events are acknowledged without touching subscriptions', async () => {
  const repo = memoryRepo();
  const r = await handleStripeEvent(ev('evt_x', 'customer.created', { id: 'cus_9' }), { stripe: fakeStripe({}), repo });
  assert.equal(r.status, 'processed');
  assert.equal(repo.s.subs.size, 0);
});

// ---- Webhook endpoint: signature verification (real Stripe SDK, fake repo) ----
function mockReq(body, headers) {
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.headers = headers;
  return req;
}
function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(b) {
      this.body = b;
    },
  };
}

test('webhook endpoint rejects bad signatures and accepts valid ones', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  // Swap the Supabase repo for the in-memory one.
  const repo = memoryRepo();
  const repoPath = require.resolve(path.join(__dirname, '../_lib/repo.js'));
  require.cache[repoPath] = { id: repoPath, filename: repoPath, loaded: true, exports: { supabaseRepo: () => repo } };
  const webhook = require('../billing/webhook');

  const payload = JSON.stringify(ev('evt_sig', 'customer.created', { id: 'cus_2' }));
  const stripe = new Stripe('sk_test_dummy');

  // Tampered signature
  let res = mockRes();
  await webhook(mockReq(payload, { 'stripe-signature': 't=1,v1=deadbeef' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(repo.s.events.size, 0); // nothing processed

  // Valid signature, but body altered after signing
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
  res = mockRes();
  await webhook(mockReq(payload.replace('cus_2', 'cus_666'), { 'stripe-signature': header }), res);
  assert.equal(res.statusCode, 400);

  // Valid
  res = mockRes();
  await webhook(mockReq(payload, { 'stripe-signature': header }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, 'processed');
  assert.ok(repo.s.events.get('evt_sig').processed_at);
});
