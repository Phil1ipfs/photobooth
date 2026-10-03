// Privacy-conscious product analytics → public.analytics_events (insert-only RLS).
//
// • No cookies, no third parties, no fingerprinting. A random UUID identifies the
//   browser (anonymous_id) and a random UUID identifies the visit (session_id,
//   rotates after 30 min of inactivity).
// • Signed-in users' events carry their user id (enforced by RLS: only their own).
// • Never sends names, emails, passwords, payment data or photo contents — only
//   event names, the page path and small whitelisted metadata (e.g. template id).
// • Respects Do Not Track / Global Privacy Control and an in-app opt-out.
import { isSupabaseConfigured, supabase } from './supabase';

const AID_KEY = 'pb:aid';
const SESSION_KEY = 'pb:session';
const OPTOUT_KEY = 'pb:analytics-optout';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 4000;

const URL = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

let queue = [];
let timer = null;
let userId = null;
let accessToken = null;

const uuid = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function analyticsAllowed() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return false;
  return safe(() => localStorage.getItem(OPTOUT_KEY) !== '1', true);
}

export function setAnalyticsEnabled(enabled) {
  safe(() => (enabled ? localStorage.removeItem(OPTOUT_KEY) : localStorage.setItem(OPTOUT_KEY, '1')));
  if (!enabled) queue = [];
}

export const isAnalyticsEnabled = () => safe(() => localStorage.getItem(OPTOUT_KEY) !== '1', true);

function anonymousId() {
  return safe(() => {
    let id = localStorage.getItem(AID_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(AID_KEY, id);
    }
    return id;
  }, null);
}

function sessionId() {
  return safe(() => {
    const now = Date.now();
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const id = s && now - s.last < SESSION_IDLE_MS ? s.id : uuid();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    return id;
  }, null);
}

/** Keep only small primitive values — no free text, no PII. */
function clean(meta) {
  const out = {};
  Object.entries(meta || {}).forEach(([k, v]) => {
    if (Object.keys(out).length >= 10) return;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 60);
  });
  return out;
}

/** Called by AuthContext whenever the session changes. */
export function setAnalyticsUser(id, token) {
  userId = id || null;
  accessToken = token || null;
}

async function send(events, { keepalive = false } = {}) {
  if (!events.length) return;
  let token = accessToken;
  if (!keepalive && userId) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || null;
  }
  // Events tagged with a user id must be sent with that user's token (RLS).
  const rows = events.map((e) => (token ? e : { ...e, user_id: null }));
  try {
    await fetch(`${URL}/rest/v1/analytics_events`, {
      method: 'POST',
      keepalive,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token || KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    /* analytics must never break the app */
  }
}

export function flush(opts) {
  if (timer) clearTimeout(timer);
  timer = null;
  const batch = queue;
  queue = [];
  return send(batch, opts);
}

/** Record an event. Safe to call anywhere; no-ops when analytics is off. */
export function track(eventName, metadata) {
  if (!analyticsAllowed()) return;
  queue.push({
    event_name: eventName,
    user_id: userId,
    anonymous_id: anonymousId(),
    session_id: sessionId(),
    path: window.location.pathname.slice(0, 200),
    metadata: clean(metadata),
  });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

if (typeof window !== 'undefined') {
  // Deliver anything pending when the tab is hidden or closed.
  const onHide = () => queue.length && flush({ keepalive: true });
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && onHide());
}
