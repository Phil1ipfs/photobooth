// Saved photo strips ("My Photos"), persisted per user in IndexedDB.
import { STRIPS, dbDelete, dbGet, dbGetAllByIndex, dbPut } from './db';
import { newId } from './auth';

export async function listStrips(userId) {
  const rows = await dbGetAllByIndex(STRIPS, 'userId', userId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveStrip(userId, { blob, templateId, templateName, layoutId, width, height, favorite = false }) {
  const record = {
    id: newId(),
    userId,
    blob,
    templateId,
    templateName,
    layoutId,
    width,
    height,
    favorite,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STRIPS, record);
  return record;
}

export async function updateStrip(id, patch) {
  const current = await dbGet(STRIPS, id);
  if (!current) throw new Error('Photo strip not found.');
  const next = { ...current, ...patch };
  await dbPut(STRIPS, next);
  return next;
}

export const deleteStrip = (id) => dbDelete(STRIPS, id);

export async function deleteAllStrips(userId) {
  const rows = await dbGetAllByIndex(STRIPS, 'userId', userId);
  await Promise.all(rows.map((r) => dbDelete(STRIPS, r.id)));
}
