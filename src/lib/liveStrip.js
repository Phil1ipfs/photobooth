// Live Strips — boomerang-style animated photostrips.
//
// Pipeline (memory-friendly; nothing per-frame goes into React state):
//   camera <video> ──(drawVideoFrame, ~10 fps for ~2 s)──▶ ~20 small canvases
//   ──▶ boomerang order 0 1 2 … n-1 … 2 1 (seamless loop, no repeated end frames)
//   ──▶ createStripRenderer(template) paints each animation frame on demand
//   ──▶ preview (canvas + requestAnimationFrame) · WebM/MP4 (MediaRecorder on the
//       canvas stream) · GIF (gifenc) · JPEG poster.
// Frames are sampled straight from the live video instead of decoding a recorded
// clip: fewer moving parts, no codec/seek quirks (iOS), and far less memory.
import { drawVideoFrame } from '../components/photobooth/useCamera';
import { createStripRenderer } from '../templates/render';

export const LIVE = {
  frames: 20, // frames captured
  captureMs: 2000, // capture window (~10 fps)
  frameMs: 90, // playback speed per animation frame
  frameWidth: 560, // captured frame width (px) — plenty for a strip slot
  exportScale: 1, // video export: full strip resolution (600 px wide)
  gifScale: 0.6, // GIF: 360 px wide keeps files shareable
  videoLoops: 3, // loops recorded into the video file
};

/** Animation order: forward then back, without doubling the end frames. */
export function boomerangOrder(n) {
  if (n <= 1) return n === 1 ? [0] : [];
  const fwd = Array.from({ length: n }, (_, i) => i);
  return [...fwd, ...fwd.slice(1, -1).reverse()];
}

/** Which captured frame each slot shows at animation step `step` (slots are staggered). */
export function slotFrames(order, slotCount, step) {
  const len = order.length;
  return Array.from({ length: slotCount }, (_, i) => order[(step + Math.round((len * i) / slotCount)) % len]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sample `count` frames from the playing camera video over `durationMs`.
 * Returns canvases (caller owns them; call releaseFrames when done).
 */
export async function captureFrames(video, { aspect, mirror = true, count = LIVE.frames, durationMs = LIVE.captureMs, onProgress, isCancelled } = {}) {
  const frames = [];
  const gap = durationMs / count;
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    if (isCancelled?.()) break;
    const c = drawVideoFrame(video, { aspect, mirror, maxWidth: LIVE.frameWidth });
    if (!c) throw new Error('The camera stopped responding. Try again.');
    frames.push(c);
    onProgress?.((i + 1) / count);
    const due = start + gap * (i + 1);
    await sleep(Math.max(0, due - performance.now()));
  }
  return frames;
}

/** Free canvas memory promptly (mobile browsers keep backing stores alive otherwise). */
export function releaseFrames(frames) {
  (frames || []).forEach((c) => {
    c.width = 0;
    c.height = 0;
  });
}

/** Builds a renderer for a template and the captured frames. */
export async function createLiveRenderer(template, frames, { aspect, layout, filter, scale = 1 }) {
  const strip = await createStripRenderer(template, { aspect, layout, filter, scale, placeholders: false });
  const order = boomerangOrder(frames.length);
  return {
    width: strip.width,
    height: strip.height,
    steps: order.length,
    /** Paint animation step `step` onto ctx. */
    draw(ctx, step) {
      const idx = slotFrames(order, strip.slotCount, step % order.length);
      strip.draw(ctx, idx.map((k) => frames[k]));
    },
  };
}

/** Poster image (first step) as a JPEG blob — used for thumbnails in My Photos. */
export async function renderPoster(renderer) {
  const c = document.createElement('canvas');
  c.width = renderer.width;
  c.height = renderer.height;
  renderer.draw(c.getContext('2d'), 0);
  const blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not create image.'))), 'image/jpeg', 0.9));
  c.width = c.height = 0;
  return blob;
}

/** Best video type this browser can record, or null. WebM first, MP4 (Safari) second. */
export function videoMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) || null;
}

export const extensionFor = (mime) => (/mp4/.test(mime) ? 'mp4' : /gif/.test(mime) ? 'gif' : 'webm');

/**
 * Record the animation to a video blob in real time (MediaRecorder on the canvas
 * stream). Takes about loops × steps × frameMs.
 */
export async function recordVideo(renderer, { loops = LIVE.videoLoops, frameMs = LIVE.frameMs, onProgress } = {}) {
  const mimeType = videoMimeType();
  if (!mimeType) throw new Error('This browser can’t record video. Try the GIF download instead.');
  const canvas = document.createElement('canvas');
  canvas.width = renderer.width;
  canvas.height = renderer.height;
  const ctx = canvas.getContext('2d');
  renderer.draw(ctx, 0);
  const stream = canvas.captureStream(Math.round(1000 / frameMs));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'));
  });
  try {
    recorder.start(250);
    const total = renderer.steps * loops;
    const start = performance.now();
    for (let i = 0; i <= total; i++) {
      renderer.draw(ctx, i);
      stream.getVideoTracks()[0]?.requestFrame?.();
      onProgress?.(i / total);
      await sleep(Math.max(0, start + frameMs * (i + 1) - performance.now()));
    }
    recorder.stop();
    await done;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    canvas.width = canvas.height = 0;
  }
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}

/** Encode the animation as a looping GIF (gifenc, in small async chunks). */
export async function encodeGif(template, frames, opts, { onProgress } = {}) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const renderer = await createLiveRenderer(template, frames, { ...opts, scale: LIVE.gifScale });
  const canvas = document.createElement('canvas');
  canvas.width = renderer.width;
  canvas.height = renderer.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  try {
    for (let i = 0; i < renderer.steps; i++) {
      renderer.draw(ctx, i);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay: LIVE.frameMs, repeat: 0 });
      onProgress?.((i + 1) / renderer.steps);
      await sleep(0); // keep the page responsive
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export const liveFileName = (templateName = 'strip', ext = 'webm', date = new Date()) =>
  `photobooth-live-${String(templateName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${date.getTime()}.${ext}`;
