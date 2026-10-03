// Authentication service.
//
// The original app had no backend, so accounts are stored on this device:
// passwords are salted + hashed with PBKDF2 (Web Crypto) and never stored in
// plain text. Every function is async and returns plain user objects, so this
// module can be swapped for a hosted provider (Firebase, Supabase, your own
// API) without touching the UI.
import { EMAIL_RE, passwordIssues } from './validation';

const USERS_KEY = 'pb:users';
const SESSION_KEY = 'pb:session';
const ITERATIONS = 150000;

export class AuthError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    throw new AuthError('Your browser storage is full or disabled. Please free up space and try again.');
  }
};

const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

const randomHex = (bytes = 16) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

export const newId = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${randomHex(8)}`;

async function hashPassword(password, salt) {
  if (!window.crypto?.subtle) {
    throw new AuthError('Secure sign-in needs HTTPS (or localhost). Please open the app over a secure connection.');
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return toHex(bits);
}

const publicUser = ({ salt, hash, ...user }) => user;

const normalizeEmail = (email) => email.trim().toLowerCase();

function setSession(userId, remember) {
  const session = JSON.stringify({ userId, at: Date.now() });
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { userId } = JSON.parse(raw);
    const user = readUsers().find((u) => u.id === userId);
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export async function signUp({ name, email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (!name.trim()) throw new AuthError('Please enter your name.', 'name');
  if (!EMAIL_RE.test(cleanEmail)) throw new AuthError('Please enter a valid email address.', 'email');
  if (passwordIssues(password).length) throw new AuthError('Please choose a stronger password.', 'password');

  const users = readUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new AuthError('An account with this email already exists. Try logging in instead.', 'email');
  }
  const salt = randomHex();
  const user = {
    id: newId(),
    name: name.trim(),
    email: cleanEmail,
    avatar: null,
    createdAt: new Date().toISOString(),
    salt,
    hash: await hashPassword(password, salt),
  };
  writeUsers([...users, user]);
  setSession(user.id, true);
  return publicUser(user);
}

export async function logIn({ identifier, password, remember = true }) {
  const id = identifier.trim().toLowerCase();
  if (!id) throw new AuthError('Please enter your email or username.', 'identifier');
  if (!password) throw new AuthError('Please enter your password.', 'password');

  const user = readUsers().find((u) => u.email === id || u.name.toLowerCase() === id);
  // Hash even when the user is missing so response time doesn't reveal which accounts exist.
  const hash = await hashPassword(password, user ? user.salt : 'no-user');
  if (!user || hash !== user.hash) {
    throw new AuthError('That email/username and password don’t match. Please try again.');
  }
  setSession(user.id, remember);
  return publicUser(user);
}

export function logOut() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function updateProfile(userId, { name, email, avatar }) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new AuthError('Account not found.');
  const next = { ...users[idx] };
  if (name !== undefined) {
    if (!name.trim()) throw new AuthError('Please enter your name.', 'name');
    next.name = name.trim();
  }
  if (email !== undefined) {
    const clean = normalizeEmail(email);
    if (!EMAIL_RE.test(clean)) throw new AuthError('Please enter a valid email address.', 'email');
    if (users.some((u) => u.email === clean && u.id !== userId)) {
      throw new AuthError('That email is already used by another account.', 'email');
    }
    next.email = clean;
  }
  if (avatar !== undefined) next.avatar = avatar;
  users[idx] = next;
  writeUsers(users);
  return publicUser(next);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new AuthError('Account not found.');
  const user = users[idx];
  if ((await hashPassword(currentPassword, user.salt)) !== user.hash) {
    throw new AuthError('Your current password is incorrect.', 'current');
  }
  if (passwordIssues(newPassword).length) throw new AuthError('Please choose a stronger password.', 'next');
  const salt = randomHex();
  users[idx] = { ...user, salt, hash: await hashPassword(newPassword, salt) };
  writeUsers(users);
}

export async function deleteAccount(userId, password) {
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new AuthError('Account not found.');
  if ((await hashPassword(password, user.salt)) !== user.hash) {
    throw new AuthError('Password is incorrect.', 'password');
  }
  writeUsers(users.filter((u) => u.id !== userId));
  logOut();
}
