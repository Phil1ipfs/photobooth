const test = require('node:test');
const assert = require('node:assert/strict');
const { notificationConfig, composeNotification, sendNotification, dispatchNotifications, EmailError } = require('../_lib/notifications');

const config = { apiKey: 're_test_private', secret: 's'.repeat(64), from: 'PhotoBooth <onboarding@resend.dev>', to: 'johncasingal63@gmail.com' };
const instant = Date.parse('2026-11-02T08:00:00Z');
const signup = () => ({ id: 'job-1', event_key: 'signup/user-1', kind: 'signup', attempts: 0,
  status: 'pending', first_attempt_at: null, delivery: null,
  payload: { name: '<img src=x onerror=alert(1)>', email: 'person@example.test', occurredAt: new Date(instant).toISOString(), provider: 'google', emailVerified: true } });
const premium = (kind = 'premium_purchased') => ({ ...signup(), kind, event_key: 'premium/pay-1',
  payload: { ...signup().payload, amount: 9900, currency: 'PHP', plan: 'premium_monthly', expiresAt: '2026-12-02T08:00:00Z', paymentId: 'pay-1' } });

function memoryRepo(jobs, clock = () => instant) {
  return {
    jobs,
    async claim() {
      const j = jobs.find((x) => (x.status === 'pending' && (!x.available_at || new Date(x.available_at).getTime() <= clock()))
        || (x.status === 'processing' && new Date(x.lease_until).getTime() < clock()));
      if (!j) return null;
      j.status = 'processing'; j.attempts += 1;
      j.lease_token = `lease-${j.attempts}`; j.lease_until = new Date(clock() + 300000).toISOString();
      j.first_attempt_at ||= new Date(clock()).toISOString();
      return structuredClone(j);
    },
    async update(j, patch) {
      const stored = jobs.find((x) => x.id === j.id);
      assert.equal(stored.lease_token, j.lease_token);
      Object.assign(stored, structuredClone(patch));
    },
  };
}
const run = (repo, extra = {}) => dispatchNotifications({ repo, config, now: () => instant, pause: async () => {}, ...extra });

test('config defaults to the requested Gmail and never needs Gmail credentials', () => {
  const keys = ['RESEND_API_KEY', 'ADMIN_NOTIFICATION_SECRET', 'ADMIN_NOTIFICATION_FROM', 'ADMIN_NOTIFICATION_EMAIL'];
  const saved = keys.map((k) => process.env[k]);
  try {
    keys.forEach((k) => delete process.env[k]);
    assert.throws(notificationConfig, /server settings/);
    process.env.RESEND_API_KEY = config.apiKey; process.env.ADMIN_NOTIFICATION_SECRET = 'short';
    assert.throws(notificationConfig, /server settings/);
    process.env.ADMIN_NOTIFICATION_SECRET = config.secret;
    assert.deepEqual(notificationConfig(), config);
    process.env.ADMIN_NOTIFICATION_EMAIL = 'attacker@example.test\nvictim@example.test';
    assert.throws(notificationConfig, /Invalid notification/);
  } finally { keys.forEach((k, i) => saved[i] === undefined ? delete process.env[k] : process.env[k] = saved[i]); }
});

test('signup email escapes customer input and identifies verification status', () => {
  const message = composeNotification(signup(), config);
  assert.deepEqual(message.to, ['johncasingal63@gmail.com']);
  assert.equal(message.subject, 'PhotoBooth: New account signup');
  assert.ok(!message.html.includes('<img src=x'));
  assert.match(message.html, /&lt;img/);
  assert.match(message.text, /person@example.test/);
  assert.match(message.text, /Verified/);
  assert.match(message.text, /PHT/);
  const job = signup(); job.payload.emailVerified = false;
  assert.match(composeNotification(job, config).text, /Pending/);
});

test('purchase and renewal emails include the actual paid amount and expiry', () => {
  const message = composeNotification(premium(), config);
  assert.match(message.subject, /payment confirmed/);
  assert.match(message.text, /99\.00/);
  assert.match(message.text, /30-day pass/);
  assert.match(message.text, /Dec 2, 2026/);
  assert.match(message.text, /pay-1/);
  assert.match(composeNotification(premium('premium_renewed'), config).subject, /renewal confirmed/);
  const legacy = premium(); legacy.payload.plan = 'premium_yearly';
  assert.match(composeNotification(legacy, config).text, /legacy yearly/);
  const invalid = premium(); invalid.payload.amount = -9900;
  assert.throws(() => composeNotification(invalid, config), /Invalid payment/);
  assert.throws(() => composeNotification({ ...signup(), kind: 'unpaid' }, config), /Unsupported/);
});

test('Resend sends server-side with the event idempotency key', async () => {
  const message = composeNotification(signup(), config);
  const id = await sendNotification(message, 'signup/user-1', { ...config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer re_test_private');
    assert.equal(options.headers['Idempotency-Key'], 'photobooth-admin/signup/user-1');
    assert.deepEqual(JSON.parse(options.body), message);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  } });
  assert.equal(id, 'email-1');
});

test('Resend retries network/429/5xx failures but rejects permanent errors', async () => {
  for (const status of [400, 401, 403, 409, 422, 429, 500, 503]) {
    await assert.rejects(sendNotification({}, 'key', { ...config, fetchImpl: async () => new Response('private provider details', { status }) }),
      (error) => error instanceof EmailError && error.message === `email_http_${status}` && error.retryable === (status === 429 || status >= 500));
  }
  await assert.rejects(sendNotification({}, 'key', { ...config, fetchImpl: async () => { throw Error('secret network details'); } }),
    (error) => error.message === 'email_network_error' && error.retryable);
  await assert.rejects(sendNotification({}, 'key', { ...config, fetchImpl: async () => new Response('{}') }), /email_missing_id/);
  await assert.rejects(sendNotification({}, 'key', { ...config, fetchImpl: async () => new Response(JSON.stringify({ name: 'concurrent_idempotent_requests' }), { status: 409 }) }),
    (error) => error.message === 'email_http_409' && error.retryable);
});

test('worker freezes the email before sending, records acceptance, never resends sent rows', async () => {
  const job = signup(), repo = memoryRepo([job]); let sends = 0;
  const sendEmail = async (message) => { sends += 1; assert.deepEqual(job.delivery, message); return 'accepted-1'; };
  assert.deepEqual(await run(repo, { sendEmail }), { sent: 1, retry: 0, failed: 0, needsReview: 0 });
  assert.equal(job.status, 'sent'); assert.equal(job.provider_id, 'accepted-1'); assert.equal(job.lease_token, null);
  await run(repo, { sendEmail }); assert.equal(sends, 1);
});

test('worker retries a failed send with identical body even if configuration changes', async () => {
  let clock = instant;
  const job = premium(), repo = memoryRepo([job], () => clock), requests = [];
  const sendEmail = async (message, key) => { requests.push({ message, key }); if (requests.length === 1) throw new EmailError('email_network_error', true); return 'accepted'; };
  assert.equal((await run(repo, { sendEmail, now: () => clock })).retry, 1);
  assert.equal(job.status, 'pending'); assert.equal(job.last_error, 'email_network_error');
  clock += 120000;
  assert.equal((await run(repo, { sendEmail, now: () => clock, config: { ...config, to: 'changed@example.test' } })).sent, 1);
  assert.deepEqual(requests[0], requests[1]);
});

test('provider acceptance followed by DB failure leaves a lease for safe recovery', async () => {
  let clock = instant;
  const job = signup(), repo = memoryRepo([job], () => clock), update = repo.update, keys = [];
  repo.update = async (row, patch) => { if (patch.status === 'sent') throw Error('DB temporarily unavailable'); return update(row, patch); };
  const sendEmail = async (_message, key) => { keys.push(key); return 'accepted'; };
  await assert.rejects(run(repo, { sendEmail, now: () => clock }), /DB temporarily/);
  assert.equal(job.status, 'processing'); assert.ok(job.delivery);
  repo.update = update; clock += 301000;
  await run(repo, { sendEmail, now: () => clock });
  assert.deepEqual(keys, ['signup/user-1', 'signup/user-1']); assert.equal(job.status, 'sent');
});

test('worker quarantines expired idempotency attempts, invalid payloads and permanent failures', async () => {
  const stale = { ...signup(), id: 'stale', first_attempt_at: new Date(instant - 24 * 3600000).toISOString() };
  const invalid = { ...signup(), id: 'invalid', kind: 'unknown' };
  const forbidden = { ...signup(), id: 'forbidden' };
  const repo = memoryRepo([stale, invalid, forbidden]); let sends = 0;
  const result = await run(repo, { sendEmail: async () => { sends += 1; throw new EmailError('email_http_403', false); } });
  assert.deepEqual(result, { sent: 0, retry: 0, failed: 2, needsReview: 1 }); assert.equal(sends, 1);
  assert.equal(stale.status, 'needs_review'); assert.equal(invalid.status, 'failed'); assert.equal(forbidden.status, 'failed');
});

test('worker bounds a backlog to ten sends per invocation', async () => {
  const jobs = Array.from({ length: 12 }, (_, i) => ({ ...signup(), id: String(i), event_key: `signup/${i}` }));
  assert.equal((await run(memoryRepo(jobs), { sendEmail: async () => 'accepted' })).sent, 10);
  assert.equal(jobs.filter((j) => j.status === 'pending').length, 2);
});
