// Two LDR rooms in one page, connected through an in-memory stand-in for Supabase
// Realtime (broadcast + presence) and Storage. Checks the sync protocol end to end:
// presence → both ready → shared countdown → shots exchanged → same strip on both sides.
import React, { createContext, useContext } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.setTimeout(40000);

const mockBus = { members: new Map(), files: new Map() }; // topic → Set(channel)
function mockChannel(topic, opts) {
  const handlers = { broadcast: [], sync: [] };
  const presence = (mockBus.presence ||= new Map());
  const ch = {
    key: opts.config.presence.key,
    on(kind, filter, fn) {
      (kind === 'broadcast' ? handlers.broadcast : handlers.sync).push(fn);
      return ch;
    },
    subscribe(cb) {
      if (!mockBus.members.has(topic)) mockBus.members.set(topic, new Set());
      mockBus.members.get(topic).add(ch);
      setTimeout(() => cb('SUBSCRIBED'), 0);
      return ch;
    },
    send({ payload }) {
      [...(mockBus.members.get(topic) || [])].filter((c) => c !== ch).forEach((c) => setTimeout(() => c._broadcast(payload), 5));
      return Promise.resolve('ok');
    },
    track(meta) {
      presence.set(ch.key, meta);
      mockSyncAll(topic);
      return Promise.resolve('ok');
    },
    presenceState: () => Object.fromEntries([...(mockBus.members.get(topic) || [])].filter((c) => presence.has(c.key)).map((c) => [c.key, [presence.get(c.key)]])),
    _broadcast: (payload) => handlers.broadcast.forEach((fn) => act(() => fn({ payload }))),
    _sync: () => handlers.sync.forEach((fn) => act(() => fn())),
  };
  return ch;
}
const mockSyncAll = (topic) => [...(mockBus.members.get(topic) || [])].forEach((c) => setTimeout(() => c._sync(), 0));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: (topic, opts) => mockChannel(topic, opts),
    removeChannel: (ch) => {
      for (const [topic, set] of mockBus.members) {
        if (set.delete(ch)) {
          mockBus.presence.delete(ch.key);
          mockSyncAll(topic);
        }
      }
    },
    realtime: { setAuth: () => Promise.resolve() },
    storage: {
      from: () => ({
        upload: async (path, blob) => (mockBus.files.set(path, blob), { error: null }),
        download: async (path) => (mockBus.files.has(path) ? { data: mockBus.files.get(path), error: null } : { data: null, error: { message: 'not found' } }),
        list: async (folder) => ({ data: [...mockBus.files.keys()].filter((k) => k.startsWith(folder + '/')).map((k) => ({ name: k.slice(folder.length + 1) })) }),
        remove: async (paths) => (paths.forEach((p) => mockBus.files.delete(p)), { error: null }),
      }),
    },
  },
}));

const mockUserCtx = createContext(null);
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: require('react').useContext(mockUserCtx) }) }));
jest.mock('../context/PrefsContext', () => ({ usePrefs: () => ({ prefs: { mirror: true, sound: false, countdown: 3, favoriteTemplates: [] } }) }));
jest.mock('../context/StripsContext', () => ({ useStrips: () => ({ strips: [], save: jest.fn() }) }));
jest.mock('../context/ToastContext', () => {
  const toast = { error: jest.fn(), info: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../context/EntitlementsContext', () => ({
  useEntitlements: () => ({ canUseTemplate: () => true, canUseLayout: () => true, canUseFeature: () => true, openUpgrade: jest.fn(), stripUsage: null, setStripUsage: () => {} }),
}));
jest.mock('../context/MusicContext', () => ({
  useMusic: () => ({ subscribe: () => () => {}, snapshot: () => ({}), applyRemote: () => {}, playing: false, track: { id: 'x' } }),
}));
jest.mock('../components/photobooth/useCamera', () => () => ({ status: 'ready', videoRef: { current: null }, capture: () => `data:image/jpeg;base64,${Math.random().toString(36).slice(2)}` }));
jest.mock('../components/photobooth/CameraPreview', () => ({ countdown }) => <div data-testid="count">{countdown || ''}</div>);
jest.mock('../components/photobooth/StripPreview', () => ({ photos }) => <div data-testid="strip">{photos.map((p) => (p ? 'x' : '-')).join('')}</div>);
jest.mock('../components/photobooth/TemplateSelector', () => () => null);
jest.mock('../components/photobooth/MusicPlayer', () => () => null);
jest.mock('../components/photobooth/MusicThemeHint', () => () => null);
jest.mock('../components/common/Logo', () => () => null);
jest.mock('../templates/render', () => ({ renderStrip: () => new Promise(() => {}) }));
jest.mock('../lib/analytics', () => ({ track: () => {} }));
jest.mock('../lib/sfx', () => ({ playBeep: () => {}, playShutter: () => {} }));
jest.mock('../lib/router', () => ({ useRouter: () => ({ query: new URLSearchParams('room=ABC123'), navigate: () => {} }) }));
jest.mock('../lib/ldr', () => ({
  ...jest.requireActual('../lib/ldr'),
  joinRoom: async () => ({ id: '11111111-2222-3333-4444-555555555555', code: 'ABC123', host_id: 'u1', guest_id: 'u2', expires_at: new Date(Date.now() + 3600e3).toISOString() }),
}));


beforeAll(() => {
  global.fetch = async (url) => ({ blob: async () => new Blob([url], { type: 'image/jpeg' }) });
});

// eslint-disable-next-line import/first
import Ldr from './Ldr';

const people = {
  u1: { id: 'u1', name: 'Alex' },
  u2: { id: 'u2', name: 'Sam' },
};
const Person = ({ id }) => (
  <mockUserCtx.Provider value={people[id]}>
    <div data-testid={`side-${id}`}>
      <Ldr />
    </div>
  </mockUserCtx.Provider>
);

test('two people get the same strip from one shared countdown', async () => {
  const { unmount } = render(
    <>
      <Person id="u1" />
      <Person id="u2" />
    </>
  );
  const a = () => within(screen.getByTestId('side-u1'));
  const b = () => within(screen.getByTestId('side-u2'));

  // Presence: each sees the other.
  await waitFor(() => expect(a().getByText('Sam')).toBeTruthy());
  await waitFor(() => expect(b().getByText('Alex')).toBeTruthy());

  // Only one ready → nothing starts.
  fireEvent.click(a().getByRole('button', { name: /I’m ready/ }));
  await waitFor(() => expect(b().getByText(/Alex is ready/)).toBeTruthy());
  expect(a().getByTestId('count').textContent).toBe('');

  // Both ready → the host starts; both count down together.
  fireEvent.click(b().getByRole('button', { name: /I’m ready/ }));
  await waitFor(() => expect(a().getByTestId('count').textContent).toBe('3'));
  await waitFor(() => expect(b().getByTestId('count').textContent).not.toBe(''));

  // Alternating 1 × 4 = 2 rounds each → 4 photos on both strips.
  await waitFor(() => expect(a().getByTestId('strip').textContent).toBe('xxxx'), { timeout: 20000 });
  await waitFor(() => expect(b().getByTestId('strip').textContent).toBe('xxxx'), { timeout: 5000 });
  expect([...mockBus.files.keys()].filter((k) => k.includes('/u1/'))).toHaveLength(2);
  expect([...mockBus.files.keys()].filter((k) => k.includes('/u2/'))).toHaveLength(2);
  expect(a().getByText('Your shared strip is ready!')).toBeTruthy();

  // Retake needs the partner's approval.
  fireEvent.click(a().getAllByRole('button', { name: /Retake together/ })[0]);
  await waitFor(() => expect(screen.getByText(/Alex wants to take the photos again/)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Yes, retake' }));
  await waitFor(() => expect(a().getByTestId('count').textContent).toBe('3'));

  unmount();
  // Leaving deletes each person's own uploads.
  await waitFor(() => expect(mockBus.files.size).toBe(0));
});

test('a partner leaving mid-countdown stops the session on the other side', async () => {
  const host = render(<Person id="u1" />);
  const guest = render(<Person id="u2" />);
  const a = () => within(screen.getByTestId('side-u1'));
  const b = () => within(screen.getByTestId('side-u2'));
  await waitFor(() => expect(a().getByText('Sam')).toBeTruthy());
  await waitFor(() => expect(b().getByText('Alex')).toBeTruthy());
  fireEvent.click(a().getByRole('button', { name: /I’m ready/ }));
  fireEvent.click(b().getByRole('button', { name: /I’m ready/ }));
  await waitFor(() => expect(a().getByTestId('count').textContent).toBe('3'));
  guest.unmount();
  await waitFor(() => expect(a().getByText(/Your partner left or lost connection/)).toBeTruthy());
  expect(a().getByTestId('count').textContent).toBe('');
  expect(a().getByRole('button', { name: /I’m ready/ })).toBeDisabled();
  host.unmount();
});
