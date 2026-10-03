// Tiny IndexedDB wrapper used to persist photo strips on this device.
const DB_NAME = 'photobooth';
const DB_VERSION = 1;
export const STRIPS = 'strips';

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support offline storage.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STRIPS)) {
          const store = db.createObjectStore(STRIPS, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      dbPromise = undefined;
      throw err;
    });
  }
  return dbPromise;
}

const promisify = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const result = await fn(tx.objectStore(storeName));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
  return result;
}

export const dbGetAllByIndex = (storeName, index, value) =>
  withStore(storeName, 'readonly', (s) => promisify(s.index(index).getAll(value)));

export const dbGet = (storeName, key) => withStore(storeName, 'readonly', (s) => promisify(s.get(key)));

export const dbPut = (storeName, value) => withStore(storeName, 'readwrite', (s) => promisify(s.put(value)));

export const dbDelete = (storeName, key) => withStore(storeName, 'readwrite', (s) => promisify(s.delete(key)));
