import React, { useEffect, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import { useEntitlements } from '../context/EntitlementsContext';
import { describePlan } from '../lib/entitlements';
import { confirmCheckout } from '../lib/billing';

/**
 * PayMongo Checkout returns here with ?ref=PB-…. Premium is never granted by the
 * browser: we ask the server to re-check the payment with PayMongo (it grants
 * Premium if paid — the webhook does the same, whichever is first), then poll
 * the database until Premium shows up.
 */
export default function BillingSuccess() {
  const { refresh } = useEntitlements();
  const [state, setState] = useState('waiting'); // waiting | active | slow
  const [ent, setEnt] = useState(null);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    const reference = new URLSearchParams(window.location.search).get('ref');
    const poll = async () => {
      if (reference) {
        try {
          await confirmCheckout(reference);
        } catch {
          /* fall back to waiting for the webhook */
        }
        if (!alive) return;
      }
      const e = await refresh();
      if (!alive) return;
      if (e.plan === 'premium' || e.plan === 'admin') {
        setEnt(e);
        setState('active');
        return;
      }
      tries += 1;
      if (tries >= 15) setState('slow');
      else setTimeout(poll, 2000);
    };
    poll();
    return () => {
      alive = false;
    };
  }, [refresh]);

  if (state === 'active') {
    return (
      <AuthLayout title="Welcome to Premium!" subtitle="Every template, layout and finish is now yours.">
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            <Icon name="sparkle" size={30} />
          </span>
          <p className="muted">{describePlan(ent).detail}</p>
          <Button size="lg" block iconRight="arrow-right" to="/booth" data-autofocus>
            Open the Photobooth
          </Button>
          <Button variant="ghost" block to="/templates">
            Browse Premium templates
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={state === 'slow' ? 'Almost there…' : 'Confirming your payment…'}
      subtitle={state === 'slow' ? 'Your payment went through — we’re still activating Premium.' : 'This only takes a few seconds.'}
    >
      <div className="auth-success" role="status" aria-live="polite">
        {state === 'waiting' ? (
          <span className="route-loading" style={{ minHeight: 80 }}>
            <span className="btn-spinner" />
          </span>
        ) : (
          <>
            <p className="muted">
              Activation usually takes a few seconds but can occasionally take a minute. You’ll get Premium
              automatically — no need to pay again.
            </p>
            <Button block onClick={() => window.location.reload()} icon="refresh">
              Check again
            </Button>
            <Button variant="ghost" block to="/settings">
              View billing in Settings
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
