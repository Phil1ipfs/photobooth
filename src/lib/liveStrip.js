// Live Strips — boomerang-style animated photostrips.
//
// Pipeline (memory-friendly; nothing per-frame goes into React state):
//   camera <video> ──(drawVideoFrame, ~10 fps for ~2 s)──▶ ~20 small canvases
//   ──▶ one clip per slot · boomerang order 0 1 2 … n-1 … 2 1 (seamless loop)
//   ──▶ createStripRenderer(template) paints each animation frame on demand
//   ──▶ preview (canvas + requestAnimationFrame) · MP4 (H.264 + AAC via WebCodecs,
//       muxed by Mediabunny — loaded only on export) · GIF (gifenc) · JPEG poster.
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
  videoLoops: 3, // loops in the exported video (~10 s)
};

/** Animation order: forward then back, without doubling the end frames. */
export function boomerangOrder(n) {
  if (n <= 1) return n === 1 ? [0] : [];
  const fwd = Array.from({ length: n }, (_, i) => i);
  return [...fwd, ...fwd.slice(1, -1).reverse()];
}

/** The frame each slot shows at animation step `step`: every slot plays its OWN clip. */
export function slotFrames(clips, step) {
  return clips.map((c) => {
    if (!c?.frames?.length) return null;
    const order = boomerangOrder(c.frames.length);
    const f = c.frames[order[step % order.length]];
    return f && f.width ? f : null; // freed after a retake/clear → treat as empty
  });
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

/**
 * Renderer for a template and the slot clips (`clips[i]` = { frames } captured for
 * slot i, or null for an empty slot — shown as the template's placeholder).
 */
export async function createLiveRenderer(template, clips, { aspect, layout, filter, scale = 1 }) {
  const strip = await createStripRenderer(template, { aspect, layout, filter, scale });
  const steps = Math.max(1, ...clips.map((c) => (c?.frames?.length ? boomerangOrder(c.frames.length).length : 1)));
  return {
    width: strip.width,
    height: strip.height,
    steps,
    /** Paint animation step `step` onto ctx. */
    draw(ctx, step) {
      strip.draw(ctx, slotFrames(clips, step));
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

// ----- MP4 export -----------------------------------------------------------
// The animation is drawn by us frame by frame, so it is encoded straight to MP4:
// H.264 video at a constant 30 fps + a silent AAC track (some apps reject video
// without audio), fast-start MP4. No WebM intermediate, nothing is renamed.

export const MP4 = { fps: 30, maxLong: 1920, maxShort: 1080, sampleRate: 48000 };

export class Mp4UnsupportedError extends Error {
  constructor() {
    super('This browser can’t create MP4 videos. Download the GIF instead, or try Chrome, Edge or Safari.');
    this.name = 'Mp4UnsupportedError';
  }
}

/** Output size: keep the strip's resolution, capped to 1080p (either orientation), even dimensions for H.264. */
export function mp4Size(width, height) {
  const k = Math.min(1, MP4.maxLong / Math.max(width, height), MP4.maxShort / Math.min(width, height));
  const even = (n) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** Quick synchronous hint for labels: can this browser likely produce an MP4? (Checked for real on export.) */
export const mp4Likely = () => typeof VideoEncoder !== 'undefined' || !!nativeMp4Type();

/** MediaRecorder MP4 (older Safari without WebCodecs H.264 encoding). */
function nativeMp4Type() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t)) || null;
}

let supportPromise;
/** { video, audio } — can WebCodecs encode H.264 / AAC here? Loads Mediabunny on first call only. */
export function mp4Support(width = 600, height = 1856) {
  if (!supportPromise) {
    supportPromise = (async () => {
      if (typeof VideoEncoder === 'undefined') return { video: false, audio: false };
      const { canEncodeVideo, canEncodeAudio } = await import('mediabunny');
      const video = await canEncodeVideo('avc', { width, height, frameRate: MP4.fps });
      const audio = video && typeof AudioEncoder !== 'undefined' && (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: MP4.sampleRate }));
      return { video, audio };
    })().catch(() => ({ video: false, audio: false }));
  }
  return supportPromise;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

/**
 * Encode the animation (`loops` times) to an MP4 blob — H.264 + silent AAC, 30 fps.
 * Faster than real time; yields to the page between frames so the UI stays responsive.
 */
export async function encodeMp4(renderer, { loops = LIVE.videoLoops, frameMs = LIVE.frameMs, audio = true, onProgress } = {}) {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality } = await import('mediabunny');
  const { width, height } = mp4Size(renderer.width, renderer.height);
  // Draw at the renderer's size, then copy onto an H.264-friendly (even, ≤1080p) canvas.
  const src = document.createElement('canvas');
  src.width = renderer.width;
  src.height = renderer.height;
  const sctx = src.getContext('2d');
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(out, { codec: 'avc', quality: new Quality('high'), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: MP4.fps });
  const sound = audio ? new AudioBufferSource({ codec: 'aac', quality: new Quality('low') }) : null;
  if (sound) output.addAudioTrack(sound);

  const seconds = (renderer.steps * loops * frameMs) / 1000;
  const total = Math.max(1, Math.round(seconds * MP4.fps));
  try {
    await output.start();
    let drawn = -1;
    for (let f = 0; f < total; f++) {
      const t = f / MP4.fps;
      const step = Math.floor((t * 1000) / frameMs); // animation step shown at this 30 fps frame
      if (step !== drawn) {
        renderer.draw(sctx, step);
        octx.drawImage(src, 0, 0, width, height);
        drawn = step;
      }
      await video.add(t, 1 / MP4.fps);
      onProgress?.((f + 1) / total);
      if (f % 6 === 5) await yieldToUi();
    }
    if (sound) {
      const length = Math.ceil(seconds * MP4.sampleRate);
      await sound.add(new AudioBuffer({ length, numberOfChannels: 2, sampleRate: MP4.sampleRate })); // silence
    }
    await output.finalize();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } catch (err) {
    if (output.state !== 'finalized') await output.cancel().catch(() => {});
    throw err;
  } finally {
    src.width = src.height = out.width = out.height = 0;
  }
}

/** Real-time MP4 recording with MediaRecorder (fallback for browsers that record MP4 natively). */
async function recordNativeMp4(renderer, { loops = LIVE.videoLoops, frameMs = LIVE.frameMs, onProgress } = {}) {
  const mimeType = nativeMp4Type();
  const canvas = document.createElement('canvas');
  const { width, height } = mp4Size(renderer.width, renderer.height);
  canvas.width = width;
  canvas.height = height;
  const src = document.createElement('canvas');
  src.width = renderer.width;
  src.height = renderer.height;
  const sctx = src.getContext('2d');
  const ctx = canvas.getContext('2d');
  const paint = (i) => {
    renderer.draw(sctx, i);
    ctx.drawImage(src, 0, 0, width, height);
  };
  paint(0);
  const stream = canvas.captureStream(MP4.fps);
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
    const t0 = performance.now();
    for (let i = 0; i <= total; i++) {
      paint(i);
      onProgress?.(i / total);
      await sleep(Math.max(0, t0 + frameMs * (i + 1) - performance.now()));
    }
    recorder.stop();
    await done;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    canvas.width = canvas.height = src.width = src.height = 0;
  }
  return new Blob(chunks, { type: 'video/mp4' });
}

/**
 * The Live Strip as an MP4 file. WebCodecs (H.264 + AAC) where available; otherwise
 * native MediaRecorder MP4; otherwise throws Mp4UnsupportedError (never a renamed WebM).
 */
export async function exportMp4(renderer, opts = {}) {
  const { width, height } = mp4Size(renderer.width, renderer.height);
  const support = await mp4Support(width, height);
  if (support.video) return encodeMp4(renderer, { ...opts, audio: support.audio });
  if (nativeMp4Type()) return recordNativeMp4(renderer, opts);
  throw new Mp4UnsupportedError();
}

export const extensionFor = (mime) => (/mp4/.test(mime) ? 'mp4' : /gif/.test(mime) ? 'gif' : 'webm');

/** Encode the animation as a looping GIF (gifenc, in small async chunks). */
export async function encodeGif(template, clips, opts, { onProgress } = {}) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const renderer = await createLiveRenderer(template, clips, { ...opts, scale: LIVE.gifScale });
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

/** e.g. photobooth-video-2026-10-04-153012.mp4 (local time; the time keeps same-day files apart). */
export function liveFileName(_templateName, ext = 'mp4', date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `photobooth-${ext === 'gif' ? 'live' : 'video'}-${day}-${time}.${ext}`;
}
