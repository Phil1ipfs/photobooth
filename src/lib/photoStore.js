// Saved photo strips ("My Photos") in Supabase: the file goes to the private
// "strips" storage bucket, metadata to the public.strips table (RLS: owner only).
// media_type 'photo' = PNG strip; 'live_strip' = WebM/MP4 animation + JPEG poster.
import { STRIPS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

const SIGNED_URL_TTL = 60 * 60 * 24; // 24 h — refreshed whenever the list reloads

const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function sb() {
  if (!isSupabaseConfigured) throw new Error('Saving isn’t available — the app isn’t connected to its database.');
  return supabase;
}

const fromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  storagePath: r.storage_path,
  templateId: r.template_id,
  templateName: r.template_name,
  layoutId: r.layout_id,
  width: r.width,
  height: r.height,
  favorite: r.favorite,
  createdAt: r.created_at,
  mediaType: r.media_type || 'photo',
  posterPath: r.poster_path || null,
  mimeType: r.mime_type || null,
});

const isLive = (r) => r.mediaType === 'live_strip';
// Live Strip files: video, or an animated GIF where the browser can't record video.
const VIDEO_EXT = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'image/gif': 'gif' };

const raise = (error, fallback) => {
  if (error) throw new Error(error.message || fallback);
};

export async function listStrips() {
  const client = sb();
  const { data, error } = await client.from('strips').select('*').order('created_at', { ascending: false });
  raise(error, 'Could not load your photos.');
  const rows = (data || []).map(fromRow);
  if (!rows.length) return rows;
  const { data: signed, error: signErr } = await client.storage
    .from(STRIPS_BUCKET)
    .createSignedUrls(rows.flatMap((r) => (r.posterPath ? [r.storagePath, r.posterPath] : [r.storagePath])), SIGNED_URL_TTL);
  raise(signErr, 'Could not load your photos.');
  const urls = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  // `url` is always an image (the strip, or a Live Strip's poster); `videoUrl` plays the animation.
  return rows.map((r) =>
    isLive(r)
      ? { ...r, url: urls.get(r.posterPath) || null, videoUrl: urls.get(r.storagePath) || null }
      : { ...r, url: urls.get(r.storagePath) || null }
  );
}

export async function saveStrip(
  userId,
  { blob, templateId, templateName, layoutId, width, height, favorite = false, creationId, mediaType = 'photo', poster }
) {
  const client = sb();
  const id = newId();
  const live = mediaType === 'live_strip';
  const mime = live ? (blob.type || 'video/webm').split(';')[0] : blob.type || 'image/png';
  const storagePath = live ? `${userId}/${id}.${VIDEO_EXT[mime] || 'webm'}` : `${userId}/${id}.png`;
  const posterPath = live ? `${userId}/${id}-poster.jpg` : null;
  const bucket = client.storage.from(STRIPS_BUCKET);
  const { error: upErr } = await bucket.upload(storagePath, blob, { contentType: mime, upsert: false });
  raise(upErr, 'Could not upload your photo strip.');
  if (live) {
    const { error: posterErr } = await bucket.upload(posterPath, poster, { contentType: 'image/jpeg', upsert: false });
    if (posterErr) {
      await bucket.remove([storagePath]);
      raise(posterErr, 'Could not upload your Live Strip.');
    }
  }

  const { data, error } = await client
    .from('strips')
    .insert({
      id,
      user_id: userId,
      storage_path: storagePath,
      template_id: templateId,
      template_name: templateName,
      layout_id: layoutId,
      width,
      height,
      favorite,
      creation_id: creationId, // must be a finalized photostrip creation (database trigger)
      media_type: mediaType,
      poster_path: posterPath,
      mime_type: mime,
    })
    .select()
    .single();
  if (error) {
    await bucket.remove(posterPath ? [storagePath, posterPath] : [storagePath]); // don't leave orphan files
    raise(error, 'Could not save your photo strip.');
  }
  return fromRow(data);
}

export async function updateStrip(id, patch) {
  const row = {};
  if (patch.favorite !== undefined) row.favorite = patch.favorite;
  const { data, error } = await sb().from('strips').update(row).eq('id', id).select().single();
  raise(error, 'Could not update this photo strip.');
  return fromRow(data);
}

export async function deleteStrip(strip) {
  const client = sb();
  // File first: if this fails nothing has changed, so we never orphan a photo in
  // storage. Removing an already-missing file succeeds, so a retry after a failed
  // row delete still completes cleanly.
  const files = strip.posterPath ? [strip.storagePath, strip.posterPath] : [strip.storagePath];
  const { error: fileErr } = await client.storage.from(STRIPS_BUCKET).remove(files);
  raise(fileErr, 'Could not delete this photo strip.');
  const { error } = await client.from('strips').delete().eq('id', strip.id);
  raise(error, 'Could not delete this photo strip.');
}

/** The file for download / share / print (PNG, or a Live Strip's video). */
export async function getStripBlob(strip) {
  if (strip.blob) return strip.blob;
  const { data, error } = await sb().storage.from(STRIPS_BUCKET).download(strip.storagePath);
  raise(error, 'Could not download this photo strip.');
  return data;
}
