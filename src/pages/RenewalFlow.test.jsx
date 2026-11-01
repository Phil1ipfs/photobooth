import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider } from '../lib/router';
import Pricing from './Pricing';
import Settings from './Settings';
import { startCheckout } from '../lib/billing';

let mockEnt;
let mockReady = true;
let mockLoading = false;
let mockAuthReady = true;
const mockToast = { error: jest.fn() };
jest.mock('../lib/billing', () => ({ startCheckout: jest.fn() }));
jest.mock('../lib/analytics', () => ({ track: () => {}, isAnalyticsEnabled: () => false }));
jest.mock('../components/layout/Header', () => () => null);
jest.mock('../components/layout/Footer', () => () => null);
jest.mock('../components/layout/AppLayout', () => ({ __esModule: true, default: ({ children }) => <main>{children}</main>, PageHeader: () => null }));
jest.mock('../context/ToastContext', () => ({ useToast: () => mockToast }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ ready: mockAuthReady, user: { id: 'u1', name: 'Alex', email: 'qa@example.test' } }) }));
jest.mock('../context/PrefsContext', () => ({ usePrefs: () => ({ prefs: { theme: 'light', sound: false, mirror: true, flash: true, countdown: 3, aspect: '4:3', layout: 'strip-1x4', captureMode: 'auto' }, setPref: () => {} }) }));
jest.mock('../context/EntitlementsContext', () => ({ useEntitlements: () => ({
  entitlements: mockEnt, ready: mockReady, loading: mockLoading,
  isPremium: mockEnt.plan === 'premium' || mockEnt.plan === 'admin', isAdmin: mockEnt.plan === 'admin',
  canUseLayout: () => true,
}) }));

const DAY = 864e5;
beforeEach(() => {
  jest.useFakeTimers('modern'); jest.setSystemTime(new Date('2026-11-01T00:00:00Z'));
  mockEnt = { plan: 'premium', status: 'active', billingPlan: 'premium_monthly', currentPeriodEnd: new Date(Date.now() + 30 * DAY).toISOString(), cancelAtPeriodEnd: true };
  mockReady = true; mockLoading = false; mockAuthReady = true;
  startCheckout.mockResolvedValue();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe.each([['Pricing', Pricing], ['Settings', Settings]])('%s renewal controls', (_, Page) => {
  const open = () => render(<RouterProvider><Page /></RouterProvider>);
  test('a longer remaining pass cannot start checkout and explains when renewal opens', () => {
    mockEnt.currentPeriodEnd = new Date(Date.now() + 200 * DAY).toISOString();
    open();
    const button = screen.getByRole('button', { name: /Extend 1 month/ });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(startCheckout).not.toHaveBeenCalled();
    expect(screen.getByText(/Renewal opens on/)).toBeInTheDocument();
  });
  test('a monthly pass at the 30-day boundary can extend by one month', () => {
    open(); const button = screen.getByRole('button', { name: /Extend 1 month/ });
    expect(button).toBeEnabled(); fireEvent.click(button);
    expect(startCheckout).toHaveBeenCalledWith('premium_monthly');
  });
  test('renewal becomes available when the window opens while the page remains open', async () => {
    mockEnt.currentPeriodEnd = new Date(Date.now() + 31 * DAY).toISOString(); open();
    expect(screen.getByRole('button', { name: /Extend 1 month/ })).toBeDisabled();
    await act(async () => { jest.advanceTimersByTime(DAY); });
    expect(screen.getByRole('button', { name: /Extend 1 month/ })).toBeEnabled();
  });
  test('admins have no actionable purchase or renewal control', () => {
    mockEnt.plan = 'admin'; open();
    expect(screen.queryByRole('button', { name: /Extend 1 month|Upgrade to Premium/ })).not.toBeInTheDocument();
    const fullAccess = screen.queryByRole('button', { name: 'Full access' });
    if (fullAccess) { expect(fullAccess).toBeDisabled(); fireEvent.click(fullAccess); }
    expect(startCheckout).not.toHaveBeenCalled();
  });
  test.each(['unloaded', 'refreshing', 'restoring login'])('purchase is disabled while details are %s', (state) => {
    mockReady = state !== 'unloaded'; mockLoading = state === 'refreshing'; mockAuthReady = state !== 'restoring login'; open();
    const button = screen.getByRole('button', { name: /Extend 1 month|Checking your plan/ });
    expect(button).toBeDisabled(); fireEvent.click(button); expect(startCheckout).not.toHaveBeenCalled();
  });
  test.each([null, 'invalid'])('a missing or malformed paid expiry disables renewal: %s', (end) => {
    mockEnt.currentPeriodEnd = end; open();
    expect(screen.getByRole('button', { name: /Extend 1 month/ })).toBeDisabled();
    expect(screen.getByText(/renewal details are unavailable/)).toBeInTheDocument();
    expect(startCheckout).not.toHaveBeenCalled();
  });
});
