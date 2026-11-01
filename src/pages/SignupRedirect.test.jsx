import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, useRouter } from '../lib/router';
import { SignupPage, LoginPage } from './Auth';
import { TERMS_VERSION } from '../config/legal';

const mockSignup = jest.fn();
const mockLogin = jest.fn();
let mockUser = null;
const user = { id: 'u1', email: 'qa@example.test', user_metadata: { name: 'Alex Example' }, identities: [{ id: 'u1', provider: 'email' }] };
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true, STRIPS_BUCKET: 'strips',
  supabase: {
    auth: { signUp: (...args) => mockSignup(...args), signInWithPassword: (...args) => mockLogin(...args) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: 'Alex Example', terms_version: '2026-11-01' } }) }) }) }),
  },
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({
  configured: true, user: mockUser,
  signUp: (data) => jest.requireActual('../lib/auth').signUp(data),
  logIn: (data) => jest.requireActual('../lib/auth').logIn(data),
}) }));
jest.mock('../context/ToastContext', () => ({ useToast: () => ({ success: () => {}, error: () => {} }) }));

function Routes() {
  const { path } = useRouter();
  if (path === '/signup') return <SignupPage />;
  if (path === '/login') return <LoginPage />;
  return <h1>Destination: {path}</h1>;
}
const open = () => render(<RouterProvider><Routes /></RouterProvider>);
const submitSignup = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Full Name' }), { target: { value: 'Alex Example' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Email Address' }), { target: { value: 'qa@example.test' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'ExamplePassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm Password', { exact: true }), { target: { value: 'ExamplePassword123!' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /agree/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
};

beforeEach(() => {
  mockUser = null;
  window.history.replaceState({}, '', '/signup?next=%2Fpricing');
  window.scrollTo = jest.fn();
  mockSignup.mockResolvedValue({ data: { user, session: null }, error: null });
  mockLogin.mockResolvedValue({ data: { user }, error: null });
});

test('email signup carries Premium pricing into the confirmation URL and the login fallback', async () => {
  open(); submitSignup();
  await screen.findByRole('heading', { name: 'Check your email' });
  expect(mockSignup).toHaveBeenCalledWith(expect.objectContaining({
    options: expect.objectContaining({ emailRedirectTo: window.location.origin + '/pricing', data: expect.objectContaining({ terms_version: TERMS_VERSION }) }),
  }));
  const login = screen.getByRole('link', { name: 'Back to Log In' });
  expect(login).toHaveAttribute('href', '/login?next=%2Fpricing');
  fireEvent.click(login);
  fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'qa@example.test' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'ExamplePassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
  await screen.findByRole('heading', { name: 'Destination: /pricing' });
});

test('signup with an immediate session offers Continue to Premium and opens pricing', async () => {
  mockSignup.mockResolvedValue({ data: { user, session: { access_token: 'fake' } }, error: null });
  open(); submitSignup();
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to Premium' }));
  expect(screen.getByRole('heading', { name: 'Destination: /pricing' })).toBeInTheDocument();
});

test('a signed-in user following the signup upgrade link returns to pricing', async () => {
  mockUser = { id: 'u1', name: 'Alex' }; open();
  await screen.findByRole('heading', { name: 'Destination: /pricing' });
  expect(mockSignup).not.toHaveBeenCalled();
});

test('an external signup destination falls back to Dashboard in both email and login links', async () => {
  window.history.replaceState({}, '', '/signup?next=https%3A%2F%2Fevil.example'); open(); submitSignup();
  await screen.findByRole('heading', { name: 'Check your email' });
  expect(mockSignup.mock.calls[0][0].options.emailRedirectTo).toBe(window.location.origin + '/dashboard');
  expect(screen.getByRole('link', { name: 'Back to Log In' })).toHaveAttribute('href', '/login?next=%2Fdashboard');
});

test('the ordinary signup flow still returns to Dashboard', async () => {
  window.history.replaceState({}, '', '/signup'); open(); submitSignup();
  await waitFor(() => expect(mockSignup).toHaveBeenCalled());
  expect(mockSignup.mock.calls[0][0].options.emailRedirectTo).toBe(window.location.origin + '/dashboard');
});
