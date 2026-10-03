import React from 'react';
import TemplatePreview from './TemplatePreview';
import Button from '../common/Button';
import { FavoriteButton } from '../common/misc';
import { categoryLabel, templateLayout } from '../../templates/data';

export default function TemplateCard({ template, favorite, onToggleFavorite, onUse, onPreview, style }) {
  const layout = templateLayout(template);
  return (
    <article className="tpl-card card card-hover" style={style}>
      <div className="tpl-card-media">
        <button
          type="button"
          className="tpl-card-preview-btn"
          onClick={() => onPreview?.(template)}
          aria-label={`Preview ${template.name} template`}
        >
          <TemplatePreview template={template} layout={layout} />
        </button>
        <FavoriteButton
          className="tpl-card-fav"
          active={favorite}
          onToggle={() => onToggleFavorite(template.id)}
          label={`favorites: ${template.name}`}
        />
        {layout.photoCount !== 4 || layout.columns > 1 ? (
          <span className="tpl-card-layout">{layout.label}</span>
        ) : null}
      </div>
      <div className="tpl-card-body">
        <div>
          <h3 className="tpl-card-name">{template.name}</h3>
          <p className="tpl-card-cat">{template.categories.map(categoryLabel).join(' · ')}</p>
        </div>
        <Button size="sm" variant="soft" block onClick={() => onUse(template.id)} aria-label={`Use ${template.name} template`}>
          Use Template
        </Button>
      </div>
    </article>
  );
}
