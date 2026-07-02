
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
  getDocs,
  setDoc,
  getDoc,
  writeBatch,
  orderBy,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  VirtualAccount, 
  AccountTransaction, 
  MonthLock, 
  MonthEndProcessResult,
  Category,
  Transaction, 
  AccountTransactionType,
  User
} from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { logChange } from '@/lib/logger';

export function useAccounts(tenantId: string | null, user: User | null) {
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>([]);
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProcessing, setLoadingProcessing] = useState(false);

  // Listen to virtual accounts
  useEffect(() => {
    if (!tenantId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const accountsQuery = query(
      collection(db, 'virtualAccounts'),
      where('tenantId', '==', tenantId),
      orderBy('categoryName', 'asc')
    );

    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData: VirtualAccount[] = [];
      snapshot.forEach((doc) => {
        accountsData.push({ id: doc.id, ...doc.data() } as VirtualAccount);
      });
      setAccounts(accountsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Listen to account transactions
  useEffect(() => {
    if (!tenantId) {
      setAccountTransactions([]);
      return;
    }

    const transactionsQuery = query(
      collection(db, 'accountTransactions'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionsData: AccountTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Partial<AccountTransaction>;
        const date = data.date ?? data.createdAt ?? new Date().toISOString();
        const createdAt = data.createdAt ?? date;

        transactionsData.push({
          id: doc.id,
          accountId: data.accountId ?? '',
          categoryId: data.categoryId ?? '',
          tenantId: data.tenantId ?? tenantId,
          amount: data.amount ?? 0,
          type: data.type ?? 'zero_balance',
          description: data.description ?? '',
          monthYear: data.monthYear ?? '',
          date,
          createdAt,
        } as AccountTransaction);
      });
      setAccountTransactions(transactionsData);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Listen to month locks
  useEffect(() => {
    if (!tenantId) {
      setMonthLocks([]);
      return;
    }

    const locksQuery = query(
      collection(db, 'monthLocks'),
      where('tenantId', '==', tenantId),
      orderBy('year', 'desc'),
      orderBy('month', 'desc')
    );

    const unsubscribe = onSnapshot(locksQuery, (snapshot) => {
      const locksData: MonthLock[] = [];
      snapshot.forEach((doc) => {
        locksData.push({ id: doc.id, ...doc.data() } as MonthLock);
      });
      setMonthLocks(locksData);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Create or get virtual account for a category
  const createOrGetAccount = useCallback(async (categoryId: string, categoryName: string): Promise<VirtualAccount> => {
    if (!tenantId) throw new Error('No tenant selected');

    // Check if account already exists
    const existingAccount = accounts.find(acc => acc.categoryId === categoryId);
    if (existingAccount) return existingAccount;

    // Create new account
    const newAccount: Omit<VirtualAccount, 'id'> = {
      categoryId,
      categoryName,
      tenantId,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'virtualAccounts'), newAccount);
    return { id: docRef.id, ...newAccount };
  }, [tenantId, accounts]);

  // Add transaction to account
  const addAccountTransaction = useCallback(async (
    accountId: string,
    categoryId: string,
    amount: number,
    type: AccountTransaction['type'],
    description: string,
    monthYear: string
  ): Promise<void> => {
    if (!tenantId || !user) throw new Error('No tenant or user selected');

    const transaction: Omit<AccountTransaction, 'id'> = {
      accountId,
      categoryId,
      tenantId,
      amount,
      type,
      description,
      monthYear,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // Use batch to update both transaction and account balance
    const batch = writeBatch(db);
    
    // Add transaction
    const transactionRef = doc(collection(db, 'accountTransactions'));
    batch.set(transactionRef, transaction);

    // Update account balance
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      const accountRef = doc(db, 'virtualAccounts', accountId);
      batch.update(accountRef, {
        currentBalance: increment(amount),
        updatedAt: new Date().toISOString()
      });
    }

    await batch.commit();

    await logChange(
      tenantId,
      user.name,
      'CREATE',
      'accountTransactions',
      transactionRef.id,
      `Created account transaction: ${description}`,
      undefined,
      { id: transactionRef.id, ...transaction }
    );
  }, [tenantId, user, accounts]);

  // Check if month is locked
  const isMonthLocked = useCallback((year: number, month: number): boolean => {
    return monthLocks.some(lock => lock.year === year && lock.month === month);
  }, [monthLocks]);

  // Lock a month
  const lockMonth = useCallback(async (year: number, month: number, lockedBy: string): Promise<void> => {
    if (!tenantId) throw new Error('No tenant selected');

    const lockId = `${tenantId}_${year}-${String(month + 1).padStart(2, '0')}`;
    const monthLock: MonthLock = {
      id: lockId,
      tenantId,
      year,
      month,
      lockedAt: new Date().toISOString(),
      lockedBy
    };

    await setDoc(doc(db, 'monthLocks', lockId), monthLock);
  }, [tenantId]);

  // Unlock a month - REVISED: Reverts balances and deletes month-end transactions
  const unlockMonth = useCallback(async (year: number, month: number): Promise<void> => {
    if (!tenantId || !user) throw new Error('No tenant or user selected');

    const lockId = `${tenantId}_${year}-${String(month + 1).padStart(2, '0')}`;
    const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthName = format(new Date(year, month), 'MMMM yyyy');
    
    setLoadingProcessing(true);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Find all month-end transactions for this specific month
      const monthEndTxTypes: AccountTransactionType[] = ['surplus_transfer', 'overspend_deficit', 'zero_balance'];
      const q = query(
        collection(db, 'accountTransactions'),
        where('tenantId', '==', tenantId),
        where('monthYear', '==', monthYear),
        where('type', 'in', monthEndTxTypes)
      );
      
      const txSnapshot = await getDocs(q);
      const revertedTxData: any[] = [];
      
      // 2. Revert balances and prepare to delete transactions
      txSnapshot.forEach((txDoc) => {
        const txData = txDoc.data() as AccountTransaction;
        revertedTxData.push({ id: txDoc.id, ...txData });
        
        const accountRef = doc(db, 'virtualAccounts', txData.accountId);
        
        // Revert balance: subtract the amount that was originally added
        // If it was a surplus (pos), subtract it. If deficit (neg), add it back (double negative).
        batch.update(accountRef, {
          currentBalance: increment(-txData.amount),
          updatedAt: new Date().toISOString()
        });
        
        // Queue deletion of the month-end transaction record
        batch.delete(txDoc.ref);
      });
      
      // 3. Delete the month lock record
      const lockRef = doc(db, 'monthLocks', lockId);
      const lockSnap = await getDoc(lockRef);
      const oldLockData = lockSnap.exists() ? lockSnap.data() : undefined;
      batch.delete(lockRef);
      
      // 4. Commit all changes at once
      await batch.commit();

      // 5. Log the reversal in Audit Logs
      await logChange(
        tenantId,
        user.name,
        'DELETE',
        'monthLocks/accountTransactions',
        lockId,
        `Unlocked month and reverted ${txSnapshot.size} transfers for ${monthName}`,
        { lock: oldLockData, transactions: revertedTxData },
        undefined
      );
      
    } catch (error: any) {
      console.error("Error during month unlock reversal:", error);
      throw new Error(`Failed to unlock month completely: ${error.message}`);
    } finally {
      setLoadingProcessing(false);
    }
  }, [tenantId, user]);

  // Process month-end (main function)
  const processMonthEnd = useCallback(async (
    year: number,
    month: number,
    categories: Category[],
    transactions: Transaction[],
    lockedBy: string
  ): Promise<MonthEndProcessResult> => {
    if (!tenantId) throw new Error('No tenant selected');
    
    setLoadingProcessing(true);
    
    try {
      const batch = writeBatch(db);
      const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthName = format(new Date(year, month), 'MMM yyyy');

      // 1. Get all existing month-end transactions for this month/year (idempotency check)
      const monthEndTxTypes: AccountTransactionType[] = ['surplus_transfer', 'overspend_deficit', 'zero_balance'];
      const q = query(
        collection(db, 'accountTransactions'),
        where('tenantId', '==', tenantId),
        where('monthYear', '==', monthYear),
        where('type', 'in', monthEndTxTypes)
      );
      const existingTxsSnapshot = await getDocs(q);
      const existingTxsByCategoryId = new Map<string, { id: string; data: AccountTransaction }>();
      existingTxsSnapshot.forEach(doc => {
        const tx = doc.data() as AccountTransaction;
        existingTxsByCategoryId.set(tx.categoryId, { id: doc.id, data: tx });
      });
      
      // 2. Calculate current month's spending
      const categorySpending = new Map<string, number>();
      transactions
        .filter(t => {
          try {
            const transactionDate = parseISO(t.date);
            return transactionDate.getFullYear() === year && transactionDate.getMonth() === month;
          } catch(e) { return false; }
        })
        .forEach(t => {
          const current = categorySpending.get(t.category) || 0;
          categorySpending.set(t.category, current + t.amount);
        });

      const result: MonthEndProcessResult = {
        processedCategories: [],
        totalSurplus: 0,
        transactionsCreated: 0,
        accountsCreated: 0
      };

      // 3. Process each category
      for (const category of categories) {
        if (!category.budget || category.budget <= 0) continue;

        const spent = categorySpending.get(category.name) || 0;
        const surplus = Math.round((category.budget - spent) * 100) / 100;

        // Get or create account reference
        let account = accounts.find(acc => acc.categoryId === category.id);
        let accountRef;

        if (account) {
          accountRef = doc(db, 'virtualAccounts', account.id);
        } else {
          // Account doesn't exist, create it within the batch
          accountRef = doc(collection(db, 'virtualAccounts'));
          const newAccountData: Omit<VirtualAccount, 'id'> = {
            categoryId: category.id,
            categoryName: category.name,
            tenantId,
            currentBalance: 0, // Will be adjusted by increment
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          batch.set(accountRef, newAccountData);
          account = { id: accountRef.id, ...newAccountData }; // for use later
          result.accountsCreated++;
        }
        
        const oldTx = existingTxsByCategoryId.get(category.id);
        const oldSurplus = oldTx ? oldTx.data.amount : 0;
        const balanceAdjustment = surplus - oldSurplus;

        // Update balance using increment
        if (balanceAdjustment !== 0) {
            batch.update(accountRef, {
                currentBalance: increment(balanceAdjustment)
            });
        }
        batch.update(accountRef, { updatedAt: new Date().toISOString() });

        // Delete old transaction if it exists
        if (oldTx) {
          batch.delete(doc(db, 'accountTransactions', oldTx.id));
        }

        // Add new transaction
        let txType: AccountTransactionType;
        let txDesc: string;
        if (surplus > 0) {
            txType = 'surplus_transfer';
            txDesc = `Month-end surplus from ${category.name} for ${monthName}`;
        } else if (surplus < 0) {
            txType = 'overspend_deficit';
            txDesc = `Month-end overspend deficit from ${category.name} for ${monthName}`;
        } else {
            txType = 'zero_balance';
            txDesc = `Month-end zero balance from ${category.name} for ${monthName}`;
        }
        
        const newTxData: Omit<AccountTransaction, 'id'> = {
            accountId: account.id,
            categoryId: category.id,
            tenantId,
            amount: surplus,
            type: txType,
            description: txDesc,
            monthYear,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        const newTxRef = doc(collection(db, 'accountTransactions'));
        batch.set(newTxRef, newTxData);

        // Update result object
        result.processedCategories.push({ categoryId: category.id, categoryName: category.name, budget: category.budget, spent, surplus, accountId: account.id });
        result.totalSurplus += surplus;
        result.transactionsCreated++;
      }

      // 4. Lock the month
      const lockId = `${tenantId}_${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLock: Omit<MonthLock, 'id'> = {
        tenantId,
        year,
        month,
        lockedAt: new Date().toISOString(),
        lockedBy
      };
      batch.set(doc(db, 'monthLocks', lockId), monthLock);

      // 5. Commit the batch
      await batch.commit();

      await logChange(
        tenantId,
        lockedBy,
        'PROCESS',
        'virtualAccounts/monthLocks',
        lockId,
        `Processed month-end for ${monthName}`,
        undefined,
        result
      );
      
      return result;
    } finally {
      setLoadingProcessing(false);
    }
  }, [tenantId, accounts]);

  // Get total balance across all accounts
  const getTotalBalance = useCallback((): number => {
    return accounts.reduce((total, account) => total + account.currentBalance, 0);
  }, [accounts]);

  // Get transactions for a specific account
  const getAccountTransactions = useCallback((accountId: string): AccountTransaction[] => {
    return accountTransactions.filter(t => t.accountId === accountId);
  }, [accountTransactions]);

  // Handle overspend withdrawal
  const handleOverspendWithdrawal = useCallback(async (
    categoryId: string,
    categoryName: string,
    overspendAmount: number,
    monthYear: string
  ): Promise<boolean> => {
    if (!tenantId) throw new Error('No tenant selected');

    // Find the account for this category
    const account = accounts.find(acc => acc.categoryId === categoryId);
    if (!account) {
      console.log(`No virtual account found for category ${categoryName}`);
      return false; // No account to withdraw from
    }

    if (account.currentBalance < overspendAmount) {
      console.log(`Insufficient balance in virtual account for ${categoryName}. Need: ${overspendAmount}, Available: ${account.currentBalance}`);
      return false; // Insufficient balance
    }

    // Create withdrawal transaction
    await addAccountTransaction(
      account.id,
      categoryId,
      -overspendAmount, // Negative amount for withdrawal
      'overspend_withdrawal',
      `Withdrawal to cover overspending in ${categoryName} for ${monthYear}`,
      monthYear
    );

    return true; // Withdrawal successful
  }, [tenantId, accounts, addAccountTransaction]);

  return {
    accounts,
    accountTransactions,
    monthLocks,
    loading,
    loadingProcessing,
    createOrGetAccount,
    addAccountTransaction,
    processMonthEnd,
    isMonthLocked,
    lockMonth,
    unlockMonth,
    getTotalBalance,
    getAccountTransactions,
    handleOverspendWithdrawal
  };
}
