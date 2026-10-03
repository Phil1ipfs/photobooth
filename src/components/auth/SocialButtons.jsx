import React, { useState } from 'react';
import { GoogleIcon } from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/**
 * Google sign-in through Supabase OAuth. The provider must be
 * enabled in Supabase → Authentication → Providers; until then Supabase
 * returns an error and we show it as a toast.
 */
export default function SocialButtons({ next = '/dashboard' }) {
  const { signInWithProvider } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const handle = (provider, label) => async () => {
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
