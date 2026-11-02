import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MusicProvider, useMusic } from './MusicContext';
import { normalizeTrack, streamUrl } from '../lib/music';

let mockAllowed = false;
jest.mock('./EntitlementsContext', () => ({ useEntitlements: () => ({ ready: true, canUseFeature: () => mockAllowed }) }));

let music;
function Controls() {
  music = useMusic();
  return <button onClick={music.resume}>Play</button>;
}

beforeEach(() => {
  mockAllowed = false;
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('Free cannot load or play music even if a playback handler is invoked', () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const { container } = render(<MusicProvider><Controls /></MusicProvider>);
  expect(container.querySelector('audio')).not.toHaveAttribute('src');
  expect(container.querySelector('audio')).toHaveAttribute('preload', 'none');
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(play).not.toHaveBeenCalled();
});

test('Premium playback stops and its source is removed when paid access is lost', async () => {
  mockAllowed = true;
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
  const { container, rerender } = render(<MusicProvider><Controls /></MusicProvider>);
  expect(container.querySelector('audio')).toHaveAttribute('src');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  expect(play).toHaveBeenCalledTimes(1);
  mockAllowed = false;
  rerender(<MusicProvider><Controls /></MusicProvider>);
  expect(pause).toHaveBeenCalledTimes(1);
  expect(container.querySelector('audio')).not.toHaveAttribute('src');
});

const songs = ['first', 'second'].map((id) => normalizeTrack({ id, title: id, duration: 120 }));
const mountPremium = () => {
  mockAllowed = true;
  return render(<MusicProvider><Controls /></MusicProvider>);
};

test('a song tap attaches and plays the selected source synchronously, including nonzero queue indexes', async () => {
  let playedSource;
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    playedSource = this.getAttribute('src');
    return Promise.resolve();
  });
  mountPremium();
  const snapshots = [];
  music.subscribe(() => snapshots.push(music.snapshot(true)));
  await act(async () => {
    music.playQueue(songs, 1, 'romantic');
    // Must happen inside the caller's gesture, before a timer or React commit.
    expect(play).toHaveBeenCalledTimes(1);
    expect(playedSource).toBe(songs[1].src);
  });
  expect(music.track.id).toBe(songs[1].id);
  expect(music.playing).toBe(true);
  expect(snapshots[0]).toMatchObject({ index: 1, trackId: songs[1].id, playing: true, position: 0 });
});

test('a rejected play promise from an older selection cannot stop the new song', async () => {
  let rejectOld;
  jest.spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }))
    .mockResolvedValue();
  mountPremium();
  act(() => music.playQueue(songs));
  await act(async () => music.select(1));
  await act(async () => rejectOld(new DOMException('Blocked', 'NotAllowedError')));
  expect(music.track.id).toBe(songs[1].id);
  expect(music.playing).toBe(true);
  expect(music.needsTap).toBe(false);
  expect(music.error).toBe('');
});

test('blocked mobile playback clears buffering and can be resumed by a new tap', async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play')
    .mockRejectedValueOnce(new DOMException('Tap required', 'NotAllowedError'))
    .mockResolvedValue();
  mountPremium();
  await act(async () => music.playQueue(songs));
  expect(music.needsTap).toBe(true);
  expect(music.loading).toBe(false);
  expect(music.snapshot().playing).toBe(false);
  await act(async () => music.resume());
  expect(play).toHaveBeenCalledTimes(2);
  expect(music.needsTap).toBe(false);
  expect(music.playing).toBe(true);
});

test('pause cancels a pending start and ignores its later resolution', async () => {
  jest.useFakeTimers();
  let resolvePlay;
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise((resolve) => { resolvePlay = resolve; }));
  mountPremium();
  act(() => music.playQueue(songs));
  expect(music.loading).toBe(true);
  act(() => music.toggle());
  await act(async () => resolvePlay());
  act(() => jest.advanceTimersByTime(30000));
  expect(music.loading).toBe(false);
  expect(music.playing).toBe(false);
  expect(music.snapshot().playing).toBe(false);
  expect(play).toHaveBeenCalledTimes(1);
});

test('a stalled stream retries once through the alternate provider and then shows a retryable error', () => {
  jest.useFakeTimers();
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise(() => {}));
  const { container } = mountPremium();
  act(() => music.playQueue(songs));
  act(() => jest.advanceTimersByTime(12000));
  expect(container.querySelector('audio')).toHaveAttribute('src', streamUrl('first', true));
  expect(play).toHaveBeenCalledTimes(2);
  act(() => jest.advanceTimersByTime(12000));
  expect(music.error).toMatch(/Try again/);
  expect(music.loading).toBe(false);
  expect(music.snapshot().playing).toBe(false);
  act(() => jest.advanceTimersByTime(30000));
  expect(play).toHaveBeenCalledTimes(2);
});

test('media errors recover immediately, retaining playback position', async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const { container } = mountPremium();
  const audio = container.querySelector('audio');
  await act(async () => music.playQueue(songs));
  Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
  fireEvent.loadedMetadata(audio);
  audio.currentTime = 21;
  Object.defineProperty(audio, 'error', { configurable: true, value: { code: 2 } });
  await act(async () => fireEvent.error(audio));
  expect(play).toHaveBeenCalledTimes(2);
  expect(audio).toHaveAttribute('src', streamUrl('first', true));
  expect(music.snapshot().position).toBe(21);
  expect(music.error).toBe('');
});

test('remote paused tracks seek only after metadata and never start or broadcast', () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const { container } = mountPremium();
  const audio = container.querySelector('audio');
  const listener = jest.fn();
  music.subscribe(listener);
  act(() => music.applyRemote({ queue: songs, trackId: songs[1].id, playing: false, position: 45, repeat: 'one', shuffle: true }));
  expect(play).not.toHaveBeenCalled();
  expect(audio.currentTime).toBe(0);
  expect(music.snapshot()).toMatchObject({ trackId: songs[1].id, playing: false, position: 45, repeat: 'one', shuffle: true });
  Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
  fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(45);
  expect(listener).not.toHaveBeenCalled();
});

test('switching songs resets duration and old startup timers are cleaned up on unmount', async () => {
  jest.useFakeTimers();
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const { container, unmount } = mountPremium();
  const audio = container.querySelector('audio');
  Object.defineProperty(audio, 'duration', { configurable: true, value: 200 });
  fireEvent.loadedMetadata(audio);
  expect(music.duration).toBe(200);
  play.mockImplementation(() => new Promise(() => {}));
  act(() => music.playQueue(songs));
  expect(music.duration).toBe(0);
  unmount();
  act(() => jest.advanceTimersByTime(30000));
  expect(play).toHaveBeenCalledTimes(1);
});

test('a rejected stream start retries immediately and succeeds without an error message', async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play')
    .mockRejectedValueOnce(new DOMException('Network failed', 'NotSupportedError'))
    .mockResolvedValue();
  const { container } = mountPremium();
  await act(async () => music.playQueue(songs));
  expect(play).toHaveBeenCalledTimes(2);
  expect(container.querySelector('audio')).toHaveAttribute('src', streamUrl('first', true));
  expect(music.playing).toBe(true);
  expect(music.loading).toBe(false);
  expect(music.error).toBe('');
});

test('losing Premium cancels a pending stream and its recovery timer', () => {
  jest.useFakeTimers();
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise(() => {}));
  const { container, rerender } = mountPremium();
  act(() => music.playQueue(songs));
  mockAllowed = false;
  rerender(<MusicProvider><Controls /></MusicProvider>);
  act(() => jest.advanceTimersByTime(30000));
  expect(container.querySelector('audio')).not.toHaveAttribute('src');
  expect(music.loading).toBe(false);
  expect(music.snapshot().playing).toBe(false);
  expect(play).toHaveBeenCalledTimes(1);
});

test('resuming after the browser pauses needs only one tap', async () => {
  let paused = true;
  jest.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
    paused = false;
    return Promise.resolve();
  });
  const { container } = mountPremium();
  await act(async () => music.playQueue(songs));
  paused = true;
  fireEvent.pause(container.querySelector('audio'));
  expect(music.snapshot().playing).toBe(false);
  await act(async () => music.toggle());
  expect(play).toHaveBeenCalledTimes(2);
  expect(music.playing).toBe(true);
});
