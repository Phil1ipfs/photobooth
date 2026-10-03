// Canvas drawing primitives and decoration ("sticker") painters used by the strip renderer.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashString = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ---------- Paths ---------- */

export function roundRectPath(ctx, x, y, w, h, r = 0) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Heart that fills the box (x, y, w, h). */
export function heartPath(ctx, x, y, w, h) {
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.26);
  ctx.bezierCurveTo(cx - w * 0.04, y + h * 0.06, cx - w * 0.24, y - h * 0.02, cx - w * 0.37, y + h * 0.02);
  ctx.bezierCurveTo(cx - w * 0.52, y + h * 0.07, cx - w * 0.54, y + h * 0.3, cx - w * 0.47, y + h * 0.45);
  ctx.bezierCurveTo(cx - w * 0.38, y + h * 0.64, cx - w * 0.14, y + h * 0.8, cx, y + h);
  ctx.bezierCurveTo(cx + w * 0.14, y + h * 0.8, cx + w * 0.38, y + h * 0.64, cx + w * 0.47, y + h * 0.45);
  ctx.bezierCurveTo(cx + w * 0.54, y + h * 0.3, cx + w * 0.52, y + h * 0.07, cx + w * 0.37, y + h * 0.02);
  ctx.bezierCurveTo(cx + w * 0.24, y - h * 0.02, cx + w * 0.04, y + h * 0.06, cx, y + h * 0.26);
  ctx.closePath();
}

export function starPath(ctx, cx, cy, outer, inner = outer * 0.45, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Four-point "sparkle" with concave sides. */
export function sparklePath(ctx, cx, cy, r) {
  const k = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
  ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
  ctx.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
  ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
  ctx.closePath();
}

export function notchedRectPath(ctx, x, y, w, h, s) {
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + w - s, y);
  ctx.lineTo(x + w - s, y + s);
  ctx.lineTo(x + w, y + s);
  ctx.lineTo(x + w, y + h - s);
  ctx.lineTo(x + w - s, y + h - s);
  ctx.lineTo(x + w - s, y + h);
  ctx.lineTo(x + s, y + h);
  ctx.lineTo(x + s, y + h - s);
  ctx.lineTo(x, y + h - s);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x + s, y + s);
  ctx.closePath();
}

/** Rounded rectangle with circular scallops along the edge. */
export function scallopPath(ctx, x, y, w, h, bump) {
  ctx.beginPath();
  const nx = Math.max(2, Math.round(w / (bump * 2)));
  const ny = Math.max(2, Math.round(h / (bump * 2)));
  const sx = w / nx;
  const sy = h / ny;
  ctx.moveTo(x, y);
  for (let i = 0; i < nx; i++) ctx.arc(x + sx * (i + 0.5), y, sx / 2, Math.PI, 0, false);
  for (let i = 0; i < ny; i++) ctx.arc(x + w, y + sy * (i + 0.5), sy / 2, -Math.PI / 2, Math.PI / 2, false);
  for (let i = nx - 1; i >= 0; i--) ctx.arc(x + sx * (i + 0.5), y + h, sx / 2, 0, Math.PI, false);
  for (let i = ny - 1; i >= 0; i--) ctx.arc(x, y + sy * (i + 0.5), sy / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.closePath();
}

/* ---------- Paint helpers ---------- */

export function chromeGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.28, '#b9bec7');
  g.addColorStop(0.48, '#f7f8fa');
  g.addColorStop(0.62, '#8c919b');
  g.addColorStop(0.82, '#e9ebef');
  g.addColorStop(1, '#a9aeb7');
  return g;
}

/**
 * A paint is a CSS colour, 'chrome', or a gradient object
 * { stops: [...colours], vertical?: boolean } spread across the item's box.
 */
export function resolvePaint(ctx, paint, box) {
  if (paint === 'chrome') return chromeGradient(ctx, box.x, box.y, box.w, box.h);
  if (paint && typeof paint === 'object' && paint.stops) {
    const g = paint.vertical
      ? ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h)
      : ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y);
    paint.stops.forEach((c, i) => g.addColorStop(i / (paint.stops.length - 1), c));
    return g;
  }
  return paint;
}

export function fillStroke(ctx, d, box) {
  if (d.color) {
    ctx.fillStyle = resolvePaint(ctx, d.color, box);
    ctx.fill();
  }
  if (d.stroke) {
    ctx.strokeStyle = resolvePaint(ctx, d.stroke, box);
    ctx.lineWidth = d.strokeWidth || Math.max(2, (d.size || 20) * 0.08);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/* ---------- Decoration painters ----------
   Each painter draws centred on (0, 0); the caller translates/rotates. */

const s2 = (d) => (d.size || 24) / 2;

export const DECOR = {
  heart(ctx, d) {
    const s = d.size || 24;
    heartPath(ctx, -s / 2, -s * 0.45, s, s * 0.9);
    fillStroke(ctx, d, { x: -s / 2, y: -s / 2, w: s, h: s });
  },
  sparkle(ctx, d) {
    sparklePath(ctx, 0, 0, s2(d));
    fillStroke(ctx, d, { x: -s2(d), y: -s2(d), w: d.size, h: d.size });
  },
  star(ctx, d) {
    starPath(ctx, 0, 0, s2(d), s2(d) * (d.inner || 0.48));
    fillStroke(ctx, d, { x: -s2(d), y: -s2(d), w: d.size, h: d.size });
  },
  flower(ctx, d) {
    const r = s2(d);
    const petals = d.petals || 6;
    ctx.save();
    for (let i = 0; i < petals; i++) {
      ctx.rotate((Math.PI * 2) / petals);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = d.color || '#fff';
      ctx.fill();
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = d.strokeWidth || 2;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = d.center || '#ffd23f';
    ctx.fill();
    if (d.stroke) {
      ctx.strokeStyle = d.stroke;
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.stroke();
    }
    if (d.face) DECOR.smileyFace(ctx, { size: r * 0.62, ink: d.stroke || '#3a2a1a' });
  },
  smileyFace(ctx, d) {
    const r = d.size / 2;
    ctx.fillStyle = d.ink;
    ctx.beginPath();
    ctx.arc(-r * 0.36, -r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.52, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = d.ink;
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.lineCap = 'round';
    ctx.stroke();
  },
  smiley(ctx, d) {
    const r = s2(d);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    fillStroke(ctx, { ...d, strokeWidth: d.strokeWidth || r * 0.09 }, { x: -r, y: -r, w: 2 * r, h: 2 * r });
    DECOR.smileyFace(ctx, { size: d.size * 0.9, ink: d.ink || d.stroke || '#2b1d12' });
  },
  bow(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#f6a8c8';
    ctx.strokeStyle = d.stroke || 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(dir * r * 0.5, -r * 0.9, dir * r * 1.15, -r * 0.55, dir * r, 0);
      ctx.bezierCurveTo(dir * r * 1.15, r * 0.55, dir * r * 0.5, r * 0.5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.08, r * 0.1);
      ctx.quadraticCurveTo(dir * r * 0.35, r * 0.7, dir * r * 0.5, r * 1.15);
      ctx.lineTo(dir * r * 0.28, r * 1.05);
      ctx.quadraticCurveTo(dir * r * 0.2, r * 0.6, 0, r * 0.12);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },
  paw(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#7a3410';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.48, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const toes = [
      [-0.55, -0.25],
      [-0.2, -0.6],
      [0.2, -0.6],
      [0.55, -0.25],
    ];
    for (const [tx, ty] of toes) {
      ctx.beginPath();
      ctx.ellipse(tx * r, ty * r, r * 0.17, r * 0.22, tx * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  barcode(ctx, d) {
    const w = d.w || 120;
    const h = d.h || 30;
    const rand = mulberry32(hashString(String(w) + h + (d.seed || 1)));
    ctx.fillStyle = d.color || '#111';
    let x = -w / 2;
    while (x < w / 2) {
      const bw = rand() < 0.35 ? 3 : rand() < 0.7 ? 1.6 : 1;
      if (rand() > 0.25) ctx.fillRect(x, -h / 2, Math.min(bw, w / 2 - x), h);
      x += bw + (rand() < 0.5 ? 1.4 : 2.6);
    }
  },
  globe(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.stroke || d.color || '#111';
    ctx.lineWidth = d.strokeWidth || 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    for (const k of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * k, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const k of [-0.5, 0, 0.5]) {
      const yy = k * r;
      const xx = Math.sqrt(r * r - yy * yy);
      ctx.beginPath();
      ctx.moveTo(-xx, yy);
      ctx.lineTo(xx, yy);
      ctx.stroke();
    }
  },
  cloud(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-r * 0.45, r * 0.12, r * 0.42, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.12, r * 0.55, 0, Math.PI * 2);
    ctx.arc(r * 0.5, r * 0.1, r * 0.4, 0, Math.PI * 2);
    ctx.rect(-r * 0.45, r * 0.1, r * 0.95, r * 0.44);
    ctx.fill();
  },
  moon(ctx, d) {
    const r = s2(d);
    const a = Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(-a) * r, Math.sin(-a) * r);
    ctx.arc(0, 0, r, -a, a, true);
    ctx.quadraticCurveTo(-r * 0.25, 0, Math.cos(-a) * r, Math.sin(-a) * r);
    ctx.closePath();
    fillStroke(ctx, d, { x: -r, y: -r, w: 2 * r, h: 2 * r });
  },
  tape(ctx, d) {
    const w = d.w || 90;
    const h = d.h || 26;
    ctx.fillStyle = d.color || 'rgba(232, 214, 170, 0.78)';
    ctx.beginPath();
    const teeth = 5;
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    for (let i = 0; i <= teeth; i++) ctx.lineTo(w / 2 + (i % 2 ? -3 : 0), -h / 2 + (h * i) / teeth);
    ctx.lineTo(-w / 2, h / 2);
    for (let i = teeth; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? 3 : 0), -h / 2 + (h * i) / teeth);
    ctx.closePath();
    ctx.fill();
  },
  crown(ctx, d) {
    const r = s2(d);
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.5);
    ctx.lineTo(-r, -r * 0.4);
    ctx.lineTo(-r * 0.5, r * 0.05);
    ctx.lineTo(0, -r * 0.65);
    ctx.lineTo(r * 0.5, r * 0.05);
    ctx.lineTo(r, -r * 0.4);
    ctx.lineTo(r, r * 0.5);
    ctx.closePath();
    fillStroke(ctx, { strokeWidth: r * 0.12, ...d }, { x: -r, y: -r, w: 2 * r, h: 2 * r });
  },
  bunny(ctx, d) {
    const r = s2(d);
    const ink = d.stroke || '#3a1028';
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = ink;
    ctx.fillStyle = '#fff';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.32, -r * 0.75, r * 0.2, r * 0.55, dir * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.32, -r * 0.75, r * 0.09, r * 0.38, dir * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = d.color || '#ffb3cf';
      ctx.fill();
      ctx.fillStyle = '#fff';
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-r * 0.28, r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.28, r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.color || '#ffb3cf';
    ctx.beginPath();
    ctx.ellipse(-r * 0.45, r * 0.25, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.45, r * 0.25, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = ink;
    ctx.stroke();
  },
  cat(ctx, d) {
    const r = s2(d);
    const fur = d.color || '#f2994a';
    const ink = d.stroke || '#5a2a0c';
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = ink;
    ctx.lineJoin = 'round';
    // ears
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.78, -r * 0.2);
      ctx.lineTo(dir * r * 0.62, -r * 0.95);
      ctx.lineTo(dir * r * 0.2, -r * 0.55);
      ctx.closePath();
      ctx.fillStyle = fur;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.65, -r * 0.35);
      ctx.lineTo(dir * r * 0.6, -r * 0.75);
      ctx.lineTo(dir * r * 0.36, -r * 0.52);
      ctx.closePath();
      ctx.fillStyle = '#ffc2b4';
      ctx.fill();
    }
    // head
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.stroke();
    // stripes
    ctx.strokeStyle = d.stripe || '#d9731f';
    ctx.lineWidth = r * 0.07;
    for (const k of [-0.18, 0, 0.18]) {
      ctx.beginPath();
      ctx.moveTo(k * r, -r * 0.7);
      ctx.lineTo(k * r * 0.8, -r * 0.45);
      ctx.stroke();
    }
    // muzzle
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7ec';
    ctx.fill();
    // eyes
    ctx.fillStyle = ink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      if (d.sleepy) {
        ctx.arc(dir * r * 0.38, -r * 0.02, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = ink;
        ctx.lineWidth = r * 0.05;
        ctx.stroke();
      } else {
        ctx.ellipse(dir * r * 0.38, -r * 0.02, r * 0.1, r * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(dir * r * 0.38 + r * 0.03, -r * 0.07, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink;
      }
    }
    // nose + mouth
    ctx.beginPath();
    ctx.moveTo(-r * 0.07, r * 0.17);
    ctx.lineTo(r * 0.07, r * 0.17);
    ctx.lineTo(0, r * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#e8746b';
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = ink;
    ctx.lineWidth = r * 0.035;
    ctx.arc(-r * 0.09, r * 0.28, r * 0.09, 0, Math.PI * 0.9);
    ctx.moveTo(r * 0.18, r * 0.28);
    ctx.arc(r * 0.09, r * 0.28, r * 0.09, 0, Math.PI * 0.9);
    ctx.stroke();
    // blush
    ctx.fillStyle = 'rgba(255, 120, 120, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, r * 0.2, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.6, r * 0.2, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    // whiskers
    ctx.strokeStyle = ink;
    ctx.lineWidth = r * 0.025;
    for (const dir of [-1, 1]) {
      for (const k of [-0.05, 0.08]) {
        ctx.beginPath();
        ctx.moveTo(dir * r * 0.5, r * (0.25 + k));
        ctx.lineTo(dir * r * 1.05, r * (0.18 + k * 1.6));
        ctx.stroke();
      }
    }
  },
  gamepad(ctx, d) {
    const r = s2(d);
    const ink = d.stroke || '#1a1a4e';
    roundRectPath(ctx, -r, -r * 0.48, 2 * r, r * 0.96, r * 0.42);
    ctx.fillStyle = d.color || '#b48cff';
    ctx.fill();
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(-r * 0.7, -r * 0.07, r * 0.4, r * 0.14);
    ctx.fillRect(-r * 0.57, -r * 0.2, r * 0.14, r * 0.4);
    const btns = [
      [0.45, -0.15, '#ff4fa3'],
      [0.65, 0.05, '#ffd23f'],
      [0.25, 0.05, '#3fd0ff'],
      [0.45, 0.25, '#5ce08a'],
    ];
    for (const [bx, by, c] of btns) {
      ctx.beginPath();
      ctx.arc(bx * r, by * r, r * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.lineWidth = r * 0.03;
      ctx.stroke();
    }
  },
  'pixel-heart'(ctx, d) {
    const grid = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
    const px = (d.size || 42) / 7;
    ctx.fillStyle = d.color || '#ff4fa3';
    grid.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === '1') ctx.fillRect((x - 3.5) * px, (y - 3) * px, px + 0.5, px + 0.5);
      })
    );
    if (d.shine) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(-2.5 * px, -2 * px, px, px);
    }
  },
  balloon(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.stroke || 'rgba(60,40,40,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(r * 0.3, r * 1.4, -r * 0.3, r * 1.7, r * 0.1, r * 2.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.72, r * 0.88, 0, 0, Math.PI * 2);
    ctx.fillStyle = d.color || '#ff6b6b';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.95);
    ctx.lineTo(r * 0.1, r * 0.95);
    ctx.lineTo(0, r * 0.84);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.35, r * 0.12, r * 0.22, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  },
  cake(ctx, d) {
    const r = s2(d);
    const ink = d.stroke || '#3d348b';
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = ink;
    roundRectPath(ctx, -r * 0.8, -r * 0.05, r * 1.6, r * 0.75, r * 0.1);
    ctx.fillStyle = d.color || '#ffb3c7';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.15);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-r * 0.8 + (r * 1.6 * i) / 8, r * (i % 2 ? 0.28 : 0.15));
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = ink;
    ctx.fillRect(-r * 0.06, -r * 0.5, r * 0.12, r * 0.45);
    ctx.strokeRect(-r * 0.06, -r * 0.5, r * 0.12, r * 0.45);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.65, r * 0.08, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8a3d';
    ctx.fill();
  },
};

/* ---------- Full-strip effects (not centred painters) ---------- */

export const EFFECTS = {
  'film-sprockets'(ctx, d, W, H) {
    ctx.fillStyle = d.color || '#f3e9dc';
    const hw = d.w || 22;
    const hh = d.h || 15;
    const step = d.step || 42;
    const inset = d.inset || 16;
    for (let y = 18; y < H - hh - 10; y += step) {
      roundRectPath(ctx, inset, y, hw, hh, 3);
      ctx.fill();
      roundRectPath(ctx, W - inset - hw, y, hw, hh, 3);
      ctx.fill();
    }
  },
  'side-bar'(ctx, d, W, H) {
    ctx.fillStyle = d.color;
    if (d.left) ctx.fillRect(0, 0, d.left, H);
    if (d.right) ctx.fillRect(W - d.right, 0, d.right, H);
    if (d.top) ctx.fillRect(0, 0, W, d.top);
    if (d.bottom) ctx.fillRect(0, H - d.bottom, W, d.bottom);
  },
  rule(ctx, d, W, H, resolveY) {
    const y = resolveY(d.y);
    ctx.strokeStyle = d.color || '#111';
    ctx.lineWidth = d.width || 1.5;
    const x1 = (d.x1 ?? 0.08) * W;
    const x2 = (d.x2 ?? 0.92) * W;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    if (d.double) {
      ctx.moveTo(x1, y + d.double);
      ctx.lineTo(x2, y + d.double);
    }
    ctx.stroke();
  },
  waves70s(ctx, d, W, H) {
    const colors = d.colors || ['#8b3a1a', '#d9541e', '#f08c2e', '#f5b544'];
    const band = d.band || 14;
    for (const side of [-1, 1]) {
      colors.forEach((c, i) => {
        ctx.beginPath();
        const base = side < 0 ? (colors.length - i) * band : W - (colors.length - i) * band;
        ctx.moveTo(side < 0 ? 0 : W, 0);
        for (let y = 0; y <= H; y += 8) {
          const x = base + side * -1 * Math.sin(y / 70 + i * 0.4) * 9;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(side < 0 ? 0 : W, H);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
      });
    }
  },
  confetti(ctx, d, W, H) {
    const rand = mulberry32(d.seed || 7);
    const colors = d.colors || ['#ff6b6b', '#ffd23f', '#3fd0ff', '#5ce08a', '#b48cff'];
    for (let i = 0; i < (d.count || 80); i++) {
      ctx.save();
      ctx.translate(rand() * W, rand() * H);
      ctx.rotate(rand() * Math.PI);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.85;
      if (rand() < 0.5) ctx.fillRect(-5, -2.5, 10, 5);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
};

/* ---------- Background patterns ---------- */

export function drawPattern(ctx, p, W, H, seed = 1) {
  if (!p) return;
  const rand = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.type) {
    case 'grid': {
      const s = p.size || 24;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = s; x < W; x += s) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
      }
      for (let y = s; y < H; y += s) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
      }
      ctx.stroke();
      break;
    }
    case 'dots': {
      const g = p.gap || 24;
      const r = p.size || 3;
      for (let y = g / 2, row = 0; y < H; y += g, row++) {
        for (let x = (row % 2 ? g : g / 2); x < W; x += g) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'pixel': {
      const s = p.size || 20;
      for (let y = 0; y < H; y += s) {
        for (let x = 0; x < W; x += s) if (((x + y) / s) % 2 === 0) ctx.fillRect(x, y, s, s);
      }
      break;
    }
    case 'grain': {
      const n = Math.floor((W * H) / (p.density || 140));
      for (let i = 0; i < n; i++) ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
      break;
    }
    case 'hearts': {
      const n = p.count || 40;
      for (let i = 0; i < n; i++) {
        const s = 10 + rand() * 16;
        ctx.save();
        ctx.translate(rand() * W, rand() * H);
        ctx.rotate((rand() - 0.5) * 0.8);
        heartPath(ctx, -s / 2, -s / 2, s, s * 0.9);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    default:
      PATTERNS[p.type]?.(ctx, p, W, H, rand);
      break;
  }
  ctx.restore();
}

/** Extra background patterns registered by drawExtra.js: (ctx, p, W, H, rand) => void */
export const PATTERNS = {};
