// Download / share / print helpers for rendered photo strips.
import { fileSafe } from './format';

export const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image.'))), type, quality)
  );

export const stripFileName = (templateName = 'strip', date = new Date()) =>
  `photobooth-${fileSafe(templateName)}-${date.getTime()}.png`;

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Returns 'shared' | 'downloaded' | 'cancelled'. Falls back to download when Web Share with files isn't available. */
export async function shareBlob(blob, filename, text = 'Made with PhotoBooth — Making Memories ♡') {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My photo strip', text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function printBlob(blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><title>Photo strip</title><style>
    @page { margin: 12mm; }
    html,body { margin:0; height:100%; }
    body { display:flex; align-items:flex-start; justify-content:center; }
    img { max-height: 100%; max-width: 100%; }
  </style></head><body><img src="${url}" alt="Photo strip"></body></html>`);
  doc.close();
  const img = doc.querySelector('img');
  const go = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  };
  if (img.complete) go();
  else img.onload = go;
}

/** Downscale an uploaded image file to a square avatar data URL. */
export function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}
