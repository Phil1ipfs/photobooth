const { timingSafeEqual } = require('node:crypto');
const { ConfigError, env } = require('../_lib/clients');
const { send } = require('../_lib/http');
const { notificationRepo } = require('../_lib/notificationRepo');
const { notificationConfig, dispatchNotifications } = require('../_lib/notifications');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }
  const secret = env('ADMIN_NOTIFICATION_SECRET');
  if (secret.length < 32) return send(res, 503, { error: 'Email notifications are not configured.' });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.authorization || '');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return send(res, 401, { error: 'Unauthorized.' });
  }
  try {
    // No client payload is accepted; all events come from the private DB queue.
    const config = notificationConfig();
    const result = await dispatchNotifications({ repo: notificationRepo(), config });
    return send(res, 200, result);
  } catch (error) {
    if (error instanceof ConfigError) return send(res, 503, { error: 'Email notifications are not configured.' });
    console.error('[admin email] dispatch failed'); // Never log secrets or customer email bodies.
    return send(res, 500, { error: 'Email notification processing failed.' });
  }
};

module.exports.config = { maxDuration: 60 };
