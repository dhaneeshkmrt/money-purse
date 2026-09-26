/**
 * IndexedDB storage utility for receiving and retrieving files
 * shared with Money Purse via the PWA Web Share Target API.
 */

export interface SharedFileRecord {
  id: string;
  name: string;
  type: string;
  data: ArrayBuffer | Blob;
  timestamp: number;
}

const DB_NAME = 'money-purse-share-target';
const DB_VERSION = 1;
const STORE_NAME = 'shared-files';

function getIndexedDB(): IDBFactory | undefined {
  if (typeof indexedDB !== 'undefined') {
    return indexedDB;
  }
  if (typeof self !== 'undefined' && self.indexedDB) {
    return self.indexedDB;
  }
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return undefined;
}

export function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSharedFile(fileData: ArrayBuffer | Blob, name: string, type: string): Promise<string> {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const id = `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: SharedFileRecord = {
      id,
      name: name || 'shared-document',
      type: type || (fileData as any).type || 'application/octet-stream',
      data: fileData,
      timestamp: Date.now(),
    };

    store.put(record);

    // Crucial: Wait for transaction to complete (committed to disk)
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('IndexedDB transaction was aborted'));
  });
}

export async function getSharedFiles(): Promise<SharedFileRecord[]> {
  try {
    const db = await openShareDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ShareTargetDB] Could not retrieve shared files:', err);
    return [];
  }
}

export async function clearSharedFiles(): Promise<void> {
  try {
    const db = await openShareDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IndexedDB clear aborted'));
    });
  } catch (err) {
    console.warn('[ShareTargetDB] Could not clear shared files:', err);
  }
}

export async function deleteSharedFile(id: string): Promise<void> {
  try {
    const db = await openShareDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IndexedDB delete aborted'));
    });
  } catch (err) {
    console.warn('[ShareTargetDB] Could not delete shared file:', err);
  }
}
