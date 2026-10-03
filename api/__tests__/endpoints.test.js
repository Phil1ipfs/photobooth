// Checkout / portal endpoint auth + behaviour (fake Stripe, Supabase and repo).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const path = require('node:path');

process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_monthly_test';
process.env.SITE_URL = 'https://photobooth.example';

const USER = { id: '22222222-2222-4222-8222-222222222222', email: 'tester@example.com' };
const state = { tier: 'free', customer: null, activeSub: null, stripeCalls: [], tracked: [] };

const fakeStripe = {
  customers: {
    create: async (params, opts) => {
      state.stripeCalls.push(['customers.create', params, opts]);
      return { id: 'cus_new' };
    },
  },
  checkout: {
    sessions: {
      create: async (params) => {
        state.stripeCalls.push(['checkout.sessions.create', params]);
        return { url: 'https://checkout.stripe.test/session' };
      },
    },
  },
  billingPortal: {
    sessions: {
      create: async (params) => {
        state.stripeCalls.push(['billingPortal.sessions.create', params]);
        return { url: 'https://billing.stripe.test/portal' };
      },
    },
  },
};

const fakeAdmin = {
  auth: {
    getUser: async (token) => (token === 'valid-token' ? { data: { user: USER }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } }),
  },
};

const mock = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const realClients = require('../_lib/clients');
mock('../_lib/clients.js', { ...realClients, getStripe: () => fakeStripe, getAdmin: () => fakeAdmin });
mock('../_lib/repo.js', {
  supabaseRepo: () => ({
    currentTier: async () => state.tier,
    getCustomerForUser: async () => state.customer,
    saveCustomer: async (uid, cid) => {
      state.customer = cid;
    },
    getActiveSubscription: async () => state.activeSub,
    track: async (uid, name, meta) => state.tracked.push({ uid, name, meta }),
  }),
});

const checkout = require('../billing/checkout');
const portal = require('../billing/portal');

function call(fn, { method = 'POST', token, body } = {}) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method;
  req.headers = { host: 'ignored.example', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const res = {
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
  return fn(req, res).then(() => ({ status: res.statusCode, json: JSON.parse(res.body || '{}') }));
}

test('checkout: only POST', async () => {
  assert.equal((await call(checkout, { method: 'GET' })).status, 405);
});

test('checkout: requires a valid session token', async () => {
  assert.equal((await call(checkout, { body: { planId: 'premium_monthly' } })).status, 401);
  assert.equal((await call(checkout, { token: 'forged', body: { planId: 'premium_monthly' } })).status, 401);
});

test('checkout: rejects unknown or unconfigured plans', async () => {
  const r = await call(checkout, { token: 'valid-token', body: { planId: 'premium_lifetime' } });
  assert.equal(r.status, 400);
  const yearly = await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly' } }); // no env price
  assert.equal(yearly.status, 400);
});

test('checkout: creates a customer + subscription session tied to the user', async () => {
  state.tier = 'free';
  state.customer = null;
  state.stripeCalls = [];
  const r = await call(checkout, { token: 'valid-token', body: { planId: 'premium_monthly' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.url, 'https://checkout.stripe.test/session');
  const [, custParams, custOpts] = state.stripeCalls.find((c) => c[0] === 'customers.create');
  assert.equal(custParams.metadata.user_id, USER.id);
  assert.equal(custOpts.idempotencyKey, `customer-${USER.id}`);
  const [, s] = state.stripeCalls.find((c) => c[0] === 'checkout.sessions.create');
  assert.equal(s.mode, 'subscription');
  assert.equal(s.customer, 'cus_new');
  assert.equal(s.client_reference_id, USER.id);
  assert.deepEqual(s.line_items, [{ price: 'price_monthly_test', quantity: 1 }]);
  assert.equal(s.subscription_data.metadata.user_id, USER.id);
  assert.ok(s.success_url.startsWith('https://photobooth.example/billing/success'));
  assert.equal(state.tracked.at(-1).name, 'checkout_started');
});

test('checkout: refuses users who already have Premium', async () => {
  state.tier = 'premium';
  const r = await call(checkout, { token: 'valid-token', body: { planId: 'premium_monthly' } });
  assert.equal(r.status, 409);
  state.tier = 'free';
});

test('portal: requires a billing account; cancel flow targets the active subscription', async () => {
  state.customer = null;
  assert.equal((await call(portal, { token: 'valid-token', body: {} })).status, 400);
  state.customer = 'cus_new';
  state.activeSub = { stripe_subscription_id: 'sub_9' };
  state.stripeCalls = [];
  const r = await call(portal, { token: 'valid-token', body: { flow: 'cancel' } });
  assert.equal(r.status, 200);
  const [, p] = state.stripeCalls[0];
  assert.equal(p.customer, 'cus_new');
  assert.equal(p.flow_data.type, 'subscription_cancel');
  assert.equal(p.flow_data.subscription_cancel.subscription, 'sub_9');
  assert.equal(p.return_url, 'https://photobooth.example/settings');
});

test('portal: unauthenticated callers are rejected', async () => {
  assert.equal((await call(portal, { body: {} })).status, 401);
});
