'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Insurance, User, InsuranceStatus } from '@/lib/types';
import { differenceInDays, parseISO, startOfDay, isBefore } from 'date-fns';
import { logChange } from '@/lib/logger';

export function useInsurance(tenantId: string | null, user: User | null) {
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setInsurances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'insurances'),
      where('tenantId', '==', tenantId),
      orderBy('expiryDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Insurance[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Insurance));
      setInsurances(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const getInsuranceStatus = useCallback((expiryDate: string): InsuranceStatus => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(expiryDate));
    const daysUntilExpiry = differenceInDays(expiry, today);

    if (isBefore(expiry, today)) return 'Expired';
    if (daysUntilExpiry <= 30) return 'Expiring Soon';
    return 'Active';
  }, []);

  const addInsurance = async (data: Omit<Insurance, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!tenantId || !user) return;
    const timestamp = new Date().toISOString();
    const newInsurance: Omit<Insurance, 'id'> = {
      ...data,
      tenantId,
      userId: user.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const docRef = await addDoc(collection(db, 'insurances'), newInsurance);
    await logChange(tenantId, user.name, 'CREATE', 'insurances', docRef.id, `Added ${data.type} insurance from ${data.provider}`, undefined, newInsurance);
  };

  const editInsurance = async (id: string, data: Partial<Omit<Insurance, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
    if (!tenantId || !user) return;
    const docRef = doc(db, 'insurances', id);
    const oldInsurance = insurances.find(i => i.id === id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, updateData);
    await logChange(tenantId, user.name, 'UPDATE', 'insurances', id, `Updated insurance: ${oldInsurance?.policyNumber}`, oldInsurance, { ...oldInsurance, ...updateData });
  };

  const deleteInsurance = async (id: string) => {
    if (!tenantId || !user) return;
    const insurance = insurances.find(i => i.id === id);
    await deleteDoc(doc(db, 'insurances', id));
    await logChange(tenantId, user.name, 'DELETE', 'insurances', id, `Deleted insurance policy: ${insurance?.policyNumber}`);
  };

  return {
    insurances,
    loading,
    addInsurance,
    editInsurance,
    deleteInsurance,
    getInsuranceStatus,
  };
}
