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
  setDoc,
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Insurance, User, InsuranceStatus, InsuranceRenewalRecord } from '@/lib/types';
import { differenceInDays, parseISO, startOfDay, isBefore, format, subDays } from 'date-fns';
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

  const getInsuranceStatus = useCallback((expiryDate: string, isRenewed?: boolean): InsuranceStatus => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(expiryDate));
    const daysUntilExpiry = differenceInDays(expiry, today);

    if (isBefore(expiry, today)) return 'Expired';
    if (daysUntilExpiry <= 60) return 'Expiring Soon';
    if (isRenewed) return 'Renewed';
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

    await setDoc(docRef, updateData, { merge: true });
    await logChange(tenantId, user.name, 'UPDATE', 'insurances', id, `Updated insurance: ${oldInsurance?.policyNumber}`, oldInsurance, { ...oldInsurance, ...updateData });
  };

  const renewInsurance = async (
    id: string,
    renewalData: {
      newExpiryDate: string;
      newStartDate?: string;
      newPremiumAmount?: number;
      newPolicyNumber?: string;
      name?: string;
      notes?: string;
    }
  ) => {
    if (!tenantId || !user) return;
    const docRef = doc(db, 'insurances', id);
    const oldInsurance = insurances.find((i) => i.id === id);
    if (!oldInsurance) return;

    const timestamp = new Date().toISOString();
    const newExpiry = renewalData.newExpiryDate;
    const newStartDate = renewalData.newStartDate || oldInsurance.expiryDate;
    const newReminder = format(subDays(parseISO(newExpiry), 60), 'yyyy-MM-dd');

    // Archive the expired / previous policy period under renewalHistory
    const historicalRecord: InsuranceRenewalRecord = {
      id: `renewal-${Date.now()}`,
      name: oldInsurance.name,
      policyNumber: oldInsurance.policyNumber,
      startDate: oldInsurance.startDate,
      expiryDate: oldInsurance.expiryDate,
      premiumAmount: oldInsurance.premiumAmount,
      renewedAt: timestamp,
      notes: oldInsurance.notes,
    };

    const existingHistory = oldInsurance.renewalHistory || [];
    const updatedHistory = [historicalRecord, ...existingHistory];

    const updateData: Partial<Insurance> = {
      name: renewalData.name !== undefined ? renewalData.name : oldInsurance.name,
      expiryDate: newExpiry,
      startDate: newStartDate,
      reminderDate: newReminder,
      premiumAmount: renewalData.newPremiumAmount ?? oldInsurance.premiumAmount,
      policyNumber: renewalData.newPolicyNumber || oldInsurance.policyNumber,
      notes: renewalData.notes !== undefined ? renewalData.notes : oldInsurance.notes,
      isRenewed: true,
      renewedAt: timestamp,
      previousExpiryDate: oldInsurance.expiryDate,
      renewalCount: (oldInsurance.renewalCount || 0) + 1,
      renewalHistory: updatedHistory,
      updatedAt: timestamp,
    };

    await setDoc(docRef, updateData, { merge: true });
    await logChange(
      tenantId,
      user.name,
      'UPDATE',
      'insurances',
      id,
      `Renewed policy #${oldInsurance.policyNumber} until ${newExpiry}. Archived previous period (${oldInsurance.startDate} to ${oldInsurance.expiryDate}) in history.`,
      oldInsurance,
      { ...oldInsurance, ...updateData }
    );
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
    renewInsurance,
    deleteInsurance,
    getInsuranceStatus,
  };
}
