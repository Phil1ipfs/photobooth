import React, { useEffect, useState } from 'react';
import { getTemplatePreview } from '../../templates/render';
import { Skeleton } from '../common/misc';

/** Renders a template with placeholder photos (cached data URL). */
export default function TemplatePreview({ template, aspect = 4 / 3, scale = 0.45, layout, className = '', style, alt }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    getTemplatePreview(template, { aspect, scale, layout })
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [template, aspect, scale, layout]);

  if (!src) return <Skeleton className={`tpl-preview tpl-skeleton ${className}`} style={style} radius={6} />;
  return (
    <img
      src={src}
      alt={alt ?? `${template.name} photo strip template`}
      className={`tpl-preview strip-img ${className}`}
      style={style}
      draggable="false"
    />
  );
}
