
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { Tenant, User } from '@/lib/types';
import { useToast } from './use-toast';

const AUTH_STORAGE_KEY = 'expenseflow_auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          return JSON.parse(storedAuth).user;
        }
      } catch (error) {
        console.error("Failed to parse auth data from localStorage", error);
      }
    }
    return null;
  });
  const [loadingAuth, setLoadingAuth] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          if (authData.user) return false;
        }
      } catch (error) {}
    }
    return true;
  });
  const { toast } = useToast();

  useEffect(() => {
    // Check for persisted user session on mount
    try {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        setUser(authData.user);
      }
    } catch (error) {
      console.error("Failed to parse auth data from localStorage", error);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  const findUserByEmail = async (email: string): Promise<{user: User, tenant: Tenant} | null> => {
      const tenantsCollection = collection(db, 'tenants');
      const q = query(tenantsCollection);
      const querySnapshot = await getDocs(q);

      for (const doc of querySnapshot.docs) {
        const tenant = { id: doc.id, ...doc.data() } as Tenant;

        // Check main tenant email
        if (tenant.email === email) {
          return { user: { name: tenant.name, tenantId: tenant.id }, tenant };
        }

        // Check member emails
        if (tenant.members && tenant.members.length > 0) {
          const member = tenant.members.find(m => m.email === email);
          if (member) {
            return { user: { name: member.name, tenantId: tenant.id }, tenant };
          }
        }
      }
      return null;
  };

  const signIn = async (email: string, secretToken: string): Promise<boolean> => {
    setLoadingAuth(true);
    try {
      const tenantsCollection = collection(db, 'tenants');
      const q = query(tenantsCollection);
      const querySnapshot = await getDocs(q);

      let foundUser: User | null = null;
      let foundTenant: Tenant | null = null;

      for (const doc of querySnapshot.docs) {
        const tenant = { id: doc.id, ...doc.data() } as Tenant;

        // Check main tenant credentials
        if (tenant.email === email && tenant.secretToken === secretToken) {
          foundUser = { name: tenant.name, tenantId: tenant.id };
          foundTenant = tenant;
          break;
        }

        // Check member credentials
        if (tenant.members && tenant.members.length > 0) {
          const member = tenant.members.find(
            m => m.email === email && m.secretToken === secretToken
          );
          if (member) {
            foundUser = { name: member.name, tenantId: tenant.id };
            foundTenant = tenant;
            break;
          }
        }
      }

      if (foundUser && foundTenant) {
        setUser(foundUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: foundUser, tenant: foundTenant }));
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoadingAuth(false);
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setLoadingAuth(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      if (!googleUser.email) {
        throw new Error("No email found in Google account.");
      }

      const userData = await findUserByEmail(googleUser.email);

      if (userData) {
        setUser(userData.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData.user, tenant: userData.tenant }));
        return true;
      } else {
        toast({
          title: 'Login Failed',
          description: 'Your Google account email does not match any tenant.',
          variant: 'destructive',
        });
        await firebaseSignOut(auth);
        return false;
      }
    } catch (error: any) {
      toast({
        title: 'Google Sign-In Failed',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoadingAuth(false);
    }
  }

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    await firebaseSignOut(auth).catch(err => console.error("Error signing out from Firebase:", err));
  };

  return { user, loadingAuth, signIn, signOut, signInWithGoogle };
}
