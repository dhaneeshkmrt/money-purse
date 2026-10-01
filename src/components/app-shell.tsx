
'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { LogOut } from 'lucide-react';
import { useApp } from '@/lib/provider';
import { Button } from './ui/button';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AppShellNav } from './app-shell-nav';
import { AppShellHeader } from './app-shell-header';
import { APP_VERSION } from '@/lib/version';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, signOut } = useApp();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <AppShellNav />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 p-2">
            <div className="flex-grow min-w-0">
              <p className="font-semibold truncate">{user?.name}</p>
            </div>
            <span
              className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 shrink-0 select-none"
              title={`Version ${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppShellHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
