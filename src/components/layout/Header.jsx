import React, { useEffect, useState } from 'react';
import Logo from '../common/Logo';
import Button from '../common/Button';
import Icon from '../common/Icon';
import { Avatar } from '../common/misc';
import { Link, useRouter } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';

export const MARKETING_NAV = [
  { to: '/', label: 'Home', match: '' },
  { to: '/#features', label: 'Features', match: '#features' },
  { to: '/#templates', label: 'Templates', match: '#templates' },
  { to: '/#about', label: 'About', match: '#about' },
  { to: '/pricing', label: 'Pricing', match: null },
];

/** Marketing site header (landing, legal pages). */
export default function Header() {
  const { user } = useAuth();
  const { path, hash } = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [path, hash]);

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}${open ? ' menu-open' : ''}`}>
      <div className="site-header-inner container">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="site-nav-link"
              aria-current={(item.match === null ? path === item.to : path === '/' && hash === item.match) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          {user ? (
            <>
              <Button to="/dashboard" variant="outline" size="sm">
                Dashboard
              </Button>
              <Link to="/settings" aria-label="Account settings" className="header-avatar">
                <Avatar user={user} size={36} />
              </Link>
            </>
          ) : (
            <>
              <Button to="/login" variant="outline-primary" size="sm">
                Log In
              </Button>
              <Button to="/signup" size="sm">
                Sign Up
              </Button>
            </>
          )}
        </div>
        <button
          className="icon-btn menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'x' : 'menu'} size={20} />
        </button>
      </div>
      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        <nav aria-label="Mobile">
          {MARKETING_NAV.map((item) => (
            <Link key={item.label} to={item.to} className="mobile-menu-link">
              {item.label}
              <Icon name="chevron-right" size={18} />
            </Link>
          ))}
        </nav>
        <div className="mobile-menu-actions">
          {user ? (
            <Button to="/dashboard" block>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="outline" block>
                Log In
              </Button>
              <Button to="/signup" block>
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
