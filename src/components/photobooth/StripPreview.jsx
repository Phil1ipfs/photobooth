import React, { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import { FavoriteButton, Sparkle, DoodleHeart } from '../common/misc';
import { Skeleton } from '../common/misc';
import { renderStrip } from '../../templates/render';
import PremiumBadge from '../billing/PremiumBadge';

/** Real-time rendered strip with action buttons. Reports the rendered URL via onRendered. */
export default function StripPreview({
  template,
  layout,
  photos,
  aspect,
  filter = 'auto',
  onRendered,
  actions,
  favorite,
  onFavorite,
  busyAction,
  hd,
  hdLocked,
  onToggleHd,
}) {
  const [url, setUrl] = useState(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let alive = true;
    setRendering(true);
    renderStrip(template, { photos, aspect, layout, filter, scale: 0.6 })
      .then((canvas) => {
        if (!alive) return;
        const u = canvas.toDataURL('image/jpeg', 0.9);
        setUrl(u);
        onRendered?.(u);
      })
      .catch(() => {})
      .finally(() => alive && setRendering(false));
    return () => {
      alive = false;
    };
  }, [template, layout, photos, aspect, filter, onRendered]);

  const count = photos.filter(Boolean).length;

  return (
    <section className="strip-panel card" aria-labelledby="strip-title">
      <div className="strip-panel-head">
        <h2 id="strip-title">Your Photo Strip</h2>
        <span className="strip-panel-rule" aria-hidden="true" />
        <span className="strip-panel-tpl">{template.name}</span>
        <FavoriteButton active={favorite} onToggle={onFavorite} label="favorites" />
      </div>

      <div className="strip-stage">
        <Sparkle size={14} className="deco-twinkle" style={{ left: '12%', top: '28%' }} />
        <Sparkle size={18} className="deco-twinkle" style={{ right: '10%', top: '40%', animationDelay: '1.2s' }} />
        <DoodleHeart size={22} style={{ left: '14%', top: '62%' }} />
        {url ? (
          <img
            key={`${template.id}-${layout.id}`}
            src={url}
            alt={`${template.name} strip preview, ${count} of ${layout.photoCount} shots taken`}
            className={`strip-img strip-live${rendering ? ' updating' : ''}`}
          />
        ) : (
          <Skeleton width={150} height={460} radius={6} />
        )}
      </div>

      <p className="strip-progress">
        {count === layout.photoCount ? (
          <>
            <Icon name="check-circle" size={16} /> All {layout.photoCount} photos captured
          </>
        ) : (
          `${count} of ${layout.photoCount} photos captured · ${layout.label} ${layout.name}`
        )}
      </p>

      <div className="strip-actions" role="group" aria-label="Photo strip actions">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="strip-action"
            onClick={a.onClick}
            disabled={a.disabled || !!busyAction}
            aria-label={a.label}
          >
            <span className="strip-action-icon">
              {busyAction === a.id ? <span className="btn-spinner" /> : <Icon name={a.icon} size={18} />}
            </span>
            <span>{a.short || a.label}</span>
          </button>
        ))}
      </div>

      {onToggleHd && (
        <label className={`hd-toggle${hdLocked ? ' is-locked' : ''}`}>
          <span>
            <strong>HD download</strong>
            <small>2× resolution for printing</small>
          </span>
          {hdLocked && <PremiumBadge locked compact />}
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={!!hd && !hdLocked}
            onChange={(e) => onToggleHd(e.target.checked)}
            aria-label="HD download, 2× resolution"
          />
        </label>
      )}
    </section>
  );
}
