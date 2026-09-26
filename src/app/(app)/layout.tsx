'use client';

import { AppShell } from '@/components/app-shell';
import { useApp } from '@/lib/provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSharedFiles } from '@/lib/share-target-db';

// This layout will apply to all pages that need authentication
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loadingAuth } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loadingAuth && !user) {
      router.replace('/login');
    }
  }, [user, loadingAuth, router]);

  // If user opens or focuses the app on any page other than /transactions/group
  // and there are pending shared files, route them to the group transaction scanner
  useEffect(() => {
    if (loadingAuth || !user) return;

    let isChecking = false;
    const checkRedirectToShared = async () => {
      if (isChecking) return;
      if (pathname === '/transactions/group') return;
      isChecking = true;
      try {
        const shared = await getSharedFiles();
        if (shared && shared.length > 0) {
          router.push(`/transactions/group?shared=${Date.now()}`);
        }
      } catch (err) {
        // ignore
      } finally {
        isChecking = false;
      }
    };

    checkRedirectToShared();

    const handleFocus = () => checkRedirectToShared();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkRedirectToShared();
    };
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SHARED_FILES_RECEIVED') {
        checkRedirectToShared();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, [user, loadingAuth, pathname, router]);

  if (loadingAuth || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
