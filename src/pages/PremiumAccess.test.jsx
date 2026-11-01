import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as permissions from '../lib/entitlements';
import { DEFAULT_PREFS } from '../context/PrefsContext';
import Booth from './Booth';
import Ldr from './Ldr';
import useStripActions from '../components/photos/useStripActions';
import { downloadBlob, printBlob, shareBlob } from '../lib/share';

let mockPlan = 'free';
let mockReady = true;
let mockInitialPrefs;
const mockUpgrade = jest.fn();
const mockSave = jest.fn();
const mockFavorite = jest.fn();
const mockGetBlob = jest.fn();
const mockAuthorize = jest.fn();
const mockJoin = jest.fn();
const mockCreate = jest.fn();

jest.mock('../context/EntitlementsContext', () => ({ useEntitlements: () => {
  const rules = jest.requireActual('../lib/entitlements');
  const entitlements = { plan: mockPlan };
  return {
    ready: mockReady, entitlements, stripUsage: null, setStripUsage: () => {}, openUpgrade: mockUpgrade,
    isPremium: rules.isPremium(entitlements), isAdmin: rules.isAdmin(entitlements),
    canUseFeature: (id) => rules.canUseFeature(entitlements, id),
    canUseTemplate: (t) => rules.canUseTemplate(entitlements, t),
    canUseLayout: (l) => rules.canUseLayout(entitlements, l),
    canUseFilter: (f) => rules.canUseFilter(entitlements, f),
  };
} }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Alex' } }) }));
jest.mock('../context/PrefsContext', () => ({
  ...jest.requireActual('../context/PrefsContext'),
  usePrefs: () => {
    const [prefs, setPrefs] = require('react').useState(mockInitialPrefs);
    return { prefs, setPref: (patch) => setPrefs((p) => ({ ...p, ...patch })), toggleFavoriteTemplate: jest.fn() };
  },
}));
jest.mock('../context/StripsContext', () => ({ useStrips: () => ({ strips: [], save: mockSave, toggleFavorite: mockFavorite, getBlob: mockGetBlob, remove: jest.fn() }) }));
jest.mock('../context/ToastContext', () => {
  const toast = { info: jest.fn(), error: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../context/MusicContext', () => ({ useMusic: () => ({ track: { id: 'x' }, tracks: [], playing: false, subscribe: () => () => {} }) }));
jest.mock('../lib/router', () => ({
  useRouter: () => ({ query: new URLSearchParams(), navigate: jest.fn() }),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../components/layout/AppLayout', () => ({
  __esModule: true,
  default: ({ children }) => <main>{children}</main>,
  PageHeader: ({ title }) => <h1>{title}</h1>,
}));
jest.mock('../components/common/Logo', () => () => null);
jest.mock('../components/photobooth/useCamera', () => () => ({ status: 'ready', devices: [], capture: () => 'data:image/jpeg;base64,cGhvdG8=' }));
jest.mock('../components/photobooth/CameraPreview', () => () => <div>Camera</div>);
jest.mock('../components/photobooth/TemplateSelector', () => () => null);
jest.mock('../templates/render', () => ({ renderStrip: async () => ({
  width: 600, height: 1800, toDataURL: () => 'data:image/png;base64,cGhvdG8=',
  toBlob: (cb) => cb(new Blob(['strip'], { type: 'image/png' })),
}) }));
jest.mock('../lib/share', () => ({ ...jest.requireActual('../lib/share'), downloadBlob: jest.fn(), printBlob: jest.fn(), shareBlob: jest.fn() }));
jest.mock('../lib/stripGate', () => ({
  ...jest.requireActual('../lib/stripGate'),
  createStripGate: () => ({ state: { id: 'c1' }, authorizeExport: mockAuthorize, beginStrip: () => {}, reset: () => {} }),
}));
jest.mock('../lib/ldr', () => ({ ...jest.requireActual('../lib/ldr'), createRoom: (...args) => mockCreate(...args), joinRoom: (...args) => mockJoin(...args) }));
jest.mock('../lib/analytics', () => ({ track: () => {} }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = 'free';
  mockReady = true;
  mockInitialPrefs = { ...DEFAULT_PREFS, countdown: 0, sound: false };
  mockAuthorize.mockResolvedValue({ allowed: true });
  mockGetBlob.mockResolvedValue(new Blob(['photo'], { type: 'image/png' }));
  mockCreate.mockImplementation(() => new Promise(() => {}));
  sessionStorage.clear();
  sessionStorage.setItem('pb:booth-session', JSON.stringify({ photos: Array(4).fill('data:image/jpeg;base64,cGhvdG8='), templateId: 'classic' }));
});

test('Free can download a classic photo, while Live, Save, Share, Print and music open upgrade prompts', async () => {
  render(<Booth />);
  await screen.findByAltText(/Classic Strip strip preview/i);
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.png$/)));
  expect(mockAuthorize).toHaveBeenCalledTimes(1);
  for (const [name, feature] of [
    [/^Live$/, 'live_strips'], [/^Save \(Premium\)$/, 'cloud_save'], [/^Share \(Premium\)$/, 'share_print'],
    [/^Print \(Premium\)$/, 'share_print'], [/^Music library \(Premium\)$/, 'music_library'],
  ]) {
    fireEvent.click(screen.getByRole('button', { name }));
    expect(mockUpgrade).toHaveBeenLastCalledWith(expect.objectContaining({ feature }));
  }
  expect(screen.getByRole('button', { name: 'Photo' })).toHaveAttribute('aria-pressed', 'true');
  expect(mockSave).not.toHaveBeenCalled();
  expect(printBlob).not.toHaveBeenCalled();
  expect(shareBlob).not.toHaveBeenCalled();
  expect(mockAuthorize).toHaveBeenCalledTimes(1); // locked actions don't consume a free strip
});

test('saved Premium preferences cannot restore Live, premium templates, layouts, filters or HD on a Free account', async () => {
  mockInitialPrefs = { ...mockInitialPrefs, boothMode: 'live', lastTemplate: 'polaroid', layout: 'grid-2x2', filter: 'warm', hd: true };
  sessionStorage.setItem('pb:booth-session', JSON.stringify({ photos: [], templateId: 'polaroid' }));
  render(<Booth />);
  await screen.findByAltText(/Classic Strip strip preview/i);
  expect(screen.getByRole('combobox', { name: 'Photo layout' })).toHaveValue('strip-1x4');
  expect(screen.getByRole('combobox', { name: 'Photo filter' })).toHaveValue('none');
  expect(screen.getByRole('switch', { name: /HD download/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Photo' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('combobox', { name: 'Photo filter' }), { target: { value: 'noir' } });
  expect(mockUpgrade).toHaveBeenLastCalledWith(expect.objectContaining({ feature: 'premium_filters' }));
  expect(screen.getByRole('combobox', { name: 'Photo filter' })).toHaveValue('none');
});

test.each(['premium', 'admin'])('%s can enter Live mode, and losing Premium returns the booth to Photo', async (plan) => {
  mockPlan = plan;
  const { rerender } = render(<Booth />);
  fireEvent.click(screen.getByRole('button', { name: 'Live' }));
  expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  expect(mockUpgrade).not.toHaveBeenCalled();
  mockPlan = 'free';
  rerender(<Booth />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Photo' })).toHaveAttribute('aria-pressed', 'true'));
  expect(screen.getByRole('button', { name: 'Print (Premium)' })).toBeInTheDocument();
});

test('Free direct LDR visits never mount the room lobby or call room RPCs', () => {
  render(<Ldr />);
  expect(screen.getByRole('region', { name: 'LDR Photobooth requires Premium' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create a room' })).not.toBeInTheDocument();
  expect(mockJoin).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Premium' }));
  expect(mockUpgrade).toHaveBeenCalledWith(expect.objectContaining({ feature: 'ldr_rooms' }));
});

test.each(['premium', 'admin'])('%s can create LDR rooms', (plan) => {
  mockPlan = plan;
  render(<Ldr />);
  fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockUpgrade).not.toHaveBeenCalled();
});

test('LDR stays closed while entitlements are loading', () => {
  mockPlan = 'premium'; mockReady = false;
  render(<Ldr />);
  expect(screen.getByRole('status', { name: 'Checking your plan' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create a room' })).not.toBeInTheDocument();
  expect(mockCreate).not.toHaveBeenCalled();
});

function SavedActions() {
  const actions = useStripActions();
  const photo = { id: 'old', templateName: 'Classic', createdAt: '2026-01-01' };
  return <div aria-label="Saved photo actions">
    <button onClick={() => actions.download(photo)}>Download</button>
    <button onClick={() => actions.share(photo)}>Share</button>
    <button onClick={() => actions.print(photo)}>Print</button>
    <button onClick={() => actions.favorite(photo)}>Favorite</button>
  </div>;
}

test('Free keeps downloads of existing saved photos, while saved-photo Share, Print and Favorites stay locked', async () => {
  render(<SavedActions />);
  const actions = within(screen.getByLabelText('Saved photo actions'));
  for (const name of ['Share', 'Print', 'Favorite']) fireEvent.click(actions.getByRole('button', { name }));
  expect(mockGetBlob).not.toHaveBeenCalled();
  expect(mockFavorite).not.toHaveBeenCalled();
  expect(mockUpgrade).toHaveBeenCalledTimes(3);
  fireEvent.click(actions.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
});

test('Free has only the Classic template and Original photos; every paid feature is available to Premium and admin', () => {
  expect(permissions.canUseTemplate({ plan: 'free' }, 'classic')).toBe(true);
  expect(permissions.canUseTemplate({ plan: 'free' }, 'love-hearts')).toBe(false);
  for (const feature of ['live_strips', 'ldr_rooms', 'music_library', 'cloud_save', 'share_print', 'favorites', 'hd_export']) {
    expect(permissions.canUseFeature({ plan: 'free' }, feature)).toBe(false);
    expect(permissions.canUseFeature({ plan: 'premium' }, feature)).toBe(true);
    expect(permissions.canUseFeature({ plan: 'admin' }, feature)).toBe(true);
  }
});
