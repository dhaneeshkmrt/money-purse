'use client';
import type { ElementType } from 'react';

export type FeatureAccess = {
  balanceSheet?: boolean;
  virtualAccounts?: boolean;
  yearlyReport?: boolean;
  aiImageStudio?: boolean;
  calculators?: boolean;
  admin?: boolean;
  reminders?: boolean;
  logs?: boolean;
  borrowings?: boolean;
  insurance?: boolean;
};

export type Microcategory = {
  id: string;
  name: string;
};

export type Subcategory = {
  id: string;
  name: string;
  microcategories: Microcategory[];
};

export type Category = {
  id: string;
  name: string;
  icon: ElementType | string;
  subcategories: Subcategory[];
  tenantId: string;
  userId?: string;
  isDefault?: boolean;
  budget: number; // This now represents the budget for the currently selected month
};

export type Transaction = {
  id:string;
  date: string;
  time: string;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  microcategory?: string;
  paidBy: string;
  notes?: string;
  tenantId: string;
  userId?: string;
};

export type Settings = {
  currency: string;
  locale: string;
  tenantId: string;
  userId?: string;
  dateInputStyle?: 'popup' | 'inline';
  defaultCategory?: string;
  defaultSubcategory?: string;
  defaultMicrocategory?: string;
  defaultPaidBy?: string;
};

export type TenantMember = {
  name: string;
  email: string;
  mobileNo?: string;
  secretToken: string;
};

export type Tenant = {
  id: string;
  name: string;
  email: string;
  mobileNo?: string;
  address?: string;
  secretToken: string;
  members?: TenantMember[];
  paidByOptions?: string[];
  featureAccess?: FeatureAccess;
};

export type User = {
  name: string;
  tenantId: string;
};

export type BalanceSheetAccount = {
  categoryId: string;
  categoryName: string;
  budget: number;
  spent: number;
  balance: number;
};

export type BalanceSheetPaidBy = {
  name: string;
  amount: number;
};

export type BalanceSheet = {
  id: string; // e.g., tenantId_2024-07
  tenantId: string;
  year: number;
  month: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  accountData: BalanceSheetAccount[];
  paidByData: BalanceSheetPaidBy[];
  updatedAt: string; // ISO string
};

// Virtual Banking System Types
export type VirtualAccount = {
  id: string;
  categoryId: string;
  categoryName: string;
  tenantId: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountTransactionType = 'surplus_transfer' | 'overspend_withdrawal' | 'overspend_deficit' | 'zero_balance';

export type AccountTransaction = {
  id: string;
  accountId: string;
  categoryId: string;
  tenantId: string;
  amount: number; // positive for deposits, negative for withdrawals
  type: AccountTransactionType;
  description: string; // "Month-end surplus from Food for Dec 2024"
  monthYear: string; // "2024-12"
  date: string;
  createdAt: string;
};

export type MonthLock = {
  id: string; // format: tenantId_2024-12
  tenantId: string;
  year: number;
  month: number;
  lockedAt: string;
  lockedBy: string;
};

// Month-end processing result
export type MonthEndProcessResult = {
  processedCategories: {
    categoryId: string;
    categoryName: string;
    budget: number;
    spent: number;
    surplus: number;
    accountId: string;
  }[];
  totalSurplus: number;
  transactionsCreated: number;
  accountsCreated: number;
};

export type CategoryBudget = {
  budgets: { [monthKey: string]: { [categoryId: string]: number } };
};

// Reminder System Types
export type RecurrenceRule = {
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'yearly';
  // For monthly/quarterly/yearly on a specific date
  dayOfMonth?: number; // 1-31
  // Or for weekly/monthly/... on a specific weekday
  dayOfWeek?: number; // 0-6 (Sun-Sat)
  weekOfMonth?: number; // 1-4, 5 for last
};

export type Reminder = {
  id: string;
  tenantId: string;
  userId: string;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  microcategory?: string;
  paidBy: string;
  notes?: string;

  startDate: string; // ISO date string
  
  recurrence: RecurrenceRule;

  // Map of 'YYYY-MM-DD' due dates to the ID of the transaction that completed it
  completedInstances: Record<string, string>; 
};

export type ReminderInstance = {
  reminder: Reminder;
  dueDate: Date;
  isCompleted: boolean;
  transactionId?: string;
};

// Audit Log Types
export type AuditLog = {
  id: string;
  tenantId: string;
  userId: string;
  timestamp: string; // ISO string
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'PROCESS';
  collectionName: string;
  docId: string;
  description: string;
  oldData?: string; // JSON string
  newData?: string; // JSON string
};

// Borrowings System Types
export type BorrowingRelationship = 'Close Relative' | 'Relative' | 'Close Friend' | 'Friend' | 'Colleague' | 'Neighbour' | 'Other';

export type BorrowingContact = {
  id: string;
  tenantId: string;
  name: string;
  relationship: BorrowingRelationship;
  phone?: string;
  address?: string;
  notes?: string;
  job?: string;
  creditScore: number; // 300 - 900
  createdAt: string;
};

export type BorrowingType = 'Lent' | 'Borrowed';

export type BorrowingStatus = 'Active' | 'Overdue' | 'Sub-Standard' | 'NPA' | 'Written Off' | 'Settled';

export type Borrowing = {
  id: string;
  tenantId: string;
  userId: string;
  contactId: string;
  contactName: string;
  type: BorrowingType;
  amount: number;
  balance: number;
  startDate: string;
  dueDate: string;
  notes?: string;
  isClosed: boolean;
  closedAt?: string;
  createdAt: string;
};

export type Repayment = {
  id: string;
  tenantId: string;
  borrowingId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
};

// Insurance System Types
export type InsuranceType = 'Motor' | 'Health' | 'Term' | 'Life' | 'Home' | 'Travel' | 'Other';

export type InsuranceStatus = 'Active' | 'Expiring Soon' | 'Expired';

export type Insurance = {
  id: string;
  tenantId: string;
  userId: string;
  type: InsuranceType;
  provider: string;
  policyNumber: string;
  premiumAmount: number;
  startDate: string;
  expiryDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
