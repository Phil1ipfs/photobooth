// src/App.jsx
import React from 'react';
import { RouterProvider, Redirect, useRouter } from './lib/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PrefsProvider } from './context/PrefsContext';
import { StripsProvider } from './context/StripsContext';
import { MusicProvider } from './context/MusicContext';
import Landing from './pages/Landing';
import { LoginPage, SignupPage } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Booth from './pages/Booth';
import MyPhotos from './pages/MyPhotos';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import { NotFound, Privacy, Terms } from './pages/Static';

// path → [component, access] where access is 'public' | 'auth' (signed-in only) | 'guest' (signed-out only)
const ROUTES = {
  '/': [Landing, 'public'],
  '/login': [LoginPage, 'guest'],
  '/signup': [SignupPage, 'public'],
  '/dashboard': [Dashboard, 'auth'],
  '/templates': [Templates, 'public'],
  '/booth': [Booth, 'public'],
  '/photos': [MyPhotos, 'auth'],
  '/favorites': [Favorites, 'auth'],
  '/settings': [Settings, 'auth'],
  '/terms': [Terms, 'public'],
  '/privacy': [Privacy, 'public'],
};

function Routes() {
  const { path, search } = useRouter();
  const { user } = useAuth();
  const [Page, access] = ROUTES[path] || [NotFound, 'public'];

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
            <StripsProvider>
              <MusicProvider>
                <Routes />
              </MusicProvider>
            </StripsProvider>
          </PrefsProvider>
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
