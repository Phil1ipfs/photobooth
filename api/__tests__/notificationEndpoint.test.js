const test = require('node:test');
const assert = require('node:assert/strict');

const real = require('../_lib/notifications');
let processed = 0, failure = false;
const repoPath = require.resolve('../_lib/notificationRepo');
require.cache[repoPath] = { id: repoPath, filename: repoPath, loaded: true, exports: { notificationRepo: () => ({}) } };
const workerPath = require.resolve('../_lib/notifications');
require.cache[workerPath].exports = { ...real, dispatchNotifications: async () => {
  processed += 1;
  if (failure) throw Error('private customer information');
  return { sent: 1, retry: 0, failed: 0, needsReview: 0 };
} };
const endpoint = require('../notifications/dispatch');
const secret = 'notification-test-secret-'.repeat(3);

async function call({ method = 'POST', token, body = {} } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.body = JSON.parse(value); } };
  await endpoint(req, res);
  return res;
}

test('notification endpoint refuses methods, missing config and forged secrets before claiming', async () => {
  delete process.env.ADMIN_NOTIFICATION_SECRET;
  assert.equal((await call({ method: 'GET' })).statusCode, 405);
  assert.equal((await call()).statusCode, 503);
  process.env.ADMIN_NOTIFICATION_SECRET = secret;
  assert.equal((await call()).statusCode, 401);
  assert.equal((await call({ token: 'wrong' })).statusCode, 401);
  assert.equal((await call({ token: secret.slice(0, -1) + 'x' })).statusCode, 401);
  assert.equal(processed, 0);
});

test('notification endpoint refuses missing email credentials without processing', async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await call({ token: secret })).statusCode, 503);
  assert.equal(processed, 0);
});

test('notification endpoint returns counts only; client cannot choose email body or recipient', async () => {
  process.env.RESEND_API_KEY = 're_test';
  const res = await call({ token: secret, body: { to: 'attacker@example.test', kind: 'signup', payload: { email: 'forged' } } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 1, retry: 0, failed: 0, needsReview: 0 });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('notification endpoint sanitizes database errors', async () => {
  failure = true;
  const res = await call({ token: secret });
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('private customer information'));
});
