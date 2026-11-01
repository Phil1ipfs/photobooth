import React, { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { useMusic } from '../../context/MusicContext';
import { useToast } from '../../context/ToastContext';
import { useEntitlements } from '../../context/EntitlementsContext';
import { formatTime } from '../../lib/format';
import { MUSIC_CATEGORIES, searchTracks } from '../../lib/music';

function Cover({ track, spinning, size = 48 }) {
  const [broken, setBroken] = useState(false);
  if (track.artwork && !broken) {
    return (
      <img
        className={`music-cover music-art${spinning ? ' spinning' : ''}`}
        src={track.artwork}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  const [a, b] = track.cover || ['#e7a3b3', '#7a1030'];
  return (
    <span
      className={`music-cover${spinning ? ' spinning' : ''}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden="true"
    >
      <Icon name="music" size={18} />
    </span>
  );
}

/** Search + mood/genre shelves from the Audius library. */
function Browse({ onPlayed }) {
  const m = useMusic();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(m.category || 'romantic');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error | done
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const chipsRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: true });
  const updateEdges = () => {
    const el = chipsRef.current;
    if (el) setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  const scrollChips = (dir) => chipsRef.current?.scrollBy({ left: dir * chipsRef.current.clientWidth * 0.7 });

  // A mouse wheel scrolls the mood row sideways (trackpads and touch already do).
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return undefined;
    updateEdges();
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(
      async () => {
        setStatus('loading');
        try {
          const list = await searchTracks({ query, category: query.trim() ? null : category, signal: ctrl.signal });
          setResults(list);
          setStatus('done');
        } catch (err) {
          if (err.name === 'AbortError') return;
          setError(err.message);
          setStatus('error');
        }
      },
      query ? 400 : 0,
    ); // debounce typing
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, category, attempt]);

  const pick = (i) => {
    m.playQueue(results, i, query.trim() ? null : category);
    onPlayed?.();
  };

  return (
    <div className="music-browse">
      <label className="music-search">
        <Icon name="search" size={15} />
        <input
          type="search"
          placeholder="Search songs or artists"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search music"
        />
      </label>
      <div className="music-chips-wrap">
        <button
          type="button"
          className="music-chips-arrow"
          aria-label="Scroll moods left"
          disabled={!edges.left}
          onClick={() => scrollChips(-1)}
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <div className="music-chips" role="group" aria-label="Moods and genres" ref={chipsRef} onScroll={updateEdges}>
          {MUSIC_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={!query.trim() && category === c.id}
              onClick={() => {
                setQuery('');
                setCategory(c.id);
              }}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="music-chips-arrow"
          aria-label="Scroll moods right"
          disabled={!edges.right}
          onClick={() => scrollChips(1)}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
      <div className="music-results" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' && (
          <p className="music-note">
            <span className="btn-spinner" /> Finding songs…
          </p>
        )}
        {status === 'error' && (
          <p className="music-note">
            {error}{' '}
            <button type="button" className="link-btn" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        )}
        {status === 'done' && results.length === 0 && <p className="music-note">No songs found. Try another search.</p>}
        {status === 'done' && (
          <ul className="music-list music-list-rich" aria-label="Songs">
            {results.map((t, i) => (
              <li key={t.id}>
                <button type="button" aria-current={m.track.id === t.id || undefined} onClick={() => pick(i)}>
                  <Cover track={t} size={34} />
                  <span className="music-row-meta">
                    <strong>{t.title}</strong>
                    <small>{t.artist}</small>
                  </span>
                  <small className="music-row-time">{formatTime(t.duration)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="music-credit">
        Music streamed from{' '}
        <a href="https://audius.co" target="_blank" rel="noreferrer">
          Audius
        </a>{' '}
        · songs belong to their artists
      </p>
    </div>
  );
}

/** Floating music player. `compact` starts collapsed to the round music button. */
export default function MusicPlayer({ compact = false, shared = false }) {
  const m = useMusic();
  const { ready, canUseFeature, openUpgrade } = useEntitlements();
  const allowed = ready && canUseFeature('music_library');
  const toast = useToast();
  const [open, setOpen] = useState(!compact && window.innerWidth >= 1560);
  const [tab, setTab] = useState('now');
  const [volOpen, setVolOpen] = useState(false);
  const volRef = useRef(null);

  useEffect(() => {
    if (allowed && m.error) toast.error('Music unavailable', m.error);
  }, [allowed, m.error, toast]);

  useEffect(() => {
    if (!volOpen) return undefined;
    const close = (e) => !volRef.current?.contains(e.target) && setVolOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [volOpen]);

  const pct = m.duration ? (m.time / m.duration) * 100 : 0;
  const vol = m.muted ? 0 : m.volume;
  const repeatLabel = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[m.repeat];

  if (!allowed) return (
    <div className={`music${compact ? ' music-compact' : ''}`}>
      <button className="music-fab" aria-label="Music library (Premium)" onClick={() => openUpgrade({ feature: 'music_library', title: 'Unlock the music library', description: 'Play music while taking photos with Premium.' })}>
        <Icon name="lock" size={22} />
      </button>
    </div>
  );

  return (
    <div className={`music${open ? ' open' : ''}${compact ? ' music-compact' : ''}`}>
      {open && (
        <section className="music-card" aria-label="Music player">
          <div className="music-tabs segmented" role="group" aria-label="Music">
            <button type="button" aria-pressed={tab === 'now'} onClick={() => setTab('now')}>
              Now playing
            </button>
            <button type="button" aria-pressed={tab === 'browse'} onClick={() => setTab('browse')}>
              Browse music
            </button>
          </div>
          {shared && (
            <p className="music-shared">
              <Icon name="users" size={13} /> Synced with your partner
            </p>
          )}

          {tab === 'browse' ? (
            <Browse onPlayed={() => setTab('now')} />
          ) : (
            <>
              <div className="music-head">
                <Cover key={m.track.id} track={m.track} spinning={m.playing} />
                <div className="music-meta">
                  <strong>{m.track.title}</strong>
                  <small>
                    {m.track.link ? (
                      <a href={m.track.link} target="_blank" rel="noreferrer">
                        {m.track.artist}
                      </a>
                    ) : (
                      m.track.artist
                    )}
                    {m.loading && ' · loading…'}
                  </small>
                </div>
                <div className="music-skip">
                  <button
                    className="icon-btn icon-btn-sm icon-btn-plain"
                    onClick={m.prev}
                    aria-label="Previous song"
                    disabled={m.tracks.length < 2}
                  >
                    <Icon name="skip-back" size={14} />
                  </button>
                  <button
                    className="icon-btn icon-btn-sm icon-btn-plain"
                    onClick={m.next}
                    aria-label="Next song"
                    disabled={m.tracks.length < 2}
                  >
                    <Icon name="skip-forward" size={14} />
                  </button>
                </div>
              </div>
              {m.needsTap && (
                <button type="button" className="music-tap" onClick={m.resume}>
                  <Icon name="play" size={14} /> Tap to listen together
                </button>
              )}
              <div className="music-controls">
                <button className="music-play" onClick={m.toggle} aria-label={m.playing ? 'Pause music' : 'Play music'}>
                  {m.loading && m.playing ? (
                    <span className="btn-spinner" />
                  ) : (
                    <Icon name={m.playing ? 'pause' : 'play'} size={16} />
                  )}
                </button>
                <div className="music-vol" ref={volRef}>
                  <button
                    className="icon-btn icon-btn-sm icon-btn-plain"
                    onClick={() => setVolOpen((v) => !v)}
                    aria-label="Volume"
                    aria-expanded={volOpen}
                  >
                    <Icon name={vol === 0 ? 'volume-x' : 'volume'} size={17} />
                  </button>
                  {volOpen && (
                    <div className="music-vol-pop">
                      <input
                        type="range"
                        className="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={vol}
                        style={{ '--pct': `${vol * 100}%` }}
                        onChange={(e) => m.setVolume(parseFloat(e.target.value))}
                        aria-label="Volume"
                      />
                      <button className="link-btn" onClick={() => m.setMuted(!m.muted)}>
                        {m.muted ? 'Unmute' : 'Mute'}
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="range"
                  className="range music-progress"
                  min="0"
                  max={m.duration || 0}
                  step="0.1"
                  value={Math.min(m.time, m.duration || 0)}
                  style={{ '--pct': `${pct}%` }}
                  onChange={(e) => m.seek(parseFloat(e.target.value))}
                  aria-label="Seek"
                  aria-valuetext={`${formatTime(m.time)} of ${formatTime(m.duration)}`}
                  disabled={!m.duration}
                />
                <span className="music-time">
                  {formatTime(m.time)} / {formatTime(m.duration)}
                </span>
              </div>
              <div className="music-modes">
                <button
                  type="button"
                  className="icon-btn icon-btn-sm icon-btn-plain"
                  aria-pressed={m.shuffle}
                  aria-label="Shuffle"
                  onClick={() => m.setShuffle(!m.shuffle)}
                >
                  <Icon name="shuffle" size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm icon-btn-plain"
                  aria-pressed={m.repeat !== 'off'}
                  aria-label={repeatLabel}
                  title={repeatLabel}
                  onClick={m.cycleRepeat}
                >
                  <Icon name="repeat" size={15} />
                  {m.repeat === 'one' && <span className="music-one">1</span>}
                </button>
                <button type="button" className="link-btn" onClick={() => setTab('browse')}>
                  <Icon name="search" size={13} /> Find songs
                </button>
              </div>
              {m.tracks.length > 1 && (
                <ul className="music-list" aria-label="Up next">
                  {m.tracks.map((t, i) => (
                    <li key={t.id}>
                      <button aria-current={i === m.index || undefined} onClick={() => m.select(i)}>
                        {t.title} <small>{t.artist}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
      <button
        className={`music-fab${m.playing ? ' playing' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Hide music player' : 'Show music player'}
      >
        <Icon name="music" size={22} />
        {m.playing && (
          <span className="music-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
    </div>
  );
}
