import type { HistoryItem } from '../types';

const DB_NAME = 'ZenithAI_History';
const DB_VERSION = 1;
const STORE_NAME = 'meditationSessions';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // In some browsers, `indexedDB` may not be available.
    if (!window.indexedDB) {
        return reject('IndexedDB not supported');
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addHistoryItem = async (item: HistoryItem): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllHistoryItems = async (): Promise<HistoryItem[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise<HistoryItem[]>((resolve, reject) => {
    request.onsuccess = () => {
        // Sort descending by ID (timestamp) to get newest first
        const sorted = request.result.sort((a, b) => b.id - a.id);
        resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteHistoryItem = async (id: number): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const trimHistory = async (maxItems: number): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor(null, 'prev'); // Open cursor to iterate from newest to oldest
    let count = 0;
    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
            count++;
            if (count > maxItems) {
                cursor.delete();
            }
            cursor.continue();
        }
    };
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
