/**
 * Unified Share Storage combining Cache Storage and IndexedDB
 * for maximum reliability across browsers, WebAPKs, and Service Workers.
 */

import { saveFileToShareCache, getFilesFromShareCache } from './share-cache';
import { saveSharedFile, getSharedFiles, clearSharedFiles } from './share-target-db';

export interface UnifiedFilePayload {
  name: string;
  type: string;
  data: Blob | ArrayBuffer;
}

/**
 * Save incoming shared files into both Cache Storage and IndexedDB.
 */
export async function persistSharedFiles(files: UnifiedFilePayload[]): Promise<number> {
  let savedCount = 0;

  for (const f of files) {
    try {
      // 1. Save to Cache Storage (Google web.dev recommended pattern for Service Workers)
      await saveFileToShareCache(f.data, f.name, f.type);
      savedCount++;
    } catch (cacheErr) {
      console.warn('[ShareStorage] Failed to save to Cache Storage:', cacheErr);
    }

    try {
      // 2. Also save to IndexedDB as backup
      await saveSharedFile(f.data, f.name, f.type);
    } catch (idbErr) {
      console.warn('[ShareStorage] Failed to save to IndexedDB:', idbErr);
    }
  }

  return savedCount;
}

/**
 * Retrieve all pending shared files from both Cache Storage and IndexedDB.
 */
export async function retrieveAllSharedFiles(): Promise<File[]> {
  const resultFiles: File[] = [];
  const seenNames = new Set<string>();

  // 1. Try Cache Storage first
  try {
    const cachedFiles = await getFilesFromShareCache();
    for (const f of cachedFiles) {
      resultFiles.push(f);
      seenNames.add(`${f.name}-${f.size}`);
    }
  } catch (err) {
    console.warn('[ShareStorage] Error checking Cache Storage:', err);
  }

  // 2. Also check IndexedDB for any files not in cache
  try {
    const idbRecords = await getSharedFiles();
    if (idbRecords && idbRecords.length > 0) {
      await clearSharedFiles();
      for (const rec of idbRecords) {
        const blob = rec.data instanceof Blob ? rec.data : new Blob([rec.data], { type: rec.type });
        const sig = `${rec.name}-${blob.size}`;
        if (!seenNames.has(sig)) {
          seenNames.add(sig);
          resultFiles.push(new File([blob], rec.name, { type: rec.type, lastModified: rec.timestamp }));
        }
      }
    }
  } catch (err) {
    console.warn('[ShareStorage] Error checking IndexedDB:', err);
  }

  return resultFiles;
}

/**
 * Check if there are any shared files pending in Cache Storage or IndexedDB
 * without consuming them.
 */
export async function hasPendingSharedFiles(): Promise<boolean> {
  try {
    const cacheObj = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' ? window.caches : undefined);
    if (cacheObj) {
      const cache = await cacheObj.open('money-purse-shared-docs');
      const keys = await cache.keys();
      if (keys.length > 0) return true;
    }
  } catch (err) {}

  try {
    const idbRecords = await getSharedFiles();
    if (idbRecords && idbRecords.length > 0) return true;
  } catch (err) {}

  return false;
}

