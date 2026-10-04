import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { FavoriteButton } from '../common/misc';
import { formatDate } from '../../lib/format';

/** Large preview of a saved strip with all actions, plus delete confirmation. */
export default function PhotoViewer({ strip, onClose, actions }) {
  const [confirm, setConfirm] = useState(false);
  const open = !!strip;

  return (
    <Modal open={open} onClose={onClose} width={720} className="viewer-modal">
      {strip && (
        <div className="viewer">
          <div className="viewer-media">
            {strip.mediaType === 'live_strip' && strip.videoUrl ? (
              <span className="live-player">
                {strip.mimeType === 'image/gif' ? (
                  <img src={strip.videoUrl} alt={`${strip.templateName} Live Strip`} className="strip-img" />
                ) : (
                <video
                  src={strip.videoUrl}
                  poster={strip.url || undefined}
                  className="strip-img"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label={`${strip.templateName} Live Strip`}
                />
                )}
                <span className="live-tag" aria-hidden="true">
                  <i /> LIVE
                </span>
              </span>
            ) : (
              <img src={strip.url} alt={`${strip.templateName} strip`} className="strip-img" />
            )}
          </div>
          <div className="viewer-body">
            <span className="badge">{strip.templateName}</span>
            <h2 className="viewer-title">{formatDate(strip.createdAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
            <p className="muted">
              {new Date(strip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {strip.mediaType === 'live_strip' ? 'Live Strip · ' : ''}{strip.width}×{strip.height}px
            </p>
            <div className="viewer-fav">
              <FavoriteButton active={strip.favorite} onToggle={() => actions.favorite(strip)} size="md" label="favorites" />
              <span>{strip.favorite ? 'In your favorites' : 'Add to favorites'}</span>
            </div>
            <div className="viewer-actions">
              <Button icon="download" block onClick={() => actions.download(strip)} data-autofocus>
                Download
              </Button>
              <Button variant="outline" icon="share" block onClick={() => actions.share(strip)}>
                Share
              </Button>
              {strip.mediaType !== 'live_strip' && (
                <Button variant="outline" icon="printer" block onClick={() => actions.print(strip)}>
                  Print
                </Button>
              )}
              {confirm ? (
                <div className="confirm-del" role="alert">
                  <p>Delete this strip permanently?</p>
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        await actions.del(strip);
                        setConfirm(false);
                        onClose();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" icon="trash" block className="del-btn" onClick={() => setConfirm(true)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
