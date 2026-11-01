import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MusicProvider, useMusic } from './MusicContext';

let mockAllowed = false;
jest.mock('./EntitlementsContext', () => ({ useEntitlements: () => ({ ready: true, canUseFeature: () => mockAllowed }) }));

function Controls() {
  const music = useMusic();
  return <button onClick={music.resume}>Play</button>;
}

beforeEach(() => { mockAllowed = false; });
afterEach(() => jest.restoreAllMocks());

test('Free cannot load or play music even if a playback handler is invoked', () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const { container } = render(<MusicProvider><Controls /></MusicProvider>);
  expect(container.querySelector('audio')).not.toHaveAttribute('src');
  expect(container.querySelector('audio')).toHaveAttribute('preload', 'none');
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(play).not.toHaveBeenCalled();
});

test('Premium playback stops and its source is removed when paid access is lost', () => {
  mockAllowed = true;
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
  const { container, rerender } = render(<MusicProvider><Controls /></MusicProvider>);
  expect(container.querySelector('audio')).toHaveAttribute('src');
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(play).toHaveBeenCalledTimes(1);
  mockAllowed = false;
  rerender(<MusicProvider><Controls /></MusicProvider>);
  expect(pause).toHaveBeenCalledTimes(1);
  expect(container.querySelector('audio')).not.toHaveAttribute('src');
});
