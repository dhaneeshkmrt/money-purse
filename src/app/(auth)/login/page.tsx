
'use client';

import { useApp } from '@/lib/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { hasPendingSharedFiles } from '@/lib/share-storage';

export const dynamic = 'force-dynamic';

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.658-3.301-11.303-7.852l-6.571,4.819C9.656,39.663,16.318,44,24,44z"></path>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C43.021,36.251,44,30.433,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
  </svg>
);

export default function LoginPage() {
  const { user, signInWithGoogle } = useApp();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigateAfterAuth = async () => {
    try {
      const hasShared = await hasPendingSharedFiles();
      if (hasShared) {
        router.push(`/transactions/group?shared=1&ts=${Date.now()}`);
        return;
      }
    } catch {
      // fallback to dashboard
    }
    router.push('/dashboard');
  };

  useEffect(() => {
    if (user) {
      navigateAfterAuth();
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const success = await signInWithGoogle();
    if (success) {
      toast({
        title: 'Login Successful',
        description: 'Welcome!',
      });
      await navigateAfterAuth();
    }
    // Error toasts are handled within the signInWithGoogle function
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center">
          <Logo />
          <CardTitle className="pt-4">Welcome Back</CardTitle>
          <CardDescription>
            Sign in with Google to continue. Only users whose tenant data has been added by an admin can login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <GoogleIcon />}
              Sign In with Google
           </Button>
        </CardContent>
      </Card>
    </div>
  );
}
