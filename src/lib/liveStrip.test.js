import { boomerangOrder, slotFrames, extensionFor, liveFileName, mp4Size } from './liveStrip';

test('boomerang plays forward then back without repeating the end frames', () => {
  expect(boomerangOrder(5)).toEqual([0, 1, 2, 3, 4, 3, 2, 1]);
  // looping: …2, 1, 0, 1, 2… → every step moves by exactly one frame (no jump)
  const order = boomerangOrder(20);
  const cyc = [...order, ...order];
  for (let i = 1; i < cyc.length; i++) expect(Math.abs(cyc[i] - cyc[i - 1])).toBe(1);
  expect(boomerangOrder(1)).toEqual([0]);
  expect(boomerangOrder(0)).toEqual([]);
});

test('each slot plays its own clip; empty slots stay empty', () => {
  // canvas-like frames; .width 0 = freed after a retake
  const clip = (tag, n = 5) => ({ frames: Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, width: 10 })) });
  const ids = (fs) => fs.map((f) => (f ? f.id : null));
  const clips = [clip('a'), null, clip('c'), null];
  expect(ids(slotFrames(clips, 0))).toEqual(['a0', null, 'c0', null]);
  expect(ids(slotFrames(clips, 6))).toEqual(['a2', null, 'c2', null]); // 0 1 2 3 4 3 2 1 → step 6 = frame 2
  const one = [clip('x'), null, null, null];
  for (let step = 0; step < 16; step++) {
    const f = ids(slotFrames(one, step));
    expect(f.slice(1)).toEqual([null, null, null]); // never duplicated into other slots
    expect(f[0].startsWith('x')).toBe(true);
  }
  // a freed frame is skipped instead of drawn
  const freed = { frames: [{ id: 'z0', width: 0 }] };
  expect(slotFrames([freed], 0)).toEqual([null]);
});

test('file names and extensions', () => {
  expect(extensionFor('video/webm')).toBe('webm');
  expect(extensionFor('video/mp4')).toBe('mp4');
  expect(extensionFor('image/gif')).toBe('gif');
  const d = new Date(2026, 9, 4, 15, 30, 12);
  expect(liveFileName('Love Hearts', 'mp4', d)).toBe('photobooth-video-2026-10-04-153012.mp4');
  expect(liveFileName('Love Hearts', 'gif', d)).toBe('photobooth-live-2026-10-04-153012.gif');
});

test('MP4 size keeps the strip resolution, capped at 1080p, with even dimensions', () => {
  expect(mp4Size(600, 1854)).toEqual({ width: 600, height: 1854 }); // 1×4 strip — unchanged
  expect(mp4Size(782, 535)).toEqual({ width: 782, height: 536 }); // odd → even
  expect(mp4Size(1200, 3708)).toEqual({ width: 622, height: 1920 }); // portrait capped to 1920 long side
  expect(mp4Size(3840, 2160)).toEqual({ width: 1920, height: 1080 }); // landscape capped to 1080p
  const { width, height } = mp4Size(1201, 801);
  expect(width % 2 + height % 2).toBe(0);
});
