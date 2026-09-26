import { saveSharedFile } from '@/lib/share-target-db';

declare const self: any;

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.replace(/\/$/, '') === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files: { name: string; type: string; buffer: ArrayBuffer }[] = [];

          // Collect files from all formData entries to avoid field name mismatch
          for (const [key, value] of formData.entries()) {
            if (value && typeof value === 'object' && typeof (value as any).arrayBuffer === 'function') {
              const fileObj = value as File;
              const name = fileObj.name || `shared-bill-${Date.now()}`;
              const type = fileObj.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
              const buffer = await fileObj.arrayBuffer();
              files.push({ name, type, buffer });
            }
          }

          if (files.length > 0) {
            for (const f of files) {
              await saveSharedFile(f.buffer, f.name, f.type);
            }

            // Notify any already-open clients (app windows) immediately
            try {
              const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
              for (const client of clientList) {
                client.postMessage({ type: 'SHARED_FILES_RECEIVED', count: files.length, timestamp: Date.now() });
              }
            } catch (notifyErr) {
              console.warn('[ServiceWorker] Could not postMessage to clients:', notifyErr);
            }
          }
        } catch (err) {
          console.error('[ServiceWorker] Error processing shared files:', err);
        }

        // CRITICAL: Response.redirect requires an ABSOLUTE URL!
        // We include a timestamp so that query changes trigger any active listeners
        const redirectUrl = new URL(`/transactions/group?shared=${Date.now()}`, event.request.url).href;
        return Response.redirect(redirectUrl, 303);
      })()
    );
  }
});
