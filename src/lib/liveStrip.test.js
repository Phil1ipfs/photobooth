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

test('slots are staggered across the loop and stay in range', () => {
  const order = boomerangOrder(20); // 38 steps
  const four = slotFrames(order, 4, 0);
  expect(four).toHaveLength(4);
  expect(new Set(four).size).toBe(4);
  for (let step = 0; step < order.length * 2; step++) {
    slotFrames(order, 6, step).forEach((k) => expect(k >= 0 && k < 20).toBe(true));
  }
  expect(slotFrames(order, 1, 3)).toEqual([order[3]]);
});

test('file names and extensions', () => {
  expect(extensionFor('video/webm')).toBe('webm');
  expect(extensionFor('video/mp4')).toBe('mp4');
  expect(extensionFor('image/gif')).toBe('gif');
  expect(liveFileName('Love Hearts', 'webm', new Date(5))).toBe('photobooth-live-love-hearts-5.webm');
});
