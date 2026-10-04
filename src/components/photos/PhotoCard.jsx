import React from 'react';
import Icon from '../common/Icon';
import { FavoriteButton } from '../common/misc';
import { formatDate } from '../../lib/format';

/** Saved photo strip card. `onOpen` opens the large preview. */
export default function PhotoCard({ strip, onOpen, onFavorite, onDownload, onShare, onDelete, style }) {
  return (
    <article className="photo-card card card-hover" style={style}>
      <button type="button" className="photo-card-media" onClick={() => onOpen?.(strip)} aria-label={`Open ${strip.templateName} strip from ${formatDate(strip.createdAt)}`}>
        <img src={strip.url} alt="" loading="lazy" className="strip-img" />
        {strip.mediaType === 'live_strip' && (
          <span className="live-tag" aria-label="Live Strip">
            <i aria-hidden="true" /> LIVE
          </span>
        )}
      </button>
      <div className={`photo-card-body${onShare || onDelete ? ' photo-card-body-full' : ''}`}>
        <div className="photo-card-meta">
          <strong title={strip.templateName}>{strip.templateName}</strong>
          <small>{formatDate(strip.createdAt)}</small>
        </div>
        <div className="photo-card-actions">
          <FavoriteButton active={strip.favorite} onToggle={() => onFavorite(strip)} label="favorites" />
          <button className="icon-btn icon-btn-sm" onClick={() => onDownload(strip)} aria-label="Download">
            <Icon name="download" size={16} />
          </button>
          {onShare && (
            <button className="icon-btn icon-btn-sm" onClick={() => onShare(strip)} aria-label="Share">
              <Icon name="share" size={16} />
            </button>
          )}
          {onDelete && (
            <button className="icon-btn icon-btn-sm photo-card-del" onClick={() => onDelete(strip)} aria-label="Delete">
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function PhotoCardSkeleton() {
  return (
    <div className="photo-card card" aria-hidden="true">
      <div className="photo-card-media">
        <span className="skeleton" style={{ width: '46%', height: '86%' }} />
      </div>
      <div className="photo-card-body">
        <span className="skeleton" style={{ width: '60%', height: 14 }} />
        <span className="skeleton" style={{ width: '40%', height: 12, marginTop: 6 }} />
      </div>
    </div>
  );
}
