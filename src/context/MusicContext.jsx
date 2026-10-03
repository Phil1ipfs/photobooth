// Background music. Lives at the app root so playback continues across pages.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import looseTrack from '../assets/loose.mp3';

// Add more tracks here (import the file from src/assets) and the player will
// show a track list automatically.
export const TRACKS = [
  { id: 'loose', title: 'Loose', artist: 'Daniel Caesar', src: looseTrack, cover: ['#e7a3b3', '#7a1030'] },
];

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const track = TRACKS[index];

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const play = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setError('');
    } catch (err) {
      setPlaying(false);
      setError('Couldn’t play the music. Please check that the audio file exists.');
    }
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) play();
    else a.pause();
  }, [play]);

  const seek = useCallback((t) => {
    const a = audioRef.current;
    if (a && Number.isFinite(t)) {
      a.currentTime = t;
      setTime(t);
    }
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    if (v > 0) setMuted(false);
  }, []);

  const select = useCallback(
    (i) => {
      setIndex(i);
      setTime(0);
      // Wait for the new src to attach before playing.
      setTimeout(play, 0);
    },
    [play]
  );

  const next = useCallback(() => select((index + 1) % TRACKS.length), [index, select]);
  const prev = useCallback(() => select((index - 1 + TRACKS.length) % TRACKS.length), [index, select]);

  const value = useMemo(
    () => ({
      tracks: TRACKS,
      track,
      index,
      playing,
      volume,
      muted,
      time,
      duration,
      error,
      toggle,
      seek,
      setVolume,
      setMuted,
      select,
      next,
      prev,
    }),
    [track, index, playing, volume, muted, time, duration, error, toggle, seek, setVolume, select, next, prev]
  );

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={track.src}
        loop={TRACKS.length === 1}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => (TRACKS.length > 1 ? next() : setPlaying(false))}
        onError={() => setError('Couldn’t load the music file.')}
      />
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
