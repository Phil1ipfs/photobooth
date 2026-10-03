// Authentication service backed by Supabase Auth (+ the public.profiles table).
// UI code only talks to these functions; see supabase/schema.sql for the tables.
import { EMAIL_RE, passwordIssues } from './validation';
import { STRIPS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

export class AuthError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

const NOT_CONFIGURED = 'Accounts aren’t available right now — the app isn’t connected to its database.';

function client() {
  if (!isSupabaseConfigured) throw new AuthError(NOT_CONFIGURED);
  return supabase;
}

/** Turn Supabase errors into friendly messages (and the form field they belong to). */
function friendly(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return new AuthError('That email and password don’t match. Please try again.');
  }
  if (msg.includes('email not confirmed')) {
    return new AuthError('Please confirm your email first — check your inbox for the link we sent.');
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return new AuthError('An account with this email already exists. Try logging in instead.', 'email');
  }
  if (msg.includes('password should') || msg.includes('weak password')) {
    return new AuthError('Please choose a stronger password.', 'password');
  }
  if (msg.includes('same as the old') || msg.includes('different from the old')) {
    return new AuthError('Your new password must be different from the current one.', 'next');
  }
  if (msg.includes('rate limit') || msg.includes('too many') || error?.status === 429) {
    return new AuthError('Too many attempts. Please wait a minute and try again.');
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return new AuthError('This sign-in option isn’t enabled yet. Please use email for now.');
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return new AuthError('Can’t reach the server. Check your connection and try again.');
  }
  return new AuthError(error?.message || 'Something went wrong. Please try again.');
}

const normalizeEmail = (email) => email.trim().toLowerCase();

/** Build the app's user object from a Supabase auth user + profile row. */
async function toAppUser(authUser) {
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar, created_at')
    .eq('id', authUser.id)
    .maybeSingle();
  const meta = authUser.user_metadata || {};
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || meta.name || meta.full_name || authUser.email?.split('@')[0] || 'Friend',
    avatar: profile?.avatar || meta.avatar_url || null,
    createdAt: profile?.created_at || authUser.created_at,
  };
}

/** Restore the current session (async; Supabase keeps it in browser storage). */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return toAppUser(data.session?.user || null);
}

/** Subscribe to sign-in / sign-out / password-recovery events. Returns an unsubscribe fn. */
export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Defer: Supabase recommends not awaiting other Supabase calls inside this callback.
    setTimeout(async () => callback(event, await toAppUser(session?.user || null)), 0);
  });
  return () => data.subscription.unsubscribe();
}

export function setRemember(remember) {
  try {
    localStorage.setItem('pb:remember', remember ? '1' : '0');
  } catch {}
}

/**
 * Create an account. Returns { user, needsConfirmation }. When the Supabase
 * project requires email confirmation, `user` is null until the link is clicked.
 */
export async function signUp({ name, email, password }) {
  const sb = client();
  const cleanEmail = normalizeEmail(email);
  if (!name.trim()) throw new AuthError('Please enter your name.', 'name');
  if (!EMAIL_RE.test(cleanEmail)) throw new AuthError('Please enter a valid email address.', 'email');
  if (passwordIssues(password).length) throw new AuthError('Please choose a stronger password.', 'password');

  setRemember(true);
  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw friendly(error);
  // Supabase hides "already registered" behind an obfuscated user with no identities.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError('An account with this email already exists. Try logging in instead.', 'email');
  }
  if (!data.session) return { user: null, needsConfirmation: true, email: cleanEmail };
  return { user: await toAppUser(data.user), needsConfirmation: false };
}

export async function logIn({ identifier, password, remember = true }) {
  const sb = client();
  const email = normalizeEmail(identifier);
  if (!email) throw new AuthError('Please enter your email address.', 'identifier');
  if (!EMAIL_RE.test(email)) throw new AuthError('Please enter the email address you signed up with.', 'identifier');
  if (!password) throw new AuthError('Please enter your password.', 'password');
  setRemember(remember);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw friendly(error);
  return toAppUser(data.user);
}

// Which OAuth providers are switched on in the Supabase dashboard (cached).
let settingsPromise;
async function providerEnabled(provider) {
  if (!settingsPromise) {
    const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
    settingsPromise = fetch(`${process.env.REACT_APP_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  const settings = await settingsPromise;
  if (!settings) return true; // can't tell — let Supabase decide
  return Boolean(settings.external?.[provider]);
}

/** OAuth sign-in (Google). Redirects away; the session is picked up on return. */
export async function signInWithProvider(provider, next = '/dashboard') {
  const sb = client();
  // signInWithOAuth redirects even when the provider is off, which would land the
  // user on a raw Supabase error page — check first and explain instead.
  if (!(await providerEnabled(provider))) {
    throw new AuthError('This sign-in option isn’t enabled yet. Please use email for now.');
  }
  setRemember(true);
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}${next}` },
  });
  if (error) throw friendly(error);
}

export async function logOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email) {
  const sb = client();
  const clean = normalizeEmail(email);
  if (!EMAIL_RE.test(clean)) throw new AuthError('Please enter a valid email address.', 'email');
  const { error } = await sb.auth.resetPasswordForEmail(clean, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw friendly(error);
}

/** Used on /reset-password after following the emailed recovery link. */
export async function setNewPassword(password) {
  const sb = client();
  if (passwordIssues(password).length) throw new AuthError('Please choose a stronger password.', 'password');
  const { data, error } = await sb.auth.updateUser({ password });
  if (error) throw friendly(error);
  return toAppUser(data.user);
}

export async function updateProfile(userId, { name, email, avatar }) {
  const sb = client();
  const patch = {};
  if (name !== undefined) {
    if (!name.trim()) throw new AuthError('Please enter your name.', 'name');
    patch.name = name.trim();
  }
  if (avatar !== undefined) patch.avatar = avatar;
  if (Object.keys(patch).length) {
    const { error } = await sb.from('profiles').upsert({ id: userId, ...patch });
    if (error) throw friendly(error);
  }
  let emailChangePending = false;
  if (email !== undefined) {
    const clean = normalizeEmail(email);
    if (!EMAIL_RE.test(clean)) throw new AuthError('Please enter a valid email address.', 'email');
    const { data: current } = await sb.auth.getUser();
    if (current.user && current.user.email !== clean) {
      const { error } = await sb.auth.updateUser({ email: clean });
      if (error) throw friendly(error);
      emailChangePending = true; // Supabase emails a confirmation link before switching
    }
  }
  const { data } = await sb.auth.getUser();
  const user = await toAppUser(data.user);
  return { user, emailChangePending };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const sb = client();
  const { data: current } = await sb.auth.getUser();
  // Re-authenticate to confirm the current password.
  const { error: authErr } = await sb.auth.signInWithPassword({ email: current.user.email, password: currentPassword });
  if (authErr) throw new AuthError('Your current password is incorrect.', 'current');
  if (passwordIssues(newPassword).length) throw new AuthError('Please choose a stronger password.', 'next');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw friendly(error);
}

export async function deleteAccount(userId, password) {
  const sb = client();
  const { data: current } = await sb.auth.getUser();
  const { error: authErr } = await sb.auth.signInWithPassword({ email: current.user.email, password });
  if (authErr) throw new AuthError('Password is incorrect.', 'password');

  // Remove every file in the user's folder first (DB rows cascade when the auth user
  // is deleted). Abort on any storage error so we never leave orphaned photos behind.
  const bucket = sb.storage.from(STRIPS_BUCKET);
  for (let pass = 0; pass < 50; pass++) {
    const { data: files, error: listErr } = await bucket.list(userId, { limit: 100 });
    if (listErr) throw new AuthError('Couldn’t remove your saved photos. Please try again.');
    if (!files?.length) break;
    const { error: rmErr } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
    if (rmErr) throw new AuthError('Couldn’t remove your saved photos. Please try again.');
  }
  const { data: leftover } = await bucket.list(userId, { limit: 1 });
  if (leftover?.length) throw new AuthError('Couldn’t remove all of your saved photos. Please try again.');

  const { error } = await sb.rpc('delete_own_account');
  if (error) throw friendly(error);
  await sb.auth.signOut();
}
