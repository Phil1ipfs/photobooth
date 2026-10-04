import React, { useEffect, useRef, useState } from 'react';
import { LIVE, createLiveRenderer } from '../../lib/liveStrip';

/**
 * Plays a Live Strip (boomerang) inside the selected template, drawn on a canvas.
 * Pauses when off-screen / tab hidden, and honours "reduce motion" (shows a still
 * until tapped).
 */
export default function LiveStripPlayer({ template, frames, layout, aspect, filter, scale = 0.6, className = '', label }) {
  const canvasRef = useRef(null);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduceMotion);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let visible = true;
    const canvas = canvasRef.current;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    createLiveRenderer(template, frames, { aspect, layout, filter, scale }).then((r) => {
      if (!alive) return;
      canvas.width = r.width;
      canvas.height = r.height;
      const ctx = canvas.getContext('2d');
      r.draw(ctx, 0);
      if (!playing) return;
      let last = -1;
      const start = performance.now();
      const tick = (now) => {
        if (!alive) return;
        const step = Math.floor((now - start) / LIVE.frameMs);
        if (step !== last && visible && !document.hidden) {
          r.draw(ctx, step);
          last = step;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [template, frames, layout, aspect, filter, scale, playing]);

  return (
    <span className={`live-player ${className}`}>
      <canvas ref={canvasRef} className="strip-img" role="img" aria-label={label || `${template.name} Live Strip`} />
      <span className="live-tag" aria-hidden="true">
        <i /> LIVE
      </span>
      {!playing && (
        <button type="button" className="live-play" onClick={() => setPlaying(true)} aria-label="Play Live Strip">
          ▶
        </button>
      )}
    </span>
  );
}
