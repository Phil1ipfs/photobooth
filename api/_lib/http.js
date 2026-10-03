const { ConfigError, getAdmin } = require('./clients');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Read the untouched request body (webhook signatures are computed over raw bytes). */
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

/** Verify the caller's Supabase session token and return their auth user. */
async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in first.');
  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return data.user;
}

/** Wrap a handler: POST-only, JSON errors, never leak internals. */
function handler(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method not allowed.' });
    }
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      if (err instanceof ConfigError) return send(res, 503, { error: err.message });
      console.error('[billing]', err);
      return send(res, 500, { error: 'Something went wrong with billing. Please try again.' });
    }
  };
}

module.exports = { HttpError, send, readRawBody, readJson, requireUser, handler };
