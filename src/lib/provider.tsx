'use client';

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { 
  Transaction, 
  Category, 
  Subcategory, 
  Microcategory, 
  Settings, 
  Tenant, 
  User, 
  BalanceSheet, 
  VirtualAccount, 
  AccountTransaction, 
  MonthLock, 
  MonthEndProcessResult, 
  Reminder, 
  ReminderInstance, 
  AuditLog,
  BorrowingContact,
  Borrowing,
  Repayment,
  BorrowingStatus,
  BorrowingRelationship,
  Insurance,
  InsuranceType,
  InsuranceStatus,
  Note,
} from './types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ThemeProvider } from '@/components/theme-provider';
import Papa from 'papaparse';

import { useAuth } from '@/hooks/useAuth';
import { useTenants } from '@/hooks/useTenants';
import { useSettings } from '@/hooks/useSettings';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useReminders } from '@/hooks/useReminders';
import { useLogs } from '@/hooks/useLogs';
import { useBorrowings } from '@/hooks/useBorrowings';
import { useInsurance } from '@/hooks/useInsurance';
import { useNotes } from '@/hooks/useNotes';
import { generateReminderInstances } from './reminder-utils';
import { getYear, getMonth, parseISO, format, startOfMonth } from 'date-fns';

interface CategoryTransferData {
    sourceCategoryId: string;
    destinationCategoryId: string;
    amount: number;
    notes?: string;
}

// Define the shape of the context value
interface AppContextType {
  user: User | null;
  signIn: (email: string, secretToken: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  
  tenants: Tenant[];
  userTenant: Tenant | null;
  selectedTenantId: string | null;
  setSelectedTenantId: (tenantId: string | null) => void;
  addTenant: (tenant: Partial<Omit<Tenant, 'id'>>) => Promise<void>;
  editTenant: (tenantId: string, tenant: Partial<Omit<Tenant, 'id'>>) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;
  isAdminUser: boolean;
  isMainTenantUser: boolean;
  backupAllData: () => Promise<void>;
  restoreAllData: (data: any) => Promise<void>;
  
  settings: Settings;
  updateSettings: (newSettings: Partial<Omit<Settings, 'tenantId'>>) => Promise<void>;

  categories: Category[];
  addCategory: (category: Omit<Category, 'id' | 'subcategories' | 'icon' | 'tenantId' | 'userId' | 'budget'> & { icon: string; budget?: number; }) => Promise<void>;
  editCategory: (categoryId: string, category: { name?: string; icon?: string | React.ElementType; budget?: number; }) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  addSubcategory: (categoryId: string, subcategory: Omit<Subcategory, 'id' | 'microcategories'>) => Promise<void>;
  editSubcategory: (categoryId: string, subcategoryId: string, subcategory: Pick<Subcategory, 'name'>) => Promise<void>;
  deleteSubcategory: (categoryId: string, subcategoryId: string) => Promise<void>;
  addMicrocategory: (categoryId: string, subcategoryId: string, microcategory: Omit<Microcategory, 'id'>) => Promise<void>;
  editMicrocategory: (categoryId: string, subcategoryId: string, microcategoryId: string, microcategory: Pick<Microcategory, 'name'>) => Promise<void>;
  deleteMicrocategory: (categoryId: string, subcategoryId: string, microcategoryId: string) => Promise<void>;
  
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'>) => Promise<string>;
  addMultipleTransactions: (transactions: Omit<Transaction, 'id' | 'tenantId' | 'userId'>[]) => Promise<void>;
  editTransaction: (transactionId: string, transaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'>) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  
  handleCategoryTransfer: (data: CategoryTransferData) => Promise<void>;

  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  availableYears: number[];
  selectedMonthName: string;

  fetchBalanceSheet: (year: number, month: number) => Promise<BalanceSheet | null>;
  saveBalanceSheet: (year: number, month: number, data: Omit<BalanceSheet, 'id'|'year'|'month'|'tenantId'|'updatedAt'>) => Promise<BalanceSheet>;

  // Virtual Banking System
  virtualAccounts: VirtualAccount[];
  accountTransactions: AccountTransaction[];
  monthLocks: MonthLock[];
  processMonthEnd: (year: number, month: number, lockedBy: string) => Promise<MonthEndProcessResult>;
  isMonthLocked: (year: number, month: number) => boolean;
  unlockMonth: (year: number, month: number) => Promise<void>;
  getTotalAccountBalance: () => number;
  getAccountTransactions: (accountId: string) => AccountTransaction[];
  handleOverspendWithdrawal: (categoryId: string, categoryName: string, overspendAmount: number, monthYear: string) => Promise<boolean>;

  // Reminders
  reminders: Reminder[];
  reminderInstances: ReminderInstance[];
  pendingReminders: ReminderInstance[];
  completedReminders: ReminderInstance[];
  addReminder: (reminderData: Omit<Reminder, 'id' | 'tenantId' | 'userId' | 'completedInstances'>) => Promise<void>;
  editReminder: (reminderId: string, reminderData: Partial<Omit<Reminder, 'id' | 'tenantId' | 'userId'>>) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  completeReminderInstance: (reminder: Reminder, dueDate: Date, transactionId: string) => Promise<void>;
  
  // Borrowings
  borrowingContacts: BorrowingContact[];
  borrowings: Borrowing[];
  borrowingRepayments: Repayment[];
  addBorrowingContact: (data: { name: string, relationship: BorrowingRelationship, phone?: string, address?: string, notes?: string, job?: string }) => Promise<void>;
  editBorrowingContact: (id: string, data: { name: string, relationship: BorrowingRelationship, phone?: string, address?: string, notes?: string, job?: string }) => Promise<void>;
  deleteBorrowingContact: (id: string) => Promise<void>;
  addBorrowing: (data: Omit<Borrowing, 'id' | 'tenantId' | 'userId' | 'balance' | 'isClosed' | 'createdAt'>) => Promise<void>;
  editBorrowing: (id: string, data: { startDate: string, dueDate: string, notes?: string, amount?: number }) => Promise<void>;
  addRepayment: (borrowingId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deleteBorrowing: (id: string) => Promise<void>;
  getBorrowingStatus: (borrowing: Borrowing) => BorrowingStatus;

  // Insurance
  insurances: Insurance[];
  addInsurance: (data: Omit<Insurance, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editInsurance: (id: string, data: Partial<Omit<Insurance, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteInsurance: (id: string) => Promise<void>;
  getInsuranceStatus: (expiryDate: string) => InsuranceStatus;

  // Notes
  notes: Note[];
  addNote: (data: Omit<Note, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editNote: (id: string, data: Partial<Omit<Note, 'id' | 'tenantId' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleNoteItem: (noteId: string, itemId: string) => Promise<void>;
  pinNote: (id: string, pin: boolean) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  dismissNoteReminder: (id: string) => Promise<void>;
  loadingNotes: boolean;

  logs: AuditLog[];
  generateCurrentMonthCsv: () => string | null;

  loading: boolean;
  loadingAuth: boolean;
  loadingCategories: boolean;
  loadingSettings: boolean;
  loadingTenants: boolean;
  loadingTransactions: boolean;
  loadingAccounts: boolean;
  loadingProcessing: boolean;
  loadingReminders: boolean;
  loadingLogs: boolean;
  loadingBorrowings: boolean;
  loadingInsurance: boolean;
  isCopyingBudget: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, loadingAuth, signIn, signOut, signInWithGoogle } = useAuth();
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const { seedDefaultSettings } = useSettings(null, null);
  const { seedDefaultCategories } = useCategories(null, null, selectedYear, selectedMonth); 

  const tenantHook = useTenants(seedDefaultCategories, seedDefaultSettings, user);
  const { selectedTenantId } = tenantHook;

  const settingsHook = useSettings(selectedTenantId, user);
  const categoriesHook = useCategories(selectedTenantId, user, selectedYear, selectedMonth);
  const transactionsHook = useTransactions(selectedTenantId, user);
  const accountsHook = useAccounts(selectedTenantId, user);
  const remindersHook = useReminders(selectedTenantId, user);
  const logsHook = useLogs(selectedTenantId);
  const borrowingsHook = useBorrowings(selectedTenantId, user);
  const insuranceHook = useInsurance(selectedTenantId, user);
  const notesHook = useNotes(selectedTenantId, user);

  
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactionsHook.transactions.forEach((t) => {
      try {
        const transactionDate = parseISO(t.date || new Date().toISOString().split('T')[0]);
        if (!Number.isNaN(transactionDate.getTime())) {
          years.add(getYear(transactionDate));
        }
      } catch {
        // Ignore malformed dates
      }
    });

    if (!years.has(new Date().getFullYear())) {
      years.add(new Date().getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactionsHook.transactions]);

  const filteredTransactions = useMemo(() => {
    return transactionsHook.transactions.filter((t) => {
      try {
        const transactionDate = parseISO(t.date || new Date().toISOString().split('T')[0]);
        return !Number.isNaN(transactionDate.getTime()) && getYear(transactionDate) === selectedYear && getMonth(transactionDate) === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [transactionsHook.transactions, selectedYear, selectedMonth]);
  
  const selectedMonthName = useMemo(() => {
    return format(new Date(selectedYear, selectedMonth), 'MMMM');
  }, [selectedYear, selectedMonth]);

  const reminderInstances = useMemo(() => {
    if (!remindersHook.reminders) return [];
    return generateReminderInstances(remindersHook.reminders, selectedYear, selectedMonth);
  }, [remindersHook.reminders, selectedYear, selectedMonth]);
  
  const pendingReminders = useMemo(() => reminderInstances.filter(inst => !inst.isCompleted), [reminderInstances]);
  const completedReminders = useMemo(() => reminderInstances.filter(inst => inst.isCompleted), [reminderInstances]);


  const fetchBalanceSheet = useCallback(async (year: number, month: number): Promise<BalanceSheet | null> => {
    if (!selectedTenantId) return null;
    const docId = `${selectedTenantId}_${year}-${String(month + 1).padStart(2, '0')}`;
    const docRef = doc(db, 'balanceSheets', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as BalanceSheet;
    }
    return null;
  }, [selectedTenantId]);

  const saveBalanceSheet = useCallback(async (
    year: number,
    month: number,
    data: Omit<BalanceSheet, 'id'|'year'|'month'|'tenantId'|'updatedAt'>
  ): Promise<BalanceSheet> => {
    if (!selectedTenantId) throw new Error('No tenant selected');
    
    const docId = `${selectedTenantId}_${year}-${String(month + 1).padStart(2, '0')}`;
    const docRef = doc(db, 'balanceSheets', docId);

    const dataToSave: BalanceSheet = {
        ...data,
        id: docId,
        tenantId: selectedTenantId,
        year,
        month,
        updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return dataToSave;
  }, [selectedTenantId]);

  const handleCategoryTransfer = useCallback(async (data: CategoryTransferData) => {
    const { sourceCategoryId, destinationCategoryId, amount, notes } = data;
    const sourceCategory = categoriesHook.categories.find(c => c.id === sourceCategoryId);
    const destinationCategory = categoriesHook.categories.find(c => c.id === destinationCategoryId);

    if (!sourceCategory || !destinationCategory) {
        throw new Error("Source or destination category not found.");
    }
    
    const emergencyCategory = categoriesHook.categories.find(c => c.name === "Emergency");
    if (!emergencyCategory) {
        throw new Error("The 'Emergency' category is required for transfers but could not be found.");
    }

    const transferSubCategory = "Category Transfer";
    const date = format(new Date(), 'yyyy-MM-dd');
    const time = format(new Date(), 'HH:mm');
    const defaultPaidBy = tenantHook.tenants.find(t => t.id === tenantHook.selectedTenantId)?.paidByOptions?.[0] || 'N/A';

    // Transaction 1: Debit from source category
    const debitTransaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'> = {
        date,
        time,
        description: `Transfer to ${destinationCategory.name}`,
        amount: amount,
        category: sourceCategory.name,
        subcategory: transferSubCategory,
        paidBy: defaultPaidBy,
        notes,
    };

    // Transaction 2: Credit to destination category (via Emergency category)
    const creditTransaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'> = {
        date,
        time,
        description: `Transfer from ${sourceCategory.name}`,
        amount: -amount, // Negative amount to credit the destination budget
        category: destinationCategory.name,
        subcategory: transferSubCategory,
        paidBy: defaultPaidBy,
        notes,
    };
    
    await transactionsHook.addMultipleTransactions([debitTransaction, creditTransaction]);

  }, [categoriesHook.categories, tenantHook.tenants, tenantHook.selectedTenantId, transactionsHook.addMultipleTransactions]);

  // Month-end processing wrapper
  const processMonthEnd = useCallback(async (year: number, month: number, lockedBy: string): Promise<MonthEndProcessResult> => {
    return await accountsHook.processMonthEnd(
      year, 
      month, 
      categoriesHook.categories, 
      transactionsHook.transactions, 
      lockedBy
    );
  }, [accountsHook, categoriesHook.categories, transactionsHook.transactions]);

  // Helper function to check for overspending and handle withdrawal
  const checkAndHandleOverspend = useCallback(async (transaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'>) => {
    // Find the category
    const category = categoriesHook.categories.find(c => c.name === transaction.category);
    if (!category || !category.budget) return; // Skip if no budget set
    
    const transactionDate = parseISO(transaction.date);
    const year = getYear(transactionDate);
    const month = getMonth(transactionDate);
    const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    // Calculate current spending for this category in this month
    const monthTransactions = transactionsHook.transactions.filter(t => {
      const tDate = parseISO(t.date);
      return getYear(tDate) === year && 
             getMonth(tDate) === month && 
             t.category === transaction.category;
    });
    
    const currentSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const newSpent = currentSpent + transaction.amount;
    const overspend = Math.round((newSpent - category.budget) * 100) / 100;
    
    if (overspend > 0) {
      console.log(`Category ${transaction.category} overspent by ${overspend}. Attempting withdrawal...`);
      
      try {
        const withdrawalSuccessful = await accountsHook.handleOverspendWithdrawal(
          category.id,
          category.name,
          overspend,
          monthYear
        );
        
        if (withdrawalSuccessful) {
          console.log(`Successfully withdrew ${overspend} from virtual account for ${category.name}`);
        } else {
          console.log(`Could not withdraw from virtual account for ${category.name}. Insufficient balance or no account.`);
        }
      } catch (error) {
        console.error(`Error handling overspend withdrawal:`, error);
      }
    }
  }, [categoriesHook.categories, transactionsHook.transactions, accountsHook]);

  // Wrapper functions to check month locks before adding/editing transactions
  const addTransactionWithLockCheck = useCallback(async (transaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'>): Promise<string> => {
    const transactionDate = parseISO(transaction.date);
    const year = getYear(transactionDate);
    const month = getMonth(transactionDate);
    
    if (accountsHook.isMonthLocked(year, month)) {
      throw new Error(`Cannot add transaction to locked month: ${format(new Date(year, month), 'MMMM yyyy')}`);
    }
    
    // Add the transaction first
    const result = await transactionsHook.addTransaction(transaction);
    
    // Check for overspending and handle withdrawal
    await checkAndHandleOverspend(transaction);
    
    return result;
  }, [accountsHook.isMonthLocked, transactionsHook, checkAndHandleOverspend]);

  const addMultipleTransactionsWithLockCheck = useCallback(async (transactions: Omit<Transaction, 'id' | 'tenantId' | 'userId'>[]) => {
    // Check all transactions for locked months
    for (const transaction of transactions) {
      const transactionDate = parseISO(transaction.date);
      const year = getYear(transactionDate);
      const month = getMonth(transactionDate);
      
      if (accountsHook.isMonthLocked(year, month)) {
        throw new Error(`Cannot add transaction to locked month: ${format(new Date(year, month), 'MMMM yyyy')}`);
      }
    }
    
    // Add all transactions first
    const result = await transactionsHook.addMultipleTransactions(transactions);
    
    // Check for overspending for each transaction
    for (const transaction of transactions) {
      await checkAndHandleOverspend(transaction);
    }
    
    return result;
  }, [accountsHook.isMonthLocked, transactionsHook, checkAndHandleOverspend]);

  const editTransactionWithLockCheck = useCallback(async (transactionId: string, transaction: Omit<Transaction, 'id' | 'tenantId' | 'userId'>) => {
    const transactionDate = parseISO(transaction.date);
    const year = getYear(transactionDate);
    const month = getMonth(transactionDate);
    
    if (accountsHook.isMonthLocked(year, month)) {
      throw new Error(`Cannot edit transaction in locked month: ${format(new Date(year, month), 'MMMM yyyy')}`);
    }
    
    return await transactionsHook.editTransaction(transactionId, transaction);
  }, [accountsHook.isMonthLocked, transactionsHook]);

  const deleteTransactionWithLockCheck = useCallback(async (transactionId: string) => {
    // Get the transaction to check its date
    const transaction = transactionsHook.transactions.find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    const transactionDate = parseISO(transaction.date);
    const year = getYear(transactionDate);
    const month = getMonth(transactionDate);
    
    if (accountsHook.isMonthLocked(year, month)) {
      throw new Error(`Cannot delete transaction from locked month: ${format(new Date(year, month), 'MMMM yyyy')}`);
    }
    
    return await transactionsHook.deleteTransaction(transactionId);
  }, [accountsHook.isMonthLocked, transactionsHook]);

  const generateCurrentMonthCsv = useCallback((): string | null => {
    if (!tenantHook.selectedTenantId) {
        return null;
    }
    
    const selectedTenant = tenantHook.tenants.find(t => t.id === tenantHook.selectedTenantId);
    const firstPaidBy = selectedTenant?.paidByOptions?.[0] || '';
    
    const budgetData = categoriesHook.categories
        .map(cat => ({
            name: cat.name,
            budget: cat.budget || 0
        }))
        .filter(cat => cat.budget > 0)
        .map(cat => ({
            'Date': format(startOfMonth(new Date(selectedYear, selectedMonth)), 'd-MMM-yy'),
            'Cate': 'Income',
            'sub': cat.name,
            'Amount': cat.budget.toFixed(2),
            'Paid by': firstPaidBy,
            'Desc': '',
            'Notes': '',
            '': '',
            ' ': '',
        }));

    const transactionData = filteredTransactions.map(t => ({
      'Date': format(parseISO(t.date), 'd-MMM-yy'),
      'Cate': t.category,
      'sub': t.subcategory,
      'Amount': t.amount.toFixed(2),
      'Paid by': t.paidBy,
      'Desc': t.description,
      'Notes': t.notes || '',
      '': '',
      ' ': '',
    }));
    
    const dataToExport = [...budgetData, ...transactionData];

    if (dataToExport.length === 0) {
        return null;
    }

    return Papa.unparse(dataToExport, { header: false });
  }, [tenantHook.selectedTenantId, tenantHook.tenants, categoriesHook.categories, selectedYear, selectedMonth, filteredTransactions]);

  const loading = loadingAuth || tenantHook.loadingTenants || settingsHook.loadingSettings || categoriesHook.loadingCategories || transactionsHook.loadingTransactions || accountsHook.loading || logsHook.loadingLogs || borrowingsHook.loading || insuranceHook.loading || notesHook.loadingNotes;

  const contextValue = useMemo(() => ({
    user,
    signIn,
    signOut,
    signInWithGoogle,

    ...tenantHook,
    ...settingsHook,
    ...categoriesHook,
    ...transactionsHook,
    ...remindersHook,
    ...logsHook,
    
    // Borrowings
    borrowingContacts: borrowingsHook.contacts,
    borrowings: borrowingsHook.borrowings,
    borrowingRepayments: borrowingsHook.repayments,
    addBorrowingContact: borrowingsHook.addContact,
    editBorrowingContact: borrowingsHook.editContact,
    deleteBorrowingContact: borrowingsHook.deleteContact,
    addBorrowing: borrowingsHook.addBorrowing,
    editBorrowing: borrowingsHook.editBorrowing,
    addRepayment: borrowingsHook.addRepayment,
    deleteBorrowing: borrowingsHook.deleteBorrowing,
    getBorrowingStatus: borrowingsHook.getBorrowingStatus,

    // Insurance
    insurances: insuranceHook.insurances,
    addInsurance: insuranceHook.addInsurance,
    editInsurance: insuranceHook.editInsurance,
    deleteInsurance: insuranceHook.deleteInsurance,
    getInsuranceStatus: insuranceHook.getInsuranceStatus,

    // Override transaction functions with lock-checking versions
    addTransaction: addTransactionWithLockCheck,
    addMultipleTransactions: addMultipleTransactionsWithLockCheck,
    editTransaction: editTransactionWithLockCheck,
    deleteTransaction: deleteTransactionWithLockCheck,

    handleCategoryTransfer,
    filteredTransactions,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    availableYears,
    selectedMonthName,

    fetchBalanceSheet,
    saveBalanceSheet,
    generateCurrentMonthCsv,

    // Virtual Banking System
    virtualAccounts: accountsHook.accounts,
    accountTransactions: accountsHook.accountTransactions,
    monthLocks: accountsHook.monthLocks,
    processMonthEnd,
    isMonthLocked: accountsHook.isMonthLocked,
    unlockMonth: accountsHook.unlockMonth,
    getTotalAccountBalance: accountsHook.getTotalBalance,
    getAccountTransactions: accountsHook.getAccountTransactions,
    handleOverspendWithdrawal: accountsHook.handleOverspendWithdrawal,
    
    // Reminders
    reminderInstances,
    pendingReminders,
    completedReminders,

    // Notes
    notes: notesHook.notes,
    addNote: notesHook.addNote,
    editNote: notesHook.editNote,
    deleteNote: notesHook.deleteNote,
    toggleNoteItem: notesHook.toggleNoteItem,
    pinNote: notesHook.pinNote,
    archiveNote: notesHook.archiveNote,
    dismissNoteReminder: notesHook.dismissNoteReminder,
    loadingNotes: notesHook.loadingNotes,

    loading,
    loadingAuth,
    loadingCategories: categoriesHook.loadingCategories,
    loadingSettings: settingsHook.loadingSettings,
    loadingTenants: tenantHook.loadingTenants,
    loadingTransactions: transactionsHook.loadingTransactions,
    loadingAccounts: accountsHook.loading,
    loadingProcessing: accountsHook.loadingProcessing,
    loadingReminders: remindersHook.loadingReminders,
    loadingLogs: logsHook.loadingLogs,
    loadingBorrowings: borrowingsHook.loading,
    loadingInsurance: insuranceHook.loading,
    isCopyingBudget: categoriesHook.isCopyingBudget,
  }), [user, signIn, signOut, signInWithGoogle, tenantHook, settingsHook, categoriesHook, transactionsHook, accountsHook, remindersHook, logsHook, borrowingsHook, insuranceHook, notesHook, addTransactionWithLockCheck, addMultipleTransactionsWithLockCheck, editTransactionWithLockCheck, deleteTransactionWithLockCheck, handleCategoryTransfer, processMonthEnd, loading, loadingAuth, filteredTransactions, selectedYear, selectedMonth, availableYears, selectedMonthName, fetchBalanceSheet, saveBalanceSheet, generateCurrentMonthCsv, reminderInstances, pendingReminders, completedReminders]);

  return (
    <ThemeProvider>
      <AppContext.Provider value={contextValue}>
        {children}
      </AppContext.Provider>
    </ThemeProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
