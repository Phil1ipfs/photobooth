import React, { useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { MUSIC_CATEGORIES, THEME_SUGGESTIONS } from '../../lib/music';
import { getTemplate } from '../../templates/data';

/** Suggests a template that matches the music shelf playing. Only applies it when the user taps. */
export default function MusicThemeHint({ templateId, onUse }) {
  const { category, playing } = useMusic();
  const [dismissed, setDismissed] = useState(null);
  const idea = THEME_SUGGESTIONS[category];
  if (!playing || !idea || idea.templateId === templateId || dismissed === category) return null;
  const shelf = MUSIC_CATEGORIES.find((c) => c.id === category);
  const t = getTemplate(idea.templateId);
  return (
    <div className="music-hint" role="status">
      <span aria-hidden="true">{shelf.emoji}</span>
      <p>
        {shelf.label} music is playing — try <strong>{t.name}</strong> ({idea.label})?
      </p>
      <button type="button" className="link-btn" onClick={() => onUse(t.id)}>
        Use it
      </button>
      <button type="button" className="icon-btn icon-btn-sm icon-btn-plain" aria-label="Dismiss suggestion" onClick={() => setDismissed(category)}>
        ×
      </button>
    </div>
  );
}
