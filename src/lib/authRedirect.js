/** Normalise same-origin destinations before putting them in auth URLs. */
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (Array.from(next).some((char) => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '/dashboard';
  try {
    const base = 'https://photobooth.invalid';
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
