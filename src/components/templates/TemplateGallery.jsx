import React, { useEffect, useMemo, useState } from 'react';
import TemplatePreviewModal from './TemplatePreviewModal';
import TemplateCard from './TemplateCard';
import Icon from '../common/Icon';
import { EmptyState } from '../common/misc';
import Button from '../common/Button';
import { CATEGORIES, TEMPLATES } from '../../templates/data';
import { track } from '../../lib/analytics';

const PAGE_SIZE = 10;

/** Filterable, paginated grid of templates. */
export default function TemplateGallery({ query = '', category, onCategory, favorites, onToggleFavorite, onUse: onUseProp, only }) {
  const onUse = (id) => {
    track('template_selected', { template: id, source: 'gallery' });
    onUseProp(id);
  };
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (only || TEMPLATES).filter(
      (t) =>
        (category === 'all' || t.categories.includes(category)) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.categories.some((c) => c.includes(q)))
    );
  }, [query, category, only]);

  useEffect(() => setPage(1), [query, category]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="tpl-gallery">
      {onCategory && (
        <div className="chips" role="toolbar" aria-label="Filter templates by category">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => onCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="No templates found"
          action={
            <Button variant="outline" size="sm" onClick={() => onCategory?.('all')}>
              Show all templates
            </Button>
          }
        >
          Try a different search or category.
        </EmptyState>
      ) : (
        <div className="tpl-grid">
          {visible.map((t, i) => (
            <TemplateCard
              key={t.id}
              template={t}
              favorite={favorites.includes(t.id)}
              onToggleFavorite={onToggleFavorite}
              onUse={onUse}
              onPreview={setPreviewing}
              style={{ animationDelay: `${i * 35}ms` }}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="pagination" aria-label="Template pages">
          <button
            className="icon-btn icon-btn-sm"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
            aria-label="Previous page"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className="page-btn"
              aria-current={n === current ? 'page' : undefined}
              onClick={() => {
                setPage(n);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {n}
            </button>
          ))}
          <button
            className="icon-btn icon-btn-sm"
            onClick={() => setPage(current + 1)}
            disabled={current === pages}
            aria-label="Next page"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </nav>
      )}

      <TemplatePreviewModal
        template={previewing}
        onClose={() => setPreviewing(null)}
        favorite={!!previewing && favorites.includes(previewing.id)}
        onToggleFavorite={onToggleFavorite}
        onUse={onUse}
      />
    </div>
  );
}
