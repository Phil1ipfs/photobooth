import React from 'react';
import { GoogleIcon, FacebookIcon } from '../common/Icon';
import { useToast } from '../../context/ToastContext';

/**
 * Social sign-in buttons. The app has no OAuth provider configured yet, so
 * these explain that instead of pretending to sign in. Wire `onProvider` to a
 * hosted auth SDK (Firebase, Supabase, Auth0…) to enable them.
 */
export default function SocialButtons({ onProvider }) {
  const toast = useToast();
  const handle = (provider) => () => {
    if (onProvider) onProvider(provider);
    else
      toast.info(
        `${provider} sign-in isn’t set up yet`,
        'Social login needs a hosted auth provider. Please continue with email for now.'
      );
  };
  return (
    <>
      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>
      <div className="social-btns">
        <button type="button" className="btn btn-outline btn-block social-btn" onClick={handle('Google')}>
          <GoogleIcon />
          Continue with Google
        </button>
        <button type="button" className="btn btn-outline btn-block social-btn" onClick={handle('Facebook')}>
          <FacebookIcon />
          Continue with Facebook
        </button>
      </div>
    </>
  );
}
