import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Icon from '../common/Icon';
import { FavoriteButton } from '../common/misc';
import TemplatePreview from './TemplatePreview';
import { categoryLabel, templateLayout } from '../../templates/data';

/** Full-size template preview with its photo count, category and "Use Template". */
export default function TemplatePreviewModal({ template, onClose, favorite, onToggleFavorite, onUse }) {
  const layout = template ? templateLayout(template) : null;
  return (
    <Modal open={!!template} onClose={onClose} width={680} className="tpl-modal">
      {template && (
        <div className="tpl-modal-body">
          <div className="tpl-modal-media">
            <TemplatePreview template={template} layout={layout} scale={0.75} />
          </div>
          <div className="tpl-modal-info">
            <div className="tpl-modal-cats">
              {template.categories.map((c) => (
                <span key={c} className="badge">
                  {categoryLabel(c)}
                </span>
              ))}
            </div>
            <h2 className="tpl-modal-title">{template.name}</h2>
            <p className="muted">{template.description}</p>
            <ul className="tpl-modal-facts">
              <li>
                <Icon name="camera" size={16} />
                <span>
                  <strong>{layout.photoCount} photos</strong> required
                </span>
              </li>
              <li>
                <Icon name="templates" size={16} />
                <span>
                  {layout.label} — {layout.name} layout
                </span>
              </li>
            </ul>
            <div className="tpl-modal-actions">
              <Button iconRight="arrow-right" block onClick={() => onUse(template.id)} data-autofocus>
                Use Template
              </Button>
              <div className="tpl-modal-fav">
                <FavoriteButton
                  active={favorite}
                  onToggle={() => onToggleFavorite(template.id)}
                  size="md"
                  label={`favorites: ${template.name}`}
                />
                <span>{favorite ? 'In your favorites' : 'Add to favorites'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
