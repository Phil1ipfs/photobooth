import { templateStripUsage, stripMediaType } from './stripUsage';

test('a used photo allowance does not block Live Strips or another design', () => {
  const usage = { used: 2, limit: 20, unlimited: false, templates: {
    classic: { photo: { used: 2, limit: 2 }, live_strip: { used: 0, limit: 2 } },
    polaroid: { photo: { used: 0, limit: 2 }, live_strip: { used: 0, limit: 2 } },
  } };
  expect(templateStripUsage(usage, 'classic', 'photo')).toEqual({ used: 2, limit: 2, unlimited: false });
  expect(templateStripUsage(usage, 'classic', 'live')).toEqual({ used: 0, limit: 2, unlimited: false });
  expect(templateStripUsage(usage, 'polaroid', 'photo').used).toBe(0);
  expect(templateStripUsage(usage, 'magazine', 'photo')).toBeNull();
});

test('unknown allowance is not displayed as unused and paid users stay unlimited', () => {
  expect(templateStripUsage(null, 'classic', 'photo')).toBeNull();
  expect(templateStripUsage({ used: 2, limit: 2 }, 'classic', 'photo')).toBeNull();
  expect(templateStripUsage({ unlimited: true, templates: { classic: { photo: { used: 2, limit: 2 } } } }, 'classic', 'photo').unlimited).toBe(true);
  expect(stripMediaType('live')).toBe('live_strip');
  expect(stripMediaType('live_strip')).toBe('live_strip');
  expect(stripMediaType()).toBe('photo');
});
