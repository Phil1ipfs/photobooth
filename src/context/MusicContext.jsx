// Background music. Lives at the app root so playback continues across pages.
// The queue is the bundled track(s) below until the user plays something from the
// music library (Audius — see lib/music.js).
//
// LDR rooms sync playback through `subscribe` (local user actions) and
// `applyRemote` (the partner's actions — applied without being re-broadcast).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import looseTrack from '../assets/loose.mp3';
import { shareableTrack, streamUrl, trackFromShared } from '../lib/music';
import { hashString } from '../templates/draw';
import { useEntitlements } from './EntitlementsContext';

// Add more tracks here (import the file from src/assets) and the player will
// show a track list automatically.
export const TRACKS = [
  { id: 'loose', title: 'Loose', artist: 'Daniel Caesar', src: looseTrack, cover: ['#e7a3b3', '#7a1030'], source: 'local' },
];

const MusicContext = createContext(null);
const REPEAT_MODES = ['off', 'all', 'one'];
const BUFFER_TIMEOUT = 12000;

/** Next index after `index`. Shuffle is seeded by the track id, so two devices with the same queue agree. */
export function nextIndex(queue, index, { shuffle, step = 1 }) {
  const n = queue.length;
  if (n <= 1) return 0;
  if (!shuffle) return (index + step + n) % n;
  const jump = 1 + (hashString(queue[index]?.id || '') % (n - 1));
  return (index + step * jump + n * n) % n;
}

export function MusicProvider({ children }) {
  const { ready, canUseFeature } = useEntitlements();
  const allowed = ready && canUseFeature('music_library');
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const audioRef = useRef(null);
  const playback = useRef({ version: 0, wanted: false, retried: false, seek: null, timer: null });
  const recoverRef = useRef(null);
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

  const clearBufferTimer = useCallback(() => {
    clearTimeout(playback.current.timer);
    playback.current.timer = null;
  }, []);

  const fail = useCallback(() => {
    clearBufferTimer();
    playback.current.version += 1;
    playback.current.wanted = false;
    audioRef.current?.pause();
    setLoading(false);
    setPlaying(false);
    setError('This song could not load. Try again or choose another song.');
    emit('error');
  }, [clearBufferTimer, emit]);

  const watchBuffer = useCallback(() => {
    clearBufferTimer();
    playback.current.timer = setTimeout(() => {
      if (playback.current.wanted && !recoverRef.current?.()) fail();
    }, BUFFER_TIMEOUT);
  }, [clearBufferTimer, fail]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const play = useCallback(async () => {
    if (!allowedRef.current) return false;
    const a = audioRef.current;
    if (!a) return false;
    if (!playback.current.wanted) {
      playback.current.retried = false;
      if (a.error) a.load();
    }
    const version = ++playback.current.version;
    playback.current.wanted = true;
    setError('');
    setNeedsTap(false);
    setLoading(a.readyState < 3);
    watchBuffer();
    try {
      await a.play();
      if (version !== playback.current.version || !allowedRef.current) return false;
      clearBufferTimer();
      setLoading(false);
      setPlaying(true);
      return true;
    } catch (err) {
      // A newer selection or Pause owns the player now; ignore the old promise.
      if (version !== playback.current.version || !allowedRef.current) return false;
      clearBufferTimer();
      setPlaying(false);
      if (err?.name === 'NotAllowedError') {
        playback.current.wanted = false;
        setLoading(false);
        setNeedsTap(true);
      } else if (!recoverRef.current?.()) fail();
      return false;
    }
  }, [watchBuffer, clearBufferTimer, fail]);

  const applySeek = useCallback(() => {
    const a = audioRef.current;
    const at = playback.current.seek;
    if (!a || at === null || !a.readyState) return;
    try {
      a.currentTime = Number.isFinite(a.duration) ? Math.min(at, a.duration) : at;
      playback.current.seek = null;
    } catch {
      // Some mobile browsers only allow seeking once media data is available.
    }
  }, []);

  const recover = useCallback(() => {
    const p = playback.current;
    const a = audioRef.current;
    const s = state.current;
    const current = s.queue[s.index];
    if (!allowedRef.current || !p.wanted || p.retried || current?.source !== 'audius' || !a) return false;
    clearBufferTimer();
    p.version += 1;
    p.retried = true;
    p.seek = p.seek ?? (a.currentTime || 0);
    a.src = streamUrl(current.audiusId, true);
    a.load();
    play();
    return true;
  }, [clearBufferTimer, play]);
  recoverRef.current = recover;

  /** Attach the source and call play inside the tap, preserving mobile permission. */
  const load = useCallback(
    (i, { autoplay = true, at = 0 } = {}) => {
      if (!allowedRef.current || !state.current.queue[i]) return;
      const a = audioRef.current;
      if (!a) return;
      clearBufferTimer();
      playback.current.version += 1;
      playback.current.wanted = autoplay;
      playback.current.retried = false;
      playback.current.seek = Math.max(0, Number(at) || 0);
      state.current.index = i;
      setIndex(i);
      setTime(at);
      setDuration(0);
      setPlaying(false);
      setLoading(autoplay);
      setError('');
      setNeedsTap(false);
      a.src = state.current.queue[i].src;
      a.load();
      if (autoplay) play();
    },
    [play, clearBufferTimer]
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.paused || (playback.current.wanted && playback.current.timer !== null)) {
      clearBufferTimer();
      playback.current.version += 1;
      playback.current.wanted = false;
      a.pause();
      setPlaying(false);
      setLoading(false);
      emit('pause');
    } else {
      // Retry a failed source from a fresh user gesture.
      play().then((started) => { if (started) emit('play'); });
    }
  }, [play, emit, clearBufferTimer]);

  const seek = useCallback(
    (t) => {
      const a = audioRef.current;
      if (a && Number.isFinite(t)) {
        playback.current.seek = Math.max(0, t);
        applySeek();
        setTime(t);
        emit('seek');
      }
    },
    [emit, applySeek]
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
      if (!allowedRef.current || !list?.length || !list[i]) return;
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
    else {
      playback.current.wanted = false;
      clearBufferTimer();
      setPlaying(false);
    }
  };

  /** Shareable state for the LDR partner (`withQueue` adds the track list). */
  const snapshot = useCallback((withQueue = false) => {
    const s = state.current;
    const a = audioRef.current;
    return {
      ...(withQueue ? { queue: s.queue.map(shareableTrack) } : {}),
      trackId: s.queue[s.index]?.id,
      index: s.index,
      playing: playback.current.wanted && !!a && (!a.paused || playback.current.timer !== null),
      position: playback.current.seek ?? (a ? a.currentTime : 0),
      shuffle: s.shuffle,
      repeat: s.repeat,
    };
  }, []);

  /** Apply the partner's playback state (validated; never re-broadcast). */
  const applyRemote = useCallback(
    (snap) => {
      if (!allowedRef.current || !snap || typeof snap !== 'object') return;
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
      if (typeof snap.shuffle === 'boolean') {
        state.current.shuffle = snap.shuffle;
        setShuffleState(snap.shuffle);
      }
      if (REPEAT_MODES.includes(snap.repeat)) {
        state.current.repeat = snap.repeat;
        setRepeatState(snap.repeat);
      }
      const i = list.findIndex((t) => t.id === snap.trackId);
      if (i < 0) return;
      const position = Math.max(0, Number(snap.position) || 0);
      const a = audioRef.current;
      if (i !== state.current.index || Array.isArray(snap.queue)) {
        load(i, { autoplay: !!snap.playing, at: position });
        return;
      }
      if (a && Math.abs(a.currentTime - position) > 1.5) {
        playback.current.seek = position;
        applySeek();
      }
      if (snap.playing) play();
      else {
        clearBufferTimer();
        playback.current.version += 1;
        playback.current.wanted = false;
        a?.pause();
        setLoading(false);
        setPlaying(false);
      }
    },
    [load, play, applySeek, clearBufferTimer]
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

  useEffect(() => {
    const a = audioRef.current;
    const p = playback.current;
    if (!a) return undefined;
    if (!allowed) {
      const hadSource = a.hasAttribute('src');
      a.removeAttribute('src');
      if (hadSource) a.load();
      setPlaying(false);
      setLoading(false);
      setNeedsTap(false);
      setError('');
    } else {
      const s = state.current;
      a.src = s.queue[s.index].src;
      a.load();
    }
    return () => {
      clearBufferTimer();
      p.version += 1;
      p.wanted = false;
      if (!a.paused) a.pause();
    };
  }, [allowed, clearBufferTimer]);

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        loop={queue.length === 1 && repeat !== 'off'}
        preload={allowed ? 'metadata' : 'none'}
        onPlay={() => { if (playback.current.wanted) setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => {
          if (playback.current.wanted) { setLoading(true); watchBuffer(); }
        }}
        onStalled={() => {
          if (playback.current.wanted) { setLoading(true); watchBuffer(); }
        }}
        onPlaying={() => {
          if (!allowedRef.current || !playback.current.wanted) return;
          clearBufferTimer();
          setLoading(false);
          setPlaying(true);
        }}
        onCanPlay={applySeek}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
          applySeek();
        }}
        onEnded={onEnded}
        onError={(e) => {
          if (!allowedRef.current || !e.currentTarget.error) return;
          if (!recover()) fail();
        }}
      />
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
