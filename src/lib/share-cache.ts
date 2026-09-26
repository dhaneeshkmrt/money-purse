/**
 * Cache Storage utility for receiving and retrieving files
 * shared with Money Purse via the PWA Web Share Target API.
 * Uses the Cache Storage API recommended by Google web.dev for Service Workers.
 */

const CACHE_NAME = 'money-purse-shared-docs';

export async function saveFileToShareCache(
  data: Blob | ArrayBuffer | Uint8Array,
  name: string,
  type: string
): Promise<void> {
  const cacheObj = typeof caches !== 'undefined' ? caches : (typeof self !== 'undefined' ? (self as any).caches : undefined);
  if (!cacheObj) {
    throw new Error('Cache API not supported in this environment');
  }

  const cache = await cacheObj.open(CACHE_NAME);
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const id = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const requestUrl = `/share-target-doc/${id}`;

  const response = new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(name || 'shared-document'),
      'X-File-Type': type || 'application/octet-stream',
      'X-File-Time': Date.now().toString(),
    },
  });

  await cache.put(requestUrl, response);
}

export async function getFilesFromShareCache(): Promise<File[]> {
  const cacheObj = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' ? window.caches : undefined);
  if (!cacheObj) return [];

  try {
    const cache = await cacheObj.open(CACHE_NAME);
    const requests = await cache.keys();
    const files: File[] = [];

    for (const req of requests) {
      try {
        const res = await cache.match(req);
        if (!res) continue;

        const blob = await res.blob();
        const rawName = res.headers.get('X-File-Name');
        const fileName = rawName ? decodeURIComponent(rawName) : 'shared-document';
        const fileType = res.headers.get('X-File-Type') || blob.type || 'application/octet-stream';
        const timestamp = parseInt(res.headers.get('X-File-Time') || Date.now().toString(), 10);

        const file = new File([blob], fileName, {
          type: fileType,
          lastModified: timestamp,
        });

        files.push(file);
        // Clear consumed file from cache
        await cache.delete(req);
      } catch (err) {
        console.warn('[ShareCache] Error reading cached shared item:', err);
      }
    }

    return files;
  } catch (err) {
    console.warn('[ShareCache] Could not open share cache:', err);
    return [];
  }
}

export async function clearShareCache(): Promise<void> {
  const cacheObj = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' ? window.caches : undefined);
  if (!cacheObj) return;

  try {
    await cacheObj.delete(CACHE_NAME);
  } catch (err) {
    console.warn('[ShareCache] Could not delete share cache:', err);
  }
}
