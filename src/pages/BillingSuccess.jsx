import React, { useEffect, useRef, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useRouter } from '../lib/router';
import { describePlan } from '../lib/entitlements';
import { confirmCheckout } from '../lib/billing';

const COPY = {
  checking: ['Confirming your payment…', 'Checking this checkout with PayMongo.'],
  unpaid: ['Payment not confirmed yet', 'PayMongo has not confirmed this checkout as paid yet.'],
  invalid: ['Checkout not found', 'This payment link is missing, invalid, or does not belong to your account.'],
  failed: ['Couldn’t verify this payment', 'Please contact support before attempting another payment.'],
  error: ['Unable to check your payment', 'The payment service is temporarily unavailable. You can check again.'],
  login: ['Sign in to verify your payment', 'Your session has expired. Sign in to continue checking this checkout.'],
  paid_pending: ['Payment confirmed', 'Your payment was verified. Your account details are still updating. Please check again before making another payment.'],
};

/** Success requires proof for this checkout AND the updated account expiry. */
export default function BillingSuccess() {
  const { user } = useAuth();
  const { refresh } = useEntitlements();
  const { search } = useRouter();
  const reference = new URLSearchParams(search).get('ref');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ state: 'checking', polling: true });

  useEffect(() => {
    let stopped = false;
    let retryTimer;
    let payment = null;
    let lastState = 'error';
    const controller = new AbortController();
    const finish = (state, ent) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(deadline);
      controller.abort();
      setView({ state, ent, polling: false });
    };
    const deadline = setTimeout(() => finish(payment ? 'paid_pending' : lastState), 30000);
    setView({ state: 'checking', polling: true });

    const poll = async () => {
      try {
        if (!payment) {
          const result = await confirmCheckout(reference, { signal: controller.signal });
          if (stopped) return;
          if (result.status === 'granted' || result.status === 'already_granted') {
            payment = result;
            setView({ state: 'paid_pending', polling: true });
          } else if (result.status === 'unpaid') {
            lastState = 'unpaid';
            setView({ state: 'unpaid', polling: true });
          } else {
            finish(result.status === 'unknown_session' ? 'invalid' : 'failed');
            return;
          }
        }
        if (payment) {
          const ent = await refreshRef.current();
          if (stopped) return;
          const expectedEnd = Date.parse(payment.currentPeriodEnd);
          const actualEnd = Date.parse(ent.currentPeriodEnd);
          if (ent.plan === 'admin' || (ent.plan === 'premium' && Number.isFinite(expectedEnd) && actualEnd >= expectedEnd)) {
            finish('active', ent);
            return;
          }
        }
      } catch (err) {
        if (stopped) return;
        if (err.status === 401) { finish('login'); return; }
        if (err.status === 400 || err.status === 404) { finish('invalid'); return; }
        if (err.status === 409) { finish('failed'); return; }
        lastState = 'error';
        setView({ state: payment ? 'paid_pending' : 'error', polling: true });
      }
      if (!stopped) retryTimer = setTimeout(poll, 2000);
    };

    if (!reference || !/^PB-[\w-]{6,40}$/.test(reference)) finish('invalid');
    else poll();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [reference, user?.id, attempt]);

  if (view.state === 'active') {
    return (
      <AuthLayout title="Your Premium is active" subtitle="Your payment has been confirmed for this checkout.">
        <div className="auth-success" role="status">
          <span className="auth-success-icon"><Icon name="sparkle" size={30} /></span>
          <p className="muted">{describePlan(view.ent).detail}</p>
          <Button size="lg" block iconRight="arrow-right" to="/booth" data-autofocus>Open the Photobooth</Button>
          <Button variant="ghost" block to="/templates">Browse Premium templates</Button>
        </div>
      </AuthLayout>
    );
  }

  const [title, subtitle] = COPY[view.state];
  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <div className="auth-success" role="status" aria-live="polite">
        {view.polling ? (
          <span className="route-loading" style={{ minHeight: 80 }}><span className="btn-spinner" /></span>
        ) : (
          <>
            {view.state === 'login' ? (
              <Button block to={`/login?reauth=1&next=${encodeURIComponent('/billing/success' + search)}`}>Sign in to continue</Button>
            ) : (
              <Button block onClick={() => setAttempt((n) => n + 1)} icon="refresh">Check again</Button>
            )}
            <Button variant="ghost" block to="/settings">View billing in Settings</Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
