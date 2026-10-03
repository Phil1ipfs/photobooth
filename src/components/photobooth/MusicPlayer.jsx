import React, { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { useMusic } from '../../context/MusicContext';
import { useToast } from '../../context/ToastContext';
import { formatTime } from '../../lib/format';

/** Floating music player. `compact` starts collapsed to the round music button. */
export default function MusicPlayer({ compact = false }) {
  const m = useMusic();
  const toast = useToast();
  const [open, setOpen] = useState(!compact && window.innerWidth >= 1560);
  const [volOpen, setVolOpen] = useState(false);
  const volRef = useRef(null);

  useEffect(() => {
    if (m.error) toast.error('Music unavailable', m.error);
  }, [m.error, toast]);

  useEffect(() => {
    if (!volOpen) return undefined;
    const close = (e) => !volRef.current?.contains(e.target) && setVolOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [volOpen]);

  const pct = m.duration ? (m.time / m.duration) * 100 : 0;
  const vol = m.muted ? 0 : m.volume;

  return (
    <div className={`music${open ? ' open' : ''}${compact ? ' music-compact' : ''}`}>
      {open && (
        <section className="music-card" aria-label="Music player">
          <div className="music-head">
            <span
              className={`music-cover${m.playing ? ' spinning' : ''}`}
              style={{ background: `linear-gradient(135deg, ${m.track.cover[0]}, ${m.track.cover[1]})` }}
              aria-hidden="true"
            >
              <Icon name="music" size={18} />
            </span>
            <div className="music-meta">
              <strong>{m.track.title}</strong>
              <small>{m.track.artist}</small>
            </div>
            {m.tracks.length > 1 && (
              <div className="music-skip">
                <button className="icon-btn icon-btn-sm icon-btn-plain" onClick={m.prev} aria-label="Previous song">
                  <Icon name="skip-back" size={14} />
                </button>
                <button className="icon-btn icon-btn-sm icon-btn-plain" onClick={m.next} aria-label="Next song">
                  <Icon name="skip-forward" size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="music-controls">
            <button className="music-play" onClick={m.toggle} aria-label={m.playing ? 'Pause music' : 'Play music'}>
              <Icon name={m.playing ? 'pause' : 'play'} size={16} />
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
          {m.tracks.length > 1 && (
            <ul className="music-list" aria-label="Songs">
              {m.tracks.map((t, i) => (
                <li key={t.id}>
                  <button aria-current={i === m.index || undefined} onClick={() => m.select(i)}>
                    {t.title} <small>{t.artist}</small>
                  </button>
                </li>
              ))}
            </ul>
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
