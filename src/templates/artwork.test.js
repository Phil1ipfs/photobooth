import { ILLUSTRATED_HALLOWEEN_TEMPLATES } from './halloweenIllustrated';
import { ILLUSTRATED_LOVE_TEMPLATES } from './loveIllustrated';
import { LAYOUTS, getLayout, getTemplate, TEMPLATES } from './data';
import { computeLayout, createStripRenderer } from './render';
import { drawArtwork } from './artwork';
import { templateTier } from '../config/catalog';

const ARTWORK_TEMPLATES = [...ILLUSTRATED_HALLOWEEN_TEMPLATES, ...ILLUSTRATED_LOVE_TEMPLATES];

test('all ten illustrated designs are discoverable Halloween Premium templates', () => {
  expect(ILLUSTRATED_HALLOWEEN_TEMPLATES).toHaveLength(10);
  expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  expect(TEMPLATES.filter((t) => t.categories.includes('halloween'))).toHaveLength(20);
  ILLUSTRATED_HALLOWEEN_TEMPLATES.forEach((t) => {
    expect(getTemplate(t.id)).toBe(t);
    expect(templateTier(t)).toBe('premium');
    expect(t.layoutId).toBe('strip-1x4');
  });
});

test('all ten new Love designs are registered, Premium, and featured in Love', () => {
  expect(ILLUSTRATED_LOVE_TEMPLATES).toHaveLength(10);
  ILLUSTRATED_LOVE_TEMPLATES.forEach((t) => {
    expect(getTemplate(t.id)).toBe(t);
    expect(templateTier(t)).toBe('premium');
    expect(t.categories).toContain('love');
    expect(t.featuredCategories).toContain('love');
  });
  expect(getTemplate('theater-of-us').name).toBe('Theater of Us');
});

test.each(ARTWORK_TEMPLATES.map((t) => [t.id, t]))('%s positions four photos at the actual artwork openings', (id, template) => {
  const geo = computeLayout(template);
  expect(geo.artworkNative).toBe(true);
  expect(geo.W).toBe(600);
  expect(geo.H).toBe(Math.round(template.artwork.height * 600 / template.artwork.width));
  expect(geo.slots).toHaveLength(4);
  const ratio = 600 / template.artwork.width;
  geo.slots.forEach((r, i) => {
    const opening = template.artwork.windows[i];
    expect(r.x).toBeCloseTo(opening.x * ratio);
    expect(r.y).toBeCloseTo(opening.y * ratio);
    expect(r.w).toBeCloseTo(opening.w * ratio);
    expect(r.h).toBeCloseTo(opening.h * ratio);
  });
  // Camera aspect affects the photo crop, never the printed frame geometry.
  expect(computeLayout(template, 1)).toEqual(geo);
  expect(computeLayout(template, 16 / 9)).toEqual(geo);
});

test.each(LAYOUTS.map((l) => [l.id, l]))('illustrated frames also render the selected %s arrangement', (id, layout) => {
  ARTWORK_TEMPLATES.forEach((template) => {
    const geo = computeLayout(template, 4 / 3, layout);
    expect(geo.slots).toHaveLength(layout.photoCount);
    geo.slots.forEach((r) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(geo.W);
      expect(r.y + r.h).toBeLessThanOrEqual(geo.H);
    });
    const image = {};
    const ctx = { drawImage: jest.fn(), strokeRect: jest.fn(), save: jest.fn(), restore: jest.fn() };
    drawArtwork(ctx, image, template, geo);
    expect(ctx.drawImage).toHaveBeenCalled();
    if (!geo.artworkNative) {
      expect(ctx.strokeRect).toHaveBeenCalledTimes(layout.photoCount);
      const [header, footer] = ctx.drawImage.mock.calls;
      // Source and destination illustration aspect ratios stay equal.
      expect(header[3] / header[4]).toBeCloseTo(header[7] / header[8], 1);
      expect(footer[3] / footer[4]).toBeCloseTo(footer[7] / footer[8], 1);
    }
    ctx.drawImage.mock.calls.forEach((args) => {
      const numbers = args.slice(1);
      expect(numbers.every(Number.isFinite)).toBe(true);
      if (args.length === 9) {
        const [sx, sy, sw, sh, dx, dy, dw, dh] = numbers;
        expect(sx).toBeGreaterThanOrEqual(0);
        expect(sy).toBeGreaterThanOrEqual(0);
        expect(sx + sw).toBeLessThanOrEqual(template.artwork.width);
        expect(sy + sh).toBeLessThanOrEqual(template.artwork.height);
        expect(dx).toBeGreaterThanOrEqual(0);
        expect(dy).toBeGreaterThanOrEqual(0);
        expect(dw).toBeGreaterThan(0);
        expect(dh).toBeGreaterThan(0);
        expect(dx + dw).toBeLessThanOrEqual(geo.W + 0.001);
        expect(dy + dh).toBeLessThanOrEqual(geo.H + 0.001);
      }
    });
  });
});

test('photo mattes cannot obscure captured photos, while transparent frames still overlay them', async () => {
  let image;
  const mock = jest.spyOn(window, 'Image').mockImplementation(() => {
    image = { width: 724, height: 2172, naturalWidth: 724, naturalHeight: 2172,
      set src(value) { Promise.resolve().then(() => this.onload()); },
    };
    return image;
  });
  try {
    for (const photosOnTop of [true, false]) {
      const base = getTemplate('theater-of-us');
      const renderer = await createStripRenderer({ ...base, artwork: { ...base.artwork, photosOnTop } }, { filter: 'none' });
      const calls = [];
      const ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push({ key, args })) });
      const photos = Array.from({ length: 4 }, (_, id) => ({ id, width: 320, height: 240 }));
      renderer.draw(ctx, photos);
      const painted = calls.filter((c) => c.key === 'drawImage').map((c) => c.args[0]);
      expect(painted).toEqual(photosOnTop ? [image, ...photos] : [...photos, image]);
    }
  } finally { mock.mockRestore(); }
});

test('the original Classic and old Halloween layouts retain their existing geometry', () => {
  const classic = computeLayout(getTemplate('classic'));
  expect(classic.artworkNative).toBeUndefined();
  expect(classic.slots[0]).toMatchObject({ x: 36, y: 36, w: 528, h: 396 });
  const old = computeLayout(getTemplate('vampire-date'), 4 / 3, getLayout('grid-2x2'));
  expect(old.artworkNative).toBeUndefined();
  expect(old.slots).toHaveLength(4);
});
