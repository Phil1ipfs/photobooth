// Music library: Audius (https://audius.org) — a free, open music platform whose public
// REST API allows search and in-browser streaming without an API key. Tracks stay on
// Audius (we stream them, never download or bundle them), and every track is credited
// to its artist with a link back to Audius, as the API terms ask.
//
// Licensing: most Audius tracks are "All rights reserved" by their artists. Streaming
// them through the API is permitted; putting them inside exported photostrip videos is
// not, so music is never mixed into downloads.

const API = 'https://api.audius.co/v1';
const FALLBACK_API = 'https://discoveryprovider.audius.co/v1';
const APP_NAME = 'PhotoBooth';
const SEARCH_TIMEOUT = 8000;
const CACHE_TTL = 5 * 60 * 1000;
const searchCache = new Map();

/** Mood / genre shelves. `genre` and `mood` are Audius's own filter values. */
export const MUSIC_CATEGORIES = [
  { id: 'romantic', label: 'Romantic', emoji: '💕', query: 'love', mood: 'Romantic' },
  { id: 'lofi', label: 'Lo-fi / Chill', emoji: '☕', query: 'chill', genre: 'Lo-Fi' },
  { id: 'pop', label: 'Pop', emoji: '🎤', query: 'pop', genre: 'Pop' },
  { id: 'indie', label: 'Indie', emoji: '🎸', query: 'indie', genre: 'Alternative' },
  { id: 'rnb', label: 'R&B', emoji: '🌙', query: 'love', genre: 'R&B/Soul' },
  { id: 'acoustic', label: 'Acoustic', emoji: '🪕', query: 'acoustic', genre: 'Acoustic' },
  { id: 'instrumental', label: 'Instrumental', emoji: '🎹', query: 'instrumental' },
  { id: 'happy', label: 'Happy / Cute', emoji: '🌈', query: 'happy', mood: 'Upbeat' },
  { id: 'halloween', label: 'Halloween', emoji: '🎃', query: 'spooky halloween' },
  { id: 'ambient', label: 'Relaxing', emoji: '🌿', query: 'ambient', genre: 'Ambient' },
];

/** Optional template ideas per music shelf — only ever suggested, never applied automatically. */
export const THEME_SUGGESTIONS = {
  romantic: { templateId: 'miles-apart', label: 'Love scrapbook' },
  lofi: { templateId: 'polaroid', label: 'Vintage Polaroid' },
  halloween: { templateId: 'spooky-love', label: 'Spooky Halloween' },
  happy: { templateId: 'pink-pop', label: 'Colorful & playful' },
  acoustic: { templateId: 'modern-minimal', label: 'Minimal & cozy' },
  indie: { templateId: 'film-frame', label: 'Indie film' },
  rnb: { templateId: 'dreamy-lavender', label: 'Dreamy lavender' },
  ambient: { templateId: 'galaxy-dreams', label: 'Dreamy & calm' },
};

export const streamUrl = (id, fallback = false) => `${fallback ? FALLBACK_API : API}/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`;

/** Audius API track → player track. Returns null for anything we can't legally/technically play. */
export function normalizeTrack(t) {
  if (!t || !t.id || t.is_streamable === false || t.is_stream_gated || t.is_delete || t.is_unlisted || t.access?.stream === false) return null;
  if (!/^[A-Za-z0-9]+$/.test(String(t.id))) return null;
  return {
    id: `audius:${t.id}`,
    audiusId: String(t.id),
    title: t.title || 'Untitled',
    artist: t.user?.name || 'Unknown artist',
    duration: t.duration || 0,
    artwork: t.artwork?.['150x150'] || null,
    src: streamUrl(t.id),
    link: t.permalink ? `https://audius.co${t.permalink}` : 'https://audius.co',
    permalink: t.permalink || '',
    source: 'audius',
  };
}

async function get(path, params, signal) {
  const qs = new URLSearchParams({ ...params, app_name: APP_NAME });
  const key = `${path}?${qs}`;
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.tracks;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const abort = () => ctrl.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, SEARCH_TIMEOUT);
    try {
      const res = await fetch(`${attempt ? FALLBACK_API : API}${key}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Music service error (${res.status})`);
      const json = await res.json();
      if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
      const tracks = (json.data || []).map(normalizeTrack).filter(Boolean);
      searchCache.delete(key);
      searchCache.set(key, { at: Date.now(), tracks });
      if (searchCache.size > 30) searchCache.delete(searchCache.keys().next().value);
      return tracks;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastErr = err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  throw new Error(lastErr?.message?.startsWith('Music') ? lastErr.message : 'Couldn’t reach the music service. Check your connection and try again.');
}

/** Search Audius, optionally inside a category (genre / mood filters). */
export function searchTracks({ query = '', category = null, limit = 30, signal } = {}) {
  const cat = MUSIC_CATEGORIES.find((c) => c.id === category);
  const params = { query: query.trim() || cat?.query || '', limit: String(limit) };
  if (cat?.genre) params.genre = cat.genre;
  if (cat?.mood && !query.trim()) params.mood = cat.mood;
  return get('/tracks/search', params, signal);
}

/**
 * A track received from the LDR partner. Only ids are trusted: the playable URL is
 * rebuilt here so a partner can never make this browser load an arbitrary address.
 */
export function trackFromShared(shared, localTracks = []) {
  if (!shared || typeof shared !== 'object') return null;
  if (shared.source === 'local') return localTracks.find((t) => t.id === shared.id) || null;
  const id = String(shared.audiusId || '');
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) return null;
  const clip = (s, n) => String(s || '').slice(0, n);
  const artwork = typeof shared.artwork === 'string' && /^https:\/\/[^/]+\/content\//.test(shared.artwork) ? shared.artwork : null;
  return {
    id: `audius:${id}`,
    audiusId: id,
    title: clip(shared.title, 120) || 'Untitled',
    artist: clip(shared.artist, 80) || 'Unknown artist',
    duration: Number(shared.duration) || 0,
    artwork,
    src: streamUrl(id),
    link: /^\/[\w.-]+\/[\w.-]+$/.test(shared.permalink || '') ? `https://audius.co${shared.permalink}` : 'https://audius.co',
    source: 'audius',
  };
}

/** The minimum needed to share a track with the partner (no URLs). */
export const shareableTrack = (t) =>
  t.source === 'audius'
    ? { source: 'audius', audiusId: t.audiusId, title: t.title, artist: t.artist, duration: t.duration, artwork: t.artwork, permalink: t.permalink }
    : { source: 'local', id: t.id };
