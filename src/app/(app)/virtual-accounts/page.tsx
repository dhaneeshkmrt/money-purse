'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/provider';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Eye, Wallet, TrendingUp, ArrowUpDown } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { useState } from 'react';

export default function VirtualAccountsPage() {
  const { 
    virtualAccounts, 
    accountTransactions, 
    getTotalAccountBalance, 
    getAccountTransactions,
    loadingAccounts 
  } = useApp();
  
  const formatCurrency = useCurrencyFormatter();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const totalBalance = getTotalAccountBalance();

  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'surplus_transfer':
        return { label: 'Surplus Transfer', color: 'bg-green-500' };
      case 'overspend_withdrawal':
        return { label: 'Overspend Withdrawal', color: 'bg-red-500' };
      case 'overspend_deficit':
        return { label: 'Overspend Deficit', color: 'bg-red-600' };
      case 'zero_balance':
        return { label: 'Zero Balance', color: 'bg-blue-500' };
      default:
        return { label: type, color: 'bg-gray-500' };
    }
  };

  const selectedAccountTransactions = selectedAccountId 
    ? getAccountTransactions(selectedAccountId) 
    : [];

  const formatTransactionDate = (date?: string) => {
    if (!date) return 'Unknown date';

    try {
      const parsed = parseISO(date);
      return isValid(parsed) ? format(parsed, 'MMM dd, yyyy') : 'Invalid date';
    } catch {
      return 'Invalid date';
    }
  };

  if (loadingAccounts) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Virtual Accounts</h1>
            <p className="text-muted-foreground">
              Monitor your virtual bank accounts and their transactions.
            </p>
          </div>
        </div>
        <div className="flex justify-center items-center h-40">
          <div className="text-muted-foreground">Loading accounts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Virtual Accounts</h1>
          <p className="text-muted-foreground">
            Monitor your virtual bank accounts and their transactions.
          </p>
        </div>
      </div>

      {/* Total Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Account Balance
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-xs text-muted-foreground">
            Across {virtualAccounts.length} virtual accounts
          </p>
        </CardContent>
      </Card>

      {/* Accounts Overview */}
      {virtualAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Virtual Accounts Yet</h3>
            <p className="text-muted-foreground text-center">
              Virtual accounts are created automatically when you process month-end for categories with budget surplus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {virtualAccounts.map((account) => {
            const accountTxns = getAccountTransactions(account.id);
            const recentTxn = accountTxns[0]; // Most recent transaction
            
            return (
              <Card key={account.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{account.categoryName}</CardTitle>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedAccountId(account.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-primary">
                            {account.categoryName} Virtual Account
                          </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                            <div>
                              <p className="text-sm text-muted-foreground">Current Balance</p>
                              <p className={`text-2xl font-bold ${
                                account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(account.currentBalance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Total Transactions</p>
                              <p className="text-xl font-semibold">
                                {selectedAccountTransactions.length}
                              </p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-lg font-medium mb-3">Transaction History</h4>
                            {selectedAccountTransactions.length === 0 ? (
                              <p className="text-muted-foreground">No transactions yet</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedAccountTransactions.map((txn) => {
                                    const typeInfo = getTransactionTypeInfo(txn.type);
                                    return (
                                      <TableRow key={txn.id}>
                                        <TableCell>
                                          {formatTransactionDate(txn.date)}
                                        </TableCell>
                                        <TableCell>
                                          <Badge className={`${typeInfo.color} text-white`}>
                                            {typeInfo.label}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{txn.description}</TableCell>
                                        <TableCell className={`text-right font-medium ${
                                          txn.amount > 0 ? 'text-green-600' : txn.amount < 0 ? 'text-red-600' : 'text-blue-600'
                                        }`}>
                                          {txn.amount > 0 ? '+' : txn.amount === 0 ? '=' : ''}{formatCurrency(txn.amount)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Balance</span>
                      <span className={`font-semibold ${
                        account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(account.currentBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Transactions</span>
                      <span className="text-sm">
                        {accountTxns.length}
                      </span>
                    </div>
                    {recentTxn && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Most Recent</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">
                            {getTransactionTypeInfo(recentTxn.type).label}
                          </span>
                          <span className={`text-xs font-medium ${
                            recentTxn.amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {recentTxn.amount > 0 ? '+' : ''}{formatCurrency(recentTxn.amount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Transactions Across All Accounts */}
      {accountTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Recent Account Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountTransactions.slice(0, 10).map((txn) => {
                  const account = virtualAccounts.find(acc => acc.id === txn.accountId);
                  const typeInfo = getTransactionTypeInfo(txn.type);
                  
                  return (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {formatTransactionDate(txn.date)}
                      </TableCell>
                      <TableCell>{account?.categoryName || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge className={`${typeInfo.color} text-white`}>
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
