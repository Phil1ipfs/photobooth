import React from 'react';
import Icon from '../common/Icon';

/** Photo slots laid out with CSS Grid to mirror the selected layout (columns × rows). */
export default function PhotoSlots({ photos, layout, selected, onSelect, onRemove, aspect, disabled }) {
  return (
    <div
      className={`slots card${layout.columns > 1 ? ' slots-multi' : ''}`}
      role="group"
      aria-label={`Photo slots, ${layout.label} layout`}
      style={{ '--cols': layout.columns, '--rows': layout.rows, '--count': layout.photoCount }}
    >
      {photos.map((src, i) => {
        // Irregular layouts place cells explicitly with spans; regular grids auto-flow.
        const cell = layout.cells?.[i];
        const cs = cell?.colSpan || 1;
        const rs = cell?.rowSpan || 1;
        const place = cell
          ? { gridColumn: `${cell.col + 1} / span ${cs}`, gridRow: `${cell.row + 1} / span ${rs}` }
          : undefined;
        return (
        <div key={i} className="slot-wrap" style={place}>
          <button
            type="button"
            aria-pressed={selected === i}
            className={`slot${src ? ' filled' : ''}`}
            style={{ '--aspect': (aspect * cs) / rs }}
            onClick={() => onSelect(i)}
            disabled={disabled}
            aria-label={`Photo ${i + 1}${src ? '' : ' (empty)'}${selected === i ? ', selected — next photo goes here' : ''}`}
          >
            {src ? <img src={src} alt="" /> : <Icon name="image" size={layout.columns > 2 ? 18 : 24} className="slot-empty-icon" />}
            <span className="slot-num">{i + 1}</span>
          </button>
          {src && !disabled && (
            <button type="button" className="slot-remove" onClick={() => onRemove(i)} aria-label={`Remove photo ${i + 1}`}>
              <Icon name="x" size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
        );
      })}
    </div>
  );
}
