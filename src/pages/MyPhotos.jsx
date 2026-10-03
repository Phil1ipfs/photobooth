import React, { useMemo, useState } from 'react';
import AppLayout, { PageHeader } from '../components/layout/AppLayout';
import PhotoCard, { PhotoCardSkeleton } from '../components/photos/PhotoCard';
import PhotoViewer from '../components/photos/PhotoViewer';
import useStripActions from '../components/photos/useStripActions';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { SearchInput, SelectPill } from '../components/common/Input';
import { EmptyState } from '../components/common/misc';
import { useStrips } from '../context/StripsContext';
import { formatDate } from '../lib/format';

export default function MyPhotos({ favoritesOnly = false, embedded = false }) {
  const { strips, loading, error } = useStrips();
  const actions = useStripActions();
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewId, setViewId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const base = favoritesOnly ? strips.filter((s) => s.favorite) : strips;

  const templateOptions = useMemo(() => {
    const names = [...new Set(base.map((s) => s.templateName))].sort();
    return [{ value: 'all', label: 'All templates' }, ...names.map((n) => ({ value: n, label: n }))];
  }, [base]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = base.filter(
      (s) =>
        (tpl === 'all' || s.templateName === tpl) &&
        (!term || s.templateName.toLowerCase().includes(term) || formatDate(s.createdAt).toLowerCase().includes(term))
    );
    return sort === 'oldest' ? [...out].reverse() : out;
  }, [base, q, tpl, sort]);

  const body = (
    <>
      <div className="photos-toolbar">
        <SearchInput
          label="Search photos"
          placeholder="Search by template or date…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="photos-search"
        />
        <SelectPill icon="filter" label="Filter by template" value={tpl} onChange={setTpl} options={templateOptions} />
        <SelectPill
          icon="sort"
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
          ]}
        />
      </div>

      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="photos-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <PhotoCardSkeleton key={i} />
          ))}
        </div>
      ) : base.length === 0 ? (
        <EmptyState
          icon={favoritesOnly ? 'heart' : 'image'}
          title={favoritesOnly ? 'No favorite strips yet' : 'Your gallery is empty'}
          action={
            <Button to="/booth" iconRight="arrow-right">
              Open Photobooth
            </Button>
          }
        >
          {favoritesOnly
            ? 'Tap the heart on any saved strip to keep it here.'
            : 'Take some photos and save your strip — it will appear here.'}
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState icon="search" title="No matches">
          Try a different search or filter.
        </EmptyState>
      ) : (
        <div className="photos-grid">
          {list.map((s, i) => (
            <PhotoCard
              key={s.id}
              strip={s}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              onOpen={() => setViewId(s.id)}
              onFavorite={actions.favorite}
              onDownload={actions.download}
              onShare={actions.share}
              onDelete={setToDelete}
            />
          ))}
        </div>
      )}

      <PhotoViewer strip={strips.find((s) => s.id === viewId)} onClose={() => setViewId(null)} actions={actions} />

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this strip?"
        description="This permanently removes it from My Photos. Download it first if you want to keep a copy."
        width={420}
      >
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setToDelete(null)} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="trash"
            onClick={async () => {
              await actions.del(toDelete);
              setToDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );

  if (embedded) return body;

  return (
    <AppLayout>
      <PageHeader
        title="My Photos"
        subtitle={`${strips.length} saved ${strips.length === 1 ? 'memory' : 'memories'} — all your photo strips in one place.`}
      >
        <Button to="/booth" icon="camera">
          New Strip
        </Button>
      </PageHeader>
      {body}
    </AppLayout>
  );
}
