// Minimal PayMongo REST client (no SDK) + webhook signature verification.
// Docs: https://docs.paymongo.com — auth is HTTP Basic with the secret key as the
// username and an empty password.
const crypto = require('node:crypto');

const API = 'https://api.paymongo.com';

class PaymongoError extends Error {
  constructor(status, errors) {
    // PayMongo's error details are for our logs only — never shown to customers.
    super(`PayMongo ${status}: ${(errors || []).map((e) => `${e.code || ''} ${e.detail || ''}`.trim()).join('; ') || 'request failed'}`);
    this.status = status;
    this.errors = errors || [];
  }
}

function createPaymongo(secretKey, { fetchImpl = globalThis.fetch } = {}) {
  const auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  async function request(method, path, attributes) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: attributes ? JSON.stringify({ data: { attributes } }) : undefined,
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      /* empty / non-JSON body */
    }
    if (!res.ok) throw new PaymongoError(res.status, json.errors);
    return json.data;
  }

  return {
    key: secretKey,
    livemode: secretKey.startsWith('sk_live_'),
    createCheckoutSession: (attributes) => request('POST', '/v1/checkout_sessions', attributes),
    getCheckoutSession: (id) => request('GET', `/v1/checkout_sessions/${encodeURIComponent(id)}`),
  };
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Verify a `Paymongo-Signature` header against the raw request body.
 * Header format: `t=<unix>,te=<test sig>,li=<live sig>` where each signature is
 * hex HMAC-SHA256(secret, `${t}.${rawBody}`). A bare hex HMAC of the body is also
 * accepted (newer docs show that form).
 * Returns { valid, livemode } — livemode is null when it can't be told from the header.
 */
function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return { valid: false, livemode: null };
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const hmac = (payload) => crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  const parts = Object.fromEntries(
    String(header)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((kv) => kv.length === 2)
  );
  if (parts.t) {
    const expected = hmac(`${parts.t}.${body}`);
    if (safeEqual(expected, parts.li)) return { valid: true, livemode: true };
    if (safeEqual(expected, parts.te)) return { valid: true, livemode: false };
    return { valid: false, livemode: null };
  }
  return { valid: safeEqual(hmac(body), String(header).trim()), livemode: null };
}

module.exports = { createPaymongo, verifySignature, PaymongoError };
