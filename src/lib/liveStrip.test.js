import { boomerangOrder, slotFrames, extensionFor, liveFileName } from './liveStrip';

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
  expect(liveFileName('Love Hearts', 'webm', new Date(5))).toBe('photobooth-live-love-hearts-5.webm');
});
