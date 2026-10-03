// Additional illustration painters, effects and patterns for the expanded template
// library. They register into the shared registries in draw.js, so the renderer
// and template data treat them exactly like the built-in ones.
import { DECOR, EFFECTS, PATTERNS, fillStroke, heartPath, mulberry32, roundRectPath, starPath } from './draw';

const s2 = (d) => (d.size || 24) / 2;

Object.assign(DECOR, {
  sun(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.color || '#ff9f1c';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = d.color || '#ff9f1c';
    ctx.fill();
    if (d.face) DECOR.smileyFace(ctx, { size: r * 0.8, ink: d.ink || '#7a3a00' });
  },

  palm(ctx, d) {
    const r = s2(d);
    ctx.lineCap = 'round';
    ctx.strokeStyle = d.trunk || '#9a6a3a';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, r);
    ctx.quadraticCurveTo(r * 0.35, r * 0.1, -r * 0.05, -r * 0.45);
    ctx.stroke();
    ctx.fillStyle = d.color || '#2fa36b';
    const leaves = [-2.6, -2.0, -1.4, -0.75, -0.15];
    for (const a of leaves) {
      ctx.save();
      ctx.translate(-r * 0.05, -r * 0.45);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.35, -r * 0.28, r * 0.85, r * 0.05);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.02, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = d.nut || '#7a4a22';
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.36, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.04, -r * 0.34, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  },

  cherry(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.stem || '#4f7a28';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.4, r * 0.15, -r * 0.8);
    ctx.moveTo(r * 0.45, r * 0.4);
    ctx.quadraticCurveTo(r * 0.35, -r * 0.3, r * 0.15, -r * 0.8);
    ctx.stroke();
    ctx.fillStyle = d.leaf || '#6fae3b';
    ctx.beginPath();
    ctx.ellipse(r * 0.4, -r * 0.78, r * 0.28, r * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [
      [-r * 0.4, r * 0.5],
      [r * 0.45, r * 0.6],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = d.color || '#e0263c';
      ctx.fill();
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = r * 0.06;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
    }
  },

  planet(ctx, d) {
    const r = s2(d);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, d.color || '#ffb36b');
    g.addColorStop(1, d.shade || '#e0603a');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    if (d.bands) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-r, -r * 0.2, 2 * r, r * 0.14);
      ctx.fillRect(-r, r * 0.15, 2 * r, r * 0.1);
      ctx.restore();
    }
    if (d.ring !== false) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.26, -0.35, 0, Math.PI * 2);
      ctx.strokeStyle = d.ringColor || '#ffe3a3';
      ctx.lineWidth = r * 0.08;
      ctx.stroke();
    }
  },

  earth(ctx, d) {
    const r = s2(d);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#3d8ee8';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#4cc36b';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.25, r * 0.45, r * 0.3, 0.6, 0, Math.PI * 2);
    ctx.ellipse(r * 0.4, r * 0.35, r * 0.4, r * 0.25, -0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 0.1, -r * 0.75, r * 0.3, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  rocket(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, r * 0.55);
    ctx.lineTo(0, r * 1.05);
    ctx.lineTo(r * 0.18, r * 0.55);
    ctx.fill();
    ctx.fillStyle = d.accent || '#e8434f';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.25, r * 0.1);
      ctx.lineTo(dir * r * 0.55, r * 0.65);
      ctx.lineTo(dir * r * 0.22, r * 0.55);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.45, -r * 0.6, r * 0.32, r * 0.3, r * 0.25, r * 0.6);
    ctx.lineTo(-r * 0.25, r * 0.6);
    ctx.bezierCurveTo(-r * 0.32, r * 0.3, -r * 0.45, -r * 0.6, 0, -r);
    ctx.fillStyle = d.color || '#f2f4f8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#5ab0ff';
    ctx.fill();
    ctx.strokeStyle = '#2b3a67';
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
  },

  astronaut(ctx, d) {
    const r = s2(d);
    const suit = d.color || '#f4f6fb';
    const ink = d.stroke || '#2b3a67';
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = ink;
    ctx.fillStyle = suit;
    // backpack + body
    roundRectPath(ctx, -r * 0.42, -r * 0.05, r * 0.84, r * 0.75, r * 0.18);
    ctx.fill();
    ctx.stroke();
    // arms / legs
    for (const [x, y, w, h, rot] of [
      [-r * 0.62, r * 0.05, r * 0.24, r * 0.5, 0.5],
      [r * 0.38, r * 0.05, r * 0.24, r * 0.5, -0.9],
      [-r * 0.33, r * 0.62, r * 0.24, r * 0.38, 0.1],
      [r * 0.09, r * 0.62, r * 0.24, r * 0.38, -0.1],
    ]) {
      ctx.save();
      ctx.translate(x + w / 2, y);
      ctx.rotate(rot);
      roundRectPath(ctx, -w / 2, 0, w, h, w / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // helmet
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = suit;
    ctx.fill();
    ctx.stroke();
    roundRectPath(ctx, -r * 0.3, -r * 0.62, r * 0.6, r * 0.38, r * 0.18);
    ctx.fillStyle = '#1e2a52';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.14, -r * 0.52, r * 0.06, r * 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // chest panel
    ctx.fillStyle = '#ff6b8a';
    ctx.fillRect(-r * 0.15, r * 0.15, r * 0.3, r * 0.18);
  },

  stamp(ctx, d) {
    const w = d.w || 90;
    const h = d.h || 110;
    const t = 5;
    ctx.save();
    ctx.shadowColor = 'rgba(60,40,20,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = d.paper || '#fffaf0';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    // perforations
    ctx.fillStyle = d.bg || '#efe3cc';
    for (let x = -w / 2; x <= w / 2; x += t * 2) {
      ctx.beginPath();
      ctx.arc(x, -h / 2, t / 1.4, 0, Math.PI * 2);
      ctx.arc(x, h / 2, t / 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let y = -h / 2; y <= h / 2; y += t * 2) {
      ctx.beginPath();
      ctx.arc(-w / 2, y, t / 1.4, 0, Math.PI * 2);
      ctx.arc(w / 2, y, t / 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // picture
    const pw = w - 20;
    const ph = h - 34;
    ctx.fillStyle = d.color || '#a7c7a0';
    ctx.fillRect(-pw / 2, -h / 2 + 10, pw, ph);
    ctx.save();
    ctx.translate(0, -h / 2 + 10 + ph / 2);
    DECOR.flower(ctx, { size: Math.min(pw, ph) * 0.6, color: d.petal || '#fff6e0', center: '#f2b33d' });
    ctx.restore();
    ctx.fillStyle = d.ink || '#8a5a3a';
    ctx.font = `700 ${Math.round(h * 0.11)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(d.value || '25¢', 0, h / 2 - 8);
  },

  postmark(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.color || 'rgba(70,50,40,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const y = -r * 0.3 + i * r * 0.2;
      ctx.moveTo(r * 0.6, y);
      for (let x = r * 0.6; x <= r * 1.9; x += 6) ctx.lineTo(x, y + Math.sin(x / 7) * 3);
      ctx.stroke();
    }
    ctx.font = `700 ${Math.round(r * 0.18)}px "DM Sans", sans-serif`;
    ctx.fillStyle = d.color || 'rgba(70,50,40,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(d.text || 'PAR AVION', 0, r * 0.07);
  },

  botanical(ctx, d) {
    const r = s2(d);
    const stem = d.stem || '#7a8f5a';
    ctx.strokeStyle = stem;
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(r * 0.2, r * 0.3, -r * 0.2, -r * 0.3, r * 0.05, -r * 0.85);
    ctx.stroke();
    ctx.fillStyle = d.leaf || '#9db27a';
    for (let i = 0; i < 5; i++) {
      const y = r * 0.7 - i * r * 0.32;
      const side = i % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(side * r * 0.04, y);
      ctx.rotate(side * 0.9);
      ctx.beginPath();
      ctx.ellipse(side * r * 0.14, 0, r * 0.16, r * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(r * 0.05, -r * 0.88);
    DECOR.flower(ctx, { size: r * 0.42, color: d.color || '#f2a7a0', center: d.center || '#f5c86b', petals: 5 });
    ctx.restore();
    if (d.buds !== false) {
      ctx.fillStyle = d.color || '#f2a7a0';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.35, r * 0.07, 0, Math.PI * 2);
      ctx.arc(r * 0.24, r * 0.05, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  butterfly(ctx, d) {
    const r = s2(d);
    const c = d.color || '#b48cff';
    const c2 = d.color2 || '#f6b6e8';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.42, -r * 0.25, r * 0.42, r * 0.5, dir * -0.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.32, r * 0.35, r * 0.28, r * 0.34, dir * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = c2;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dir * r * 0.45, -r * 0.3, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();
    }
    ctx.strokeStyle = d.stroke || '#4a2c7a';
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(0, r * 0.6);
    ctx.stroke();
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.quadraticCurveTo(-r * 0.1, -r * 0.8, -r * 0.25, -r * 0.85);
    ctx.moveTo(0, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.1, -r * 0.8, r * 0.25, -r * 0.85);
    ctx.stroke();
  },

  bear(ctx, d) {
    const r = s2(d);
    const fur = d.color || '#c99366';
    const ink = d.stroke || '#5a3a22';
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = ink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * r * 0.62, -r * 0.5, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = fur;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dir * r * 0.62, -r * 0.5, r * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#f2c2a2';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.85, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.32, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f5dcc2';
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.06, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.06, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.09, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.5, r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.5, r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  /** Comic "SNAP!" starburst. */
  burst(ctx, d) {
    const r = s2(d);
    starPath(ctx, 0, 0, r, r * 0.72, d.points || 14);
    ctx.fillStyle = d.color || '#3fb6ff';
    ctx.fill();
    ctx.strokeStyle = d.stroke || '#1a1a1a';
    ctx.lineWidth = r * 0.05;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (d.inner) {
      starPath(ctx, 0, 0, r * 0.8, r * 0.6, d.points || 14, -Math.PI / 2 + 0.12);
      ctx.fillStyle = d.inner;
      ctx.fill();
    }
  },

  /** Speech bubble with a tail. Text is drawn by a separate text item. */
  bubble(ctx, d) {
    const w = d.w || 160;
    const h = d.h || 90;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.moveTo(-w * 0.12, h * 0.42);
    ctx.lineTo(-w * 0.3, h * 0.75);
    ctx.lineTo(w * 0.05, h * 0.46);
    fillStroke(ctx, { color: d.color || '#fff', stroke: d.stroke || '#1a1a1a', strokeWidth: d.strokeWidth || 4 }, { x: -w / 2, y: -h / 2, w, h });
  },

  /** Music player UI: waveform, progress bar, times and transport controls. */
  player(ctx, d) {
    const w = d.w || 440;
    const c = d.color || '#fff';
    const rand = mulberry32(d.seed || 3);
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    // waveform
    const bars = 46;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const bh = 6 + Math.abs(Math.sin(i * 0.45)) * 26 * (0.4 + rand() * 0.6);
      ctx.globalAlpha = i / bars < 0.35 ? 1 : 0.55;
      roundRectPath(ctx, -w / 2 + i * bw + bw * 0.2, -46 - bh / 2, bw * 0.6, bh, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // progress
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -8);
    ctx.lineTo(w / 2, -8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -8);
    ctx.lineTo(-w / 2 + w * 0.35, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w / 2 + w * 0.35, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '500 14px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.start || '01:12', -w / 2, 16);
    ctx.textAlign = 'right';
    ctx.fillText(d.end || '03:24', w / 2, 16);
    // controls
    ctx.beginPath();
    ctx.arc(0, 48, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.bg || '#111';
    ctx.beginPath();
    ctx.moveTo(-6, 36);
    ctx.lineTo(12, 48);
    ctx.lineTo(-6, 60);
    ctx.fill();
    ctx.fillStyle = c;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(dir * 70, 48);
      ctx.scale(dir, 1);
      ctx.beginPath();
      ctx.moveTo(-8, -9);
      ctx.lineTo(4, 0);
      ctx.lineTo(-8, 9);
      ctx.fill();
      ctx.fillRect(5, -9, 3, 18);
      ctx.restore();
    }
  },

  /** Hand-drawn style loop doodle (scribbled star / heart outline). */
  'doodle-crown'(ctx, d) {
    const r = s2(d);
    ctx.strokeStyle = d.stroke || '#fff';
    ctx.lineWidth = d.strokeWidth || 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.5);
    ctx.lineTo(-r * 0.9, -r * 0.45);
    ctx.lineTo(-r * 0.45, r * 0.05);
    ctx.lineTo(0, -r * 0.7);
    ctx.lineTo(r * 0.45, r * 0.05);
    ctx.lineTo(r * 0.9, -r * 0.45);
    ctx.lineTo(r, r * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 0.25);
    ctx.lineTo(r * 0.95, r * 0.25);
    ctx.stroke();
  },

  'heart-doodle'(ctx, d) {
    const s = d.size || 30;
    ctx.strokeStyle = d.stroke || '#fff';
    ctx.lineWidth = d.strokeWidth || 2.5;
    ctx.lineJoin = 'round';
    heartPath(ctx, -s / 2, -s * 0.45, s, s * 0.9);
    ctx.stroke();
    heartPath(ctx, -s / 2 + 2, -s * 0.45 + 2, s - 3, s * 0.9 - 3);
    ctx.stroke();
  },

  'music-note'(ctx, d) {
    const r = s2(d);
    ctx.fillStyle = d.color || '#fff';
    ctx.strokeStyle = d.color || '#fff';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, r * 0.55, r * 0.3, r * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.5);
    ctx.lineTo(-r * 0.08, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.5, r * 0.5, -r * 0.1);
    ctx.stroke();
  },
});

Object.assign(EFFECTS, {
  /** Layered ocean waves along the bottom edge. */
  sea(ctx, d, W, H) {
    const colors = d.colors || ['#7fd1ff', '#3aa7f0', '#1e7fd6'];
    const base = H - (d.height || 120);
    colors.forEach((c, i) => {
      const y0 = base + i * 28;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, y0);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y0 + Math.sin(x / 38 + i * 1.7) * 9);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) ctx[x ? 'lineTo' : 'moveTo'](x, y0 + Math.sin(x / 38 + i * 1.7) * 9);
      ctx.stroke();
    });
  },

  /** Thick 90s squiggle bands drawn behind the photos. */
  squiggles(ctx, d, W, H) {
    const colors = d.colors || ['#ff5fa2', '#ff7a1a', '#ffd23f'];
    const rand = mulberry32(d.seed || 5);
    const n = d.count || 9;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y0 = (H / n) * i + rand() * 60;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = d.width || 46;
      ctx.beginPath();
      for (let x = -40; x <= W + 40; x += 12) {
        const y = y0 + Math.sin(x / 90 + i) * 50 + x * 0.25;
        ctx[x === -40 ? 'moveTo' : 'lineTo'](x, y);
      }
      ctx.stroke();
    }
  },

  /** Faux newspaper text columns filling the margins. */
  newsprint(ctx, d, W, H) {
    const rand = mulberry32(d.seed || 9);
    ctx.fillStyle = d.color || 'rgba(30,30,30,0.18)';
    const colW = d.colW || 120;
    for (let x = 18; x < W - 20; x += colW + 14) {
      for (let y = d.top || 150; y < H - (d.bottom || 40); y += 9) {
        if (rand() < 0.08) continue;
        ctx.fillRect(x, y, Math.min(colW, W - 18 - x) * (0.7 + rand() * 0.3), 3);
      }
    }
  },

  /** Purple cloud bank along the bottom edge. */
  'cloud-bank'(ctx, d, W, H) {
    const rand = mulberry32(d.seed || 4);
    ctx.fillStyle = d.color || 'rgba(190,160,255,0.55)';
    for (let x = -30; x < W + 60; x += 70) {
      const r = 50 + rand() * 40;
      ctx.beginPath();
      ctx.arc(x, H - 20 - rand() * 30, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
});

Object.assign(PATTERNS, {
  gingham(ctx, p, W, H) {
    const s = p.size || 26;
    for (let x = 0; x < W; x += s * 2) ctx.fillRect(x, 0, s, H);
    for (let y = 0; y < H; y += s * 2) ctx.fillRect(0, y, W, s);
  },
  stars(ctx, p, W, H, rand) {
    const n = Math.floor((W * H) / (p.density || 4500));
    for (let i = 0; i < n; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = rand() < 0.85 ? 0.8 + rand() * 1.2 : 2.5;
      ctx.globalAlpha = 0.4 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  halftone(ctx, p, W, H) {
    const g = p.gap || 14;
    for (let y = 0, row = 0; y < H + g; y += g, row++) {
      for (let x = row % 2 ? g / 2 : 0; x < W + g; x += g) {
        const r = (p.size || 3) * (0.5 + 0.5 * Math.sin((x + y) / 140) ** 2);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
});
