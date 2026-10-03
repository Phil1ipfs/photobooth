import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import TermsCheckbox from './TermsCheckbox';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PENDING_TERMS_KEY, TERMS_VERSION } from '../../config/legal';

const readPending = () => {
  try {
    return localStorage.getItem(PENDING_TERMS_KEY);
  } catch {
    return null;
  }
};
const clearPending = () => {
  try {
    localStorage.removeItem(PENDING_TERMS_KEY);
  } catch {}
};

/**
 * Every signed-in account must have agreed to the current Terms & Privacy Policy.
 * Covers Google sign-ins and accounts created before consent was recorded:
 *  • ticked on Sign Up, then continued with Google → recorded automatically;
 *  • otherwise → a prompt that can't be dismissed (agree, or log out).
 */
export default function ConsentGate() {
  const { user, ready, acceptTerms, logOut } = useAuth();
  const toast = useToast();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Agreement ticked on Sign Up before Google: 'saving' → recorded, or 'failed' → prompt.
  const [auto, setAuto] = useState('idle');

  // termsVersion undefined = profile couldn't be loaded → don't nag on a hiccup.
  const needsConsent = ready && !!user && user.termsVersion !== undefined && user.termsVersion !== TERMS_VERSION;

  useEffect(() => {
    if (!needsConsent || auto !== 'idle' || readPending() !== TERMS_VERSION) return;
    setAuto('saving');
    acceptTerms(TERMS_VERSION)
      .then(() => {
        clearPending();
        setAuto('idle');
      })
      .catch(() => setAuto('failed')); // fall back to the prompt
  }, [needsConsent, auto, acceptTerms]);

  useEffect(() => {
    if (!user) {
      setAgreed(false);
      setError('');
    }
  }, [user]);

  if (!needsConsent || auto === 'saving' || (auto === 'idle' && readPending() === TERMS_VERSION)) return null;

  const agree = async () => {
    if (!agreed) {
      setError('Please tick the box to agree before continuing.');
      return;
    }
    setBusy(true);
    try {
      await acceptTerms(TERMS_VERSION);
      clearPending();
    } catch (err) {
      toast.error('Couldn’t save your agreement', err.message);
    } finally {
      setBusy(false);
    }
  };

  const isUpdate = !!user.termsVersion; // agreed to an older version before

  return (
    <Modal
      open
      onClose={() => {}}
      hideClose
      width={480}
      title={isUpdate ? 'We’ve updated our Terms & Privacy Policy' : 'Before you continue'}
      description={
        isUpdate
          ? 'Please review and agree to the updated documents to keep using your account.'
          : 'Please review and agree to how PhotoBooth handles your information.'
      }
    >
      <div className="consent-body">
        <ul>
          <li>Your camera feed and individual photos are processed in your browser — they aren’t uploaded.</li>
          <li>Only photo strips you choose to save are stored, privately, on your account.</li>
          <li>We keep your name, email and plan; payments are handled by PayMongo.</li>
          <li>You can delete your account and all saved strips at any time in Settings.</li>
        </ul>
        <TermsCheckbox
          id="consent-agree"
          checked={agreed}
          onChange={(on) => {
            setAgreed(on);
            if (on) setError('');
          }}
          error={error}
        />
        <div className="consent-actions">
          <Button block size="lg" onClick={agree} loading={busy} data-autofocus>
            Agree and continue
          </Button>
          <Button block variant="ghost" onClick={() => logOut()} disabled={busy}>
            Log out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
