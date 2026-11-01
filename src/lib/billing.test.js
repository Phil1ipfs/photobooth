import { BillingError, confirmCheckout } from './billing';

const mockSession = jest.fn();
jest.mock('./supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: () => mockSession() } } }));
const originalFetch = global.fetch;
beforeEach(() => {
  mockSession.mockResolvedValue({ data: { session: { access_token: 'qa-token' } } });
  global.fetch = jest.fn();
});
afterEach(() => { global.fetch = originalFetch; });

test.each([400, 401, 404, 409, 503])('billing exposes HTTP %s so confirmation can distinguish permanent failures', async (status) => {
  global.fetch.mockResolvedValue({ ok: false, status, headers: { get: () => 'application/json' }, json: async () => ({ error: 'Checkout error' }) });
  await expect(confirmCheckout('PB-checkout123')).rejects.toMatchObject({ status, message: 'Checkout error' });
});
test('a missing session is reported as 401 without calling the billing server', async () => {
  mockSession.mockResolvedValue({ data: { session: null } });
  await expect(confirmCheckout('PB-checkout123')).rejects.toMatchObject({ status: 401 });
  expect(global.fetch).not.toHaveBeenCalled();
});
test('confirmation forwards cancellation and keeps the verified response', async () => {
  const controller = new AbortController();
  global.fetch.mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ status: 'already_granted' }) });
  await expect(confirmCheckout('PB-checkout123', { signal: controller.signal })).resolves.toEqual({ status: 'already_granted' });
  expect(global.fetch).toHaveBeenCalledWith('/api/billing/confirm', expect.objectContaining({ signal: controller.signal, headers: expect.objectContaining({ Authorization: 'Bearer qa-token' }) }));
});
test('network failures remain retryable and do not look like an invalid reference', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  await expect(confirmCheckout('PB-checkout123')).rejects.toBeInstanceOf(BillingError);
  await expect(confirmCheckout('PB-checkout123')).rejects.toMatchObject({ status: 0 });
});
