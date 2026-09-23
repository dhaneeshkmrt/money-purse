import { saveSharedFile } from '@/lib/share-target-db';

declare const self: any;

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('files');

          if (files && files.length > 0) {
            for (const file of files) {
              if (file && typeof file === 'object') {
                const name = file.name || 'shared-document';
                const type = file.type || 'application/octet-stream';
                await saveSharedFile(file, name, type);
              }
            }
          }
        } catch (err) {
          console.error('[ServiceWorker] Error processing shared files:', err);
        }

        // Redirect with HTTP 303 (See Other) to the bill scanning page
        return Response.redirect('/transactions/group?shared=1', 303);
      })()
    );
  }
});
