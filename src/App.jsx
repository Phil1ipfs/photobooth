// src/App.jsx
import React, { useEffect } from 'react';
import { RouterProvider, Redirect, useRouter } from './lib/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PrefsProvider } from './context/PrefsContext';
import { StripsProvider } from './context/StripsContext';
import { MusicProvider } from './context/MusicContext';
import { EntitlementsProvider } from './context/EntitlementsContext';
import { track } from './lib/analytics';
import Landing from './pages/Landing';
import { LoginPage, ResetPasswordPage, SignupPage } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Booth from './pages/Booth';
import MyPhotos from './pages/MyPhotos';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import { NotFound, Privacy, Terms } from './pages/Static';
import Pricing from './pages/Pricing';
import BillingSuccess from './pages/BillingSuccess';
import Admin from './pages/Admin';

// path → [component, access] where access is 'public' | 'auth' (signed-in only) | 'guest' (signed-out only)
const ROUTES = {
  '/': [Landing, 'public'],
  '/login': [LoginPage, 'guest'],
  '/signup': [SignupPage, 'public'],
  '/reset-password': [ResetPasswordPage, 'public'],
  '/dashboard': [Dashboard, 'auth'],
  '/templates': [Templates, 'public'],
  '/booth': [Booth, 'public'],
  '/photos': [MyPhotos, 'auth'],
  '/favorites': [Favorites, 'auth'],
  '/settings': [Settings, 'auth'],
  '/terms': [Terms, 'public'],
  '/privacy': [Privacy, 'public'],
  '/pricing': [Pricing, 'public'],
  '/billing/success': [BillingSuccess, 'auth'],
  '/admin': [Admin, 'auth'], // the page itself also requires an admin account
};

function Routes() {
  const { path, search } = useRouter();
  const { user, ready } = useAuth();
  const [Page, access] = ROUTES[path] || [NotFound, 'public'];

  // One page_view per route (path only — no query strings or tokens).
  useEffect(() => {
    if (ready) track('page_view');
  }, [path, ready]);

  // Wait for the saved session before deciding a protected page needs a login.
  if (!ready && access !== 'public') return <div className="route-loading" role="status" aria-label="Loading"><span className="btn-spinner" /></div>;

  if (access === 'auth' && !user) return <Redirect to={`/login?next=${encodeURIComponent(path + search)}`} />;
  if (access === 'guest' && user) return <Redirect to="/dashboard" />;

  // Keyed by path so each page mounts fresh (and plays its enter transition).
  return <Page key={path} />;
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <PrefsProvider>
            <EntitlementsProvider>
            <StripsProvider>
              <MusicProvider>
                <Routes />
              </MusicProvider>
            </StripsProvider>
            </EntitlementsProvider>
          </PrefsProvider>
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
