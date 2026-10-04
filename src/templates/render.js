// Data-driven photo strip renderer. One code path renders gallery thumbnails,
// the live editor preview and the final downloadable strip.
import {
  DECOR,
  EFFECTS,
  drawPattern,
  hashString,
  heartPath,
  notchedRectPath,
  resolvePaint,
  roundRectPath,
  scallopPath,
} from './draw';
import './drawExtra';
import { DEFAULT_LAYOUT_ID, getLayout } from './data';

/** Width of a single-column strip; multi-column layouts grow from this. */
export const STRIP_WIDTH = 600;
const DEFAULT_LAYOUT = getLayout(DEFAULT_LAYOUT_ID);

/* ---------- Fonts ---------- */

const STRIP_FONTS = [
  '400 40px "Playfair Display"',
  '700 40px "Playfair Display"',
  'italic 400 40px "Playfair Display"',
  '500 40px "DM Sans"',
  '700 40px "DM Sans"',
  '400 40px "Great Vibes"',
  '700 40px "Caveat"',
  '400 40px "Archivo Black"',
  '400 40px "Shrikhand"',
  '400 40px "Lilita One"',
  '400 40px "Press Start 2P"',
];

let fontsPromise;
export function ensureFonts() {
  if (!fontsPromise) {
    if (!document.fonts?.load) {
      fontsPromise = Promise.resolve();
    } else {
      const loads = Promise.all(STRIP_FONTS.map((f) => document.fonts.load(f).catch(() => null)));
      fontsPromise = Promise.race([loads, new Promise((r) => setTimeout(r, 3500))]);
    }
  }
  return fontsPromise;
}

/* ---------- Images ---------- */

const imageCache = new Map();
export function loadImage(src) {
  if (!imageCache.has(src)) {
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
    imageCache.set(src, p);
    if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value);
  }
  return imageCache.get(src);
}

const filterCache = new WeakMap();
function filtered(img, filter) {
  if (!filter) return img;
  let byFilter = filterCache.get(img);
  if (!byFilter) filterCache.set(img, (byFilter = {}));
  if (byFilter[filter]) return byFilter[filter];

  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (filter === 'sepia') {
      px[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      px[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      px[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    } else if (filter === 'warm') {
      px[i] = Math.min(255, r * 1.1 + 12);
      px[i + 1] = Math.min(255, g * 1.02 + 4);
      px[i + 2] = Math.max(0, b * 0.86);
    } else if (filter === 'cool') {
      px[i] = Math.max(0, r * 0.88);
      px[i + 1] = Math.min(255, g * 1.0 + 4);
      px[i + 2] = Math.min(255, b * 1.12 + 10);
    } else if (filter === 'fade') {
      // lifted blacks, softened contrast, slight warm cast
      px[i] = Math.min(255, r * 0.78 + 50);
      px[i + 1] = Math.min(255, g * 0.76 + 44);
      px[i + 2] = Math.min(255, b * 0.72 + 42);
    } else {
      let l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (filter === 'noir') l = Math.max(0, Math.min(255, (l - 128) * 1.25 + 128));
      px[i] = px[i + 1] = px[i + 2] = l;
    }
  }
  ctx.putImageData(data, 0, 0);
  byFilter[filter] = c;
  return c;
}

/* ---------- Layout ---------- */

/**
 * Builds the photo grid for a template + layout ({ columns, rows }).
 * Templates only define margins/gaps (authored for a 1-column strip); extra
 * columns widen the canvas so photos keep a sensible size.
 * Returns { W, H, slots[], rowRects[], baseW } — slots are in reading order
 * (left→right, top→bottom), matching the on-screen slot grid.
 */
export function computeLayout(t, aspect = 4 / 3, layout = DEFAULT_LAYOUT) {
  const { columns: cols, rows } = layout;
  const L = t.layout;
  const f = t.frame || {};
  const inset = f.inset || 0;
  const extra = f.bottomExtra || 0;

  // Margins as authored for the classic 600px strip
  const left = L.photoX ?? (L.photoW ? (STRIP_WIDTH - L.photoW) / 2 : L.padX);
  const right = L.photoW ? STRIP_WIDTH - left - L.photoW : L.padX;
  const baseW = STRIP_WIDTH - left - right;
  const colGap = Math.max(L.gap, 16) + inset * 2;

  const W = Math.round(STRIP_WIDTH + ((layout.widthColumns ?? cols) - 1) * (baseW * 0.75 + colGap));
  const areaW = W - left - right;
  const cellW = (areaW - (cols - 1) * colGap) / cols;
  const cellH = Math.round(cellW / (L.slotAspect || aspect));
  const rowPitch = cellH + extra + inset * 2 + L.gap;

  // Irregular layouts list explicit cells ({ col, row, colSpan, rowSpan }); regular
  // grids are every cell in reading order.
  const cells =
    layout.cells ||
    Array.from({ length: rows * cols }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols) }));

  const top = L.top + inset;
  const rowRects = Array.from({ length: rows }, (_, r) => ({ x: left, y: top + r * rowPitch, w: areaW, h: cellH }));
  const slots = cells.map(({ col, row, colSpan = 1, rowSpan = 1 }) => ({
    x: left + col * (cellW + colGap),
    y: top + row * rowPitch,
    w: colSpan * cellW + (colSpan - 1) * colGap,
    h: rowSpan * cellH + (rowSpan - 1) * (rowPitch - cellH),
  }));
  const H = Math.round(top + rows * rowPitch - L.gap - inset + L.bottom);
  return { W, H, slots, rowRects, baseW };
}

/* ---------- Painting ---------- */

const FALLBACK = {
  'Great Vibes': 'cursive',
  Caveat: 'cursive',
  'Playfair Display': 'Georgia, serif',
};

const fontString = (t) =>
  `${t.italic ? 'italic ' : ''}${t.weight || 400} ${t.size || 24}px "${t.font || 'DM Sans'}", ${
    FALLBACK[t.font] || 'system-ui, sans-serif'
  }`;

function formatStripDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${date.getFullYear()}`;
}

// Templates anchor decorations to slots 0–3 of the classic 1 × 4 strip. For other
// layouts the anchor is mapped proportionally onto the actual rows, and its x is
// taken across the whole photo row. Overhangs (sx < 0 or > 1) keep their authored
// distance so stickers stay just outside the grid instead of flying off-canvas.
const AUTHORED_ROWS = 4;

function resolvePos(item, geo) {
  const { W, H, rowRects, baseW } = geo;
  if (item.slot != null) {
    const n = rowRects.length;
    const pos = ((item.slot + (item.sy ?? 0.5)) / AUTHORED_ROWS) * n;
    const r = Math.max(0, Math.min(n - 1, Math.floor(pos)));
    const rect = rowRects[r];
    const sx = item.sx ?? 0.5;
    const x = sx < 0 ? rect.x + sx * baseW : sx > 1 ? rect.x + rect.w + (sx - 1) * baseW : rect.x + sx * rect.w;
    return { x, y: rect.y + (pos - r) * rect.h };
  }
  const y = item.y ?? 0;
  return { x: (item.x ?? 0.5) * W, y: y >= 0 ? y : H + y };
}

function drawBackground(ctx, t, W, H) {
  const bg = t.background;
  if (bg.type === 'linear') {
    const a = (((bg.angle ?? 180) - 90) * Math.PI) / 180;
    const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
    bg.stops.forEach((c, i) => g.addColorStop(i / (bg.stops.length - 1), c));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, t.pattern, W, H, hashString(t.id));
}

function measure(ctx, text, spacing) {
  if (!spacing) return ctx.measureText(text).width;
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
}

function drawRun(ctx, text, x, y, spacing, mode) {
  const op = mode === 'stroke' ? 'strokeText' : 'fillText';
  if (!spacing) {
    ctx[op](text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx[op](ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function drawText(ctx, t, pos, date) {
  const text = t.text.replace('{date}', formatStripDate(date));
  const lines = text.split('\n');
  const size = t.size || 24;
  const lh = t.lineHeight || size * 1.1;
  const align = t.align || 'center';
  ctx.save();
  ctx.translate(pos.x, pos.y);
  if (t.rotate) ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.font = fontString(t);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  lines.forEach((line, i) => {
    const y = i * lh;
    const w = measure(ctx, line, t.letterSpacing);
    const x = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    const box = { x, y: y - size, w, h: size };
    if (t.shadow) {
      ctx.fillStyle = t.shadow.color;
      ctx.strokeStyle = t.shadow.color;
      if (t.stroke) {
        ctx.lineWidth = t.strokeWidth || 4;
        drawRun(ctx, line, x + t.shadow.dx, y + t.shadow.dy, t.letterSpacing, 'stroke');
      }
      drawRun(ctx, line, x + t.shadow.dx, y + t.shadow.dy, t.letterSpacing, 'fill');
    }
    if (t.stroke) {
      ctx.strokeStyle = resolvePaint(ctx, t.stroke, box);
      ctx.lineWidth = t.strokeWidth || 4;
      drawRun(ctx, line, x, y, t.letterSpacing, 'stroke');
    }
    ctx.fillStyle = resolvePaint(ctx, t.color || '#000', box);
    drawRun(ctx, line, x, y, t.letterSpacing, 'fill');
  });
  ctx.restore();
}

function drawDecor(ctx, d, geo) {
  const { W, H } = geo;
  ctx.save();
  if (d.alpha != null) ctx.globalAlpha = d.alpha;
  if (EFFECTS[d.type]) {
    EFFECTS[d.type](ctx, d, W, H, (y) => (y >= 0 ? y : H + y));
  } else if (DECOR[d.type]) {
    const { x, y } = resolvePos(d, geo);
    ctx.translate(x, y);
    if (d.rotate) ctx.rotate((d.rotate * Math.PI) / 180);
    DECOR[d.type](ctx, d);
  }
  ctx.restore();
}

function framePath(ctx, f, r) {
  switch (f.shape) {
    case 'heart':
      heartPath(ctx, r.x, r.y, r.w, r.h);
      break;
    case 'scallop':
      scallopPath(ctx, r.x, r.y, r.w, r.h, f.bump || 10);
      break;
    case 'pixel':
      notchedRectPath(ctx, r.x, r.y, r.w, r.h, f.step || 8);
      break;
    default:
      roundRectPath(ctx, r.x, r.y, r.w, r.h, f.radius || 0);
  }
}

function photoPath(ctx, f, r) {
  const inset = f.inset || 0;
  switch (f.shape) {
    case 'heart':
      heartPath(ctx, r.x, r.y, r.w, r.h);
      break;
    case 'scallop':
      roundRectPath(ctx, r.x, r.y, r.w, r.h, f.photoRadius ?? 6);
      break;
    case 'pixel':
      notchedRectPath(ctx, r.x, r.y, r.w, r.h, f.photoStep ?? 0);
      break;
    default:
      roundRectPath(ctx, r.x, r.y, r.w, r.h, f.photoRadius ?? Math.max(0, (f.radius || 0) - inset));
  }
}

function drawCover(ctx, src, x, y, w, h) {
  const s = Math.max(w / src.width, h / src.height);
  const dw = src.width * s;
  const dh = src.height * s;
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawPlaceholder(ctx, r, ph, i) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  g.addColorStop(0, ph.bg[0]);
  g.addColorStop(1, ph.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const s = Math.min(r.w, r.h * 1.25);
  const people = i % 2 === 0 ? [0.37, 0.63] : [0.5];
  people.forEach((px, k) => {
    const cx = r.x + px * r.w;
    const headY = r.y + r.h * (people.length > 1 && k === 1 ? 0.44 : 0.4);
    ctx.fillStyle = ph.figure;
    ctx.globalAlpha = people.length > 1 && k === 0 ? 0.9 : 1;
    ctx.beginPath();
    ctx.arc(cx, headY, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, headY + s * 0.42, s * 0.25, s * 0.26, 0, Math.PI, 0);
    ctx.lineTo(cx + s * 0.25, r.y + r.h);
    ctx.lineTo(cx - s * 0.25, r.y + r.h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawSlot(ctx, t, r, img, i, opts) {
  const f = t.frame || {};
  const inset = f.inset || 0;
  const extra = f.bottomExtra || 0;
  const outer = { x: r.x - inset, y: r.y - inset, w: r.w + inset * 2, h: r.h + inset * 2 + extra };
  const rot = f.rotate ? (f.rotate[i % f.rotate.length] * Math.PI) / 180 : 0;

  ctx.save();
  if (rot) {
    const cx = outer.x + outer.w / 2;
    const cy = outer.y + outer.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);
  }

  if (f.offsetShadow) {
    const o = f.offsetShadow;
    framePath(ctx, f, { ...outer, x: outer.x + o.dx, y: outer.y + o.dy });
    ctx.fillStyle = o.color;
    ctx.fill();
  }

  if (f.fill || f.shadow) {
    ctx.save();
    if (f.shadow) {
      ctx.shadowColor = f.shadow.color;
      ctx.shadowBlur = f.shadow.blur || 12;
      ctx.shadowOffsetY = f.shadow.y || 4;
    }
    framePath(ctx, f, outer);
    ctx.fillStyle = resolvePaint(ctx, f.fill || '#000', outer);
    ctx.fill();
    ctx.restore();
  }

  // Photo (or placeholder) clipped to the slot shape
  ctx.save();
  photoPath(ctx, f, r);
  ctx.clip();
  // User-chosen filter: 'auto' keeps the template's own, 'none' removes it.
  const filter = !opts.filter || opts.filter === 'auto' ? t.photo?.filter : opts.filter === 'none' ? null : opts.filter;
  if (img) drawCover(ctx, filtered(img, filter), r.x, r.y, r.w, r.h);
  else if (opts.placeholders) drawPlaceholder(ctx, r, t.placeholder || DEFAULT_PLACEHOLDER, i);
  else {
    ctx.fillStyle = t.emptyColor || 'rgba(0,0,0,0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();

  if (f.innerLine) {
    photoPath(ctx, f, r);
    ctx.strokeStyle = f.innerLine.color;
    ctx.lineWidth = f.innerLine.width || 2;
    ctx.stroke();
  }

  if (f.lace) {
    framePath(ctx, f, outer);
    ctx.strokeStyle = f.lace.color;
    ctx.lineWidth = f.lace.width || 8;
    ctx.lineCap = 'round';
    ctx.setLineDash(f.lace.dash || [0.1, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (f.border) {
    ctx.save();
    if (f.border.glow) {
      // Neon frames: blurred coloured halo under the stroke
      ctx.shadowColor = f.border.glow;
      ctx.shadowBlur = f.border.glowBlur || 18;
    }
    framePath(ctx, f, outer);
    ctx.strokeStyle = resolvePaint(ctx, f.border.color, outer);
    ctx.lineWidth = f.border.width || 2;
    ctx.stroke();
    ctx.restore();
  }

  if (f.sketch) {
    // Hand-drawn look: a couple of slightly offset, rotated extra outlines
    ctx.save();
    ctx.strokeStyle = f.sketch.color || '#fff';
    ctx.lineWidth = f.sketch.width || 2;
    [
      [4, -3, 0.008],
      [-3, 4, -0.006],
    ].forEach(([dx, dy, a]) => {
      ctx.save();
      const cx = outer.x + outer.w / 2;
      const cy = outer.y + outer.h / 2;
      ctx.translate(cx + dx, cy + dy);
      ctx.rotate(a * (i % 2 ? -1 : 1));
      ctx.translate(-cx, -cy);
      framePath(ctx, f, outer);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  if (f.captions && extra) {
    ctx.font = `700 ${Math.round(extra * 0.55)}px "${f.captionFont || 'Caveat'}", cursive`;
    ctx.fillStyle = f.captionColor || '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.captions[i % f.captions.length], outer.x + outer.w / 2, r.y + r.h + inset + extra / 2 - 2);
  }

  if (f.tape) {
    ctx.save();
    ctx.translate(outer.x + outer.w / 2, outer.y + 2);
    ctx.rotate(((i % 2 ? 4 : -5) * Math.PI) / 180);
    DECOR.tape(ctx, { w: 110, h: 30, color: f.tape === true ? undefined : f.tape });
    ctx.restore();
  }
  ctx.restore();
}

const DEFAULT_PLACEHOLDER = { bg: ['#e7dcd8', '#cdbcb7'], figure: 'rgba(255,255,255,0.7)' };

/**
 * Render a template to a new canvas.
 * @param {object} template  Template definition from templates/data.js
 * @param {object} options   { photos: (string|null)[], aspect, layout, scale, date, placeholders, filter }
 */
export async function renderStrip(template, options = {}) {
  const { photos = [], aspect = 4 / 3, layout = DEFAULT_LAYOUT, scale = 1, date = new Date(), placeholders = true, filter = 'auto' } = options;
  await ensureFonts();
  const images = await Promise.all(
    Array.from({ length: layout.photoCount }, (_, i) => (photos[i] ? loadImage(photos[i]).catch(() => null) : null))
  );
  const renderer = await createStripRenderer(template, { aspect, layout, scale, date, placeholders, filter });
  const canvas = document.createElement('canvas');
  canvas.width = renderer.width;
  canvas.height = renderer.height;
  renderer.draw(canvas.getContext('2d'), images);
  return canvas;
}

/**
 * A reusable renderer for one template/layout: draw(ctx, images) paints the whole
 * strip with the given per-slot images (any drawImage source — img, canvas,
 * ImageBitmap). Used for animated Live Strips, where it runs once per frame.
 */
export async function createStripRenderer(template, options = {}) {
  const { aspect = 4 / 3, layout = DEFAULT_LAYOUT, scale = 1, date = new Date(), placeholders = true, filter = 'auto' } = options;
  await ensureFonts();
  const geo = computeLayout(template, aspect, layout);
  const { W, H, slots } = geo;
  const decor = template.decor || [];
  return {
    width: Math.round(W * scale),
    height: Math.round(H * scale),
    slotCount: slots.length,
    draw(ctx, images) {
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      drawBackground(ctx, template, W, H);
      decor.filter((d) => d.layer === 'back').forEach((d) => drawDecor(ctx, d, geo));
      slots.forEach((r, i) => drawSlot(ctx, template, r, images[i] || null, i, { placeholders, filter }));
      decor.filter((d) => d.layer !== 'back').forEach((d) => drawDecor(ctx, d, geo));
      (template.texts || []).forEach((t) => drawText(ctx, t, resolvePos(t, geo), date));
      ctx.restore();
    },
  };
}

/* ---------- Cached previews (gallery thumbnails) ---------- */

const previewCache = new Map();
export function getTemplatePreview(template, { aspect = 4 / 3, scale = 0.45, layout = DEFAULT_LAYOUT } = {}) {
  const key = `${template.id}|${aspect}|${scale}|${layout.id}`;
  if (!previewCache.has(key)) {
    previewCache.set(
      key,
      renderStrip(template, { aspect, scale, layout }).then((c) => c.toDataURL('image/png'))
    );
  }
  return previewCache.get(key);
}
