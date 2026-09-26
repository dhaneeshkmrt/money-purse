import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const candidateFiles: File[] = [];

    const candidates = [
      ...formData.getAll('files'),
      ...formData.getAll('file'),
      ...formData.getAll('image'),
      ...formData.getAll('receipt'),
    ];

    for (const [key, value] of formData.entries()) {
      if (!candidates.includes(value)) {
        candidates.push(value);
      }
    }

    for (const item of candidates) {
      if (item && typeof item === 'object' && typeof (item as any).arrayBuffer === 'function') {
        candidateFiles.push(item as File);
      }
    }

    if (candidateFiles.length === 0) {
      return NextResponse.redirect(
        new URL(`/transactions/group?share_warn=server_no_files&ts=${Date.now()}`, request.url),
        303
      );
    }

    // Convert candidate files to base64 payloads to inject into client-side cache & IndexedDB
    const filePayloads = await Promise.all(
      candidateFiles.map(async (file, idx) => {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return {
          name: file.name || `shared-bill-${Date.now()}-${idx + 1}`,
          type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          base64,
        };
      })
    );

    const safePayloadJson = JSON.stringify(filePayloads).replace(/</g, '\\u003c');
    const redirectTarget = `/transactions/group?shared=${candidateFiles.length}&ts=${Date.now()}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Receiving Shared File - Money Purse</title>
  <style>
    body {
      background-color: #0a0e14;
      color: #c5a059;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(197, 160, 89, 0.2);
      border-top-color: #c5a059;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 0.5rem; color: #fff; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Receiving shared document...</h2>
  <p>Loading file into Money Purse bill scanner...</p>
  <script>
    (async () => {
      const files = ${safePayloadJson};
      const CACHE_NAME = 'money-purse-shared-docs';
      const DB_NAME = 'money-purse-share-target';
      const STORE_NAME = 'shared-files';

      try {
        // 1. Save to Cache Storage
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(CACHE_NAME);
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const byteCharacters = atob(f.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: f.type });
            const response = new Response(blob, {
              headers: {
                'Content-Type': f.type,
                'X-File-Name': encodeURIComponent(f.name),
                'X-File-Type': f.type,
                'X-File-Time': Date.now().toString(),
              }
            });
            await cache.put('/share-target-doc/' + Date.now() + '-' + i, response);
          }
        }
      } catch (cacheErr) {
        console.warn('Cache API save error in fallback HTML:', cacheErr);
      }

      try {
        // 2. Also save to IndexedDB as secondary backup
        const idb = window.indexedDB;
        if (idb) {
          const db = await new Promise((res, rej) => {
            const req = idb.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
              if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
              }
            };
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });

          for (const f of files) {
            const byteCharacters = atob(f.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: f.type });
            await new Promise((res, rej) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              tx.objectStore(STORE_NAME).put({
                id: 'share-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                name: f.name,
                type: f.type,
                data: blob,
                timestamp: Date.now()
              });
              tx.oncomplete = () => res();
              tx.onerror = () => rej(tx.error);
            });
          }
        }
      } catch (idbErr) {
        console.warn('IndexedDB save error in fallback HTML:', idbErr);
      }

      window.location.replace('${redirectTarget}');
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error processing share-target POST:', error);
    const safeErr = encodeURIComponent(error?.message || 'server_post_error');
    return NextResponse.redirect(
      new URL(`/transactions/group?share_err=${safeErr}&ts=${Date.now()}`, request.url),
      303
    );
  }
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/transactions/group', request.url), 303);
}
