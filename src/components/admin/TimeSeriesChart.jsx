// Single-series time chart (line + 10% area wash) with crosshair tooltip,
// keyboard support and a table view. One measure per chart — never two axes.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const H = 190;
const PAD = { top: 16, right: 44, bottom: 26, left: 40 };

const compact = (n) =>
  new Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);

/** Clean, rounded axis ticks (0 / 5 / 10 …). */
function niceTicks(max, count = 3) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

export default function TimeSeriesChart({ title, subtitle, data, valueKey, bucket = 'day', format = compact, dim = false }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState(null);
  const id = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => (data || []).map((d) => ({ date: new Date(d.date), value: Number(d[valueKey]) || 0 })), [data, valueKey]);
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(0, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length <= 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v) => PAD.top + innerH - (v / top) * innerH;

  const fmtDate = (d, long) =>
    d.toLocaleDateString(undefined, long ? { weekday: bucket === 'day' ? 'short' : undefined, month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = points.length ? `${line}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';
  const last = points[points.length - 1];
  const labelIdx = points.length ? [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i) : [];

  const nearest = (clientX) => {
    const rect = wrapRef.current.querySelector('svg').getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    if (points.length <= 1) return 0;
    return Math.max(0, Math.min(points.length - 1, Math.round(((px - PAD.left) / innerW) * (points.length - 1))));
  };

  const onKey = (e) => {
    if (!points.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = active ?? points.length - 1;
      setActive(Math.max(0, Math.min(points.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const a = active != null ? points[active] : null;

  return (
    <figure className={`ts-chart card${dim ? ' is-dim' : ''}`} aria-labelledby={`${id}-t`}>
      <figcaption className="ts-head">
        <div>
          <h3 id={`${id}-t`}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <strong className="ts-total">{format(total)}</strong>
      </figcaption>

      <div className="ts-plot" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={`${title}: ${format(total)} total. Use left and right arrow keys to read values.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((v) => v ?? (points.length ? points.length - 1 : null))}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => points.length && setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="ts-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="ts-axis" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {compact(t)}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} className="ts-axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
              {fmtDate(points[i].date)}
            </text>
          ))}
          {points.length > 0 && (
            <>
              <path className="ts-area" d={area} />
              <path className="ts-line" d={line} />
              <circle className="ts-dot" cx={x(points.length - 1)} cy={y(last.value)} r="4" />
              <text className="ts-end" x={x(points.length - 1) + 8} y={y(last.value)} dy="0.32em">
                {format(last.value)}
              </text>
            </>
          )}
          {a && (
            <g className="ts-cross" aria-hidden="true">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} />
              <circle className="ts-dot" cx={x(active)} cy={y(a.value)} r="4" />
            </g>
          )}
        </svg>
        {a && (
          <div
            className="ts-tip"
            role="status"
            style={{ left: `${(x(active) / width) * 100}%`, transform: `translateX(${active > points.length / 2 ? '-105%' : '5%'})` }}
          >
            <strong>{format(a.value)}</strong>
            <span>
              <i aria-hidden="true" /> {fmtDate(a.date, true)}
            </span>
          </div>
        )}
      </div>

      <details className="ts-table">
        <summary>View data</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{bucket === 'week' ? 'Week of' : 'Date'}</th>
              <th scope="col">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date.toISOString()}>
                <td>{fmtDate(p.date, true)}</td>
                <td>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
