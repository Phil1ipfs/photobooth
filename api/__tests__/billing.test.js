// Run: npm run test:api   (node:test — no network, no real PayMongo/Supabase)
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySignature } = require('../_lib/paymongo');
const { fulfilCheckoutSession, handlePaymongoEvent, FulfilError } = require('../_lib/billing');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
const DAY = 864e5;

/** In-memory stand-in for api/_lib/repo.js (grantPass mirrors grant_premium_pass()). */
function memoryRepo() {
  const s = { checkouts: new Map(), payments: new Set(), ends: new Map(), grants: 0 };
  return {
    s,
    addCheckout(sessionId, userId = USER, plan = 'premium_monthly') {
      s.checkouts.set(sessionId, { user_id: userId, session_id: sessionId, reference: `PB-${sessionId}`, plan, status: 'open' });
    },
    async getCheckoutBySession(id) {
      return s.checkouts.get(id) || null;
    },
    async grantPass({ userId, paymentId, days, sessionId }) {
      if (s.payments.has(paymentId)) return { granted: false, currentPeriodEnd: s.ends.get(userId) };
      s.payments.add(paymentId);
      s.grants += 1;
      const from = Math.max(Date.now(), s.ends.get(userId) || 0);
      s.ends.set(userId, from + days * DAY);
      if (sessionId) s.checkouts.get(sessionId).status = 'paid';
      return { granted: true, currentPeriodEnd: new Date(s.ends.get(userId)).toISOString() };
    },
  };
}

const session = ({ id = 'cs_1', paid = true, amount = 9900, currency = 'PHP', livemode = true, userId = USER, payId = 'pay_1' } = {}) => ({
  id,
  type: 'checkout_session',
  attributes: {
    livemode,
    metadata: { user_id: userId, plan: 'premium_monthly' },
    payments: paid ? [{ id: payId, type: 'payment', attributes: { status: 'paid', amount, currency } }] : [],
  },
});

const fakePaymongo = (sessions, { livemode = true, failOnce = false } = {}) => {
  let fail = failOnce;
  return {
    livemode,
    getCheckoutSession: async (id) => {
      if (fail) {
        fail = false;
        throw new Error('PayMongo 503');
      }
      if (!sessions[id]) throw new Error('PayMongo 404');
      return structuredClone(sessions[id]);
    },
  };
};

const event = (type, sessionId = 'cs_1', livemode = true) => ({
  data: { id: 'evt_1', type: 'event', attributes: { type, livemode, data: { id: sessionId, type: 'checkout_session', attributes: {} } } },
});

// --- Signature verification ------------------------------------------------

const SECRET = 'whsk_test_secret';
const sign = (body, t = '1700000000', secret = SECRET) => crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');

test('signature: accepts valid live and test signatures', () => {
  const body = JSON.stringify(event('checkout_session.payment.paid'));
  assert.deepEqual(verifySignature(Buffer.from(body), `t=1700000000,te=,li=${sign(body)}`, SECRET), { valid: true, livemode: true });
  assert.deepEqual(verifySignature(body, `t=1700000000,te=${sign(body)},li=`, SECRET), { valid: true, livemode: false });
});

test('signature: rejects tampered bodies, wrong secrets and missing headers', () => {
  const body = '{"a":1}';
  const header = `t=1700000000,te=,li=${sign(body)}`;
  assert.equal(verifySignature('{"a":2}', header, SECRET).valid, false);
  assert.equal(verifySignature(body, header, 'other_secret').valid, false);
  assert.equal(verifySignature(body, `t=1700000001,te=,li=${sign(body)}`, SECRET).valid, false); // timestamp is signed
  assert.equal(verifySignature(body, undefined, SECRET).valid, false);
  assert.equal(verifySignature(body, 't=1,te=,li=', SECRET).valid, false);
});

test('signature: also accepts a bare hex HMAC of the body', () => {
  const body = '{"a":1}';
  const bare = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  assert.equal(verifySignature(body, bare, SECRET).valid, true);
  assert.equal(verifySignature(body, bare.replace(/.$/, '0'), SECRET).valid, bare.endsWith('0'));
});

// --- Fulfilment ---------------------------------------------------------------

test('fulfil: paid session grants 30 days once, even if confirmed twice', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const deps = { repo, paymongo: fakePaymongo({ cs_1: session() }) };
  const first = await fulfilCheckoutSession(deps, 'cs_1');
  assert.equal(first.status, 'granted');
  assert.equal(first.userId, USER);
  const end = new Date(first.currentPeriodEnd).getTime();
  assert.ok(Math.abs(end - (Date.now() + 30 * DAY)) < 5000);
  const second = await fulfilCheckoutSession(deps, 'cs_1', { expectedUserId: USER });
  assert.equal(second.status, 'already_granted');
  assert.equal(repo.s.grants, 1);
  assert.equal(repo.s.checkouts.get('cs_1').status, 'paid');
});

test('fulfil: a second purchase extends from the current end date', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  repo.addCheckout('cs_2');
  const deps = { repo, paymongo: fakePaymongo({ cs_1: session(), cs_2: session({ id: 'cs_2', payId: 'pay_2' }) }) };
  await fulfilCheckoutSession(deps, 'cs_1');
  const r = await fulfilCheckoutSession(deps, 'cs_2');
  assert.ok(Math.abs(new Date(r.currentPeriodEnd).getTime() - (Date.now() + 60 * DAY)) < 5000);
});

test('fulfil: unpaid and unknown sessions grant nothing', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const deps = { repo, paymongo: fakePaymongo({ cs_1: session({ paid: false }) }) };
  assert.equal((await fulfilCheckoutSession(deps, 'cs_1')).status, 'unpaid');
  assert.equal((await fulfilCheckoutSession(deps, 'cs_unknown')).status, 'unknown_session');
  assert.equal(repo.s.grants, 0);
});

test('fulfil: rejects wrong amount, currency, mode or user', async () => {
  const cases = [
    [session({ amount: 100 }), {}],
    [session({ currency: 'USD' }), {}],
    [session({ livemode: false }), {}],
    [session({ userId: OTHER }), {}],
    [session(), { expectedUserId: OTHER }],
  ];
  for (const [s, opts] of cases) {
    const repo = memoryRepo();
    repo.addCheckout('cs_1');
    await assert.rejects(fulfilCheckoutSession({ repo, paymongo: fakePaymongo({ cs_1: s }) }, 'cs_1', opts), FulfilError);
    assert.equal(repo.s.grants, 0);
  }
});

test('fulfil: pass-on fees (amount above the price) are accepted', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const r = await fulfilCheckoutSession({ repo, paymongo: fakePaymongo({ cs_1: session({ amount: 10150 }) }) }, 'cs_1');
  assert.equal(r.status, 'granted');
});

// --- Webhook events -----------------------------------------------------------

test('webhook event: checkout_session.payment.paid grants; other events are acknowledged', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const deps = { repo, paymongo: fakePaymongo({ cs_1: session() }) };
  assert.equal((await handlePaymongoEvent(event('payment.failed'), deps)).status, 'ignored');
  assert.equal((await handlePaymongoEvent(event('checkout_session.payment.paid'), deps)).status, 'granted');
  assert.equal((await handlePaymongoEvent(event('checkout_session.payment.paid'), deps)).status, 'already_granted');
  assert.equal(repo.s.grants, 1);
});

test('webhook event: test-mode events are ignored by a live key', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const r = await handlePaymongoEvent(event('checkout_session.payment.paid', 'cs_1', false), { repo, paymongo: fakePaymongo({ cs_1: session() }) });
  assert.equal(r.status, 'ignored');
  assert.equal(repo.s.grants, 0);
});

test('webhook event: transient errors throw (so PayMongo retries); mismatches do not', async () => {
  const repo = memoryRepo();
  repo.addCheckout('cs_1');
  const deps = { repo, paymongo: fakePaymongo({ cs_1: session() }, { failOnce: true }) };
  await assert.rejects(handlePaymongoEvent(event('checkout_session.payment.paid'), deps));
  assert.equal((await handlePaymongoEvent(event('checkout_session.payment.paid'), deps)).status, 'granted'); // retry succeeds

  const bad = memoryRepo();
  bad.addCheckout('cs_1');
  const r = await handlePaymongoEvent(event('checkout_session.payment.paid'), { repo: bad, paymongo: fakePaymongo({ cs_1: session({ amount: 1 }) }) });
  assert.equal(r.status, 'rejected');
});
