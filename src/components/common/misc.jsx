// Small shared presentational components.
import React, { useState } from 'react';
import Icon from './Icon';
import { initials } from '../../lib/format';

export function Avatar({ user, size = 40 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {user?.avatar ? <img src={user.avatar} alt="" /> : initials(user?.name)}
    </span>
  );
}

export function EmptyState({ icon = 'image', title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius, className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** Heart toggle with a pop animation when favourited. */
export function FavoriteButton({ active, onToggle, label = 'favorites', size = 'sm', className = '' }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      className={`icon-btn fav-btn${size === 'sm' ? ' icon-btn-sm' : ''}${pop ? ' pop' : ''} ${className}`}
      aria-pressed={!!active}
      aria-label={active ? `Remove from ${label}` : `Add to ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!active) setPop(true);
        onToggle?.();
      }}
      onAnimationEnd={() => setPop(false)}
    >
      <Icon name="heart" size={size === 'sm' ? 16 : 18} />
    </button>
  );
}

/** Decorative sparkle / heart doodles. */
export function Sparkle({ size = 18, className = '', style }) {
  return (
    <svg className={`deco ${className}`} style={style} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1c.6 6.5 4.5 10.4 11 11-6.5.6-10.4 4.5-11 11-.6-6.5-4.5-10.4-11-11 6.5-.6 10.4-4.5 11-11Z" fill="currentColor" />
    </svg>
  );
}

export function DoodleHeart({ size = 40, className = '', style, filled }) {
  return (
    <svg className={`deco ${className}`} style={style} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 41s-15-8.6-17.8-18C4.3 16.6 8.3 10 14.6 10c4.1 0 7.3 2.5 9.4 6 2.1-3.5 5.3-6 9.4-6 6.3 0 10.3 6.6 8.4 13-2.8 9.4-17.8 18-17.8 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

/** Looping script heart flourish used near headings. */
export function HeartSwirl({ size = 120, className = '', style }) {
  return (
    <svg className={`deco ${className}`} style={style} width={size} height={size * 0.8} viewBox="0 0 150 120" fill="none" aria-hidden="true">
      <path
        d="M4 112c30-6 58-22 74-46 9-14 12-30 4-38-8-7-20-2-22 8-4-12-18-16-26-8-10 10-2 30 22 46 14 9 34 16 56 16 16 0 28-4 34-10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
