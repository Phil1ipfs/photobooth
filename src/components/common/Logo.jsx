import React from 'react';
import { Link } from '../../lib/router';

export function LogoMark({ size = 40 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M17.5 10.5 19.6 7h8.8l2.1 3.5H38a5 5 0 0 1 5 5V36a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V15.5a5 5 0 0 1 5-5h7.5Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 34.5s-7.6-4.4-7.6-9.5c0-2.4 1.8-4.2 4-4.2 1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2 2.2 0 4 1.8 4 4.2 0 5.1-7.6 9.5-7.6 9.5Z"
        fill="currentColor"
      />
      <circle cx="37" cy="16.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

export default function Logo({ to = '/', size = 'md', className = '' }) {
  return (
    <Link to={to} className={`logo${size === 'sm' ? ' logo-sm' : ''} ${className}`} aria-label="PhotoBooth home">
      <LogoMark size={size === 'sm' ? 36 : 42} />
      <span className="logo-text">
        <span className="logo-name">PhotoBooth</span>
        <span className="logo-sub">
          Making Memories
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.2 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
          </svg>
        </span>
      </span>
    </Link>
  );
}
