
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, doc, writeBatch, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, User } from '@/lib/types';
import { logChange } from '@/lib/logger';

const normalizeTransaction = (transaction: Partial<Transaction> & { id?: string }, fallbackDate?: string): Transaction => {
  const dateValue = transaction.date || fallbackDate || new Date().toISOString().split('T')[0];
  const timeValue = transaction.time || '00:00';

  return {
    id: transaction.id || '',
    date: dateValue,
    time: timeValue,
    description: transaction.description || '',
    amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
    category: transaction.category || '',
    subcategory: transaction.subcategory || '',
    microcategory: transaction.microcategory || '',
    paidBy: transaction.paidBy || '',
    notes: transaction.notes || '',
    tenantId: transaction.tenantId || '',
    userId: transaction.userId || '',
  } as Transaction;
};

const sortTransactions = (transactions: Transaction[]) => {
  return transactions.sort((a, b) => {
    const dateA = new Date(`${a.date || new Date().toISOString().split('T')[0]}T${a.time || '00:00:00'}`).getTime();
    const dateB = new Date(`${b.date || new Date().toISOString().split('T')[0]}T${b.time || '00:00:00'}`).getTime();
    return dateB - dateA;
  });
};

export function useTransactions(tenantId: string | null, user: User | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  const fetchTransactions = useCallback(async (tenantIdToFetch: string) => {
    setLoadingTransactions(true);
    try {
      const q = query(collection(db, "transactions"), where("tenantId", "==", tenantIdToFetch));
      const querySnapshot = await getDocs(q);
      const fetchedTransactions = querySnapshot.docs.map(doc => normalizeTransaction({ id: doc.id, ...doc.data() }));
      setTransactions(sortTransactions(fetchedTransactions));
    } catch (error) {
      console.error("Error fetching transactions: ", error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchTransactions(tenantId);
    } else {
      setTransactions([]);
      setLoadingTransactions(false);
    }
  }, [tenantId, fetchTransactions]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'tenantId'| 'userId'>): Promise<string> => {
    if (!tenantId || !user) throw new Error("Tenant or user not available");
    const transactionData = normalizeTransaction({ ...transaction, tenantId: tenantId, userId: user.name });
    try {
      const docRef = await addDoc(collection(db, "transactions"), transactionData);
      const newTransaction = { ...transactionData, id: docRef.id };
      setTransactions(prev => sortTransactions([...prev, newTransaction]));

      await logChange(
        tenantId,
        user.name,
        'CREATE',
        'transactions',
        docRef.id,
        `Created transaction: ${transaction.description}`,
        undefined,
        newTransaction
      );

      return docRef.id;
    } catch (e) {
      console.error("Error adding document: ", e);
      throw e;
    }
  };
  
  const addMultipleTransactions = async (transactionsToAdd: Omit<Transaction, 'id' | 'tenantId' | 'userId'>[]) => {
    if (!tenantId || !user) throw new Error("Please select a tenant first.");
    const batch = writeBatch(db);
    const newTransactions: Transaction[] = [];

    transactionsToAdd.forEach(transaction => {
      const docRef = doc(collection(db, "transactions"));
      const transactionData = normalizeTransaction({ ...transaction, tenantId: tenantId, userId: user?.name, microcategory: transaction.microcategory || '' });
      batch.set(docRef, transactionData);
      newTransactions.push({ ...transactionData, id: docRef.id });
    });

    try {
      await batch.commit();
      setTransactions(prev => sortTransactions([...prev, ...newTransactions]));

      for (const newTx of newTransactions) {
        await logChange(
          tenantId,
          user.name,
          'CREATE',
          'transactions',
          newTx.id,
          `Created transaction via bulk import: ${newTx.description}`,
          undefined,
          newTx
        );
      }

    } catch (e) {
      console.error("Error adding multiple documents: ", e);
      throw new Error("Failed to import transactions.");
    }
  };

  const editTransaction = async (transactionId: string, transactionUpdate: Omit<Transaction, 'id' | 'tenantId' | 'userId'>) => {
    if (!tenantId || !user) return;
    const transactionData = normalizeTransaction({ ...transactionUpdate, tenantId: tenantId, userId: user.name });
    try {
        const oldTransaction = transactions.find(t => t.id === transactionId);
        const transactionRef = doc(db, "transactions", transactionId);
        await updateDoc(transactionRef, transactionData);
        const newTransaction = { id: transactionId, ...transactionData };
        setTransactions(prev => 
            sortTransactions(prev.map(t => t.id === transactionId ? newTransaction : t))
        );

        await logChange(
          tenantId,
          user.name,
          'UPDATE',
          'transactions',
          transactionId,
          `Updated transaction: ${transactionUpdate.description}`,
          oldTransaction,
          newTransaction
        );

    } catch (e) {
        console.error("Error updating document: ", e);
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    if (!tenantId || !user) return;
    try {
        const transactionToDelete = transactions.find(t => t.id === transactionId);
        await deleteDoc(doc(db, "transactions", transactionId));
        setTransactions(prev => prev.filter(t => t.id !== transactionId));
        
        if (transactionToDelete) {
          await logChange(
            tenantId,
            user.name,
            'DELETE',
            'transactions',
            transactionId,
            `Deleted transaction: ${transactionToDelete.description}`,
            transactionToDelete,
            undefined
          );
        }
    } catch (e) {
        console.error("Error deleting document: ", e);
    }
  };

  return {
    transactions,
    loadingTransactions,
    addTransaction,
    addMultipleTransactions,
    editTransaction,
    deleteTransaction,
  };
}
