import { persistSharedFiles, UnifiedFilePayload } from '@/lib/share-storage';

declare const self: any;

// Intercept POST requests to /share-target
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.replace(/\/$/, '') === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          // Direct formData parse without cloning - cloning tee's the body stream which breaks native Android IPC file descriptors
          const formData = await event.request.formData();
          const filesToSave: UnifiedFilePayload[] = [];
          const seenFiles = new Set<string>();

          // Helper to process candidate items
          const processItem = async (item: any, fallbackName: string) => {
            if (!item) return;

            if (typeof item === 'object' && (item instanceof Blob || typeof (item as any).arrayBuffer === 'function')) {
              const fileObj = item as File;
              const name = fileObj.name || fallbackName;
              const type = fileObj.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

              if (typeof (fileObj as any).arrayBuffer === 'function') {
                const buffer = await fileObj.arrayBuffer();
                if (buffer.byteLength > 0 && !seenFiles.has(`${name}-${buffer.byteLength}`)) {
                  seenFiles.add(`${name}-${buffer.byteLength}`);
                  filesToSave.push({ name, type, data: buffer });
                }
              } else if (fileObj instanceof Blob && fileObj.size > 0 && !seenFiles.has(`${name}-${fileObj.size}`)) {
                seenFiles.add(`${name}-${fileObj.size}`);
                filesToSave.push({ name, type, data: fileObj });
              }
            } else if (typeof item === 'string') {
              if (item.startsWith('data:image/') || item.startsWith('data:application/pdf')) {
                const mime = item.substring(5, item.indexOf(';'));
                const base64Data = item.substring(item.indexOf(',') + 1);
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const ext = mime.includes('pdf') ? 'pdf' : 'jpg';
                const name = `${fallbackName}.${ext}`;
                if (!seenFiles.has(`${name}-${byteNumbers.length}`)) {
                  seenFiles.add(`${name}-${byteNumbers.length}`);
                  filesToSave.push({ name, type: mime, data: byteNumbers.buffer });
                }
              }
            }
          };

          // 1. Check known field keys defined in manifest.json and standard Android implementations
          const knownFieldKeys = ['files', 'file', 'image', 'photos', 'receipt', 'documents'];
          for (const key of knownFieldKeys) {
            const values = formData.getAll(key);
            for (let i = 0; i < values.length; i++) {
              await processItem(values[i], `shared-bill-${Date.now()}-${filesToSave.length + 1}`);
            }
          }

          // 2. Also inspect every single entry in formData in case a custom field name was used
          const allEntries = Array.from(formData.entries()) as [string, any][];
          for (let idx = 0; idx < allEntries.length; idx++) {
            const [key, value] = allEntries[idx];
            if (!knownFieldKeys.includes(key)) {
              await processItem(value, `shared-bill-${Date.now()}-${filesToSave.length + 1}`);
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

          // If no files found, redirect cleanly with debug info from incoming formData keys
          const formKeys = Array.from(formData.keys()).join(',') || 'empty_form';
          console.warn('[ServiceWorker] POST /share-target received with 0 files. Keys found:', formKeys);
          const fallbackUrl = `/transactions/group?share_warn=no_files_found&source=sw&debug=${encodeURIComponent(formKeys)}&ts=${Date.now()}`;
          return Response.redirect(new URL(fallbackUrl, event.request.url).href, 303);
        } catch (err: any) {
          console.error('[ServiceWorker] Error processing shared files:', err);
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
