// Checkout / confirm / webhook endpoints (fake PayMongo, Supabase and repo).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const path = require('node:path');

process.env.SITE_URL = 'https://photobooth.example';
process.env.PAYMONGO_WEBHOOK_SECRET = 'whsk_test_endpoint';
delete process.env.PAYMONGO_PAYMENT_METHODS;

const USER = { id: '22222222-2222-4222-8222-222222222222', email: 'tester@example.com', user_metadata: { full_name: 'Tess Ter' } };
const OTHER = { id: '44444444-4444-4444-8444-444444444444', email: 'other@example.com', user_metadata: {} };
const state = { tier: 'free', activeSub: null, created: [], checkouts: [], grants: [], tracked: [], session: null };

const fakePaymongo = {
  livemode: true,
  createCheckoutSession: async (attrs) => {
    state.created.push(attrs);
    return { id: `cs_${state.created.length}`, attributes: { checkout_url: `https://checkout.paymongo.test/cs_${state.created.length}` } };
  },
  getCheckoutSession: async (id) => state.session(id),
};

const fakeAdmin = {
  auth: {
    getUser: async (token) =>
      token === 'valid-token'
        ? { data: { user: USER }, error: null }
        : token === 'other-token'
          ? { data: { user: OTHER }, error: null }
          : { data: { user: null }, error: { message: 'bad jwt' } },
  },
};

const mock = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const realClients = require('../_lib/clients');
mock('../_lib/clients.js', { ...realClients, getPaymongo: () => fakePaymongo, getAdmin: () => fakeAdmin });
mock('../_lib/repo.js', {
  supabaseRepo: () => ({
    currentTier: async () => state.tier,
    getActiveSubscription: async () => state.activeSub,
    saveCheckout: async (row) => state.checkouts.push({ ...row, user_id: row.userId, session_id: row.sessionId }),
    getCheckoutByReference: async (uid, ref) => state.checkouts.find((c) => c.user_id === uid && c.reference === ref) || null,
    getCheckoutBySession: async (id) => state.checkouts.find((c) => c.session_id === id) || null,
    grantPass: async (g) => {
      const dup = state.grants.some((x) => x.paymentId === g.paymentId);
      if (!dup) state.grants.push(g);
      return { granted: !dup, currentPeriodEnd: '2026-11-02T00:00:00.000Z' };
    },
    track: async (uid, name, meta) => state.tracked.push({ uid, name, meta }),
  }),
});

const checkout = require('../billing/checkout');
const confirm = require('../billing/confirm');
const webhook = require('../billing/webhook');

function call(fn, { method = 'POST', token, body, raw, headers = {} } = {}) {
  const bytes = raw ?? (body ? JSON.stringify(body) : '');
  const req = Readable.from(bytes ? [Buffer.from(bytes)] : []);
  req.method = method;
  req.headers = { host: 'ignored.example', ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) };
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

const paidSession = (id, userId = USER.id) => ({
  id,
  type: 'checkout_session',
  attributes: {
    livemode: true,
    metadata: { user_id: userId },
    payments: [{ id: `pay_${id}`, attributes: { status: 'paid', amount: 9900, currency: 'PHP' } }],
  },
});

// --- checkout ---------------------------------------------------------------

test('checkout: only POST', async () => {
  assert.equal((await call(checkout, { method: 'GET' })).status, 405);
});

test('checkout: requires a valid session token', async () => {
  assert.equal((await call(checkout, { body: { planId: 'premium_yearly' } })).status, 401);
  assert.equal((await call(checkout, { token: 'forged', body: { planId: 'premium_yearly' } })).status, 401);
});

test('checkout: rejects unknown plans (incl. prototype keys)', async () => {
  // premium_monthly is retired (no longer for sale)
  for (const planId of ['premium_lifetime', 'premium_monthly', 'toString', '__proto__', undefined]) {
    assert.equal((await call(checkout, { token: 'valid-token', body: { planId } })).status, 400, String(planId));
  }
});

test('checkout: creates a ₱99 PayMongo session tied to the user', async () => {
  state.created = [];
  const r = await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly', amount: 1 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.url, 'https://checkout.paymongo.test/cs_1');
  const s = state.created[0];
  assert.deepEqual(
    s.line_items.map(({ amount, currency, quantity }) => ({ amount, currency, quantity })),
    [{ amount: 9900, currency: 'PHP', quantity: 1 }] // the client can't change the price
  );
  assert.deepEqual(s.payment_method_types, ['card', 'gcash', 'paymaya']);
  assert.equal(s.metadata.user_id, USER.id);
  assert.equal(s.billing, undefined); // no personal data sent beyond what PayMongo asks for
  assert.match(s.reference_number, /^PB-[\w-]+$/);
  assert.equal(s.success_url, `https://photobooth.example/billing/success?ref=${s.reference_number}`);
  assert.equal(s.cancel_url, 'https://photobooth.example/pricing?checkout=cancelled');
  const saved = state.checkouts.at(-1);
  assert.equal(saved.session_id, 'cs_1');
  assert.equal(saved.user_id, USER.id);
  assert.equal(saved.reference, s.reference_number);
  assert.equal(state.tracked.at(-1).name, 'checkout_started');
});

test('checkout: payment methods are configurable', async () => {
  process.env.PAYMONGO_PAYMENT_METHODS = ' gcash, qrph ';
  await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly' } });
  assert.deepEqual(state.created.at(-1).payment_method_types, ['gcash', 'qrph']);
  delete process.env.PAYMONGO_PAYMENT_METHODS;
});

test('checkout: Premium users can renew in the last 30 days only; admins never pay', async () => {
  state.tier = 'premium';
  state.activeSub = { current_period_end: new Date(Date.now() + 20 * 864e5).toISOString() };
  assert.equal((await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly' } })).status, 200);
  state.activeSub = { current_period_end: new Date(Date.now() + 200 * 864e5).toISOString() };
  const early = await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly' } });
  assert.equal(early.status, 409);
  assert.match(early.json.error, /last 30 days/);
  state.activeSub = null;
  state.tier = 'admin';
  assert.equal((await call(checkout, { token: 'valid-token', body: { planId: 'premium_yearly' } })).status, 409);
  state.tier = 'free';
});

// --- confirm ----------------------------------------------------------------

test('confirm: validates input and ownership', async () => {
  assert.equal((await call(confirm, { body: { reference: 'PB-abcdefgh' } })).status, 401);
  assert.equal((await call(confirm, { token: 'valid-token', body: { reference: 'nope' } })).status, 400);
  assert.equal((await call(confirm, { token: 'valid-token', body: { reference: 'PB-doesnotexist' } })).status, 404);
  const ref = state.checkouts[0].reference;
  assert.equal((await call(confirm, { token: 'other-token', body: { reference: ref } })).status, 404); // not theirs
});

test('confirm: grants Premium for a paid session, idempotently', async () => {
  state.grants = [];
  const ref = state.checkouts[0].reference;
  state.session = () => ({ ...paidSession('cs_1'), attributes: { ...paidSession('cs_1').attributes, payments: [] } });
  assert.equal((await call(confirm, { token: 'valid-token', body: { reference: ref } })).json.status, 'unpaid');
  state.session = (id) => paidSession(id);
  const r = await call(confirm, { token: 'valid-token', body: { reference: ref } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'granted');
  assert.equal(state.grants[0].userId, USER.id);
  assert.equal(state.grants[0].days, 365);
  assert.equal((await call(confirm, { token: 'valid-token', body: { reference: ref } })).json.status, 'already_granted');
  assert.equal(state.grants.length, 1);
});

test('confirm: a session PayMongo says belongs to someone else is refused', async () => {
  state.session = (id) => paidSession(id, OTHER.id);
  const ref = state.checkouts[1].reference;
  assert.equal((await call(confirm, { token: 'valid-token', body: { reference: ref } })).status, 409);
});

// --- webhook ----------------------------------------------------------------

const signed = (payload, secret = process.env.PAYMONGO_WEBHOOK_SECRET) => {
  const raw = JSON.stringify(payload);
  const t = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return { raw, headers: { 'paymongo-signature': `t=${t},te=,li=${sig}` } };
};
const paidEvent = (sessionId) => ({
  data: { id: 'evt_9', attributes: { type: 'checkout_session.payment.paid', livemode: true, data: { id: sessionId, type: 'checkout_session' } } },
});

test('webhook: rejects missing or forged signatures without processing', async () => {
  state.grants = [];
  assert.equal((await call(webhook, { raw: JSON.stringify(paidEvent('cs_3')) })).status, 401);
  assert.equal((await call(webhook, signed(paidEvent('cs_3'), 'attacker-secret'))).status, 401);
  const { raw, headers } = signed(paidEvent('cs_3'));
  assert.equal((await call(webhook, { raw: raw.replace('cs_3', 'cs_2'), headers })).status, 401);
  assert.equal(state.grants.length, 0);
});

test('webhook: verified payment grants Premium; retries are harmless', async () => {
  state.session = (id) => paidSession(id);
  const r = await call(webhook, signed(paidEvent('cs_3')));
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'granted');
  assert.equal((await call(webhook, signed(paidEvent('cs_3')))).json.status, 'already_granted');
  assert.equal(state.grants.length, 1);
});

test('webhook: transient failures return 500 so PayMongo retries', async () => {
  state.session = () => {
    throw new Error('PayMongo 503');
  };
  assert.equal((await call(webhook, signed(paidEvent('cs_3')))).status, 500);
});

test('webhook: unknown events are acknowledged', async () => {
  const r = await call(webhook, signed({ data: { id: 'evt_x', attributes: { type: 'payment.refunded', livemode: true, data: { id: 'pay_1', type: 'payment' } } } }));
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ignored');
});
