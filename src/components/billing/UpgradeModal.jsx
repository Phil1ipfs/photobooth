import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Icon from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useRouter } from '../../lib/router';
import { TIERS, enabledPlans, formatPrice } from '../../config/plans';
import { startCheckout } from '../../lib/billing';
import { track } from '../../lib/analytics';

/** Elegant upgrade prompt shown when a free user reaches for a Premium feature. */
export default function UpgradeModal({ info, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { navigate, path } = useRouter();
  const [loading, setLoading] = useState(false);
  const plan = enabledPlans()[0];

  const upgrade = async () => {
    track('upgrade_clicked', { feature: info?.feature || 'premium', source: 'modal' });
    if (!user) {
      onClose();
      navigate(`/signup?next=${encodeURIComponent('/pricing')}`);
      return;
    }
    setLoading(true);
    try {
      await startCheckout(plan.id);
    } catch (err) {
      toast.error('Couldn’t start checkout', err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open={!!info} onClose={onClose} width={460} className="upgrade-modal">
      {info && (
        <div className="upgrade">
          <span className="upgrade-crest" aria-hidden="true">
            <Icon name="sparkle" size={26} />
          </span>
          <span className="premium-badge">
            <Icon name="lock" size={12} strokeWidth={2.2} /> Premium
          </span>
          <h2 className="upgrade-title">{info.title || 'Unlock PhotoBooth Premium'}</h2>
          <p className="muted">
            {info.description || 'This is part of Premium. Upgrade to unlock every template, layout and finish.'}
          </p>
          <ul className="upgrade-list">
            {TIERS.premium.features.slice(1, 5).map((f) => (
              <li key={f}>
                <Icon name="check" size={15} strokeWidth={2.4} />
                {f}
              </li>
            ))}
          </ul>
          {plan && (
            <p className="upgrade-price">
              <strong>{formatPrice(plan.price)}</strong> / {plan.interval} · cancel anytime
            </p>
          )}
          <div className="upgrade-actions">
            <Button block size="lg" icon="sparkle" onClick={upgrade} loading={loading} data-autofocus>
              {user ? 'Upgrade to Premium' : 'Sign up to upgrade'}
            </Button>
            <Button
              block
              variant="ghost"
              onClick={() => {
                onClose();
                if (path !== '/pricing') navigate('/pricing');
              }}
            >
              Compare plans
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
