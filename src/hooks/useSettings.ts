'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { defaultSettings } from '@/lib/data';
import type { Settings, User } from '@/lib/types';
import { logChange } from '@/lib/logger';

const SETTINGS_STORAGE_KEY = 'expenseflow_settings';

export function useSettings(tenantId: string | null, user: User | null) {
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {}
    }
    return { 
      ...defaultSettings, 
      tenantId: tenantId || '', 
      userId: user?.name || '',
      dateInputStyle: 'popup'
    };
  });
  const [loadingSettings, setLoadingSettings] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (cached) return false;
      } catch (e) {}
    }
    return true;
  });
  const [isSyncingSettings, setIsSyncingSettings] = useState<boolean>(false);

  const seedDefaultSettings = useCallback(async (tenantIdToSeed: string, userIdToSeed: string = 'default') => {
    const docId = `${tenantIdToSeed}_${userIdToSeed}`;
    const settingsRef = doc(db, 'settings', docId);
    const newSettings: Settings = { 
      ...defaultSettings, 
      tenantId: tenantIdToSeed, 
      userId: userIdToSeed,
      dateInputStyle: 'popup'
    };
    await setDoc(settingsRef, newSettings);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    }
    return newSettings;
  }, []);

  useEffect(() => {
    if (!tenantId || !user?.name) {
      if (!tenantId) {
        setLoadingSettings(false);
        setIsSyncingSettings(false);
      }
      return;
    }

    const docId = `${tenantId}_${user.name}`;
    const settingsRef = doc(db, 'settings', docId);

    const unsubscribe = onSnapshot(settingsRef, { includeMetadataChanges: true }, async (docSnap) => {
      setIsSyncingSettings(docSnap.metadata.fromCache);
      setLoadingSettings(false);

      if (!docSnap.exists()) {
        if (!docSnap.metadata.fromCache) {
          const newSettings = await seedDefaultSettings(tenantId, user.name);
          setSettings(newSettings);
        }
      } else {
        const data = docSnap.data() as Omit<Settings, 'tenantId' | 'userId'>;
        const fullSettings: Settings = { 
          ...defaultSettings, 
          dateInputStyle: 'popup',
          ...data, 
          tenantId: tenantId, 
          userId: user.name 
        };
        setSettings(fullSettings);
        if (typeof window !== 'undefined') {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(fullSettings));
        }
      }
    }, (error) => {
      console.error("Error listening to user settings: ", error);
      setLoadingSettings(false);
      setIsSyncingSettings(false);
    });

    return () => unsubscribe();
  }, [tenantId, user?.name, seedDefaultSettings]);

  const updateSettings = async (newSettings: Partial<Omit<Settings, 'tenantId' | 'userId'>>) => {
      if (!tenantId || !user) return;
      const oldSettings = { ...settings };
      const docId = `${tenantId}_${user.name}`;
      
      try {
          const settingsRef = doc(db, 'settings', docId);
          // We clean up the data slightly before saving to avoid issues with undefined
          const dataToSave = { ...newSettings };
          
          await setDoc(settingsRef, dataToSave, { merge: true });
          
          const updatedSettings = { ...settings, ...dataToSave };
          setSettings(updatedSettings);
          if (typeof window !== 'undefined') {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
          }

          await logChange(
            tenantId,
            user.name,
            'UPDATE',
            'settings',
            docId,
            'Updated personal settings',
            oldSettings,
            updatedSettings
          );
      } catch (error) {
          console.error("Error updating settings: ", error);
          throw error; // Re-throw so the UI can handle the error
      }
  };

  return { settings, loadingSettings, isSyncingSettings, updateSettings, seedDefaultSettings };
}
