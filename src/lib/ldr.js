// LDR (long-distance) photobooth: two signed-in people in a private room.
// The database is the authority (supabase/migrations/009_ldr_rooms.sql): rooms are
// created/joined only through RPCs, and the Realtime channel + shot uploads are
// limited to the room's two members by RLS.
import { supabase } from './supabase';
import { getLayout } from '../templates/data';

export const LDR_BUCKET = 'ldr';
export const topicFor = (roomId) => `ldr:${roomId}`;
export const inviteLink = (code) => `${window.location.origin}/ldr?room=${encodeURIComponent(code)}`;

const ERRORS = {
  room_not_found: 'We couldn’t find that room. Check the code and try again.',
  room_expired: 'This room has expired. Ask your partner to create a new one.',
  room_full: 'This room already has two people in it.',
  too_many_rooms: 'You have too many open rooms. Use one of them, or wait for them to expire.',
  not_authenticated: 'Please log in again.',
};
const friendly = (error, fallback) => {
  const key = Object.keys(ERRORS).find((k) => error?.message?.includes(k));
  return new Error(key ? ERRORS[key] : fallback);
};

export async function createRoom() {
  const { data, error } = await supabase.rpc('create_ldr_room');
  if (error) throw friendly(error, 'Couldn’t create a room. Please try again.');
  return data;
}

export async function joinRoom(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) throw new Error('Room codes are 6 letters or numbers.');
  const { data, error } = await supabase.rpc('join_ldr_room', { p_code: clean });
  if (error) throw friendly(error, 'Couldn’t join the room. Please try again.');
  return data;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Couldn’t read the photo.'));
    r.readAsDataURL(blob);
  });

async function retry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw err;
}

/** Upload one of my shots; returns its storage path (<room>/<me>/<session>-<round>.jpg). */
export async function uploadShot({ roomId, userId, sessionId, round, dataUrl }) {
  const path = `${roomId}/${userId}/${sessionId}-${round}.jpg`;
  const blob = await dataUrlToBlob(dataUrl);
  await retry(async () => {
    const { error } = await supabase.storage.from(LDR_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
  });
  return path;
}

/** Download the partner's shot as a data URL. Only paths inside the partner's folder are accepted. */
export async function downloadShot({ roomId, partnerId, path }) {
  if (typeof path !== 'string' || !path.startsWith(`${roomId}/${partnerId}/`) || !/^[\w-]+\/[\w-]+\/[\w-]+\.jpg$/.test(path)) {
    throw new Error('Unexpected photo from your partner.');
  }
  const blob = await retry(async () => {
    const { data, error } = await supabase.storage.from(LDR_BUCKET).download(path);
    if (error) throw new Error(error.message);
    return data;
  });
  return blobToDataUrl(blob);
}

/** Delete everything I uploaded to this room (best effort — called when leaving). */
export async function removeMyShots(roomId, userId) {
  const folder = `${roomId}/${userId}`;
  const { data } = await supabase.storage.from(LDR_BUCKET).list(folder, { limit: 100 });
  if (data?.length) await supabase.storage.from(LDR_BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
}

// ----- Arrangements: which person's photo goes in each slot -----
// 'A' = the room's host, 'B' = the guest; the number is the capture round.
const pairs = (n) => Array.from({ length: n }, (_, i) => [i % 2 ? 'B' : 'A', Math.floor(i / 2)]);

export const LDR_ARRANGEMENTS = [
  { id: 'alternate', name: 'Alternating', hint: 'You, them, you, them', layoutId: 'strip-1x4', slots: pairs(4) },
  { id: 'duo', name: 'Duo', hint: 'One photo each', layoutId: 'strip-1x2', slots: pairs(2) },
  { id: 'side', name: 'Side by side', hint: 'Three pairs, side by side', layoutId: 'grid-2x3', slots: pairs(6) },
  { id: 'grid', name: 'Couple grid', hint: 'Checkerboard 2 × 2', layoutId: 'grid-2x2', slots: [['A', 0], ['B', 0], ['B', 1], ['A', 1]] },
  { id: 'scrapbook', name: 'Romantic scrapbook', hint: 'Taped polaroids, hearts & stamps', layoutId: 'strip-1x4', slots: pairs(4), templateId: 'miles-apart' },
];
export const getArrangement = (id) => LDR_ARRANGEMENTS.find((a) => a.id === id) || LDR_ARRANGEMENTS[0];

/**
 * The layout and slot plan for an arrangement with a template. Templates designed
 * for their own layout (e.g. a 1 × 2 Halloween strip) keep it, alternating A/B.
 */
export function planFor(arrangement, template) {
  if (template?.layoutId && template.layoutId !== arrangement.layoutId) {
    const layout = getLayout(template.layoutId);
    return { layout, slots: pairs(layout.photoCount), rounds: Math.ceil(layout.photoCount / 2) };
  }
  const layout = getLayout(arrangement.layoutId);
  return { layout, slots: arrangement.slots, rounds: Math.max(...arrangement.slots.map(([, r]) => r)) + 1 };
}

/** Photos for the strip, by slot: shots = { A: [round0, round1…], B: […] }. */
export const arrange = (slots, shots) => slots.map(([who, round]) => shots[who]?.[round] || null);
