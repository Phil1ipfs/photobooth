import React, { useState } from 'react';
import { GoogleIcon } from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PENDING_TERMS_KEY, TERMS_VERSION } from '../../config/legal';

/**
 * Google sign-in through Supabase OAuth. The provider must be
 * enabled in Supabase → Authentication → Providers; until then Supabase
 * returns an error and we show it as a toast.
 *
 * `consent` (Sign Up page): the Terms checkbox must be ticked first; the agreement
 * is then recorded right after Google signs the user in (see ConsentGate).
 */
export default function SocialButtons({ next = '/dashboard', consent }) {
  const { signInWithProvider } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const handle = (provider, label) => async () => {
    if (consent && !consent.given) {
      consent.onMissing?.();
      return;
    }
    try {
      if (consent) localStorage.setItem(PENDING_TERMS_KEY, TERMS_VERSION);
      else localStorage.removeItem(PENDING_TERMS_KEY);
    } catch {}
    setBusy(provider);
    try {
      await signInWithProvider(provider, next); // redirects away on success
    } catch (err) {
      toast.error(`${label} sign-in unavailable`, err.message);
      setBusy(null);
    }
  };

  return (
    <>
      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>
      <div className="social-btns">
        <button type="button" className="btn btn-outline btn-block social-btn" onClick={handle('google', 'Google')} disabled={!!busy}>
          {busy === 'google' ? <span className="btn-spinner" aria-hidden="true" /> : <GoogleIcon />}
          Continue with Google
        </button>
      </div>
    </>
  );
}
