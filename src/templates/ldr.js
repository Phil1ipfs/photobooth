// LDR (long-distance) collection. Same schema as data.js. A text with `caption: true`
// shows the couple's own caption when one is given (renderStrip option `caption`).

const whiteEdge = { stroke: '#fff', strokeWidth: 6 };

export const LDR_TEMPLATES = [
  {
    id: 'miles-apart',
    name: 'Miles Apart',
    layoutId: 'strip-1x4',
    categories: ['love'],
    description: 'Romantic scrapbook: layered paper, washi-taped polaroids, stamps and hearts — made for two places at once.',
    background: { type: 'solid', color: '#f6d6dc' },
    layout: { padX: 104, top: 70, gap: 34, bottom: 290 },
    frame: {
      shape: 'polaroid',
      inset: 14,
      bottomExtra: 44,
      fill: '#fffdf8',
      shadow: { color: 'rgba(120,50,70,0.28)', blur: 14, y: 6 },
      rotate: [-3, 3, -2.5, 3.5],
      shiftX: [-0.09, 0.09, -0.09, 0.09],
      tape: ['rgba(255,160,195,0.9)', 'rgba(150,215,195,0.88)', 'rgba(190,170,255,0.88)', 'rgba(255,215,130,0.9)'],
    },
    placeholder: { bg: ['#f7c6d3', '#d98aa3'], figure: 'rgba(255,255,255,0.75)' },
    texts: [
      { text: 'miles apart', caption: true, font: 'Caveat', weight: 700, size: 78, color: '#d6336c', stroke: '#fff', strokeWidth: 12, x: 0.42, y: -176, rotate: -5 },
      { text: 'close at heart · {date}', font: 'Caveat', weight: 700, size: 34, color: '#8a4a5a', x: 0.42, y: -100, rotate: -3 },
    ],
    decor: [
      { type: 'paper-sheet', layer: 'back', color: '#e9a9b8', inset: 14, seed: 5 },
      { type: 'paper-sheet', layer: 'back', color: '#fff4ea', inset: 34, jag: 6, seed: 9 },
      { type: 'scatter', layer: 'back', items: ['heart', 'doodle', 'heart', 'sparkle'], shape: 'heart', count: 26, size: 22, alpha: 0.45, seed: 31, colors: ['#f08aa8', '#c9a4d8', '#f6b26b', '#e7357a'] },
      { type: 'heart', slot: 0, sx: 1.13, sy: 0.3, size: 70, color: '#ff5d8f', ...whiteEdge, rotate: 12 },
      { type: 'sparkle', slot: 0, sx: 1.1, sy: 0.82, size: 34, color: '#f6b26b' },
      { type: 'stamp', slot: 1, sx: -0.14, sy: 0.4, w: 70, h: 86, color: '#f7b6c8', petal: '#fff', value: '♡', rotate: -8 },
      { type: 'heart-doodle', slot: 1, sx: -0.12, sy: 0.92, size: 40, stroke: '#d6336c' },
      { type: 'bow', slot: 2, sx: 1.13, sy: 0.25, size: 64, color: '#ff9ec4', rotate: 10 },
      { type: 'heart', slot: 2, sx: 1.12, sy: 0.75, size: 38, color: '#c9a4d8', ...whiteEdge },
      { type: 'flower', slot: 3, sx: -0.13, sy: 0.35, size: 58, color: '#ffb3c7', center: '#f6c453', rotate: 15 },
      { type: 'heart', slot: 3, sx: -0.12, sy: 0.85, size: 34, color: '#ff5d8f', ...whiteEdge, rotate: -14 },
      { type: 'postmark', x: 0.8, y: -130, size: 80, text: 'WITH LOVE', color: 'rgba(160,60,90,0.55)', rotate: -12 },
      { type: 'heart', x: 0.88, y: 46, size: 40, color: '#e7357a', ...whiteEdge, rotate: 14 },
    ],
  },
];
