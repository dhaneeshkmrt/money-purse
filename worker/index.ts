import { persistSharedFiles, UnifiedFilePayload } from '@/lib/share-storage';

declare const self: any;

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.replace(/\/$/, '') === '/share-target') {
    event.respondWith(
      (async () => {
        let redirectTarget = `/transactions/group?shared=1&ts=${Date.now()}`;

        try {
          const formData = await event.request.formData();
          const filesToSave: UnifiedFilePayload[] = [];

          // Collect from standard field names and all entries
          const candidateValues: any[] = [
            ...formData.getAll('files'),
            ...formData.getAll('file'),
            ...formData.getAll('image'),
            ...formData.getAll('receipt'),
          ];

          for (const [key, value] of formData.entries()) {
            if (!candidateValues.includes(value)) {
              candidateValues.push(value);
            }
          }

          for (let idx = 0; idx < candidateValues.length; idx++) {
            const item = candidateValues[idx];
            if (item && typeof item === 'object') {
              const fileObj = item as File;
              const name = fileObj.name || `shared-bill-${Date.now()}-${idx + 1}`;
              const type = fileObj.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

              if (typeof (fileObj as any).arrayBuffer === 'function') {
                const buffer = await fileObj.arrayBuffer();
                filesToSave.push({ name, type, data: buffer });
              } else if (fileObj instanceof Blob) {
                filesToSave.push({ name, type, data: fileObj });
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

            redirectTarget = `/transactions/group?shared=${filesToSave.length}&ts=${Date.now()}`;
          } else {
            console.warn('[ServiceWorker] POST /share-target received with 0 files.');
            redirectTarget = `/transactions/group?share_warn=no_files_found&ts=${Date.now()}`;
          }
        } catch (err: any) {
          console.error('[ServiceWorker] Error processing shared files:', err);
          const safeMsg = encodeURIComponent(err?.message || 'sw_parse_error');
          redirectTarget = `/transactions/group?share_err=${safeMsg}&ts=${Date.now()}`;
        }

        // Response.redirect requires an ABSOLUTE URL
        const absoluteRedirect = new URL(redirectTarget, event.request.url).href;
        return Response.redirect(absoluteRedirect, 303);
      })()
    );
  }
});

// Handle mobile push notification click
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/insurance';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: any[]) => {
        // If an open window exists, focus and navigate it
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle incoming background push notifications
self.addEventListener('push', (event: any) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || '🛡️ Insurance Renewal Alert', {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-192x192.png',
        data: payload.data || { url: '/insurance' },
        vibrate: [200, 100, 200, 100, 200],
        tag: payload.tag || 'insurance-saturday-reminder',
      })
    );
  } catch (err) {
    console.error('[ServiceWorker] Push notification error:', err);
  }
});

