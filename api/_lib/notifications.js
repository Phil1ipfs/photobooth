// Server only. Customer data and email credentials never enter the React bundle.
const { ConfigError, env } = require('./clients');

function notificationConfig() {
  const apiKey = env('RESEND_API_KEY');
  const secret = env('ADMIN_NOTIFICATION_SECRET');
  const from = env('ADMIN_NOTIFICATION_FROM') || 'PhotoBooth <onboarding@resend.dev>';
  const to = env('ADMIN_NOTIFICATION_EMAIL') || 'johncasingal63@gmail.com';
  if (!apiKey || secret.length < 32) throw new ConfigError('Email notifications need their server settings.');
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to) || /[\r\n]/.test(from)) {
    throw new ConfigError('Invalid notification email settings.');
  }
  return { apiKey, secret, from, to };
}

const clean = (value) => String(value ?? '').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 500);
const escapeHtml = (value) => clean(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (value) => {
  const d = new Date(value);
  if (!value || !Number.isFinite(d.getTime())) throw new Error('Invalid notification date.');
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(d) + ' PHT';
};

function composeNotification(job, { from, to }) {
  const p = job.payload || {};
  const title = { signup: 'New account signup', premium_purchased: 'Premium payment confirmed', premium_renewed: 'Premium renewal confirmed' }[job.kind];
  if (!title) throw new Error('Unsupported notification type.');
  const rows = [['Name', clean(p.name) || 'Not provided'], ['Email', clean(p.email) || 'Not provided'], ['Date', date(p.occurredAt)]];
  if (job.kind === 'signup') {
    rows.push(['Sign-in method', clean(p.provider)], ['Email verification at signup', p.emailVerified ? 'Verified' : 'Pending']);
  } else {
    if (!Number.isSafeInteger(p.amount) || p.amount <= 0 || p.currency !== 'PHP') throw new Error('Invalid payment notification.');
    rows.push(['Amount paid', new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(p.amount / 100)],
      ['Plan', p.plan === 'premium_yearly' ? 'Premium - legacy yearly pass' : 'Premium - 30-day pass'],
      ['Premium expires', date(p.expiresAt)], ['Payment reference', clean(p.paymentId)]);
  }
  const text = `${title}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nPhotoBooth admin notification`;
  const html = `<div style="font-family:Arial,sans-serif;color:#351d24;max-width:560px;padding:24px;border:1px solid #ebdde0;border-radius:16px"><p style="color:#8f1838">PhotoBooth</p><h1 style="font-size:22px">${title}</h1><table style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><th style="text-align:left;padding:10px 12px 10px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px 0;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table><p style="font-size:12px;color:#806b70">PhotoBooth admin notification</p></div>`;
  return { from, to: [to], subject: `PhotoBooth: ${title}`, text, html };
}

class EmailError extends Error {
  constructor(code, retryable) { super(code); this.retryable = retryable; }
}

async function sendNotification(message, eventKey, { apiKey, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `photobooth-admin/${eventKey}` },
      body: JSON.stringify(message), signal: AbortSignal.timeout(5000),
    });
  } catch { throw new EmailError('email_network_error', true); }
  if (!response.ok) {
    let concurrent = false;
    if (response.status === 409) {
      try { concurrent = (await response.json()).name === 'concurrent_idempotent_requests'; } catch { /* Not a known retryable conflict. */ }
    }
    throw new EmailError(`email_http_${response.status}`, concurrent || response.status === 429 || response.status >= 500);
  }
  let result;
  try { result = await response.json(); } catch { throw new EmailError('email_invalid_response', true); }
  if (typeof result?.id !== 'string' || !result.id) throw new EmailError('email_missing_id', true);
  return result.id;
}

async function dispatchNotifications({ repo, config, sendEmail = sendNotification, now = Date.now, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const started = now();
  const counts = { sent: 0, retry: 0, failed: 0, needsReview: 0 };
  // Bound each invocation; a minute-by-minute scheduler drains any backlog.
  for (let i = 0; i < 10 && now() - started < 18000; i += 1) {
    const job = await repo.claim();
    if (!job) break;
    const release = { lease_until: null, lease_token: null };
    // Resend's deduplication expires after 24h. Ambiguous older attempts need
    // manual reconciliation instead of risking a second email.
    if (now() - new Date(job.first_attempt_at).getTime() >= 23 * 3600000) {
      await repo.update(job, { ...release, status: 'needs_review', last_error: 'idempotency_window_expired' });
      counts.needsReview += 1;
      continue;
    }
    let message;
    try { message = job.delivery || composeNotification(job, config); }
    catch {
      await repo.update(job, { ...release, status: 'failed', last_error: 'invalid_notification_payload' });
      counts.failed += 1;
      continue;
    }
    // Save before contacting the provider. Retries keep the same exact body.
    if (!job.delivery) await repo.update(job, { delivery: message });
    let providerId;
    try { providerId = await sendEmail(message, job.event_key, config); }
    catch (error) {
      const retryable = !(error instanceof EmailError) || error.retryable;
      const delay = Math.min(900, 30 * 2 ** Math.min(job.attempts, 5));
      await repo.update(job, { ...release, status: retryable ? 'pending' : 'failed',
        available_at: new Date(now() + delay * 1000).toISOString(),
        last_error: error instanceof EmailError ? error.message : 'email_send_error' });
      counts[retryable ? 'retry' : 'failed'] += 1;
      await pause(600);
      continue;
    }
    // If this write fails, keep the lease and retry with the SAME provider key.
    await repo.update(job, { ...release, status: 'sent', provider_id: providerId, sent_at: new Date(now()).toISOString(), last_error: null });
    counts.sent += 1;
    await pause(600); // Stay below the provider's default 2 requests/second.
  }
  return counts;
}

module.exports = { notificationConfig, composeNotification, sendNotification, dispatchNotifications, EmailError };
