import { normalizeTrack, searchTracks, shareableTrack, trackFromShared } from './music';

const raw = { id: 'gWd2p', title: 'Love me', user: { name: 'Beats' }, duration: 191, is_streamable: true, permalink: '/beatslove/love-me', artwork: { '150x150': 'https://val007.example.com/content/Qm/150x150.jpg' } };

test('normalizeTrack keeps streamable tracks and builds the stream URL', () => {
  const t = normalizeTrack(raw);
  expect(t).toMatchObject({ id: 'audius:gWd2p', title: 'Love me', artist: 'Beats', link: 'https://audius.co/beatslove/love-me' });
  expect(t.src).toBe('https://api.audius.co/v1/tracks/gWd2p/stream?app_name=PhotoBooth');
});

test('normalizeTrack drops gated, unstreamable or odd ids', () => {
  expect(normalizeTrack({ ...raw, is_stream_gated: true })).toBeNull();
  expect(normalizeTrack({ ...raw, is_streamable: false })).toBeNull();
  expect(normalizeTrack({ ...raw, id: '../x' })).toBeNull();
  expect(normalizeTrack({ ...raw, access: { stream: false } })).toBeNull();
});

test('a shared track round-trips, but a partner cannot inject URLs', () => {
  const t = normalizeTrack(raw);
  expect(trackFromShared(shareableTrack(t))).toMatchObject({ id: t.id, src: t.src, link: t.link, artwork: t.artwork });
  const evil = trackFromShared({ source: 'audius', audiusId: 'x?y', title: 'x' });
  expect(evil).toBeNull();
  const sneaky = trackFromShared({ source: 'audius', audiusId: 'abc', artwork: 'javascript:alert(1)', permalink: '//evil.com/x', src: 'https://evil.com/a.mp3' });
  expect(sneaky.src).toBe('https://api.audius.co/v1/tracks/abc/stream?app_name=PhotoBooth');
  expect(sneaky.artwork).toBeNull();
  expect(sneaky.link).toBe('https://audius.co');
  expect(trackFromShared({ source: 'local', id: 'loose' }, [{ id: 'loose', src: '/x.mp3' }])).toEqual({ id: 'loose', src: '/x.mp3' });
});

test('searchTracks sends the category filters and retries once', async () => {
  const calls = [];
  global.fetch = jest.fn(async (url) => {
    calls.push(url);
    if (calls.length === 1) throw new TypeError('network');
    return { ok: true, json: async () => ({ data: [raw, { ...raw, id: 'b', is_stream_gated: true }] }) };
  });
  const list = await searchTracks({ category: 'romantic' });
  expect(list).toHaveLength(1);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toContain('mood=Romantic');
  expect(calls[1]).toContain('query=love');
  expect(calls[1]).toContain('https://discoveryprovider.audius.co/v1/');
});

test('reopening the same music shelf uses its recent results instead of fetching again', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [raw] }) }));
  const first = await searchTracks({ query: 'cache-test' });
  expect(await searchTracks({ query: 'cache-test' })).toEqual(first);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const ctrl = new AbortController();
  ctrl.abort();
  await expect(searchTracks({ query: 'cache-test', signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
});

test('a hanging search is bounded and retried through the fallback endpoint', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest.fn()
      .mockImplementationOnce((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')))))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [raw] }) });
    const pending = searchTracks({ query: 'timeout-test' });
    jest.advanceTimersByTime(8000);
    expect(await pending).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('https://discoveryprovider.audius.co/v1/');
  } finally { jest.useRealTimers(); }
});

test('changing a search cancels the request without starting a fallback or caching stale results', async () => {
  const ctrl = new AbortController();
  global.fetch = jest.fn((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))));
  const pending = searchTracks({ query: 'cancel-test', signal: ctrl.signal });
  ctrl.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
