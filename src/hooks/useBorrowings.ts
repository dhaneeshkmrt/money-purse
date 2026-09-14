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
  writeBatch,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  BorrowingContact, 
  Borrowing, 
  Repayment, 
  BorrowingStatus,
  User,
  BorrowingRelationship
} from '@/lib/types';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { logChange } from '@/lib/logger';

export function useBorrowings(tenantId: string | null, user: User | null) {
  const [contacts, setContacts] = useState<BorrowingContact[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to data
  useEffect(() => {
    if (!tenantId) {
      setContacts([]);
      setBorrowings([]);
      setRepayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to Contacts
    const contactsUnsubscribe = onSnapshot(
      query(collection(db, 'borrowingContacts'), where('tenantId', '==', tenantId), orderBy('name')),
      (snapshot) => {
        const data: BorrowingContact[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as BorrowingContact));
        setContacts(data);
      }
    );

    // Subscribe to Borrowings
    const borrowingsUnsubscribe = onSnapshot(
      query(collection(db, 'borrowings'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data: Borrowing[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Borrowing));
        setBorrowings(data);
        setLoading(false);
      }
    );

    // Subscribe to Repayments
    const repaymentsUnsubscribe = onSnapshot(
      query(collection(db, 'borrowingRepayments'), where('tenantId', '==', tenantId), orderBy('date', 'desc')),
      (snapshot) => {
        const data: Repayment[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Repayment));
        setRepayments(data);
      }
    );

    return () => {
      contactsUnsubscribe();
      borrowingsUnsubscribe();
      repaymentsUnsubscribe();
    };
  }, [tenantId]);

  // Logic: Get status of a borrowing based on due date
  const getBorrowingStatus = useCallback((borrowing: Borrowing): BorrowingStatus => {
    if (borrowing.isClosed) return 'Settled';
    
    const today = startOfDay(new Date());
    const dueDate = startOfDay(parseISO(borrowing.dueDate));
    const daysLate = differenceInDays(today, dueDate);

    if (daysLate <= 0) return 'Active';
    if (daysLate <= 30) return 'Overdue';
    if (daysLate <= 90) return 'Sub-Standard';
    if (daysLate <= 180) return 'NPA';
    return 'Written Off';
  }, []);

  // Action: Add Contact
  const addContact = async (data: { name: string, relationship: BorrowingRelationship, phone?: string, address?: string, notes?: string, job?: string }) => {
    if (!tenantId) return;
    const newContact: Omit<BorrowingContact, 'id'> = {
      tenantId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      job: data.job || '',
      creditScore: 750, // Initial Score
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'borrowingContacts'), newContact);
    await logChange(tenantId, user?.name || 'System', 'CREATE', 'borrowingContacts', docRef.id, `Added borrowing contact: ${data.name}`, undefined, newContact);
  };

  // Action: Edit Contact
  const editContact = async (id: string, data: { name: string, relationship: BorrowingRelationship, phone?: string, address?: string, notes?: string, job?: string }) => {
    if (!tenantId || !user) return;
    const contactRef = doc(db, 'borrowingContacts', id);
    const oldContact = contacts.find(c => c.id === id);
    
    const updateData = {
      name: data.name,
      relationship: data.relationship,
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      job: data.job || '',
    };

    await setDoc(contactRef, updateData, { merge: true });
    await logChange(tenantId, user.name, 'UPDATE', 'borrowingContacts', id, `Updated contact details for ${data.name}`, oldContact, { ...oldContact, ...updateData });
  };

  // Action: Delete Contact
  const deleteContact = async (id: string) => {
    if (!tenantId || !user) return;
    
    // Safety check: Don't delete if there is history
    const hasHistory = borrowings.some(b => b.contactId === id);
    if (hasHistory) {
      throw new Error("Cannot delete contact with existing financial history.");
    }

    const contact = contacts.find(c => c.id === id);
    await deleteDoc(doc(db, 'borrowingContacts', id));
    await logChange(tenantId, user.name, 'DELETE', 'borrowingContacts', id, `Deleted borrowing contact: ${contact?.name || id}`);
  };

  // Action: Add Borrowing
  const addBorrowing = async (data: Omit<Borrowing, 'id' | 'tenantId' | 'userId' | 'balance' | 'isClosed' | 'createdAt'>) => {
    if (!tenantId || !user) return;
    const newBorrowing: Omit<Borrowing, 'id'> = {
      ...data,
      tenantId,
      userId: user.name,
      balance: data.amount,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'borrowings'), newBorrowing);
    await logChange(tenantId, user.name, 'CREATE', 'borrowings', docRef.id, `Recorded ${data.type} of ${data.amount} from/to ${data.contactName}`, undefined, newBorrowing);
  };

  // Action: Edit Borrowing
  const editBorrowing = async (id: string, data: { startDate: string, dueDate: string, notes?: string, amount?: number }) => {
    if (!tenantId || !user) return;
    const borrowingRef = doc(db, 'borrowings', id);
    const oldBorrowing = borrowings.find(b => b.id === id);
    if (!oldBorrowing) return;

    // Logic: If amount changed, we need to adjust balance carefully
    let newBalance = oldBorrowing.balance;
    if (data.amount !== undefined && data.amount !== oldBorrowing.amount) {
      const paidAlready = oldBorrowing.amount - oldBorrowing.balance;
      newBalance = Math.max(0, data.amount - paidAlready);
    }

    const updateData = {
      ...data,
      balance: newBalance,
      isClosed: newBalance <= 0,
      ...(newBalance <= 0 && !oldBorrowing.isClosed && { closedAt: new Date().toISOString() }),
      ...(newBalance > 0 && oldBorrowing.isClosed && { closedAt: null })
    };

    await setDoc(borrowingRef, updateData, { merge: true });
    await logChange(tenantId, user.name, 'UPDATE', 'borrowings', id, `Updated borrowing record: ${oldBorrowing.contactName}`, oldBorrowing, { ...oldBorrowing, ...updateData });
  };

  // Action: Add Repayment
  const addRepayment = async (borrowingId: string, amount: number, date: string, notes?: string) => {
    if (!tenantId || !user) return;
    
    const borrowing = borrowings.find(b => b.id === borrowingId);
    if (!borrowing) return;

    const batch = writeBatch(db);
    
    // 1. Create Repayment record
    const repaymentRef = doc(collection(db, 'borrowingRepayments'));
    const repaymentData: Omit<Repayment, 'id'> = {
      tenantId,
      borrowingId,
      amount,
      date,
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };
    batch.set(repaymentRef, repaymentData);

    // 2. Update Borrowing balance
    const newBalance = Math.max(0, borrowing.balance - amount);
    const isNowClosed = newBalance <= 0;
    const borrowingRef = doc(db, 'borrowings', borrowingId);
    batch.set(borrowingRef, {
      balance: newBalance,
      isClosed: isNowClosed,
      ...(isNowClosed && { closedAt: new Date().toISOString() })
    }, { merge: true });

    // 3. Update Contact Credit Score (simple logic)
    if (borrowing.type === 'Lent') {
      const contact = contacts.find(c => c.id === borrowing.contactId);
      if (contact) {
        const status = getBorrowingStatus(borrowing);
        let scoreChange = 5; // Base gain for repayment
        
        if (status === 'Active') scoreChange = 10;
        if (status === 'Overdue') scoreChange = -10;
        if (status === 'Sub-Standard') scoreChange = -30;
        if (status === 'NPA') scoreChange = -100;
        if (status === 'Written Off') scoreChange = -200;

        const newScore = Math.min(900, Math.max(300, contact.creditScore + scoreChange));
        batch.set(doc(db, 'borrowingContacts', contact.id), { creditScore: newScore }, { merge: true });
      }
    }

    await batch.commit();
    await logChange(tenantId, user.name, 'CREATE', 'borrowingRepayments', repaymentRef.id, `Repayment of ${amount} for borrowing ${borrowingId}`, undefined, repaymentData);
  };

  const deleteBorrowing = async (id: string) => {
    if (!tenantId || !user) return;
    const borrowing = borrowings.find(b => b.id === id);
    await deleteDoc(doc(db, 'borrowings', id));
    await logChange(tenantId, user.name, 'DELETE', 'borrowings', id, `Deleted borrowing record: ${borrowing?.notes || borrowing?.contactName || id}`);
  };

  // Action: Archive / Close Borrowing
  const closeBorrowing = async (id: string, isClosed: boolean = true) => {
    if (!tenantId || !user) return;
    const borrowingRef = doc(db, 'borrowings', id);
    const borrowing = borrowings.find(b => b.id === id);
    if (!borrowing) return;

    if (isClosed && borrowing.balance > 0) {
      throw new Error("Only borrowings with zero balance can be archived or closed.");
    }

    const updateData = {
      isClosed,
      closedAt: isClosed ? (borrowing.closedAt || new Date().toISOString()) : null,
    };

    await setDoc(borrowingRef, updateData, { merge: true });
    await logChange(
      tenantId,
      user.name,
      'UPDATE',
      'borrowings',
      id,
      `${isClosed ? 'Archived/Closed' : 'Reopened'} borrowing for ${borrowing.contactName}`,
      borrowing,
      { ...borrowing, ...updateData }
    );
  };

  // Action: Bulk Archive All Zero Balance Borrowings
  const closeAllZeroBalanceBorrowings = async () => {
    if (!tenantId || !user) return;
    const zeroBalanceBorrowings = borrowings.filter(b => b.balance <= 0 && !b.isClosed);
    if (zeroBalanceBorrowings.length === 0) return;

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const b of zeroBalanceBorrowings) {
      const ref = doc(db, 'borrowings', b.id);
      batch.set(ref, { isClosed: true, closedAt: b.closedAt || now }, { merge: true });
    }
    await batch.commit();
    await logChange(
      tenantId,
      user.name,
      'UPDATE',
      'borrowings',
      'bulk',
      `Archived/Closed ${zeroBalanceBorrowings.length} zero-balance borrowing(s)`
    );
  };

  return {
    contacts,
    borrowings,
    repayments,
    loading,
    addContact,
    editContact,
    deleteContact,
    addBorrowing,
    editBorrowing,
    addRepayment,
    deleteBorrowing,
    closeBorrowing,
    closeAllZeroBalanceBorrowings,
    getBorrowingStatus
  };
}
