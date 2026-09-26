import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: { name: string; type: string; base64: string }[] = [];

    // Collect files from all formData entries
    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && typeof (value as any).arrayBuffer === 'function') {
        const file = value as File;
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const name = file.name || `shared-bill-${Date.now()}`;
        const type = file.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        files.push({ name, type, base64 });
      }
    }

    if (files.length === 0) {
      return NextResponse.redirect(new URL('/transactions/group', request.url), 303);
    }

    const safePayloadJson = JSON.stringify(files).replace(/</g, '\\u003c');
    const redirectTarget = `/transactions/group?shared=${Date.now()}`;

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
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 0.5rem; color: #fff; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Receiving shared file...</h2>
  <p>Loading document into Money Purse bill scanner...</p>
  <script>
    (async () => {
      const files = ${safePayloadJson};
      const DB_NAME = 'money-purse-share-target';
      const STORE_NAME = 'shared-files';

      function openDB() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }

      try {
        const db = await openDB();
        for (const f of files) {
          const byteCharacters = atob(f.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: f.type });

          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({
              id: 'share-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
              name: f.name,
              type: f.type,
              data: blob,
              timestamp: Date.now()
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error('Tx aborted'));
          });
        }
      } catch (err) {
        console.error('Error saving shared files to IndexedDB:', err);
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
  } catch (error) {
    console.error('Error processing share-target POST:', error);
    return NextResponse.redirect(new URL('/transactions/group', request.url), 303);
  }
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/transactions/group', request.url), 303);
}
