// Halloween illustration painters and effects. They register into the shared
// registries in draw.js (like drawExtra.js), so templates use them as plain data.
// Painters draw centred on (0, 0); `outline` paints a white sticker edge first.
import { DECOR, EFFECTS, PATTERNS, heartPath, mulberry32, sparklePath } from './draw';

const s2 = (d) => (d.size || 24) / 2;
const INK = '#2b1d22';

/** White "sticker" edge: stroke the silhouette thickly before the art is painted. */
function outline(ctx, d, r, silhouette) {
  if (!d.outline) return;
  ctx.save();
  silhouette();
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.22;
  ctx.strokeStyle = d.outline === true ? '#fff' : d.outline;
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = r * 0.12;
  ctx.shadowOffsetY = r * 0.04;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function ghostPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, r * 0.75);
  ctx.lineTo(-r * 0.78, -r * 0.05);
  ctx.bezierCurveTo(-r * 0.78, -r * 1.05, r * 0.78, -r * 1.05, r * 0.78, -r * 0.05);
  ctx.lineTo(r * 0.78, r * 0.75);
  // wavy hem
  for (let i = 0; i < 4; i++) {
    const x0 = r * 0.78 - (i * r * 1.56) / 4;
    ctx.quadraticCurveTo(x0 - r * 0.2, r * (i % 2 ? 0.98 : 0.6), x0 - r * 0.39, r * 0.75);
  }
  ctx.closePath();
}

function hatPath(ctx, r) {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.45, r * 0.95, r * 0.22, 0, 0, Math.PI * 2);
  ctx.moveTo(-r * 0.5, r * 0.4);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.2, r * 0.35, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.05, -r * 0.2, r * 0.5, r * 0.4);
  ctx.closePath();
}

Object.assign(DECOR, {
  /** Jack-o'-lantern. face: 'carved' (glowing) | 'cute' | 'none'. */
  pumpkin(ctx, d) {
    const r = s2(d);
    outline(ctx, d, r, () => {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 0.98, r * 0.78, 0, 0, Math.PI * 2);
    });
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, 0, r);
    g.addColorStop(0, d.light || '#ffb347');
    g.addColorStop(1, d.color || '#f07b12');
    ctx.fillStyle = g;
    ctx.strokeStyle = d.rib || 'rgba(150,60,0,0.55)';
    ctx.lineWidth = r * 0.05;
    for (const [cx, rx] of [
      [-r * 0.52, r * 0.45],
      [r * 0.52, r * 0.45],
      [0, r * 0.55],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, r * 0.1, rx, r * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // stem
    ctx.fillStyle = d.stem || '#5c7a29';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.6);
    ctx.quadraticCurveTo(-r * 0.05, -r * 0.95, r * 0.22, -r * 1.02);
    ctx.lineTo(r * 0.14, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    const face = d.face || 'carved';
    if (face === 'carved') {
      ctx.save();
      ctx.fillStyle = d.glow || '#ffe066';
      ctx.shadowColor = d.glow || '#ffd23f';
      ctx.shadowBlur = r * 0.35;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * r * 0.15, -r * 0.05);
        ctx.lineTo(dir * r * 0.55, -r * 0.08);
        ctx.lineTo(dir * r * 0.34, -r * 0.38);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.22);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.6 + (i * r * 1.2) / 6, r * (i % 2 ? 0.32 : 0.22));
      ctx.quadraticCurveTo(0, r * 0.85, -r * 0.6, r * 0.22);
      ctx.fill();
      ctx.restore();
    } else if (face === 'cute') {
      ctx.fillStyle = INK;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(dir * r * 0.3, -r * 0.02, r * 0.09, r * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,140,0.55)';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(dir * r * 0.55, r * 0.2, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  /** Friendly ghost. hat: witch hat; heart: holds a heart; pumpkin: holds a pumpkin. */
  ghost(ctx, d) {
    const r = s2(d);
    outline(ctx, d, r, () => ghostPath(ctx, r));
    ghostPath(ctx, r);
    ctx.fillStyle = d.color || '#fffaf5';
    ctx.fill();
    ctx.strokeStyle = d.stroke || INK;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.fillStyle = d.stroke || INK;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.26, -r * 0.18, r * 0.08, r * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = d.stroke || INK;
    ctx.lineWidth = r * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -r * 0.02, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,130,150,0.6)';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.45, -r * 0.0, r * 0.1, r * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (d.heart) {
      heartPath(ctx, -r * 0.32, r * 0.18, r * 0.64, r * 0.56);
      ctx.fillStyle = d.heart === true ? '#ff8fa3' : d.heart;
      ctx.fill();
      ctx.strokeStyle = d.stroke || INK;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
    }
    if (d.pumpkin) {
      ctx.save();
      ctx.translate(0, r * 0.42);
      DECOR.pumpkin(ctx, { size: r * 0.8, face: 'carved' });
      ctx.restore();
    }
    if (d.hat) {
      ctx.save();
      ctx.translate(r * 0.05, -r * 0.88);
      ctx.rotate(-0.12);
      DECOR['witch-hat'](ctx, { size: r * 1.15, band: d.hat === true ? '#f07b12' : d.hat });
      ctx.restore();
    }
    if (d.bow) {
      ctx.save();
      ctx.translate(r * 0.45, -r * 0.62);
      DECOR.bow(ctx, { size: r * 0.55, color: d.bow === true ? '#ff9ec4' : d.bow });
      ctx.restore();
    }
  },

  bat(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#1a1014';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.15);
    for (const dir of [-1, 1]) {
      ctx.moveTo(0, -r * 0.1);
      ctx.quadraticCurveTo(dir * r * 0.45, -r * 0.55, dir * r, -r * 0.2);
      ctx.quadraticCurveTo(dir * r * 0.82, -r * 0.05, dir * r * 0.78, r * 0.18);
      ctx.quadraticCurveTo(dir * r * 0.62, r * 0.02, dir * r * 0.5, r * 0.2);
      ctx.quadraticCurveTo(dir * r * 0.36, r * 0.04, dir * r * 0.22, r * 0.22);
      ctx.quadraticCurveTo(dir * r * 0.1, r * 0.05, 0, r * 0.12);
      ctx.closePath();
    }
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.14, r * 0.2, 0, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.12, -r * 0.12);
    ctx.lineTo(-r * 0.08, -r * 0.3);
    ctx.lineTo(-r * 0.02, -r * 0.16);
    ctx.lineTo(r * 0.02, -r * 0.16);
    ctx.lineTo(r * 0.08, -r * 0.3);
    ctx.lineTo(r * 0.12, -r * 0.12);
    ctx.fill();
  },

  /** Quarter spider web spreading into +x/+y from (0, 0); rotate to fit a corner. */
  spiderweb(ctx, d) {
    const s = d.size || 160;
    ctx.strokeStyle = d.color || 'rgba(255,255,255,0.55)';
    ctx.lineWidth = d.width || 1.6;
    const rays = 6;
    const angle = (i) => (i / (rays - 1)) * (Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i < rays; i++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle(i)) * s, Math.sin(angle(i)) * s);
    }
    for (let ring = 1; ring <= 5; ring++) {
      const rr = (s * ring) / 5.4;
      for (let i = 0; i < rays; i++) {
        const a = angle(i);
        const p = [Math.cos(a) * rr, Math.sin(a) * rr];
        if (i === 0) ctx.moveTo(...p);
        else {
          const m = (angle(i - 1) + a) / 2;
          ctx.quadraticCurveTo(Math.cos(m) * rr * 0.82, Math.sin(m) * rr * 0.82, ...p);
        }
      }
    }
    ctx.stroke();
  },

  spider(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.thread || 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.lineTo(0, -(d.thread_len || r * 3));
    ctx.stroke();
    ctx.strokeStyle = d.color || '#140c10';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = -r * 0.1 + i * r * 0.14;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(dir * r * 0.55, y - r * 0.35, dir * r * (0.75 + i * 0.05), y + r * 0.25);
        ctx.stroke();
      }
    }
    ctx.fillStyle = d.color || '#140c10';
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.32, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.15, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  },

  /** Wrapped candy with twisted ends. colors: [body, stripe]. */
  candy(ctx, d) {
    const r = s2(d);
    const [body, stripe] = d.colors || ['#9b5de5', '#f7931e'];
    outline(ctx, d, r, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
    });
    ctx.fillStyle = body;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.45, 0);
      ctx.lineTo(dir * r, -r * 0.42);
      ctx.lineTo(dir * r * 0.9, 0);
      ctx.lineTo(dir * r, r * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = stripe;
    ctx.lineWidth = r * 0.16;
    for (let x = -r; x < r; x += r * 0.38) {
      ctx.beginPath();
      ctx.moveTo(x, r * 0.5);
      ctx.lineTo(x + r * 0.4, -r * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Swirl lollipop. colors: [a, b]. */
  lollipop(ctx, d) {
    const r = s2(d);
    const [a, b] = d.colors || ['#ff5d8f', '#ffffff'];
    ctx.strokeStyle = d.stick || '#f4ece4';
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.4);
    ctx.lineTo(r * 0.45, r * 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = a;
    ctx.fill();
    ctx.strokeStyle = b;
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    for (let t = 0; t < 14; t += 0.2) {
      const rr = (t / 14) * r * 0.5;
      ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    ctx.stroke();
  },

  'candy-corn'(ctx, d) {
    const r = s2(d);
    const tri = () => {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.75, r * 0.5, r * 0.62, r * 0.85);
      ctx.quadraticCurveTo(0, r * 1.02, -r * 0.62, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.75, r * 0.5, 0, -r);
      ctx.closePath();
    };
    outline(ctx, d, r, tri);
    ctx.save();
    tri();
    ctx.clip();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-r, r * 0.35, r * 2, r);
    ctx.fillStyle = '#f7801f';
    ctx.fillRect(-r, -r * 0.3, r * 2, r * 0.66);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(-r, -r, r * 2, r * 0.7);
    ctx.restore();
  },

  'witch-hat'(ctx, d) {
    const r = s2(d);
    outline(ctx, d, r, () => hatPath(ctx, r));
    hatPath(ctx, r);
    ctx.fillStyle = d.color || '#231427';
    ctx.fill();
    ctx.fillStyle = d.band || '#f07b12';
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.28);
    ctx.lineTo(r * 0.46, r * 0.28);
    ctx.lineTo(r * 0.42, r * 0.1);
    ctx.lineTo(-r * 0.4, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = d.buckle || '#ffd23f';
    ctx.lineWidth = r * 0.06;
    ctx.strokeRect(-r * 0.1, r * 0.11, r * 0.2, r * 0.16);
  },

  skull(ctx, d) {
    const r = s2(d);
    const head = () => {
      ctx.beginPath();
      ctx.arc(0, -r * 0.12, r * 0.78, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(r * 0.42, r * 0.85);
      ctx.lineTo(-r * 0.42, r * 0.85);
      ctx.closePath();
    };
    outline(ctx, d, r, head);
    head();
    ctx.fillStyle = d.color || '#f6f1e7';
    ctx.fill();
    ctx.strokeStyle = d.stroke || INK;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.fillStyle = d.stroke || INK;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.3, -r * 0.05, r * 0.2, r * 0.23, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, r * 0.2);
    ctx.lineTo(-r * 0.09, r * 0.38);
    ctx.lineTo(r * 0.09, r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = r * 0.05;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.16, r * 0.55);
      ctx.lineTo(i * r * 0.16, r * 0.85);
      ctx.stroke();
    }
    if (d.heartEyes) {
      ctx.fillStyle = d.heartEyes === true ? '#ff4d6d' : d.heartEyes;
      for (const dir of [-1, 1]) {
        heartPath(ctx, dir * r * 0.3 - r * 0.13, -r * 0.16, r * 0.26, r * 0.24);
        ctx.fill();
      }
    }
  },

  bone(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#f6f1e7';
    ctx.beginPath();
    ctx.rect(-r * 0.7, -r * 0.12, r * 1.4, r * 0.24);
    for (const x of [-1, 1]) for (const y of [-1, 1]) ctx.arc(x * r * 0.75, y * r * 0.15, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  },

  tombstone(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#6b6478';
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r);
    ctx.lineTo(-r * 0.6, -r * 0.3);
    ctx.arc(0, -r * 0.3, r * 0.6, Math.PI, 0);
    ctx.lineTo(r * 0.6, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = d.ink || 'rgba(30,20,40,0.6)';
    ctx.font = `700 ${Math.round(r * 0.42)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text || 'RIP', 0, -r * 0.2);
  },

  /** Round potion bottle with a heart. */
  potion(ctx, d) {
    const r = s2(d);
    const body = () => {
      ctx.beginPath();
      ctx.arc(0, r * 0.3, r * 0.65, -Math.PI * 0.3, Math.PI * 1.3);
      ctx.lineTo(-r * 0.22, -r * 0.55);
      ctx.lineTo(r * 0.22, -r * 0.55);
      ctx.closePath();
    };
    outline(ctx, d, r, body);
    body();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = d.color || '#b48cff';
    ctx.fillRect(-r, r * 0.05, r * 2, r);
    ctx.restore();
    body();
    ctx.strokeStyle = INK;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.fillStyle = '#c99a6b';
    ctx.fillRect(-r * 0.2, -r * 0.82, r * 0.4, r * 0.3);
    heartPath(ctx, -r * 0.2, r * 0.22, r * 0.4, r * 0.36);
    ctx.fillStyle = d.heart || '#ff5d8f';
    ctx.fill();
  },

  lantern(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.frame || '#2b1d22';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(0, -r * 0.75, r * 0.2, Math.PI, 0);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = d.glow || '#ffb347';
    ctx.shadowBlur = r * 0.8;
    ctx.fillStyle = d.glow || '#ffcf6b';
    ctx.fillRect(-r * 0.32, -r * 0.5, r * 0.64, r * 0.95);
    ctx.restore();
    ctx.strokeRect(-r * 0.32, -r * 0.5, r * 0.64, r * 0.95);
    ctx.fillStyle = d.frame || '#2b1d22';
    ctx.fillRect(-r * 0.42, -r * 0.62, r * 0.84, r * 0.14);
    ctx.fillRect(-r * 0.42, r * 0.45, r * 0.84, r * 0.14);
  },

  /** Autumn leaf. */
  leaf(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#e8762b';
    ctx.beginPath();
    ctx.moveTo(0, r);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.5 + (i / 8) * 2);
      const rr = r * (i % 2 ? 0.55 : 0.95);
      ctx.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr * 0.9);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = d.vein || 'rgba(90,30,0,0.5)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, -r * 0.6);
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.5, -r * 0.35);
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.5, -r * 0.35);
    ctx.stroke();
  },

  /** Full moon with a soft glow (pale, or red for a blood moon). */
  'full-moon'(ctx, d) {
    const r = s2(d);
    const c = d.color || '#f6efd2';
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2);
    g.addColorStop(0, d.glow || 'rgba(255,240,200,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    body.addColorStop(0, d.light || '#fffbe9');
    body.addColorStop(1, c);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.crater || 'rgba(0,0,0,0.08)';
    for (const [x, y, k] of [
      [-0.3, -0.2, 0.18],
      [0.25, 0.1, 0.24],
      [-0.1, 0.4, 0.12],
      [0.4, -0.35, 0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, k * r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /** Sitting black cat; hat and bow optional. */
  'black-cat'(ctx, d) {
    const r = s2(d);
    const body = () => {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.45, r * 0.55, r * 0.5, 0, 0, Math.PI * 2);
      ctx.moveTo(r * 0.45, -r * 0.15);
      ctx.ellipse(0, -r * 0.15, r * 0.45, r * 0.38, 0, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.4, -r * 0.3);
      ctx.lineTo(-r * 0.36, -r * 0.7);
      ctx.lineTo(-r * 0.12, -r * 0.48);
      ctx.moveTo(r * 0.4, -r * 0.3);
      ctx.lineTo(r * 0.36, -r * 0.7);
      ctx.lineTo(r * 0.12, -r * 0.48);
    };
    outline(ctx, d, r, body);
    ctx.fillStyle = d.color || '#1b1418';
    body();
    ctx.fill();
    ctx.strokeStyle = d.color || '#1b1418';
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.45, r * 0.8);
    ctx.quadraticCurveTo(r * 1.05, r * 0.85, r * 0.85, r * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.18, -r * 0.15, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff9ec4';
    ctx.beginPath();
    ctx.arc(0, -r * 0.04, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    if (d.bow) {
      ctx.save();
      ctx.translate(0, r * 0.18);
      DECOR.bow(ctx, { size: r * 0.5, color: d.bow === true ? '#ff9ec4' : d.bow });
      ctx.restore();
    }
    if (d.hat) {
      ctx.save();
      ctx.translate(r * 0.05, -r * 0.62);
      ctx.rotate(0.12);
      DECOR['witch-hat'](ctx, { size: r * 0.95, band: d.hat === true ? '#7a3cff' : d.hat });
      ctx.restore();
    }
  },

  /** Little hand-drawn sparkle/heart doodle (outline only). */
  doodle(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.color || INK;
    ctx.lineWidth = d.strokeWidth || Math.max(1.5, r * 0.12);
    ctx.lineJoin = 'round';
    if (d.shape === 'heart') heartPath(ctx, -r, -r * 0.9, r * 2, r * 1.8);
    else sparklePath(ctx, 0, 0, r);
    ctx.stroke();
  },
});

Object.assign(EFFECTS, {
  /** Torn kraft-paper sheet on a light backdrop (draw with layer: 'back'). */
  'paper-sheet'(ctx, d, W, H) {
    const rand = mulberry32(d.seed || 11);
    const inset = d.inset ?? 16;
    const jag = d.jag ?? 9;
    const edge = (x0, y0, x1, y1, n) => {
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        ctx.lineTo(x0 + (x1 - x0) * t + (rand() - 0.5) * jag, y0 + (y1 - y0) * t + (rand() - 0.5) * jag);
      }
    };
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    edge(inset, inset, W - inset, inset, 40);
    edge(W - inset, inset, W - inset, H - inset, 120);
    edge(W - inset, H - inset, inset, H - inset, 40);
    edge(inset, H - inset, inset, inset, 120);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(60,40,20,0.25)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = d.color || '#cdb08a';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.clip();
    // paper fibre speckles
    for (let i = 0; i < (W * H) / 900; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(90,60,30,0.10)' : 'rgba(255,255,255,0.10)';
      ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2.5, 1 + rand() * 2.5);
    }
    ctx.restore();
  },

  /** Haunted house + dead trees silhouette along the bottom, lit windows. */
  'haunted-skyline'(ctx, d, W, H) {
    const base = H - (d.bottom || 0);
    const h = d.height || 180;
    const c = d.color || '#1a0f24';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.quadraticCurveTo(W * 0.25, base - h * 0.35, W * 0.5, base - h * 0.25);
    ctx.quadraticCurveTo(W * 0.78, base - h * 0.15, W, base - h * 0.32);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // house (house: false keeps just hills and trees)
    const hx = W * (d.houseX ?? 0.62);
    if (d.house !== false) {
    const hw = W * 0.26;
    const hy = base - h * 0.25;
    ctx.beginPath();
    ctx.rect(hx - hw / 2, hy - h * 0.45, hw, h * 0.5);
    ctx.moveTo(hx - hw * 0.62, hy - h * 0.43);
    ctx.lineTo(hx, hy - h * 0.8);
    ctx.lineTo(hx + hw * 0.62, hy - h * 0.43);
    ctx.rect(hx + hw * 0.28, hy - h * 0.82, hw * 0.16, h * 0.4);
    ctx.moveTo(hx + hw * 0.22, hy - h * 0.8);
    ctx.lineTo(hx + hw * 0.36, hy - h * 1.02);
    ctx.lineTo(hx + hw * 0.5, hy - h * 0.8);
    ctx.fill();
    ctx.fillStyle = d.window || '#ffcf6b';
    for (const [wx, wy] of [
      [-0.3, -0.33],
      [0.08, -0.33],
      [-0.12, -0.12],
      [0.3, -0.62],
    ]) {
      ctx.fillRect(hx + wx * hw, hy + wy * h, hw * 0.1, h * 0.09);
    }
    }
    // dead trees
    ctx.strokeStyle = c;
    ctx.lineCap = 'round';
    for (const [tx, th, dir] of [
      [0.12, 0.75, 1],
      [0.9, 0.62, -1],
    ]) {
      const x = W * tx;
      const y = base - h * 0.22;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 6, y - h * th);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 1; i <= 3; i++) {
        const by = y - h * th * (0.3 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + dir * 4, by);
        ctx.lineTo(x + dir * (30 + i * 6) * (i % 2 ? 1 : -1), by - 26);
        ctx.stroke();
      }
    }
  },

  /** Wrought-iron fence along a y position. */
  'iron-fence'(ctx, d, W, H, resolveY) {
    const y = resolveY(d.y ?? -40);
    const h = d.height || 60;
    ctx.strokeStyle = d.color || '#2a1838';
    ctx.fillStyle = d.color || '#2a1838';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y - h * 0.7);
    ctx.lineTo(W, y - h * 0.7);
    ctx.moveTo(0, y - h * 0.15);
    ctx.lineTo(W, y - h * 0.15);
    for (let x = 8; x < W; x += d.step || 22) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
    }
    ctx.stroke();
    for (let x = 8; x < W; x += d.step || 22) {
      ctx.beginPath();
      ctx.moveTo(x - 5, y - h);
      ctx.lineTo(x, y - h - 10);
      ctx.lineTo(x + 5, y - h);
      ctx.fill();
    }
  },

  /** Soft drifting fog bands. */
  fog(ctx, d, W, H, resolveY) {
    const rand = mulberry32(d.seed || 3);
    const y0 = resolveY(d.y ?? -220);
    const y1 = resolveY(d.y2 ?? -1);
    for (let i = 0; i < (d.count || 18); i++) {
      const x = rand() * W;
      const y = y0 + rand() * (y1 - y0);
      const r = 60 + rand() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, d.color || 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  },

  /** Dripping edge along the top (vampire look). */
  drips(ctx, d, W) {
    const rand = mulberry32(d.seed || 9);
    const h = d.height || 26;
    ctx.fillStyle = d.color || '#8a0f1f';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    for (let x = 0; x <= W; x += 30) {
      const len = h + rand() * (d.max || 60);
      ctx.lineTo(x + 6, h);
      ctx.quadraticCurveTo(x + 8, len, x + 15, len);
      ctx.quadraticCurveTo(x + 22, len, x + 24, h);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
  },

  /**
   * Small painters scattered at random — use with layer: 'back' so photos sit on
   * top and nothing ever covers a face.
   */
  scatter(ctx, d, W, H) {
    const rand = mulberry32(d.seed || 21);
    const items = d.items || ['bat'];
    for (let i = 0; i < (d.count || 20); i++) {
      const type = items[i % items.length];
      ctx.save();
      ctx.translate(rand() * W, rand() * H);
      ctx.rotate((rand() - 0.5) * 0.8);
      ctx.globalAlpha = d.alpha ?? 0.85;
      DECOR[type](ctx, { size: (d.size || 22) * (0.7 + rand() * 0.6), color: d.colors ? d.colors[i % d.colors.length] : undefined, shape: d.shape });
      ctx.restore();
    }
  },
});

Object.assign(PATTERNS, {
  /** Diagonal candy stripes. */
  'candy-stripes'(ctx, p, W, H) {
    const s = p.size || 24;
    ctx.lineWidth = s;
    for (let x = -H; x < W + H; x += s * 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
  },
});
