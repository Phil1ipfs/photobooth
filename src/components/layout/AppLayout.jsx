import React from 'react';
import Logo from '../common/Logo';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Avatar } from '../common/misc';
import { Link, useRouter } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import MusicPlayer from '../photobooth/MusicPlayer';

export const APP_NAV = [
  { to: '/dashboard', label: 'Home', icon: 'home', auth: true },
  { to: '/templates', label: 'Templates', icon: 'templates' },
  { to: '/photos', label: 'My Photos', icon: 'image', auth: true },
  { to: '/favorites', label: 'Favorites', icon: 'heart', auth: true },
  { to: '/settings', label: 'Settings', icon: 'settings', auth: true },
];

const navTarget = (item, user) => (item.auth && !user ? `/login?next=${encodeURIComponent(item.to)}` : item.to);

function Sidebar() {
  const { user, logOut } = useAuth();
  const { path, navigate } = useRouter();
  const toast = useToast();

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <Logo to={user ? '/dashboard' : '/'} size="sm" />
      <nav className="side-nav" aria-label="App">
        {APP_NAV.map((item) => (
          <Link
            key={item.to}
            to={navTarget(item, user)}
            className="side-link"
            aria-current={path === item.to ? 'page' : undefined}
          >
            <Icon name={item.icon} size={19} />
            {item.label}
          </Link>
        ))}
      </nav>
      <Link to="/booth" className="side-cta">
        <span className="side-cta-icon">
          <Icon name="camera" size={18} />
        </span>
        <span>
          <strong>Open Photobooth</strong>
          <small>Start a new session</small>
        </span>
      </Link>
      <div className="side-footer">
        {user ? (
          <>
            <Link to="/settings" className="side-user">
              <Avatar user={user} size={40} />
              <span className="side-user-text">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </Link>
            <button
              className="side-logout"
              onClick={() => {
                logOut();
                toast.info('Logged out', 'See you soon ♡');
                navigate('/');
              }}
            >
              <Icon name="logout" size={17} />
              Log Out
            </button>
          </>
        ) : (
          <div className="side-guest">
            <strong>Keep your memories</strong>
            <small>Create a free account to save strips and favorites.</small>
            <Button to={`/signup?next=${encodeURIComponent(path)}`} size="sm" block>
              Sign Up
            </Button>
            <Button to={`/login?next=${encodeURIComponent(path)}`} size="sm" variant="ghost" block>
              Log In
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const { path } = useRouter();
  const items = [APP_NAV[0], APP_NAV[1], null, APP_NAV[2], APP_NAV[4]];
  return (
    <nav className="bottom-nav" aria-label="App">
      {items.map((item) =>
        item ? (
          <Link
            key={item.to}
            to={navTarget(item, user)}
            className="bottom-link"
            aria-current={path === item.to ? 'page' : undefined}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label === 'My Photos' ? 'Photos' : item.label}</span>
          </Link>
        ) : (
          <Link key="booth" to="/booth" className="bottom-cta" aria-label="Open Photobooth">
            <Icon name="camera" size={24} />
          </Link>
        )
      )}
    </nav>
  );
}

/** Shell for signed-in app pages: sidebar on desktop, top bar + bottom nav on mobile. */
export default function AppLayout({ children }) {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-topbar">
          <Logo to={user ? '/dashboard' : '/'} size="sm" />
          {user ? (
            <Link to="/settings" aria-label="Account settings">
              <Avatar user={user} size={36} />
            </Link>
          ) : (
            <Button to="/login" size="sm" variant="outline-primary">
              Log In
            </Button>
          )}
        </header>
        <main id="main" className="app-content page-enter">
          {children}
        </main>
      </div>
      <BottomNav />
      <MusicPlayer compact />
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
