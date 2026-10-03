import React from 'react';
import TemplatePreview from './TemplatePreview';
import Button from '../common/Button';
import { FavoriteButton } from '../common/misc';
import PremiumBadge from '../billing/PremiumBadge';
import { categoryLabel, templateLayout } from '../../templates/data';
import { templateTier } from '../../config/catalog';
import { useEntitlements } from '../../context/EntitlementsContext';

export default function TemplateCard({ template, favorite, onToggleFavorite, onUse, onPreview, style }) {
  const { canUseTemplate, openUpgrade } = useEntitlements();
  const layout = templateLayout(template);
  const premium = templateTier(template) === 'premium';
  const locked = !canUseTemplate(template);

  const use = () => {
    if (locked) {
      openUpgrade({
        feature: 'premium_templates',
        title: `Unlock “${template.name}”`,
        description: `${template.name} is a Premium template. Upgrade to use it — plus every other Premium look.`,
      });
      return;
    }
    onUse(template.id);
  };

  return (
    <article className={`tpl-card card card-hover${locked ? ' is-locked' : ''}`} style={style}>
      <div className="tpl-card-media">
        <button
          type="button"
          className="tpl-card-preview-btn"
          onClick={() => onPreview?.(template)}
          aria-label={`Preview ${template.name} template${premium ? ' (Premium)' : ''}`}
        >
          <TemplatePreview template={template} layout={layout} />
        </button>
        <FavoriteButton
          className="tpl-card-fav"
          active={favorite}
          onToggle={() => onToggleFavorite(template.id)}
          label={`favorites: ${template.name}`}
        />
        {premium ? (
          <PremiumBadge locked={locked} className="tpl-card-premium" />
        ) : layout.photoCount !== 4 || layout.columns > 1 ? (
          <span className="tpl-card-layout">{layout.label}</span>
        ) : null}
      </div>
      <div className="tpl-card-body">
        <div>
          <h3 className="tpl-card-name">{template.name}</h3>
          <p className="tpl-card-cat">{template.categories.map(categoryLabel).join(' · ')}</p>
        </div>
        <Button
          size="sm"
          variant={locked ? 'outline-primary' : 'soft'}
          icon={locked ? 'lock' : undefined}
          block
          onClick={use}
          aria-label={locked ? `Unlock ${template.name} with Premium` : `Use ${template.name} template`}
        >
          {locked ? 'Unlock' : 'Use Template'}
        </Button>
      </div>
    </article>
  );
}
