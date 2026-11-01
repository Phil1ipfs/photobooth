import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: { id: 'u1' }, ready: true }) }));
jest.mock('./context/ToastContext', () => ({ ToastProvider: ({ children }) => children }));
jest.mock('./context/PrefsContext', () => ({ PrefsProvider: ({ children }) => children }));
jest.mock('./context/StripsContext', () => ({ StripsProvider: ({ children }) => children }));
jest.mock('./context/MusicContext', () => ({ MusicProvider: ({ children }) => children }));
jest.mock('./context/EntitlementsContext', () => ({ EntitlementsProvider: ({ children }) => children }));
jest.mock('./components/auth/ConsentGate', () => () => null);
jest.mock('./pages/Pricing', () => () => <h1>Premium pricing</h1>);
jest.mock('./pages/Dashboard', () => () => <h1>My dashboard</h1>);
jest.mock('./pages/BillingSuccess', () => () => <h1>Payment verification</h1>);
jest.mock('./pages/Auth', () => ({ LoginPage: () => <h1>Sign in again</h1>, SignupPage: () => null, ResetPasswordPage: () => null }));
jest.mock('./lib/analytics', () => ({ track: () => {} }));

beforeEach(() => { window.scrollTo = jest.fn(); });

test.each([
  ['/pricing', 'Premium pricing'],
  ['/billing/success?ref=PB-checkout123', 'Payment verification'],
  ['https://evil.example', 'My dashboard'],
])('the signed-in login route honours only safe destinations: %s', async (next, title) => {
  window.history.replaceState({}, '', '/login?next=' + encodeURIComponent(next));
  render(<App />);
  await screen.findByRole('heading', { name: title });
  expect(window.location.pathname + window.location.search).toBe(next.startsWith('/') ? next : '/dashboard');
});

test('an expired billing session can show the login form even while the previous user is cached', async () => {
  window.history.replaceState({}, '', '/login?reauth=1&next=%2Fbilling%2Fsuccess%3Fref%3DPB-checkout123');
  render(<App />);
  await screen.findByRole('heading', { name: 'Sign in again' });
  expect(new URLSearchParams(window.location.search).get('next')).toBe('/billing/success?ref=PB-checkout123');
});
