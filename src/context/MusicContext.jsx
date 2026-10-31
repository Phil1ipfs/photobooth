// Background music. Lives at the app root so playback continues across pages.
// The queue is the bundled track(s) below until the user plays something from the
// music library (Audius — see lib/music.js).
//
// LDR rooms sync playback through `subscribe` (local user actions) and
// `applyRemote` (the partner's actions — applied without being re-broadcast).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import looseTrack from '../assets/loose.mp3';
import { shareableTrack, trackFromShared } from '../lib/music';
import { hashString } from '../templates/draw';

// Add more tracks here (import the file from src/assets) and the player will
// show a track list automatically.
export const TRACKS = [
  { id: 'loose', title: 'Loose', artist: 'Daniel Caesar', src: looseTrack, cover: ['#e7a3b3', '#7a1030'], source: 'local' },
];

const MusicContext = createContext(null);
const REPEAT_MODES = ['off', 'all', 'one'];

/** Next index after `index`. Shuffle is seeded by the track id, so two devices with the same queue agree. */
export function nextIndex(queue, index, { shuffle, step = 1 }) {
  const n = queue.length;
  if (n <= 1) return 0;
  if (!shuffle) return (index + step + n) % n;
  const jump = 1 + (hashString(queue[index]?.id || '') % (n - 1));
  return (index + step * jump + n * n) % n;
}

export function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState(TRACKS);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [needsTap, setNeedsTap] = useState(false); // the browser blocked playback until the user taps
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState('all');
  const [category, setCategory] = useState(null); // library shelf the music came from (theme hints)
  const track = queue[index] || queue[0];

  const listeners = useRef(new Set());
  const emit = useCallback((kind) => listeners.current.forEach((fn) => fn(kind)), []);
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  const state = useRef({});
  state.current = { queue, index, shuffle, repeat };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const play = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setError('');
      setNeedsTap(false);
    } catch (err) {
      setPlaying(false);
      if (err?.name === 'NotAllowedError') setNeedsTap(true);
      else if (err?.name !== 'AbortError') setError('Couldn’t play this song. Pick another one.');
    }
  }, []);

  /** Switch to queue[i] and start it (after the new src attaches). */
  const load = useCallback(
    (i, { autoplay = true, at = 0 } = {}) => {
      setIndex(i);
      setTime(at);
      setError('');
      setTimeout(() => {
        const a = audioRef.current;
        if (a && at) a.currentTime = at;
        if (autoplay) play();
      }, 0);
    },
    [play]
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) play().then(() => emit('play'));
    else {
      a.pause();
      emit('pause');
    }
  }, [play, emit]);

  const seek = useCallback(
    (t) => {
      const a = audioRef.current;
      if (a && Number.isFinite(t)) {
        a.currentTime = t;
        setTime(t);
        emit('seek');
      }
    },
    [emit]
  );

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    if (v > 0) setMuted(false);
  }, []);

  const select = useCallback(
    (i) => {
      load(i);
      emit('track');
    },
    [load, emit]
  );

  /** Replace the queue (e.g. with search results) and play `list[i]`. */
  const playQueue = useCallback(
    (list, i = 0, cat = null) => {
      setQueue(list);
      setCategory(cat);
      state.current.queue = list;
      load(i);
      emit('track');
    },
    [load, emit]
  );

  const next = useCallback(() => select(nextIndex(queue, index, { shuffle })), [queue, index, shuffle, select]);
  const prev = useCallback(() => select(nextIndex(queue, index, { shuffle, step: -1 })), [queue, index, shuffle, select]);

  const setShuffle = useCallback(
    (on) => {
      setShuffleState(on);
      state.current.shuffle = on;
      emit('mode');
    },
    [emit]
  );
  const cycleRepeat = useCallback(() => {
    const nextMode = REPEAT_MODES[(REPEAT_MODES.indexOf(state.current.repeat) + 1) % REPEAT_MODES.length];
    setRepeatState(nextMode);
    state.current.repeat = nextMode;
    emit('mode');
  }, [emit]);

  const onEnded = () => {
    // Not broadcast: both devices reach the end together and pick the same next track.
    if (repeat === 'one') load(index);
    else if (repeat === 'all' || index < queue.length - 1) load(nextIndex(queue, index, { shuffle }));
    else setPlaying(false);
  };

  /** Shareable state for the LDR partner (`withQueue` adds the track list). */
  const snapshot = useCallback((withQueue = false) => {
    const s = state.current;
    const a = audioRef.current;
    return {
      ...(withQueue ? { queue: s.queue.map(shareableTrack) } : {}),
      trackId: s.queue[s.index]?.id,
      index: s.index,
      playing: !!a && !a.paused,
      position: a ? a.currentTime : 0,
      shuffle: s.shuffle,
      repeat: s.repeat,
    };
  }, []);

  /** Apply the partner's playback state (validated; never re-broadcast). */
  const applyRemote = useCallback(
    (snap) => {
      if (!snap || typeof snap !== 'object') return;
      let list = state.current.queue;
      if (Array.isArray(snap.queue)) {
        const incoming = snap.queue.slice(0, 50).map((t) => trackFromShared(t, TRACKS)).filter(Boolean);
        if (incoming.length) {
          list = incoming;
          setQueue(incoming);
          setCategory(null);
          state.current.queue = incoming;
        }
      }
      if (typeof snap.shuffle === 'boolean') setShuffleState(snap.shuffle);
      if (REPEAT_MODES.includes(snap.repeat)) setRepeatState(snap.repeat);
      const i = list.findIndex((t) => t.id === snap.trackId);
      if (i < 0) return;
      const position = Math.max(0, Number(snap.position) || 0);
      const a = audioRef.current;
      if (i !== state.current.index || Array.isArray(snap.queue)) {
        load(i, { autoplay: !!snap.playing, at: position });
        return;
      }
      if (a && Math.abs(a.currentTime - position) > 1.5) a.currentTime = position;
      if (snap.playing) play();
      else a?.pause();
    },
    [load, play]
  );

  const value = useMemo(
    () => ({
      tracks: queue,
      track,
      index,
      playing,
      loading,
      volume,
      muted,
      time,
      duration,
      error,
      needsTap,
      shuffle,
      repeat,
      category,
      toggle,
      resume: play,
      seek,
      setVolume,
      setMuted,
      select,
      next,
      prev,
      playQueue,
      setShuffle,
      cycleRepeat,
      subscribe,
      snapshot,
      applyRemote,
      clearError: () => setError(''),
    }),
    [queue, track, index, playing, loading, volume, muted, time, duration, error, needsTap, shuffle, repeat, category, toggle, play, seek, setVolume, select, next, prev, playQueue, setShuffle, cycleRepeat, subscribe, snapshot, applyRemote]
  );

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={track.src}
        loop={queue.length === 1 && repeat !== 'off'}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={onEnded}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          setError(track.source === 'audius' ? 'This song can’t be played right now. Pick another one.' : 'Couldn’t load the music file.');
          emit('error');
        }}
      />
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
