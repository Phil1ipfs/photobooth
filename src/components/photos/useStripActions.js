import { useCallback } from 'react';
import { useStrips } from '../../context/StripsContext';
import { useToast } from '../../context/ToastContext';
import { downloadBlob, printBlob, shareBlob, stripFileName } from '../../lib/share';
import { track } from '../../lib/analytics';
import { extensionFor, liveFileName } from '../../lib/liveStrip';

/** Download name: PNG for photo strips, .webm/.mp4 for Live Strips. */
const fileNameFor = (s, blob) =>
  s.mediaType === 'live_strip'
    ? liveFileName(s.templateName, extensionFor(blob.type || s.mimeType || ''), new Date(s.createdAt))
    : stripFileName(s.templateName, new Date(s.createdAt));

/** Actions on saved strips (My Photos, Dashboard, Favorites). */
export default function useStripActions() {
  const { toggleFavorite, remove, getBlob } = useStrips();
  const toast = useToast();

  const withBlob = useCallback(
    async (s, fn) => {
      try {
        await fn(await getBlob(s));
      } catch (err) {
        toast.error('Something went wrong', err.message);
      }
    },
    [getBlob, toast]
  );

  const download = useCallback(
    (s) =>
      withBlob(s, (blob) => {
        downloadBlob(blob, fileNameFor(s, blob));
        track('photostrip_downloaded', { template: s.templateId, layout: s.layoutId || 'strip-1x4', source: 'my_photos' });
        toast.success('Downloaded!', 'Your photo strip was saved to your device.');
      }),
    [withBlob, toast]
  );

  const share = useCallback(
    (s) =>
      withBlob(s, async (blob) => {
        const res = await shareBlob(blob, fileNameFor(s, blob));
        if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
      }),
    [withBlob, toast]
  );

  const favorite = useCallback(
    async (s) => {
      try {
        await toggleFavorite(s.id);
      } catch (err) {
        toast.error('Couldn’t update favorite', err.message);
      }
    },
    [toggleFavorite, toast]
  );

  const del = useCallback(
    async (s) => {
      try {
        await remove(s.id);
        toast.success('Photo strip deleted');
      } catch (err) {
        toast.error('Couldn’t delete', err.message);
      }
    },
    [remove, toast]
  );

  const print = useCallback((s) => withBlob(s, (blob) => printBlob(blob)), [withBlob]);

  return { download, share, favorite, del, print };
}
