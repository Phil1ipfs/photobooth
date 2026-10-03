import React from 'react';
import Icon from '../common/Icon';

/** Small "✦ Premium" pill. `locked` shows a lock instead of the sparkle. */
export default function PremiumBadge({ locked = false, compact = false, className = '' }) {
  return (
    <span className={`premium-badge${compact ? ' compact' : ''} ${className}`} title={locked ? 'Premium — upgrade to unlock' : 'Premium'}>
      <Icon name={locked ? 'lock' : 'sparkle'} size={compact ? 10 : 12} strokeWidth={2.2} />
      {compact ? <span className="sr-only">{locked ? 'Premium, locked' : 'Premium'}</span> : <span>Premium</span>}
    </span>
  );
}
