import { persistSharedFiles, UnifiedFilePayload } from '@/lib/share-storage';

declare const self: any;

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.replace(/\/$/, '') === '/share-target') {
    event.respondWith(
      (async () => {
        // Clone request BEFORE reading formData, so if SW fails or has 0 files,
        // we can still forward the original multipart request to the server!
        let reqForFallback: Request | null = null;
        try {
          reqForFallback = event.request.clone();
        } catch (cloneErr) {
          console.warn('[ServiceWorker] Could not clone share-target request:', cloneErr);
        }

        try {
          const formData = await event.request.formData();
          const filesToSave: UnifiedFilePayload[] = [];
          const allEntries = Array.from(formData.entries()) as [string, any][];

          for (let idx = 0; idx < allEntries.length; idx++) {
            const [key, value] = allEntries[idx];
            if (value && typeof value === 'object' && (value instanceof Blob || typeof (value as any).arrayBuffer === 'function')) {
              const fileObj = value as File;
              // Check if file has data (not empty 0-byte stream)
              if (typeof fileObj.size === 'number' ? fileObj.size > 0 : true) {
                const name = fileObj.name || `shared-bill-${Date.now()}-${idx + 1}`;
                const type = fileObj.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

                if (typeof (fileObj as any).arrayBuffer === 'function') {
                  const buffer = await fileObj.arrayBuffer();
                  filesToSave.push({ name, type, data: buffer });
                } else if (fileObj instanceof Blob) {
                  filesToSave.push({ name, type, data: fileObj });
                }
              }
            } else if (typeof value === 'string') {
              // Check if value is a data URI
              if (value.startsWith('data:image/') || value.startsWith('data:application/pdf')) {
                const mime = value.substring(5, value.indexOf(';'));
                const base64Data = value.substring(value.indexOf(',') + 1);
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const name = `shared-bill-${Date.now()}-${idx + 1}.${mime.includes('pdf') ? 'pdf' : 'jpg'}`;
                filesToSave.push({ name, type: mime, data: byteNumbers.buffer });
              }
            }
          }

          if (filesToSave.length > 0) {
            await persistSharedFiles(filesToSave);

            // Notify open windows immediately
            try {
              const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
              for (const client of clientList) {
                client.postMessage({
                  type: 'SHARED_FILES_RECEIVED',
                  count: filesToSave.length,
                  timestamp: Date.now(),
                });
              }
            } catch (notifyErr) {
              console.warn('[ServiceWorker] Could not postMessage to clients:', notifyErr);
            }

            const redirectTarget = `/transactions/group?shared=${filesToSave.length}&ts=${Date.now()}`;
            return Response.redirect(new URL(redirectTarget, event.request.url).href, 303);
          }

          // If SW extracted 0 files (e.g. Android WebAPK permission boundary issue),
          // forward the request to the Next.js server route handler!
          console.warn('[ServiceWorker] 0 files extracted in Service Worker. Forwarding to server route...');
          if (reqForFallback) {
            try {
              return await fetch(reqForFallback);
            } catch (fetchErr) {
              console.warn('[ServiceWorker] Fallback server fetch failed:', fetchErr);
            }
          }

          // If fallback also failed or is offline:
          const debugSummary = allEntries
            .map(([k, v]: [string, any]) => `${k}:${typeof v === 'object' ? (v instanceof Blob ? `blob(${v.size},${v.type})` : 'obj') : typeof v}`)
            .join(';');
          const fallbackUrl = `/transactions/group?share_warn=no_files_found&source=sw&debug=${encodeURIComponent(debugSummary || 'empty_form')}&ts=${Date.now()}`;
          return Response.redirect(new URL(fallbackUrl, event.request.url).href, 303);
        } catch (err: any) {
          console.error('[ServiceWorker] Error processing shared files:', err);
          if (reqForFallback) {
            try {
              return await fetch(reqForFallback);
            } catch (fallbackErr) {
              // ignore
            }
          }
          const safeMsg = encodeURIComponent(err?.message || 'sw_parse_error');
          const errUrl = `/transactions/group?share_err=${safeMsg}&source=sw&ts=${Date.now()}`;
          return Response.redirect(new URL(errUrl, event.request.url).href, 303);
        }
      })()
    );
  }
});

// Handle mobile push notification click
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/reminders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          if (client.url) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
