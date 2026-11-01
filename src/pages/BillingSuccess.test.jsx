import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider } from '../lib/router';
import BillingSuccess from './BillingSuccess';
import { confirmCheckout, BillingError } from '../lib/billing';

const mockRefresh = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('../context/EntitlementsContext', () => ({ useEntitlements: () => ({ refresh: mockRefresh }) }));
jest.mock('../lib/billing', () => ({ ...jest.requireActual('../lib/billing'), confirmCheckout: jest.fn() }));

const END = '2026-12-01T00:00:00.000Z';
const premium = { plan: 'premium', currentPeriodEnd: END, cancelAtPeriodEnd: true };
const flush = async () => { await act(async () => {}); };
const advance = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const open = () => render(<RouterProvider><BillingSuccess /></RouterProvider>);

beforeEach(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date('2026-11-01T00:00:00Z'));
  window.history.replaceState({}, '', '/billing/success?ref=PB-checkout123');
  mockRefresh.mockResolvedValue({ plan: 'free' });
  confirmCheckout.mockResolvedValue({ status: 'unpaid' });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test.each(['granted', 'already_granted'])('%s for this checkout plus updated entitlements shows active Premium', async (status) => {
  confirmCheckout.mockResolvedValue({ status, currentPeriodEnd: END });
  mockRefresh.mockResolvedValue(premium);
  open(); await flush();
  expect(screen.getByRole('heading', { name: 'Your Premium is active' })).toBeInTheDocument();
  expect(confirmCheckout).toHaveBeenCalledWith('PB-checkout123', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('an unpaid checkout never shows payment success, even when the account is already Premium', async () => {
  mockRefresh.mockResolvedValue(premium);
  open(); await flush(); await advance(30000);
  expect(screen.getByRole('heading', { name: 'Payment not confirmed yet' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.queryByText(/payment went through/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your Premium is active' })).not.toBeInTheDocument();
});

test('an existing Premium expiry must advance to the expiry confirmed for the renewal', async () => {
  confirmCheckout.mockResolvedValue({ status: 'granted', currentPeriodEnd: END });
  mockRefresh.mockResolvedValueOnce({ ...premium, currentPeriodEnd: '2026-11-15T00:00:00Z' }).mockResolvedValue(premium);
  open(); await flush();
  expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your Premium is active' })).not.toBeInTheDocument();
  await advance(2000);
  expect(screen.getByRole('heading', { name: 'Your Premium is active' })).toBeInTheDocument();
  expect(confirmCheckout).toHaveBeenCalledTimes(1);
});

test('paid but delayed activation times out with an accurate paid message and retry', async () => {
  confirmCheckout.mockResolvedValue({ status: 'already_granted', currentPeriodEnd: END });
  open(); await flush(); await advance(30000);
  expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeInTheDocument();
  expect(screen.getByText(/account details are still updating/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  mockRefresh.mockResolvedValue(premium);
  fireEvent.click(screen.getByRole('button', { name: 'Check again' })); await flush();
  expect(screen.getByRole('heading', { name: 'Your Premium is active' })).toBeInTheDocument();
});

test.each(['/billing/success', '/billing/success?ref=invalid'])('missing or malformed references are rejected without a payment request: %s', async (path) => {
  window.history.replaceState({}, '', path); open(); await flush();
  expect(screen.getByRole('heading', { name: 'Checkout not found' })).toBeInTheDocument();
  expect(confirmCheckout).not.toHaveBeenCalled();
});

test.each([400, 404, 409])('a permanent verification failure (%s) stops automatic retries', async (status) => {
  confirmCheckout.mockRejectedValue(new BillingError('Invalid checkout', status));
  open(); await flush(); await advance(30000);
  expect(screen.getByRole('heading', { name: status === 409 ? 'Couldn’t verify this payment' : 'Checkout not found' })).toBeInTheDocument();
  expect(confirmCheckout).toHaveBeenCalledTimes(1);
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('an expired session keeps the checkout reference in the login return path', async () => {
  confirmCheckout.mockRejectedValue(new BillingError('Expired', 401));
  open(); await flush();
  expect(screen.getByRole('link', { name: 'Sign in to continue' })).toHaveAttribute('href', '/login?reauth=1&next=%2Fbilling%2Fsuccess%3Fref%3DPB-checkout123');
});

test('temporary errors time out without claiming payment, then a manual retry can succeed', async () => {
  confirmCheckout.mockRejectedValue(new BillingError('Unavailable', 503));
  open(); await flush(); await advance(30000);
  expect(screen.getByRole('heading', { name: 'Unable to check your payment' })).toBeInTheDocument();
  confirmCheckout.mockResolvedValue({ status: 'granted', currentPeriodEnd: END }); mockRefresh.mockResolvedValue(premium);
  fireEvent.click(screen.getByRole('button', { name: 'Check again' })); await flush();
  expect(screen.getByRole('heading', { name: 'Your Premium is active' })).toBeInTheDocument();
});

test('a stalled request is aborted at the deadline, and unmount cancels further work', async () => {
  confirmCheckout.mockImplementation(() => new Promise(() => {}));
  const { unmount } = open(); await flush();
  const signal = confirmCheckout.mock.calls[0][1].signal;
  await advance(30000);
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  const calls = confirmCheckout.mock.calls.length;
  unmount(); await advance(60000);
  expect(confirmCheckout).toHaveBeenCalledTimes(calls);
});

test('leaving the confirmation page aborts the request and cancels the retry timer immediately', async () => {
  confirmCheckout.mockImplementation(() => new Promise(() => {}));
  const { unmount } = open(); await flush();
  const signal = confirmCheckout.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await advance(60000);
  expect(confirmCheckout).toHaveBeenCalledTimes(1);
});
