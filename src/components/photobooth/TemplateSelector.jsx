import React, { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import TemplatePreview from '../templates/TemplatePreview';
import { Link } from '../../lib/router';
import { TEMPLATES } from '../../templates/data';

export default function TemplateSelector({ value, onChange, aspect, layout, favorites }) {
  const [favOnly, setFavOnly] = useState(false);
  const listRef = useRef(null);
  const list = favOnly ? TEMPLATES.filter((t) => favorites.includes(t.id)) : TEMPLATES;

  // Keep the selected template scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-checked="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [value, favOnly]);

  // Mouse wheel over the row scrolls it horizontally. Once the row hits either end,
  // the wheel falls through to the page. Native listener: React's onWheel is passive.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch-zoom / trackpad sideways swipe
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= max - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      const step = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY; // lines → px
      el.scrollBy({ left: step, behavior: 'auto' });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [list.length]);

  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const i = list.findIndex((t) => t.id === value);
    const next = list[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    if (next) {
      onChange(next.id);
      setTimeout(() => listRef.current?.querySelector('[aria-checked="true"]')?.focus(), 0);
    }
  };

  return (
    <section className="tpl-select card" aria-labelledby="tpl-select-title">
      <div className="panel-head">
        <div>
          <h2 id="tpl-select-title">Choose a Template</h2>
          <p>Select your favorite style</p>
        </div>
        <button
          className="icon-btn fav-btn"
          aria-pressed={favOnly}
          onClick={() => setFavOnly((f) => !f)}
          aria-label={favOnly ? 'Show all templates' : 'Show favorite templates only'}
          title={favOnly ? 'Show all' : 'Favorites only'}
        >
          <Icon name="heart" size={18} />
        </button>
      </div>
      {list.length === 0 ? (
        <p className="tpl-select-empty">
          No favorites yet — tap the heart on any template in the <Link to="/templates">gallery</Link>.
        </p>
      ) : (
        <div className="tpl-select-list" role="radiogroup" aria-label="Templates" ref={listRef} onKeyDown={onKeyDown}>
          {list.map((t) => {
            const active = t.id === value;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className="tpl-option"
                onClick={() => onChange(t.id)}
              >
                <span className="tpl-option-thumb">
                  <TemplatePreview template={t} aspect={aspect} layout={layout} scale={0.3} alt="" />
                  {active && (
                    <span className="tpl-check" aria-hidden="true">
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="tpl-option-name">{t.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <Link to="/templates" className="link-btn tpl-select-all">
        Browse all templates <Icon name="arrow-right" size={14} />
      </Link>
    </section>
  );
}
