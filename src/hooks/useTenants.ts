
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, doc, where, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Tenant, User, Category, Transaction, Settings } from '@/lib/types';
import { format } from 'date-fns';
import { logChange } from '@/lib/logger';

const generateSecretToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export function useTenants(
    seedDefaultCategories: (tenantId: string) => Promise<void>,
    seedDefaultSettings: (tenantId: string, userId?: string) => Promise<any>,
    user: User | null
) {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loadingTenants, setLoadingTenants] = useState<boolean>(true);
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => user?.tenantId || null);
    const [isSyncingTenants, setIsSyncingTenants] = useState<boolean>(false);

    const userTenant = useMemo(() => {
        if (!user || !tenants.length) return null;
        return tenants.find(t => t.id === user.tenantId);
    }, [user, tenants]);
    
    const isAdminUser = useMemo(() => {
        if (!userTenant || !user) return false;
        return !!userTenant.featureAccess?.admin;
    }, [userTenant, user]);

    const isMainTenantUser = useMemo(() => {
        if (!userTenant || !user) return false;
        return user.name === userTenant.name;
    }, [user, userTenant]);

    useEffect(() => {
        try {
            const storedAuth = localStorage.getItem('expenseflow_auth');
            if (storedAuth) {
                const authData = JSON.parse(storedAuth);
                if (authData.tenant) {
                    setTenants(prev => prev.length === 0 ? [authData.tenant] : prev);
                    setLoadingTenants(false);
                }
                if (authData.user?.tenantId) {
                    setSelectedTenantId(prev => prev || authData.user.tenantId);
                }
            }
        } catch (e) {}
    }, []);

    useEffect(() => {
        const tenantsCollection = collection(db, "tenants");
        const q = query(tenantsCollection, orderBy("name"));
        
        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (querySnapshot) => {
            const fetchedTenants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
            setTenants(fetchedTenants);
            setLoadingTenants(false);
            setIsSyncingTenants(querySnapshot.metadata.fromCache);
        }, (error) => {
            console.error("Error listening to tenants: ", error);
            setLoadingTenants(false);
            setIsSyncingTenants(false);
        });

        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if(user?.tenantId) {
            setSelectedTenantId(user.tenantId)
        } else {
            setSelectedTenantId(null);
        }
    }, [user]);

    const handleSetSelectedTenantId = (tenantId: string | null) => {
        if (isAdminUser) {
            setSelectedTenantId(tenantId);
        } else if (user && tenantId !== user.tenantId) {
            console.warn("Attempted to switch tenant for non-admin user. Denied.");
            return;
        } else {
            setSelectedTenantId(tenantId);
        }
    };

    const addTenant = async (tenantData: Partial<Omit<Tenant, 'id'>>) => {
        if (!isAdminUser || !user) {
            console.error("Access denied: Only admin users can add tenants");
            return;
        }
        
        try {
            const docRef = await addDoc(collection(db, 'tenants'), tenantData);
            const newTenant = { id: docRef.id, ...tenantData } as Tenant;
    
            await seedDefaultCategories(newTenant.id);
            await seedDefaultSettings(newTenant.id);
    
            setTenants(prev => [...prev, newTenant].sort((a,b) => a.name.localeCompare(b.name)));

            await logChange(user.tenantId, user.name, 'CREATE', 'tenants', docRef.id, `Created new tenant: ${newTenant.name}`, undefined, newTenant);
            
        } catch(e) {
            console.error("Error adding tenant: ", e);
        }
    };

    const editTenant = async (tenantId: string, tenantData: Partial<Omit<Tenant, 'id'>>) => {
        if (!isAdminUser || !user) {
            console.error("Access denied: Only admin users can edit tenants");
            return;
        }
        
        try {
            const oldTenant = tenants.find(t => t.id === tenantId);
            const tenantRef = doc(db, 'tenants', tenantId);
            await setDoc(tenantRef, tenantData, { merge: true });
            const updatedTenant = { ...oldTenant, ...tenantData } as Tenant;
            setTenants(prev => prev.map(t => t.id === tenantId ? updatedTenant : t).sort((a,b) => a.name.localeCompare(b.name)));

            await logChange(user.tenantId, user.name, 'UPDATE', 'tenants', tenantId, `Updated tenant: ${tenantData.name}`, oldTenant, updatedTenant);

        } catch(e) {
            console.error("Error updating tenant: ", e);
        }
    };

    const deleteTenant = async (tenantId: string) => {
        if (!isAdminUser || !user) {
            console.error("Access denied: Only admin users can delete tenants");
            return;
        }
        
        try {
            if(user?.tenantId === tenantId) {
                alert("You cannot delete the tenant you are currently logged into.");
                return;
            }
            if(selectedTenantId === tenantId) {
                setSelectedTenantId(user?.tenantId ?? null);
            }
            const tenantToDelete = tenants.find(t => t.id === tenantId);

            const batch = writeBatch(db);

            // Delete categories
            const categoriesQuery = query(collection(db, 'categories'), where('tenantId', '==', tenantId));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            categoriesSnapshot.forEach(doc => batch.delete(doc.ref));
            
            // Delete budgets
            const budgetsRef = doc(db, 'budgets', tenantId);
            batch.delete(budgetsRef);

            // Delete transactions
            const transactionsQuery = query(collection(db, 'transactions'), where('tenantId', '==', tenantId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.forEach(doc => batch.delete(doc.ref));
            
            // Delete settings
            const settingsRef = doc(db, 'settings', tenantId);
            batch.delete(settingsRef);

            // Delete the tenant itself
            const tenantRef = doc(db, 'tenants', tenantId);
            batch.delete(tenantRef);
            
            await batch.commit();

            const remainingTenants = tenants.filter(t => t.id !== tenantId);
            setTenants(remainingTenants);

            if(tenantToDelete) {
                await logChange(user.tenantId, user.name, 'DELETE', 'tenants', tenantId, `Deleted tenant: ${tenantToDelete.name}`, tenantToDelete, undefined);
            }

        } catch(e) {
            console.error("Error deleting tenant and associated data: ", e);
        }
    };
    
    const backupAllData = async () => {
        console.log("Starting backup...");
        const backupData: { [key: string]: any[] } = {
            tenants: [],
            categories: [],
            transactions: [],
            settings: [],
            budgets: [],
        };
        const collectionsToBackup = ['tenants', 'categories', 'transactions', 'settings', 'budgets'];

        for (const collectionName of collectionsToBackup) {
            const querySnapshot = await getDocs(collection(db, collectionName));
            querySnapshot.forEach(doc => {
                backupData[collectionName].push({ id: doc.id, ...doc.data() });
            });
        }
        
        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = format(new Date(), 'yyyy-MM-dd');
        a.download = `money-purse-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (user) {
            await logChange(user.tenantId, user.name, 'PROCESS', 'all', 'all', 'Created a database backup', undefined, { file: `money-purse-backup-${date}.json` });
        }
        console.log("Backup complete.");
    };

    const restoreAllData = async (data: { [key: string]: any[] }) => {
        console.log("Starting restore...");
        if (!user) throw new Error("User not authenticated for restore operation.");
        const collectionsToDelete = ['tenants', 'categories', 'transactions', 'settings', 'budgets'];
        const batch = writeBatch(db);
        
        // Clear all current data
        for (const collectionName of collectionsToDelete) {
            const querySnapshot = await getDocs(collection(db, collectionName));
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        await batch.commit();
        console.log("All existing data deleted.");

        // Write new data
        const restoreBatch = writeBatch(db);
        for (const collectionName of collectionsToDelete) {
            if (data[collectionName]) {
                data[collectionName].forEach((item: any) => {
                    const { id, ...itemData } = item;
                    const docRef = doc(db, collectionName, id);
                    restoreBatch.set(docRef, itemData);
                });
            }
        }
        await restoreBatch.commit();

        await logChange(user.tenantId, user.name, 'PROCESS', 'all', 'all', 'Restored database from backup file', 'all existing data', 'new data from backup');
        
        console.log("Restore complete.");
        // Force a page reload to reflect the new state
        window.location.reload();
    };


    return {
        tenants,
        loadingTenants,
        isSyncingTenants,
        selectedTenantId,
        setSelectedTenantId: handleSetSelectedTenantId,
        addTenant,
        editTenant,
        deleteTenant,
        userTenant,
        isAdminUser,
        isMainTenantUser,
        backupAllData,
        restoreAllData,
    };
}
