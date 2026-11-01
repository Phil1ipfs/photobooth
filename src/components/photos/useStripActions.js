import { useCallback } from 'react';
import { useStrips } from '../../context/StripsContext';
import { useToast } from '../../context/ToastContext';
import { downloadBlob, printBlob, shareBlob, stripFileName } from '../../lib/share';
import { track } from '../../lib/analytics';
import { extensionFor, liveFileName } from '../../lib/liveStrip';
import { useEntitlements } from '../../context/EntitlementsContext';
import { FEATURES } from '../../config/catalog';

/** Download name: PNG for photo strips, .webm/.mp4 for Live Strips. */
const fileNameFor = (s, blob) =>
  s.mediaType === 'live_strip'
    ? liveFileName(s.templateName, extensionFor(blob.type || s.mimeType || ''), new Date(s.createdAt))
    : stripFileName(s.templateName, new Date(s.createdAt));

/** Actions on saved strips (My Photos, Dashboard, Favorites). */
export default function useStripActions() {
  const { toggleFavorite, remove, getBlob } = useStrips();
  const toast = useToast();
  const { canUseFeature, openUpgrade } = useEntitlements();
  const allow = useCallback((feature) => {
    if (canUseFeature(feature)) return true;
    openUpgrade({ feature, title: `Unlock ${FEATURES[feature].label}`, description: 'Free accounts can download their photos. Upgrade to use this feature.' });
    return false;
  }, [canUseFeature, openUpgrade]);

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
    (s) => allow('share_print') &&
      withBlob(s, async (blob) => {
        const res = await shareBlob(blob, fileNameFor(s, blob));
        if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
      }),
    [withBlob, toast, allow]
  );

  const favorite = useCallback(
    async (s) => {
      if (!allow('favorites')) return;
      try {
        await toggleFavorite(s.id);
      } catch (err) {
        toast.error('Couldn’t update favorite', err.message);
      }
    },
    [toggleFavorite, toast, allow]
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

  const print = useCallback((s) => allow('share_print') && withBlob(s, (blob) => printBlob(blob)), [withBlob, allow]);

  return { download, share, favorite, del, print, locked: { share: !canUseFeature('share_print'), print: !canUseFeature('share_print'), favorite: !canUseFeature('favorites') } };
}
