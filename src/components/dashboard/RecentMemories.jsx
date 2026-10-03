import React, { useRef } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { EmptyState } from '../common/misc';
import { Link } from '../../lib/router';
import PhotoCard, { PhotoCardSkeleton } from '../photos/PhotoCard';

export default function RecentMemories({ strips, loading, actions, onOpen }) {
  const rowRef = useRef(null);
  const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <section aria-labelledby="recent-title">
      <div className="section-title">
        <h2 id="recent-title">Recent Memories</h2>
        {strips.length > 0 && (
          <Link to="/photos" className="link-btn">
            View All
          </Link>
        )}
      </div>
      {loading ? (
        <div className="recent-row">
          {[0, 1, 2, 3].map((i) => (
            <PhotoCardSkeleton key={i} />
          ))}
        </div>
      ) : strips.length === 0 ? (
        <EmptyState
          icon="camera"
          title="No memories yet"
          action={
            <Button to="/booth" size="sm" iconRight="arrow-right">
              Take your first strip
            </Button>
          }
        >
          Strips you save from the photobooth will show up here.
        </EmptyState>
      ) : (
        <div className="recent-wrap">
          <div className="recent-row" ref={rowRef}>
            {strips.slice(0, 8).map((s) => (
              <PhotoCard
                key={s.id}
                strip={s}
                onOpen={onOpen}
                onFavorite={actions.favorite}
                onDownload={actions.download}
              />
            ))}
          </div>
          {strips.length > 4 && (
            <button className="icon-btn recent-next" onClick={() => scroll(1)} aria-label="Scroll recent memories">
              <Icon name="chevron-right" size={18} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
