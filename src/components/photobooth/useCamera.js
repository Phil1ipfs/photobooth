import { useCallback, useEffect, useRef, useState } from 'react';

const MESSAGES = {
  denied: 'Camera access was blocked. Allow camera permission in your browser settings, then try again.',
  notfound: 'No camera was found on this device.',
  busy: 'Your camera is being used by another app. Close it and try again.',
  insecure: 'The camera needs a secure connection (HTTPS or localhost).',
  unsupported: 'This browser doesn’t support camera access.',
  generic: 'We couldn’t start your camera. Please try again.',
};

/**
 * Webcam stream management (getUserMedia).
 * status: 'loading' | 'ready' | 'denied' | 'error' | 'unsupported'
 */
export default function useCamera(deviceId) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError(window.isSecureContext === false ? MESSAGES.insecure : MESSAGES.unsupported);
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    setError('');

    const base = { width: { ideal: 1280 }, height: { ideal: 960 } };
    const request = (video) => navigator.mediaDevices.getUserMedia({ video, audio: false });

    request(deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: 'user' })
      .catch((err) => {
        // Saved camera unplugged or constraints unsupported → fall back to any camera.
        if (['OverconstrainedError', 'NotFoundError'].includes(err?.name)) return request(true);
        throw err;
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setActiveDeviceId(stream.getVideoTracks()[0]?.getSettings?.().deviceId || '');
        setStatus('ready');
        const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) {
          setDevices(
            all
              .filter((d) => d.kind === 'videoinput')
              .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }))
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const name = err?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied');
          setError(MESSAGES.denied);
        } else {
          setStatus('error');
          setError(name === 'NotFoundError' ? MESSAGES.notfound : name === 'NotReadableError' ? MESSAGES.busy : MESSAGES.generic);
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [deviceId, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  /** Grab a frame cropped to `aspect`; returns a JPEG data URL (or null if not ready). */
  const capture = useCallback(({ aspect = 4 / 3, mirror = true, maxWidth = 1280 } = {}) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    let sw = vw;
    let sh = vw / aspect;
    if (sh > vh) {
      sh = vh;
      sw = vh * aspect;
    }
    const outW = Math.min(maxWidth, Math.round(sw));
    const outH = Math.round(outW / aspect);
    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext('2d');
    if (mirror) {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, outW, outH);
    return c.toDataURL('image/jpeg', 0.92);
  }, []);

  return { videoRef, status, error, devices, activeDeviceId, retry, capture };
}
