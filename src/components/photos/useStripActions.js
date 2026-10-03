import { useCallback } from 'react';
import { useStrips } from '../../context/StripsContext';
import { useToast } from '../../context/ToastContext';
import { downloadBlob, printBlob, shareBlob, stripFileName } from '../../lib/share';

/** Actions on saved strips (My Photos, Dashboard, Favorites). */
export default function useStripActions() {
  const { toggleFavorite, remove } = useStrips();
  const toast = useToast();

  const download = useCallback(
    (s) => {
      downloadBlob(s.blob, stripFileName(s.templateName, new Date(s.createdAt)));
      toast.success('Downloaded!', 'Your photo strip was saved to your device.');
    },
    [toast]
  );

  const share = useCallback(
    async (s) => {
      const res = await shareBlob(s.blob, stripFileName(s.templateName, new Date(s.createdAt)));
      if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
    },
    [toast]
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

  const print = useCallback((s) => printBlob(s.blob), []);

  return { download, share, favorite, del, print };
}
